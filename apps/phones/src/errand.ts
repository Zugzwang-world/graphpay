// The errand's server-sent frames (POST /api/agents/run: `started`, `trace`, `result`,
// `failed`) mapped to the team's DemoEvents, so their customer thread, shop cards and
// quote sheet follow the real run. Every figure comes from a tool result or the run's
// result; the agents' own words come from the run's messages and narrative.

import type { AgentActivity, AgentRef, DemoEvent, Link, Money, RefusalReason, ShopChoice } from '@/demo/contract';
import type { Story } from '@/data/story';

// What the mapper needs from the story (the build's projection of packages/config/story.json).
export type ErrandCast = Pick<Story, 'agents' | 'shops' | 'products' | 'customer' | 'spendingPass'>;

type Json = Record<string, unknown>;
type Trace =
  | { type: 'message'; from: string; to: string; text: string }
  | { type: 'agent.start'; agent: string; role: string }
  | { type: 'agent.end'; agent: string; role: string; output: unknown; error?: string }
  | { type: 'tool.call'; agent: string; tool: string; input: unknown }
  | { type: 'tool.result'; agent: string; tool: string; output: unknown; error?: string }
  | { type: 'guard'; guard: string; ok: boolean; detail: string };

interface Offer {
  shop: string;
  priceUsdt: string;
  distanceKm: number;
}

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const money = (amount: string): Money => ({ amount: Number(amount).toFixed(2), currency: 'USDT' });

// The refusal codes the runner names (in a guard's or a tool's reason or detail), as the phones' reasons.
const REASONS: [RegExp, RefusalReason][] = [
  [/CAP_EXCEEDED/, 'cap'],
  [/ENS_PAUSED/, 'paused'],
  [/ENS_EXPIRED_OR_REVOKED|AGENT_REVOKED/, 'revoked'],
  [/SHOP_NOT_ELIGIBLE/, 'trap_shop'],
  [/QUOTE_EXPIRED/, 'quote_expired'],
  [/OVER_BUDGET|OVER_APPROVED_PRICE|MISSES_DEADLINE/, 'budget'],
];
export function refusalOf(text: string): RefusalReason | null {
  for (const [pattern, reason] of REASONS) if (pattern.test(text)) return reason;
  return null;
}

const QUOTE_VALID_MS = 10 * 60_000;

// An MCP tool's answer is `{content:[{type:'text', text:'<JSON>'}]}`; a GraphQL answer counts its Arkiv calls.
function arkivCalls(out: Json): number {
  const text = Array.isArray(out.content) && isObj(out.content[0]) ? out.content[0].text : null;
  if (typeof text !== 'string') return 0;
  try {
    const calls = (JSON.parse(text) as { extensions?: { arkiv?: { calls?: unknown } } }).extensions?.arkiv?.calls;
    return typeof calls === 'number' && Number.isFinite(calls) ? calls : 0;
  } catch {
    return 0;
  }
}

// The repeat-buyer count is not in the graph yet; the card shows a dash, never a made-up number.
const UNKNOWN_COUNT = { toLocaleString: () => '—' } as unknown as number;

export class ErrandMapper {
  private errandId: string | undefined;
  private offers = new Map<string, Offer>();
  private quote: { orderId: string; total: Money } | null = null;
  // Arkiv calls behind the analyst's graph reads, from each GraphQL answer's own count.
  private reads = 0;
  private done = false;
  private readonly buyers: Map<string, AgentRef>;
  private readonly payer: ErrandCast['agents'][number] | undefined;

  private readonly story: ErrandCast;
  private readonly txLink: (tx: string) => Link;

  // Plain fields, not parameter properties: the tests run this file with Node's type stripping.
  constructor(story: ErrandCast, txLink: (tx: string) => Link) {
    this.story = story;
    this.txLink = txLink;
    this.buyers = new Map(story.agents.map((a) => [a.ens, { ens: a.ens, role: a.role, owner: story.customer.ens }]));
    this.payer = story.agents.find((a) => a.role === story.spendingPass.payingRole);
  }

  map(event: string, data: string): DemoEvent[] {
    let body: unknown;
    try {
      body = JSON.parse(data);
    } catch {
      return [];
    }
    if (event === 'started' && isObj(body) && typeof body.runId === 'string') {
      this.errandId = body.runId;
      return [];
    }
    if (event === 'trace' && isObj(body)) return this.trace(body as unknown as Trace);
    if (event === 'result' && isObj(body)) return this.result(body);
    if (event === 'failed') {
      this.done = true;
      const error = isObj(body) && typeof body.error === 'string' ? body.error : 'the errand failed';
      return [{ type: 'error', message: `The errand stopped: ${error}.`, recoverable: true, retry: 'sendPrompt', errandId: this.errandId }];
    }
    return [];
  }

  // The stream closed: a run that never reached its result says so.
  end(): DemoEvent[] {
    if (this.done) return [];
    this.done = true;
    return [{ type: 'error', message: 'The errand stream ended before its result. Try again.', recoverable: true, retry: 'sendPrompt', errandId: this.errandId }];
  }

  private agent(ens: string): AgentRef | undefined {
    return this.buyers.get(ens);
  }

  private status(ens: string, status: AgentActivity, reason?: string): DemoEvent[] {
    const agent = this.agent(ens);
    return agent ? [{ type: 'agent.status', agent, status, reason, errandId: this.errandId }] : [];
  }

  private trace(t: Trace): DemoEvent[] {
    const errandId = this.errandId;
    switch (t.type) {
      case 'agent.start':
        return this.status(t.agent, 'thinking');
      case 'agent.end':
        if (t.error) return this.status(t.agent, 'refused', t.error);
        return t.role === 'payer' ? [] : this.status(t.agent, 'checked');
      case 'message': {
        const agent = this.agent(t.from);
        return agent && t.text ? [{ type: 'agent.message', agent, text: t.text, at: Date.now(), errandId }] : [];
      }
      case 'guard':
        // Every check passed before the payer signed: the quote's signature step.
        if (t.ok && t.guard === 'G5' && /every check passed before signing/.test(t.detail) && this.quote) return [{ type: 'payment.signed', orderId: this.quote.orderId }];
        return [];
      case 'tool.result':
        return this.toolResult(t);
      default:
        return [];
    }
  }

  private toolResult(t: Extract<Trace, { type: 'tool.result' }>): DemoEvent[] {
    const out = t.output;
    if (!isObj(out)) return [];
    if (t.tool === 'graphql') {
      this.reads += arkivCalls(out);
      return [];
    }
    if ((t.tool === 'scout' || t.tool === 'catalog_read') && Array.isArray(out.offers)) {
      for (const o of out.offers) if (isObj(o) && typeof o.shop === 'string' && typeof o.priceUsdt === 'string') this.offers.set(o.shop, { shop: o.shop, priceUsdt: o.priceUsdt, distanceKm: Number(o.distanceKm) });
      return [];
    }
    if (t.tool === 'analyst' && Array.isArray(out.ranking)) return this.ranking(out.ranking, typeof out.explainId === 'string' ? out.explainId : null);
    if (t.tool === 'get_quote' && out.ok === true && typeof out.orderId === 'string' && typeof out.priceUsdt === 'string' && typeof out.shop === 'string') {
      const total = money(out.priceUsdt);
      this.quote = { orderId: out.orderId, total };
      const shop = this.story.shops.find((s) => s.ens === out.shop);
      const product = this.story.products.find((p) => p.shop === out.shop);
      return [{
        type: 'quote.created',
        orderId: out.orderId,
        shop: { ens: out.shop, name: shop?.name ?? out.shop },
        items: [{ name: product?.name ?? String(out.item ?? ''), qty: 1, price: total }],
        total,
        // The payer pays at once; the shop's quotes stay valid 10 minutes (acceptance D10).
        validUntil: Date.now() + QUOTE_VALID_MS,
        errandId: this.errandId,
      }];
    }
    if (t.tool === 'pay_order') {
      if (out.status === 'paid' && typeof out.transaction === 'string' && typeof out.orderId === 'string') return this.settled(out.orderId, typeof out.amountUsdt === 'string' ? money(out.amountUsdt) : this.quote?.total, out.transaction);
      return this.refused(`${String(out.reason ?? '')} ${String(out.detail ?? '')}`);
    }
    return [];
  }

  private ranking(ranking: unknown[], explainId: string | null): DemoEvent[] {
    const rows = ranking.filter(isObj).filter((r) => typeof r.ens === 'string') as { ens: string; eligible?: unknown; reasons?: unknown }[];
    const best = rows.find((r) => r.eligible === true);
    const choices: ShopChoice[] = rows.map((r) => {
      const shop = this.story.shops.find((s) => s.ens === r.ens);
      const offer = this.offers.get(r.ens);
      const reasons = Array.isArray(r.reasons) ? r.reasons.filter((x): x is string => typeof x === 'string') : [];
      return {
        shop: { ens: r.ens, name: shop?.name ?? r.ens },
        price: money(offer?.priceUsdt ?? shop?.priceUsdt ?? '0'),
        distanceKm: offer?.distanceKm ?? shop?.distanceKm ?? 0,
        // The story's synthetic scenario for the city (labelled synthetic in the story).
        paidOrders: shop?.paidOrders ?? 0,
        refundRate: shop?.refundRate ?? '—',
        repeatBuyers: UNKNOWN_COUNT,
        verdict: r === best ? 'chosen' : r.eligible === true ? 'considered' : 'rejected',
        ...(r.eligible === true ? {} : { reason: reasons.join('; ') }),
      };
    });
    const links = explainId && /^[0-9a-f]{12}$/.test(explainId) ? [{ label: 'See every Arkiv read', url: `/explain/${explainId}` }] : [];
    return [
      { type: 'graph.read', question: 'Which nearby shop can be trusted?', reads: this.reads, ms: 0, links, errandId: this.errandId },
      { type: 'shops.compared', errandId: this.errandId, choices },
    ];
  }

  private settled(orderId: string, total: Money | undefined, tx: string): DemoEvent[] {
    if (this.done) return [];
    this.done = true;
    const events: DemoEvent[] = [{ type: 'payment.settled', orderId, total: total ?? money('0'), links: [this.txLink(tx)] }];
    if (this.payer) events.unshift(...this.status(this.payer.ens, 'paid'));
    return events;
  }

  private refused(text: string): DemoEvent[] {
    const reason = refusalOf(text);
    if (!reason) return [];
    this.done = true;
    const payer = this.payer ? this.agent(this.payer.ens) : undefined;
    return [{ type: 'payment.refused', orderId: this.quote?.orderId, reason, links: [], agent: payer, attempted: this.quote?.total, errandId: this.errandId }];
  }

  private result(r: Json): DemoEvent[] {
    // The narrative is the model's own prose (RunResult.narrative); the phones show only the
    // agents' code-built messages and the tools' figures, so it is left out.
    const events: DemoEvent[] = [];
    const narrative = typeof r.narrative === 'string' && r.narrative.trim() ? r.narrative.trim() : null;
    if (this.done) return events;
    const receipt = isObj(r.receipt) ? r.receipt : null;
    if (r.status === 'paid' && receipt && typeof receipt.transaction === 'string' && typeof r.orderId === 'string') {
      return [...events, ...this.settled(r.orderId, typeof receipt.amountUsdt === 'string' ? money(receipt.amountUsdt) : this.quote?.total, receipt.transaction)];
    }
    const refusals = Array.isArray(r.refusals) ? r.refusals.filter(isObj).map((x) => `${String(x.reason ?? '')} ${String(x.detail ?? '')}`).join(' ') : '';
    const refused = r.status === 'refused' ? this.refused(refusals) : [];
    if (refused.length) return [...events, ...refused];
    this.done = true;
    return [...events, { type: 'error', message: narrative ? 'No purchase this time.' : 'The errand ended without a purchase.', recoverable: true, retry: 'sendPrompt', errandId: this.errandId }];
  }
}

// A server-sent stream read from a fetch body: each `event:` / `data:` frame, comments skipped.
export async function readFrames(body: ReadableStream<Uint8Array>, onFrame: (event: string, data: string) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split(/\r?\n\r?\n/);
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        let event = 'message';
        const data: string[] = [];
        for (const line of part.split(/\r?\n/)) {
          if (line.startsWith(':')) continue;
          const colon = line.indexOf(':');
          const field = colon === -1 ? line : line.slice(0, colon);
          const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
          if (field === 'event') event = value;
          else if (field === 'data') data.push(value);
        }
        if (!data.length) continue;
        // One frame that fails to apply never stops the stream: the result still arrives.
        try {
          onFrame(event, data.join('\n'));
        } catch (error) {
          console.error(`errand frame "${event}" was skipped:`, error);
        }
      }
    }
  } catch (error) {
    // The connection dropped; the caller's end() reports a run with no result.
    console.error('errand stream dropped:', error);
  }
}
