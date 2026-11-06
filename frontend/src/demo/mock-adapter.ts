/**
 * The mock adapter (DESIGN_INSTRUCTIONS.md 13): one in-memory store shared by
 * both phones, scripted deterministic journeys with realistic delays, and
 * links marked as mock. It emits the same events a live adapter will, so the
 * UI never knows the difference.
 *
 * Behaviour the real system has that the mock copies (Appendix D): the ENS
 * gate refuses a paused or revoked agent before any quote; a quote is valid for
 * 15 minutes and re-quotes when it expires; a payment over the cap is refused;
 * the trap shop is rejected for its refund rate; a closed shop is not
 * considered and takes no orders; skipped renewals retry when the shop opens;
 * the customer pays no gas; an agent can never raise its own cap.
 */
import type {
  AgentRef,
  AgentState,
  DemoAdapter,
  DemoEvent,
  DemoSnapshot,
  Link,
  Money,
  Order,
  Refund,
  RefusalReason,
  Renewal,
  ShopChoice,
} from './contract';
import { decodeSchedule } from './contract';
import { seedState, type MockState } from './mock-data';
import { timing, QUOTE_VALIDITY_MS, type TimingKey } from './timing';
import { ensRecord, resetLinkCounter, whitechainTx, arkivEntity } from './links';
import {
  canRequestRefund,
  firstChargeAt,
  nextChargeAfter,
  passState,
  refundableMax,
  scheduleShort,
  scheduleText,
  startOfCityDay,
} from './rules';
import { story, productById, payingAgent, mainAgent, agentByRole, type StoryProduct } from '@/data/story';
import { add, cmp, formatMoney, toCents, usdt } from '@/lib/money';
import { DAY, formatDateTime, isoDate } from '@/lib/time';
import { copy, fill } from '@/copy';

/* ---------- clock and scheduler (replaceable in tests) ---------- */

export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const realClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
};

export interface MockOptions {
  clock?: Clock;
  /** Multiplies every delay (0 = instant, for tests). */
  speed?: number;
  /** Log every event to the console (dev). */
  debug?: boolean;
  /** Override the 15-minute quote validity (dev state switcher and tests). */
  quoteValidityMs?: number;
}

type Listener = (e: DemoEvent) => void;

interface PendingQuote {
  orderId: string;
  errandId: string;
  validUntil: number;
  timer: unknown;
}

const clone = <T>(v: T): T => structuredClone(v);

export class MockAdapter implements DemoAdapter {
  readonly mode = 'mock' as const;
  private state: MockState;
  private listeners = new Set<Listener>();
  private timers = new Set<unknown>();
  /** Bumped by reset so stale scripted steps never touch the new store. */
  private epoch = 0;
  private errandSeq = 0;
  private quotes = new Map<string, PendingQuote>();
  private readonly clock: Clock;
  private readonly speed: number;
  private readonly debug: boolean;
  private readonly quoteValidityMs: number;
  /** Recent events, for the dev log. */
  readonly history: { at: number; event: DemoEvent }[] = [];
  /** Fail the next prompt with a recoverable error (dev state switcher). */
  failNextPrompt = false;

  constructor(opts: MockOptions = {}) {
    this.clock = opts.clock ?? realClock;
    this.speed = opts.speed ?? 1;
    this.debug = opts.debug ?? false;
    this.quoteValidityMs = opts.quoteValidityMs ?? ((story.demo.quoteValidityMinutes || 15) * 60_000 || QUOTE_VALIDITY_MS);
    this.state = seedState(this.clock.now());
  }

  /* ---------- plumbing ---------- */

  async getSnapshot(): Promise<DemoSnapshot> {
    return clone({ ...this.snapshotBase(), mode: this.mode, now: this.clock.now() });
  }

  private snapshotBase(): Omit<MockState, 'nextOrderNumber'> {
    const { nextOrderNumber: _n, ...rest } = this.state;
    void _n;
    rest.agents = rest.agents.map((a) => this.withPassState(a));
    return rest;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(e: DemoEvent): void {
    const copyOfEvent = clone(e);
    this.history.push({ at: this.clock.now(), event: copyOfEvent });
    if (this.history.length > 300) this.history.shift();
    if (this.debug) console.debug('[mock]', copyOfEvent.type, copyOfEvent);
    for (const l of [...this.listeners]) {
      try {
        l(clone(copyOfEvent));
      } catch (err) {
        console.error('[mock] listener failed', err);
      }
    }
  }

  private delay(key: TimingKey | number): number {
    const ms = typeof key === 'number' ? key : timing[key];
    return Math.round(ms * this.speed);
  }

  /** Run `fn` after a delay, unless the demo was reset in between. */
  private later(key: TimingKey | number, fn: () => void): unknown {
    return this.laterUnscaled(this.delay(key), fn);
  }

  private laterUnscaled(ms: number, fn: () => void): unknown {
    const epoch = this.epoch;
    const handle = this.clock.setTimeout(() => {
      this.timers.delete(handle);
      if (epoch === this.epoch) fn();
    }, ms);
    this.timers.add(handle);
    return handle;
  }

  /** A sequence of scripted steps, each after its own delay. */
  private script(steps: [TimingKey | number, () => void | false][]): void {
    const epoch = this.epoch;
    const run = (i: number) => {
      const step = steps[i];
      if (!step || epoch !== this.epoch) return;
      this.later(step[0], () => {
        if (step[1]() === false) return;
        run(i + 1);
      });
    };
    run(0);
  }

  private now(): number {
    return this.clock.now();
  }

  /* ---------- lookups ---------- */

  private agent(ens: string): AgentState {
    const a = this.state.agents.find((x) => x.ref.ens === ens);
    if (!a) throw new Error(`Unknown agent ${ens}`);
    return a;
  }

  private agentByRole(role: string): AgentState | undefined {
    return this.state.agents.find((a) => a.ref.role === role);
  }

  private payer(): AgentState {
    return this.agent(payingAgent().ens);
  }

  private order(id: string): Order {
    const o = this.state.orders.find((x) => x.id === id);
    if (!o) throw new Error(`Unknown order ${id}`);
    return o;
  }

  private renewal(id: string): Renewal {
    const r = this.state.renewals.find((x) => x.id === id);
    if (!r) throw new Error(`Unknown renewal ${id}`);
    return r;
  }

  private withPassState(a: AgentState): AgentState {
    if (!a.pass) return a;
    return { ...a, pass: { ...a.pass, state: passState(a.pass, a.status, this.now()) } };
  }

  private ref(role: string): AgentRef {
    const a = this.agentByRole(role);
    if (a) return a.ref;
    const s = this.state.shopAgents.find((x) => x.ref.role === role);
    if (s) return s.ref;
    const fallback = agentByRole(role);
    return { ens: fallback?.ens ?? role, role, owner: story.customer.ens };
  }

  private label(role: string): string {
    return this.agentByRole(role)?.label ?? agentByRole(role)?.label ?? role;
  }

  private shopRef() {
    return { ...this.state.shop.ref };
  }

  /* ---------- emit helpers ---------- */

  private say(role: string, text: string, errandId?: string): void {
    this.emit({ type: 'agent.message', agent: this.ref(role), text, at: this.now(), errandId });
  }

  private status(role: string, status: 'thinking' | 'checked' | 'quoted' | 'paid' | 'refused' | 'idle', errandId?: string, reason?: string, links?: Link[]): void {
    this.emit({ type: 'agent.status', agent: this.ref(role), status, reason, errandId, links });
  }

  private orderUpdated(o: Order): void {
    this.emit({ type: 'order.updated', order: o });
  }

  private agentChanged(a: AgentState, change: 'paused' | 'resumed' | 'revoked', links: Link[]): void {
    this.emit({ type: 'agent.permission', agent: a.ref, change, links });
  }

  private refused(reason: RefusalReason, opts: { orderId?: string; agent?: AgentState; attempted?: Money; renewalId?: string; errandId?: string; links?: Link[] }): void {
    const links = opts.links ?? (opts.agent && (reason === 'paused' || reason === 'revoked') ? [ensRecord(opts.agent.ref.ens)] : []);
    if (opts.agent) {
      opts.agent.refusedAttempts.push({
        id: `ra-${this.now()}-${opts.agent.refusedAttempts.length}`,
        kind: 'payment',
        reason,
        attempted: opts.attempted,
        at: this.now(),
        links,
      });
    }
    this.emit({
      type: 'payment.refused',
      orderId: opts.orderId,
      reason,
      links,
      agent: opts.agent?.ref,
      attempted: opts.attempted,
      renewalId: opts.renewalId,
      errandId: opts.errandId,
    });
  }

  /* ---------- orders ---------- */

  private newOrder(product: StoryProduct, kind: Order['kind'], renewalId?: string): Order {
    const payer = this.payer();
    const rep = story.buyerReputation;
    const prior = this.state.orders.filter((o) => o.owner.ens === story.customer.ens && o.status !== 'ordered').length;
    const refunds = this.state.orders
      .filter((o) => o.owner.ens === story.customer.ens)
      .reduce((n, o) => n + o.refunds.filter((r) => r.status === 'refunded').length, 0);
    const o: Order = {
      id: `ord-${this.state.nextOrderNumber}`,
      number: String(this.state.nextOrderNumber++),
      kind,
      renewalId,
      shop: this.shopRef(),
      items: [{ name: product.name, qty: 1, price: usdt(product.priceUsdt), productId: product.id }],
      total: usdt(product.priceUsdt),
      status: 'ordered',
      createdAt: this.now(),
      buyer: payer.ref,
      owner: { ...this.state.customer },
      reputation: { orders: rep.orders + prior, refunds: rep.refunds + refunds, since: rep.since },
      risk: refunds > 2 ? { level: 'warn', text: copy.mockRisk.manyRefunds } : { level: 'safe', text: rep.riskVerdict },
      links: [],
      refunds: [],
      isNew: true,
      synthetic: false,
    };
    this.state.orders.push(o);
    return o;
  }

  /** The ENS gate and cap check the facilitator runs before any quote or charge. */
  private gate(agent: AgentState, amount: Money): RefusalReason | null {
    if (agent.status === 'revoked') return 'revoked';
    if (agent.status === 'paused') return 'paused';
    if (!agent.pass) return 'cap';
    const st = passState(agent.pass, agent.status, this.now());
    if (st === 'expired') return 'budget';
    if (toCents(add(agent.pass.used, amount)) > toCents(agent.pass.cap)) return 'cap';
    return null;
  }

  /* ---------- customer: ask and pay ---------- */

  async sendPrompt(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;
    const errandId = `e${++this.errandSeq}`;
    if (this.failNextPrompt) {
      this.failNextPrompt = false;
      this.later('handoff', () => this.emit({ type: 'error', message: copy.mock.errorRetry, recoverable: true, retry: 'sendPrompt', errandId }));
      return;
    }
    const quick = story.quickPrompts.find((q) => q.text.toLowerCase() === trimmed.toLowerCase());
    const wantsReorder = quick?.kind === 'reorder' || /\b(re-?order|usual|again)\b/i.test(trimmed);
    const product = productById(quick?.productId) ?? this.guessProduct(trimmed);
    this.state.errandRunning = true;
    if (wantsReorder) this.runReorderErrand(product, errandId);
    else this.runAskErrand(product, errandId);
  }

  private guessProduct(text: string): StoryProduct {
    const t = text.toLowerCase();
    const hit = story.products.find((p) => p.name.toLowerCase().split(/[ ,]+/).filter((w) => w.length > 3).some((w) => t.includes(w)));
    return hit ?? story.products[0]!;
  }

  private finishErrand(): void {
    this.state.errandRunning = false;
  }

  private runAskErrand(product: StoryProduct, errandId: string): void {
    const concierge = mainAgent().role;
    const scout = 'scout';
    const analyst = 'analyst';
    const payerRole = payingAgent().role;
    const area = this.state.shop.area;
    const shopName = this.state.shop.ref.name;
    // Shops are compared when the scout reads the graph, so the open flag is current.
    let choices: ShopChoice[] = [];

    this.script([
      [0, () => this.status(concierge, 'thinking', errandId)],
      ['conciergeThink', () => {
        this.say(concierge, fill(copy.customer.script.conciergeStart, { scout: this.label(scout), area }), errandId);
        this.status(concierge, 'checked', errandId);
        this.status(scout, 'thinking', errandId);
      }],
      ['scoutThink', () => {
        choices = this.compareShops(product);
        this.emit({
          type: 'graph.read',
          question: fill(copy.mockGraph.question, { product: product.name, area }),
          reads: 2,
          ms: 180,
          links: [arkivEntity(`graph-${errandId}`)],
          errandId,
        });
      }],
      ['graphRead', () => {
        this.say(scout, fill(copy.customer.script.scoutFound, { count: choices.length }), errandId);
        this.status(scout, 'checked', errandId);
        this.status(analyst, 'thinking', errandId);
      }],
      ['analystThink', () => {
        choices = this.compareShops(product);
        const open = choices.filter((c) => c.verdict !== 'rejected');
        const chosen = choices.find((c) => c.verdict === 'chosen');
        const trap = choices.find((c) => c.verdict === 'rejected');
        this.emit({ type: 'shops.compared', errandId, choices });
        if (trap) {
          this.status(analyst, 'refused', errandId, trap.reason);
          this.say(analyst, fill(copy.customer.script.analystTrap, { trap: trap.shop.name, reason: trap.reason ?? '' }), errandId);
        }
        if (!chosen) {
          // Our shop is closed (or nothing fits): say so instead of quoting.
          this.status(analyst, 'refused', errandId, copy.refusal.shop_closed);
          this.say(concierge, open.length ? copy.customer.script.noneOpen : fill(copy.customer.desk.shopClosed, { shop: shopName }), errandId);
          this.say(concierge, copy.customer.desk.shopClosedFollowUp, errandId);
          this.emit({ type: 'payment.refused', reason: 'shop_closed', links: [], errandId });
          this.status(concierge, 'idle', errandId);
          this.finishErrand();
          return false;
        }
        this.say(analyst, fill(copy.customer.script.analystPick, { shop: chosen.shop.name, paid: chosen.paidOrders.toLocaleString('en-IN'), refunds: chosen.refundRate }), errandId);
        this.status(analyst, 'checked', errandId);
        return undefined;
      }],
      ['riskCheck', () => {
        // The shop's risk agent checks the buyer back before quoting; the analyst reports it.
        this.say(analyst, fill(copy.customer.script.riskCheck, { shop: shopName }), errandId);
        this.status(payerRole, 'thinking', errandId);
      }],
      ['payerThink', () => this.quoteAndPay(product, errandId, 'order')],
    ]);
  }

  private runReorderErrand(product: StoryProduct, errandId: string, fromOrder?: Order): void {
    const concierge = mainAgent().role;
    const payerRole = payingAgent().role;
    const shopName = this.state.shop.ref.name;
    this.script([
      [0, () => this.status(concierge, 'thinking', errandId)],
      ['conciergeThink', () => {
        if (!this.state.shop.open) {
          this.status(concierge, 'refused', errandId, copy.refusal.shop_closed);
          this.say(concierge, fill(copy.customer.desk.shopClosed, { shop: shopName }), errandId);
          this.say(concierge, copy.customer.desk.shopClosedFollowUp, errandId);
          this.emit({ type: 'payment.refused', reason: 'shop_closed', links: [], errandId, orderId: fromOrder?.id });
          this.status(concierge, 'idle', errandId);
          this.finishErrand();
          return false;
        }
        this.say(concierge, fill(copy.customer.script.reorderStart, { shop: shopName }), errandId);
        this.status(concierge, 'checked', errandId);
        this.status(payerRole, 'thinking', errandId);
        return undefined;
      }],
      ['payerThink', () => this.quoteAndPay(product, errandId, 'order')],
    ]);
  }

  /** C2: the shops the agents compared, from the story data and the open flag. */
  private compareShops(product: StoryProduct): ShopChoice[] {
    const ourShop = this.state.shop;
    const list = story.shops
      .map((s) => {
        const isOurs = s.ens === ourShop.ref.ens;
        const open = isOurs ? ourShop.open : s.open;
        return { s, open, isOurs };
      })
      // Closed shops are not considered or listed (C2).
      .filter((x) => x.open);
    const price = (s: (typeof story.shops)[number]) => (s.ens === product.shop ? usdt(product.priceUsdt) : usdt(s.priceUsdt));
    return list.map(({ s, isOurs }) => {
      const verdict: ShopChoice['verdict'] = s.storyRole === 'trap' ? 'rejected' : isOurs ? 'chosen' : 'considered';
      return {
        shop: { ens: s.ens, name: s.name },
        price: price(s),
        distanceKm: s.distanceKm,
        paidOrders: s.paidOrders,
        refundRate: s.refundRate,
        repeatBuyers: s.repeatBuyers,
        verdict,
        reason: s.storyRole === 'trap' ? s.rejectedBecause : undefined,
      };
    });
  }

  /** Quote from the shop, the gate, the payer's signature, settlement. */
  private quoteAndPay(product: StoryProduct, errandId: string, kind: Order['kind']): void {
    const payer = this.payer();
    const payerRole = payer.ref.role;
    const amount = usdt(product.priceUsdt);
    if (!this.state.shop.open) {
      this.status(payerRole, 'refused', errandId, copy.refusal.shop_closed);
      this.say(payerRole, fill(copy.customer.script.payerRefused, { reason: copy.refusal.shop_closed.toLowerCase() }), errandId);
      this.refused('shop_closed', { errandId, agent: payer, attempted: amount });
      this.finishErrand();
      return;
    }
    // The ENS gate refuses a paused or revoked agent before any quote.
    const early = payer.status === 'active' ? null : this.gate(payer, amount);
    if (early) {
      this.status(payerRole, 'refused', errandId, copy.refusal[early]);
      this.say(payerRole, fill(copy.customer.script.payerRefused, { reason: copy.refusal[early].toLowerCase() }), errandId);
      this.refused(early, { errandId, agent: payer, attempted: amount });
      this.status(mainAgent().role, 'idle', errandId);
      this.finishErrand();
      return;
    }
    const order = this.newOrder(product, kind);
    this.issueQuote(order, errandId);
    this.status(payerRole, 'quoted', errandId);
    this.script([
      ['sign', () => {
        if (!this.stillQuotable(order, errandId)) return false;
        const reason = this.gate(payer, order.total);
        if (reason) {
          this.dropQuote(order.id);
          this.status(payerRole, 'refused', errandId, copy.refusal[reason]);
          this.say(payerRole, fill(copy.customer.script.payerRefused, { reason: copy.refusal[reason].toLowerCase() }), errandId);
          this.refused(reason, { orderId: order.id, errandId, agent: payer, attempted: order.total });
          this.removeOrder(order.id);
          this.finishErrand();
          return false;
        }
        this.say(payerRole, fill(copy.customer.script.payerPaying, { shop: order.shop.name, amount: formatMoney(order.total) }), errandId);
        this.emit({ type: 'payment.signed', orderId: order.id });
        return undefined;
      }],
      ['settle', () => {
        if (!this.stillQuotable(order, errandId)) return false;
        this.dropQuote(order.id);
        this.settle(order);
        this.status(payerRole, 'paid', errandId);
        this.say(payerRole, fill(copy.customer.script.payerPaid, { shop: order.shop.name }), errandId);
        this.status(mainAgent().role, 'idle', errandId);
        this.finishErrand();
        return undefined;
      }],
    ]);
  }

  private issueQuote(order: Order, errandId: string): void {
    const validMs = this.quoteValidityMs;
    const validUntil = this.now() + validMs;
    const prev = this.quotes.get(order.id);
    if (prev) {
      this.clock.clearTimeout(prev.timer);
      this.timers.delete(prev.timer);
    }
    // A quote that expires re-quotes by itself (C3); it is never a failure.
    // Not scaled by `speed`: validity is wall-clock time shown in the countdown.
    const timer = this.laterUnscaled(validMs, () => {
      if (this.quotes.has(order.id) && order.status === 'ordered') this.issueQuote(order, errandId);
    });
    this.quotes.set(order.id, { orderId: order.id, errandId, validUntil, timer });
    this.emit({
      type: 'quote.created',
      orderId: order.id,
      shop: order.shop,
      items: order.items.map((i) => ({ name: i.name, qty: i.qty, price: i.price })),
      total: order.total,
      validUntil,
      errandId,
    });
    this.emit({ type: 'arkiv.write', kind: 'quote', links: [arkivEntity(`quote-${order.id}`)] });
  }

  private dropQuote(orderId: string): void {
    const q = this.quotes.get(orderId);
    if (q) {
      this.clock.clearTimeout(q.timer);
      this.timers.delete(q.timer);
    }
    this.quotes.delete(orderId);
  }

  /** The shop may close while a quote is open: the quote is withdrawn (C3). */
  private stillQuotable(order: Order, errandId: string): boolean {
    if (!this.quotes.has(order.id)) return false;
    if (this.state.shop.open) return true;
    const payer = this.payer();
    this.dropQuote(order.id);
    this.status(payer.ref.role, 'refused', errandId, copy.refusal.shop_closed);
    this.say(payer.ref.role, fill(copy.customer.script.payerRefused, { reason: copy.refusal.shop_closed.toLowerCase() }), errandId);
    this.refused('shop_closed', { orderId: order.id, errandId, agent: payer, attempted: order.total });
    this.removeOrder(order.id);
    this.finishErrand();
    return false;
  }

  private removeOrder(id: string): void {
    this.state.orders = this.state.orders.filter((o) => o.id !== id);
  }

  /** Settlement on Whitechain: pass usage, links, merchant notification. */
  private settle(order: Order): void {
    const payer = this.agent(order.buyer.ens);
    if (payer.pass) payer.pass.used = add(payer.pass.used, order.total);
    const links = [whitechainTx(`pay-${order.id}`)];
    order.status = 'paid';
    order.paidAt = this.now();
    order.links = links;
    order.isNew = true;
    this.emit({ type: 'payment.settled', orderId: order.id, total: order.total, links });
    this.emit({ type: 'arkiv.write', kind: 'payment', links: [arkivEntity(`pay-${order.id}`)] });
    this.orderUpdated(order);
    this.emit({ type: 'merchant.notification', kind: order.kind === 'renewal' ? 'renewal' : 'new_order', orderId: order.id });
  }

  async reorder(orderId: string): Promise<void> {
    const prev = this.order(orderId);
    const product = productById(prev.items[0]?.productId) ?? story.products[0]!;
    const errandId = `e${++this.errandSeq}`;
    this.state.errandRunning = true;
    this.runReorderErrand(product, errandId, prev);
  }

  /* ---------- customer: refunds ---------- */

  async requestRefund(orderId: string, input: { amount: Money; reason: string; photo?: File }): Promise<void> {
    const o = this.order(orderId);
    const ok = canRequestRefund(o);
    if (!ok.ok) throw new Error(`Refund not possible: ${ok.why}`);
    const max = refundableMax(o);
    if (toCents(input.amount) <= 0 || cmp(input.amount, max) > 0) throw new Error('Refund amount out of range');
    if (!input.reason.trim()) throw new Error('A reason is required');
    const photoUrl = input.photo && typeof URL !== 'undefined' && 'createObjectURL' in URL ? URL.createObjectURL(input.photo) : undefined;
    const refund: Refund = {
      id: `rf-${o.id}-${o.refunds.length + 1}`,
      amount: usdt(input.amount.amount),
      full: cmp(input.amount, max) === 0 && o.refunds.length === 0,
      reason: input.reason.trim(),
      photoUrl,
      photoName: input.photo?.name,
      status: 'requested',
      requestedAt: this.now(),
      links: [],
    };
    this.later('refundRequest', () => {
      o.refunds.push(refund);
      this.emit({ type: 'refund.requested', orderId: o.id, amount: refund.amount, reason: refund.reason, photoUrl });
      this.orderUpdated(o);
      this.emit({ type: 'merchant.notification', kind: 'refund_request', orderId: o.id });
    });
  }

  /* ---------- customer: renewals ---------- */

  async startRenewal(orderId: string, schedule: string): Promise<void> {
    const o = this.order(orderId);
    const s = decodeSchedule(schedule) ?? { frequency: 'weekly' as const, weekday: 0, startDate: isoDate(this.now()) };
    const product = productById(o.items[0]?.productId);
    const payer = this.payer();
    const renewal: Renewal = {
      id: `rn-${o.id}-${this.state.renewals.length + 1}`,
      sourceOrderId: o.id,
      item: product?.short ?? o.items.map((i) => `${i.name} × ${i.qty}`).join(', '),
      productId: product?.id,
      shop: o.shop,
      schedule: s,
      scheduleText: scheduleText(s),
      scheduleShort: scheduleShort(s),
      nextChargeAt: firstChargeAt(s),
      amount: o.total,
      status: 'active',
      payingAgent: payer.ref,
      owner: { ...this.state.customer },
      charges: [],
      createdAt: this.now(),
      synthetic: false,
    };
    this.later('renewalCreate', () => {
      this.state.renewals.push(renewal);
      this.emit({ type: 'renewal.created', renewal, links: [arkivEntity(`renewal-${renewal.id}`)] });
      this.emit({ type: 'arkiv.write', kind: 'renewal', links: [arkivEntity(`renewal-${renewal.id}`)] });
      this.emit({ type: 'merchant.notification', kind: 'renewal', orderId: o.id });
    });
  }

  async cancelRenewal(renewalId: string): Promise<void> {
    const r = this.renewal(renewalId);
    if (r.status === 'cancelled') return;
    this.later('handoff', () => {
      r.status = 'cancelled';
      r.nextChargeAt = null;
      r.skippedReason = undefined;
      this.emit({ type: 'renewal.cancelled', renewal: r, links: [arkivEntity(`renewal-cancel-${r.id}`)] });
    });
  }

  /** Demo control: charge the next due renewal of this customer now. */
  async runNextRenewal(): Promise<void> {
    const due = this.state.renewals
      .filter((r) => r.status !== 'cancelled' && r.owner.ens === this.state.customer.ens)
      .sort((a, b) => (a.nextChargeAt ?? Infinity) - (b.nextChargeAt ?? Infinity))[0];
    const r = due ?? this.state.renewals.filter((x) => x.status !== 'cancelled').sort((a, b) => (a.nextChargeAt ?? Infinity) - (b.nextChargeAt ?? Infinity))[0];
    if (!r) {
      this.emit({ type: 'error', message: copy.mockRenewal.none, recoverable: false });
      return;
    }
    this.later('renewalCharge', () => { this.advancePassForRenewal(r); this.chargeRenewal(r); });
  }

  /** The demo control brings a future scheduled charge forward with its new daily pass period. */
  private advancePassForRenewal(r: Renewal): void {
    const agent = this.state.agents.find((candidate) => candidate.ref.ens === r.payingAgent.ens);
    if (!agent?.pass || !r.nextChargeAt || r.nextChargeAt < agent.pass.expiresAt) return;
    agent.pass.used = usdt('0');
    agent.pass.expiresAt = startOfCityDay(r.nextChargeAt) + DAY;
    this.emit({ type: 'agent.pass.period', agent: agent.ref, used: agent.pass.used, expiresAt: agent.pass.expiresAt });
  }

  private chargeRenewal(r: Renewal): void {
    if (r.status === 'cancelled') return;
    const agent = this.state.agents.find((a) => a.ref.ens === r.payingAgent.ens);
    if (!this.state.shop.open) {
      // Skipped while closed; it retries when the shop opens.
      r.status = 'skipped';
      r.skippedReason = 'shop_closed';
      if (agent) this.refused('shop_closed', { agent, attempted: r.amount, renewalId: r.id });
      else this.emit({ type: 'payment.refused', reason: 'shop_closed', links: [], renewalId: r.id, attempted: r.amount });
      this.emit({ type: 'renewal.charged', renewal: r, links: [] });
      return;
    }
    if (agent) {
      const reason = this.gate(agent, r.amount);
      if (reason) {
        this.refused(reason, { agent, attempted: r.amount, renewalId: r.id });
        return;
      }
    }
    const product = productById(r.productId) ?? story.products[0]!;
    const order = this.newOrder(product, 'renewal', r.id);
    if (agent) order.buyer = agent.ref;
    else {
      order.buyer = r.payingAgent;
      order.owner = { ...r.owner };
    }
    this.settleRenewalOrder(order, r);
  }

  private settleRenewalOrder(order: Order, r: Renewal): void {
    const agent = this.state.agents.find((a) => a.ref.ens === order.buyer.ens);
    if (agent?.pass) agent.pass.used = add(agent.pass.used, order.total);
    const links = [whitechainTx(`renewal-${order.id}`)];
    order.status = 'paid';
    order.paidAt = this.now();
    order.links = links;
    const chargedAt = this.now();
    r.charges.push({ at: chargedAt, orderId: order.id, amount: order.total, links });
    r.status = 'charged';
    r.skippedReason = undefined;
    r.nextChargeAt = nextChargeAfter(r.schedule, Math.max(chargedAt, r.nextChargeAt ?? chargedAt));
    this.emit({ type: 'payment.settled', orderId: order.id, total: order.total, links });
    this.orderUpdated(order);
    this.emit({ type: 'renewal.charged', renewal: r, links });
    this.emit({ type: 'arkiv.write', kind: 'payment', links: [arkivEntity(`renewal-pay-${order.id}`)] });
    this.emit({ type: 'merchant.notification', kind: 'renewal', orderId: order.id });
  }

  /* ---------- customer: agents and the pass ---------- */

  async pauseAgent(ens: string): Promise<void> {
    const a = this.agent(ens);
    if (a.status !== 'active') return;
    this.later('ensWrite', () => {
      a.status = 'paused';
      this.agentChanged(this.withPassState(a), 'paused', [ensRecord(a.ref.ens)]);
    });
  }

  async resumeAgent(ens: string): Promise<void> {
    const a = this.agent(ens);
    if (a.status !== 'paused') return;
    this.later('ensWrite', () => {
      a.status = 'active';
      this.agentChanged(this.withPassState(a), 'resumed', [ensRecord(a.ref.ens)]);
    });
  }

  async revokeAgent(ens: string): Promise<void> {
    const a = this.agent(ens);
    if (a.status === 'revoked') return;
    this.later('ensWrite', () => {
      a.status = 'revoked';
      this.agentChanged(this.withPassState(a), 'revoked', [ensRecord(a.ref.ens)]);
    });
  }

  /** The agent tries to raise its own cap: always refused, only the owner can. */
  async tryRaiseCap(ens: string, newCap: Money): Promise<void> {
    const a = this.agent(ens);
    this.later('capRefusal', () => {
      const links = [ensRecord(a.ref.ens)];
      a.refusedAttempts.push({ id: `ra-${this.now()}-cap`, kind: 'cap_change', reason: 'cap_change', attempted: newCap, at: this.now(), links });
      this.emit({ type: 'cap.change.refused', agent: a.ref, attempted: newCap, links });
    });
  }

  /** PROPOSED (mock only): the owner changes a cap. */
  async setCap(ens: string, cap: Money): Promise<void> {
    const a = this.agent(ens);
    if (!a.pass || a.status === 'revoked') throw new Error('This agent has no pass to change');
    if (toCents(cap) <= 0) throw new Error('A cap must be more than 0.00');
    this.later('ensWrite', () => {
      if (!a.pass) return;
      a.pass.cap = usdt(cap.amount);
      this.emit({ type: 'agent.cap.changed', agent: a.ref, cap: a.pass.cap, links: [ensRecord(a.ref.ens)] });
    });
  }

  /* ---------- merchant ---------- */

  async setShopOpen(open: boolean): Promise<void> {
    if (this.state.shop.open === open) return;
    this.later('shopToggle', () => {
      this.state.shop.open = open;
      this.emit({ type: 'shop.status', open });
      if (open) this.retrySkippedRenewals();
    });
  }

  private retrySkippedRenewals(): void {
    const skipped = this.state.renewals.filter((r) => r.status === 'skipped');
    skipped.forEach((r, i) => this.later(timing.renewalRetryGap * (i + 1), () => this.chargeRenewal(r)));
  }

  async dispatch(orderId: string): Promise<void> {
    const o = this.order(orderId);
    if (o.status !== 'paid') return;
    this.later('dispatch', () => {
      o.status = 'dispatched';
      o.dispatchedAt = this.now();
      o.isNew = false;
      this.orderUpdated(o);
      this.later('deliveredAfter', () => {
        if (o.status !== 'dispatched') return;
        o.status = 'delivered';
        o.deliveredAt = this.now();
        this.orderUpdated(o);
      });
    });
  }

  async markOrderSeen(orderId: string): Promise<void> {
    const o = this.order(orderId);
    if (!o.isNew) return;
    o.isNew = false;
    this.orderUpdated(o);
  }

  async approveRefund(orderId: string, amount: Money): Promise<void> {
    const o = this.order(orderId);
    const max = refundableMax(o);
    if (toCents(amount) <= 0 || cmp(amount, max) > 0) throw new Error('Refund amount out of range');
    let refund = o.refunds.find((r) => r.status === 'requested');
    this.later('refundAccept', () => {
      if (!refund) {
        // The merchant refunds without a customer request (M4 from M3).
        refund = {
          id: `rf-${o.id}-${o.refunds.length + 1}`,
          amount: usdt(amount.amount),
          full: cmp(amount, max) === 0,
          reason: copy.mockRefund.shopInitiated,
          status: 'accepted',
          requestedAt: this.now(),
          links: [],
        };
        o.refunds.push(refund);
      }
      refund.amount = usdt(amount.amount);
      refund.status = 'accepted';
      refund.decidedAt = this.now();
      this.orderUpdated(o);
      this.later('refundSettle', () => {
        if (!refund) return;
        const links = [whitechainTx(`refund-${refund.id}`)];
        refund.status = 'refunded';
        refund.settledAt = this.now();
        refund.links = links;
        this.emit({ type: 'refund.settled', orderId: o.id, amount: refund.amount, links });
        this.emit({ type: 'arkiv.write', kind: 'refund', links: [arkivEntity(`refund-${refund.id}`)] });
        this.orderUpdated(o);
      });
    });
  }

  async declineRefund(orderId: string, note: string): Promise<void> {
    const o = this.order(orderId);
    const refund = o.refunds.find((r) => r.status === 'requested');
    if (!refund) throw new Error('No refund request to decline');
    if (!note.trim()) throw new Error('A note is required');
    this.later('refundDecline', () => {
      refund.status = 'declined';
      refund.note = note.trim();
      refund.decidedAt = this.now();
      this.orderUpdated(o);
    });
  }

  async exportCsv(range: { from: string; to: string }): Promise<Blob> {
    const rows = this.csvRows(range);
    const head = ['date', 'type', 'order', 'buyer_ens', 'amount_usdt', 'status', 'transaction_link', 'link_is_mock'];
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const body = rows.map((r) => r.map((v) => esc(String(v))).join(','));
    const csv = [head.join(','), ...body].join('\r\n') + '\r\n';
    await new Promise((res) => this.later('exportBuild', () => res(undefined)));
    return new Blob([csv], { type: 'text/csv;charset=utf-8' });
  }

  /** Payments and refunds settled in the range, both ends inclusive (city dates). */
  csvRows(range: { from: string; to: string }): string[][] {
    const out: { at: number; row: string[] }[] = [];
    for (const o of this.state.orders) {
      if (o.shop.ens !== this.state.shop.ref.ens) continue;
      if (o.paidAt && inRange(o.paidAt, range)) {
        const link = o.links[0];
        out.push({ at: o.paidAt, row: [formatDateTime(o.paidAt), 'Order', o.number, o.buyer.ens, o.total.amount, o.status, link?.url ?? '', String(Boolean(link?.mock))] });
      }
      for (const r of o.refunds) {
        if (r.status === 'refunded' && r.settledAt && inRange(r.settledAt, range)) {
          const link = r.links[0];
          out.push({ at: r.settledAt, row: [formatDateTime(r.settledAt), 'Refund', o.number, o.buyer.ens, `-${r.amount.amount}`, 'refunded', link?.url ?? '', String(Boolean(link?.mock))] });
        }
      }
    }
    return out.sort((a, b) => b.at - a.at).map((x) => x.row);
  }

  /* ---------- demo ---------- */

  async resetDemo(): Promise<void> {
    this.epoch++;
    for (const t of this.timers) this.clock.clearTimeout(t);
    this.timers.clear();
    for (const q of this.quotes.values()) this.clock.clearTimeout(q.timer);
    this.quotes.clear();
    resetLinkCounter();
    this.state = seedState(this.now());
    this.failNextPrompt = false;
    this.emit({ type: 'demo.reset' });
  }

  /** Dev only: how many scripted steps are waiting. */
  get pendingSteps(): number {
    return this.timers.size;
  }
}

function inRange(ms: number, range: { from: string; to: string }): boolean {
  const d = isoDate(ms);
  return d >= range.from && d <= range.to;
}

export { startOfCityDay };
