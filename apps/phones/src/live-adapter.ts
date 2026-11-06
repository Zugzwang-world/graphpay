// The live adapter: the team's DemoAdapter contract served by our back end on the same
// origin. Phase 1 reads only: the customer's agent and pass (`/api/state/customer`), the
// shop's open flag (`/api/map`), the shop's orders (`/api/merchant/export.csv`, then the
// `/api/merchant/events` stream). Spending actions arrive in the next phases; until then
// they answer with an error event and change nothing.

import type { AgentRef, AgentState, DemoAdapter, DemoEvent, DemoSnapshot, Link, Money, Order } from '@/demo/contract';
import { payingAgent, story } from '@/data/story';
import { copy, fill } from '@/copy';
import { amountToMicro, foldOrders, isLive, microToAmount, rowFromEdge, rowKey, rowsFromCsv, type FoldContext, type LedgerRow } from './orders';
import { ErrandMapper, readFrames } from './errand';
import { txLink } from './links';

interface CustomerState {
  agent: { ens: string; status: 'ACTIVE' | 'PAUSED' | 'REVOKED' | 'EXPIRED' | 'UNKNOWN' };
  capMicro: string | null;
  spentTodayMicro: string | null;
  policyExpiresAt: string | null;
}

interface MapAnswer {
  shops: { ens: string; open: boolean }[];
}

// Extra fields the build's story projection passes through (apps/phones/story-projection.mjs).
type LiveProduct = (typeof story.products)[number] & { priceMicro?: string; quantity?: number; unitName?: string };

const STATE_POLL_MS = 15_000;
const MAP_POLL_MS = 30_000;
// The merchant stream reconnects after RECONNECT_MS, doubling on each failure up to RECONNECT_MAX_MS,
// with jitter, so phones behind one IP never retry in step.
const RECONNECT_MS = 1_500;
const RECONNECT_MAX_MS = 30_000;
const DAY_MS = 86_400_000;
// The Open listing lasts 15 minutes on Arkiv; the server's own renewal period (RENEW_EVERY_S).
const RENEW_OPEN_MS = 300_000;

// The routes' refusal codes in words (the code itself when it is not listed).
const REFUSALS: Record<string, string> = {
  NOT_THIS_ORDER: 'Only the latest order can be refunded from here.',
  NOT_THE_STORY_BUYER: 'Only orders from the story’s buyer can be changed here.',
  TOO_SOON: 'That order was just changed. Wait half a minute.',
  OVER_REFUNDABLE: 'That is more than is left to refund.',
  NOT_REFUNDABLE: 'This order cannot be refunded.',
  NOT_DELIVERABLE: 'This order is not waiting for dispatch.',
  FLOAT_LOW: 'The shop’s refund float is too low.',
  STILL_PENDING: 'The last transaction for this order is still on its way.',
  NO_ORDER: 'There is no order to re-order yet.',
};
const refusalText = (code: string): string => REFUSALS[code] ?? code;

function sepoliaLink(tx: string): Link {
  return { label: fill(copy.common.viewOnEns, { chain: story.explorers.ensLabel }), url: `${story.explorers.ens.replace(/\/+$/, '')}/tx/${tx}` };
}

const usdt = (micro: string | bigint): Money => ({ amount: microToAmount(BigInt(micro)), currency: 'USDT' });

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { cache: 'no-store' });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

async function getText(path: string): Promise<string | null> {
  try {
    const res = await fetch(path, { cache: 'no-store' });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}


// The phones' three agent states. A name the server could not read never shows as active.
function statusOf(s: CustomerState['agent']['status'] | undefined): AgentState['status'] {
  if (s === 'ACTIVE' || s === 'EXPIRED') return 'active';
  if (s === 'REVOKED') return 'revoked';
  return 'paused';
}

// The pass period ends at the contract's day boundary (UTC midnight), or earlier at the policy's expiry.
function periodEnd(state: CustomerState | null, now: number): number {
  const day = (Math.floor(now / DAY_MS) + 1) * DAY_MS;
  const expiry = state?.policyExpiresAt ? Number(state.policyExpiresAt) * 1000 : null;
  if (state?.agent.status === 'EXPIRED') return now;
  return expiry !== null && Number.isFinite(expiry) && expiry < day ? expiry : day;
}

// The /live page's explainer follows the errand from these frames (apps/web/components/live-run-bridge.tsx).
const RUN_FRAME = 'graphpay.run-frame';
function postToStage(event: string, data: string): void {
  if (window.parent === window) return;
  window.parent.postMessage({ type: RUN_FRAME, event, data }, window.location.origin);
}

export class LiveAdapter implements DemoAdapter {
  readonly mode = 'live' as const;
  private listeners = new Set<(e: DemoEvent) => void>();
  private rows = new Map<string, LedgerRow>();
  private seenOrders = new Set<string>();
  private knownOrders = new Set<string>();
  // The stream starts two days back: the export carries no refund requests, so the stream's first
  // answer fills them in (rows already read are skipped).
  private cursor = Math.floor(Date.now() / 1000) - 2 * 86_400;
  // Only edges from after the page opened ring the merchant's phone.
  private readonly openedAt = Math.floor(Date.now() / 1000) - 30;
  private last: { status: AgentState['status'] | null; used: string | null; open: boolean | null } = { status: null, used: null, open: null };
  private timers: ReturnType<typeof setInterval>[] = [];
  private source: EventSource | null = null;
  private reconnect: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;
  private renewOpen: ReturnType<typeof setInterval> | null = null;
  private readonly payer = payingAgent();
  private readonly payerRef: AgentRef = { ens: this.payer.ens, role: this.payer.role, owner: story.customer.ens };
  private readonly ctx: FoldContext = {
    persona: { name: story.customer.name, ens: story.customer.ens },
    shops: story.shops.map((s) => ({ ens: s.ens, name: s.name })),
    products: (story.products as LiveProduct[])
      .filter((p) => p.priceMicro && p.quantity)
      .map((p) => ({ id: p.id, shop: p.shop, name: p.name, short: p.short, unitName: p.unitName ?? p.short, priceMicro: BigInt(p.priceMicro!), quantity: p.quantity! })),
    txLink,
  };

  async getSnapshot(): Promise<DemoSnapshot> {
    const now = Date.now();
    const [state, map, csv] = await Promise.all([getJson<CustomerState>('/api/state/customer'), getJson<MapAnswer>('/api/map'), getText('/api/merchant/export.csv')]);
    if (csv) {
      try {
        for (const r of rowsFromCsv(csv)) this.addRow(r);
      } catch {
        // An unreadable export leaves the orders to the stream.
      }
    }
    for (const r of this.rows.values()) if (r.orderId) this.knownOrders.add(r.orderId);
    const orders = this.orders();
    const open = map?.shops.find((s) => s.ens === story.shop.ens)?.open ?? false;
    this.last = { status: statusOf(state?.agent.status), used: state?.spentTodayMicro ?? null, open };
    return {
      mode: 'live',
      customer: { name: story.customer.name, ens: story.customer.ens },
      agents: story.agents.map((a) => this.agentState(a, state, now)),
      shop: { ref: { ens: story.shop.ens, name: story.shop.name }, area: story.shop.area, open },
      shopAgents: story.shop.agents.map((a) => ({ ref: { ens: a.ens, role: a.role, owner: story.shop.ens }, label: a.label, main: a.main })),
      orders,
      renewals: [],
      errandRunning: false,
      now,
    };
  }

  subscribe(listener: (e: DemoEvent) => void): () => void {
    this.listeners.add(listener);
    if (this.listeners.size === 1) this.start();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  }

  // customer
  // The errand runs on our server (POST /api/agents/run, one at a time); its frames become the
  // phones' events, and each frame is also posted to the /live page for the explainer.
  async sendPrompt(text: string): Promise<void> {
    const res = await fetch('/api/agents/run', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'text/event-stream' }, body: JSON.stringify({ request: text }), cache: 'no-store' });
    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
      throw new Error(res.status === 409 ? 'Another errand is running right now. Try again in a minute.' : typeof body?.error === 'string' ? body.error : `The errand did not start (HTTP ${res.status}).`);
    }
    const mapper = new ErrandMapper(story, txLink);
    void readFrames(res.body, (event, data) => {
      postToStage(event, data);
      for (const e of mapper.map(event, data)) {
        try {
          this.emit(e);
        } catch (error) {
          console.error(`the phones could not apply "${e.type}":`, error);
        }
      }
    }).then(() => {
      for (const e of mapper.end()) this.emit(e);
    });
  }
  // The server re-derives the parent order (the payer's last) and pays the story's re-order.
  async reorder(orderId: string): Promise<void> {
    try {
      const { body, status } = await this.post<{ status?: string; orderId?: string | null; amountMicro?: string; transaction?: string }>('/api/customer/reorder', { parentOrderId: orderId });
      if (status === 200 && body.orderId && body.transaction && body.amountMicro) {
        this.emit({ type: 'payment.settled', orderId: body.orderId, total: usdt(body.amountMicro), links: [txLink(body.transaction)] });
      } else {
        this.emit({ type: 'error', message: 'The re-order was sent; its receipt is still on its way.', recoverable: false });
      }
    } catch (error) {
      this.emit({ type: 'error', message: error instanceof Error ? error.message : String(error), recoverable: true });
    }
  }
  // Recorded on Arkiv for the payer's last order; the photo stays on the phone for now.
  async requestRefund(orderId: string, input: { amount: Money; reason: string }): Promise<void> {
    await this.post('/api/customer/refund-request', { orderId, amountMicro: String(amountToMicro(input.amount.amount)), reason: input.reason });
    this.emit({ type: 'refund.requested', orderId, amount: input.amount, reason: input.reason });
  }
  startRenewal(): Promise<void> {
    return this.notYet();
  }
  cancelRenewal(): Promise<void> {
    return this.notYet();
  }
  // The owner sets the payer's ENS status on Sepolia; the server acts on the story's payer only.
  pauseAgent(): Promise<void> {
    return this.permission(true);
  }
  resumeAgent(): Promise<void> {
    return this.permission(false);
  }
  revokeAgent(): Promise<void> {
    return this.notYet();
  }
  tryRaiseCap(): Promise<void> {
    return this.notYet();
  }
  // merchant
  // Lists the shop as open on Arkiv; the listing is renewed every RENEW_OPEN_MS while this page is open.
  async setShopOpen(open: boolean): Promise<void> {
    await this.post('/api/merchant/open', { on: open });
    if (this.renewOpen) clearInterval(this.renewOpen);
    this.renewOpen = open ? setInterval(() => void this.post('/api/merchant/open', { on: true }).catch(() => undefined), RENEW_OPEN_MS) : null;
    this.last.open = open;
    this.emit({ type: 'shop.status', open });
  }
  // The merchant marks the order delivered on Whitechain; the stream brings the new state.
  async dispatch(orderId: string): Promise<void> {
    await this.post('/api/merchant/dispatch', { orderId });
  }
  async approveRefund(orderId: string, amount: Money): Promise<void> {
    await this.post('/api/merchant/refund', { orderId, amountMicro: String(amountToMicro(amount.amount)) });
  }
  declineRefund(): Promise<void> {
    return this.notYet();
  }
  async exportCsv(): Promise<Blob> {
    const res = await fetch('/api/merchant/export.csv', { cache: 'no-store' });
    if (!res.ok) throw new Error(`the export did not answer (HTTP ${res.status})`);
    return res.blob();
  }
  async markOrderSeen(orderId: string): Promise<void> {
    this.seenOrders.add(orderId);
    const order = this.orders().find((o) => o.id === orderId);
    if (order) this.emit({ type: 'order.updated', order });
  }
  // demo controls: none in live mode
  async runNextRenewal(): Promise<void> {}
  async resetDemo(): Promise<void> {}

  private async permission(paused: boolean): Promise<void> {
    const { body } = await this.post<{ changed?: boolean; sepoliaTx?: string | null }>(paused ? '/api/customer/pause' : '/api/customer/resume', {});
    const links = body.sepoliaTx ? [sepoliaLink(body.sepoliaTx)] : [];
    this.last.status = paused ? 'paused' : 'active';
    this.emit({ type: 'agent.permission', agent: this.payerRef, change: paused ? 'paused' : 'resumed', links });
  }

  // A POST to our own routes; a refusal is thrown with the route's own words, as the phones show it.
  private async post<T = unknown>(path: string, body: unknown): Promise<{ status: number; body: T }> {
    let res: Response;
    try {
      res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
    } catch {
      throw new Error('The site did not answer. Try again.');
    }
    const parsed = (await res.json().catch(() => ({}))) as T & { error?: unknown };
    if (!res.ok) throw new Error(typeof parsed.error === 'string' ? refusalText(parsed.error) : `HTTP ${res.status}`);
    return { status: res.status, body: parsed };
  }

  private notYet(): Promise<void> {
    this.emit({ type: 'error', message: 'This action is not available yet.', recoverable: false });
    return Promise.resolve();
  }

  private emit(e: DemoEvent): void {
    for (const l of [...this.listeners]) l(e);
  }

  private addRow(r: LedgerRow): boolean {
    const key = rowKey(r);
    if (this.rows.has(key)) return false;
    this.rows.set(key, r);
    return true;
  }

  private orders(): Order[] {
    // A new order stays marked until the merchant opens it; the snapshot's orders are not new.
    return foldOrders([...this.rows.values()], this.ctx, (id) => !this.knownOrders.has(id) && !this.seenOrders.has(id)).map((o) =>
      this.seenOrders.has(o.id) ? { ...o, isNew: false } : o,
    );
  }

  private agentState(a: (typeof story.agents)[number], state: CustomerState | null, now: number): AgentState {
    const ref: AgentRef = { ens: a.ens, role: a.role, owner: story.customer.ens };
    const base: AgentState = { ref, label: a.label, main: a.main, pays: Boolean(a.pays), does: a.does ?? '', status: 'active', refusedAttempts: [] };
    // Only the paying agent's state is read live; the others carry no pass of their own here.
    if (a.ens !== this.payer.ens) return base;
    const status = statusOf(state?.agent.status);
    const cap = state?.capMicro ?? null;
    const used = state?.spentTodayMicro ?? null;
    if (cap === null || used === null) return { ...base, status };
    return { ...base, status, pass: { cap: usdt(cap), used: usdt(used), period: 'day', expiresAt: periodEnd(state, now), state: status === 'active' ? 'active' : status } };
  }

  private start(): void {
    this.timers.push(setInterval(() => void this.pollState(), STATE_POLL_MS));
    this.timers.push(setInterval(() => void this.pollMap(), MAP_POLL_MS));
    this.connect();
  }

  private stop(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    if (this.renewOpen) clearInterval(this.renewOpen);
    this.renewOpen = null;
    if (this.reconnect) clearTimeout(this.reconnect);
    this.reconnect = null;
    this.source?.close();
    this.source = null;
  }

  private async pollState(): Promise<void> {
    const state = await getJson<CustomerState>('/api/state/customer');
    if (!state) return;
    const status = statusOf(state.agent.status);
    if (this.last.status !== null && status !== this.last.status) {
      this.emit({ type: 'agent.permission', agent: this.payerRef, change: status === 'active' ? 'resumed' : status, links: [] });
    }
    this.last.status = status;
    if (state.spentTodayMicro !== null && state.spentTodayMicro !== this.last.used) {
      this.emit({ type: 'agent.pass.period', agent: this.payerRef, used: usdt(state.spentTodayMicro), expiresAt: periodEnd(state, Date.now()) });
      this.last.used = state.spentTodayMicro;
    }
  }

  private async pollMap(): Promise<void> {
    const map = await getJson<MapAnswer>('/api/map');
    const open = map?.shops.find((s) => s.ens === story.shop.ens)?.open;
    if (open === undefined || open === this.last.open) return;
    this.last.open = open;
    this.emit({ type: 'shop.status', open });
  }

  // The merchant stream ends itself before the function limit; reconnect from the last edge seen.
  private connect(): void {
    if (this.source || this.listeners.size === 0) return;
    const source = new EventSource(`/api/merchant/events?since=${this.cursor}`);
    this.source = source;
    source.addEventListener('ready', () => {
      this.failures = 0;
    });
    source.addEventListener('edge', (msg) => this.onEdge((msg as MessageEvent<string>).data));
    source.addEventListener('error', () => {
      source.close();
      if (this.source !== source) return;
      this.source = null;
      const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_MS * 2 ** this.failures) * (0.75 + Math.random() / 2);
      this.failures += 1;
      if (this.listeners.size > 0) this.reconnect = setTimeout(() => this.connect(), delay);
    });
  }

  private onEdge(data: string): void {
    let row: LedgerRow;
    try {
      row = rowFromEdge(JSON.parse(data), story.shop.ens);
    } catch {
      return;
    }
    this.cursor = Math.max(this.cursor, row.ts);
    if (!this.addRow(row) || !row.orderId || !isLive(row)) return;
    const order = this.orders().find((o) => o.id === row.orderId);
    if (!order) return;
    this.emit({ type: 'order.updated', order });
    if (row.ts < this.openedAt) return;
    if (row.kind === 'pay' || row.kind === 'renew') this.emit({ type: 'merchant.notification', kind: row.kind === 'renew' ? 'renewal' : 'new_order', orderId: order.id });
    if (row.kind === 'request') this.emit({ type: 'merchant.notification', kind: 'refund_request', orderId: order.id });
    if (row.kind === 'refund' && row.tx) this.emit({ type: 'refund.settled', orderId: order.id, amount: usdt(row.amountMicro), links: [txLink(row.tx)] });
  }
}
