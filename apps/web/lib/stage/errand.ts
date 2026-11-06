// The errand as one model, folded from its server-sent frames (POST /api/agents/run: `started`,
// `trace`, `result`, `failed`; BACKEND_FOR_FRONTEND.md §3.1 and §4). The director, the customer’s phone
// and the shop's phone all fold the same frames with this one function, so the three panes agree on
// every figure. Every value comes from a frame: a tool's result, a guard, a message's route or the
// result. The agents' own prose (reasons, narrative) is never kept for display.

import type { StepKey } from './scenes.ts';

type Json = Record<string, unknown>;

export interface Offer {
  shop: string;
  sku: string;
  priceUsdt: string;
  etaMinutes: number | null;
  distanceKm: number | null;
}

export interface Scoreboard {
  ens: string;
  orders: number | null;
  refundRate: number | null;
  onTimeRate: number | null;
  synthetic: boolean;
}

export interface RankedShop {
  ens: string;
  score: number | null;
  eligible: boolean;
}

export interface ErrandModel {
  runId: string | null;
  // Each step's arrival (ms, the caller's clock).
  arrived: Partial<Record<StepKey, number>>;
  request: string | null;
  persona: string | null;
  budgetUsdt: string | null;
  deadlineIso: string | null;
  // Agents that have started (ENS names), in order.
  woke: string[];
  // The concierge's hand-offs to the scout and the analyst.
  handoffs: number;
  directory: string[];
  offers: Offer[];
  graph: { query: string | null; explainId: string | null; calls: number | null; entityKeys: string[]; boards: Scoreboard[] } | null;
  ranking: RankedShop[];
  best: string | null;
  order: { shop: string; quantity: number } | null;
  risk: {
    buyer: string | null;
    owner: string | null;
    ensStatus: string | null;
    paidOrders: number | null;
    cancellations: number | null;
    disputes: number | null;
    explainId: string | null;
    approved: boolean | null;
  };
  quote: { orderId: string; shop: string; priceUsdt: string; etaMinutes: number | null; quantity: number } | null;
  signed: boolean;
  settledTx: string | null;
  dispatchEta: string | null;
  paid: { orderId: string; tx: string; amountUsdt: string; arrivesAt: string | null } | null;
  // The run's end: paid, refused, no-purchase, unsettled, or failed (with the server's own sentence).
  end: { status: 'paid' | 'refused' | 'no-purchase' | 'unsettled' | 'failed'; reason: string | null; at: number } | null;
  frames: number;
}

export function emptyErrand(): ErrandModel {
  return {
    runId: null,
    arrived: {},
    request: null,
    persona: null,
    budgetUsdt: null,
    deadlineIso: null,
    woke: [],
    handoffs: 0,
    directory: [],
    offers: [],
    graph: null,
    ranking: [],
    best: null,
    order: null,
    risk: { buyer: null, owner: null, ensStatus: null, paidOrders: null, cancellations: null, disputes: null, explainId: null, approved: null },
    quote: null,
    signed: false,
    settledTx: null,
    dispatchEta: null,
    paid: null,
    end: null,
    frames: 0,
  };
}

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const HASH = /^0x[0-9a-fA-F]{64}$/;
const EXPLAIN = /^[0-9a-f]{12}$/;

// An MCP tool's answer is `{content:[{type:'text', text}]}`; the text is JSON or a table.
function innerText(out: unknown): string | null {
  if (!isObj(out) || !Array.isArray(out.content)) return null;
  const first = out.content[0];
  return isObj(first) && typeof first.text === 'string' ? first.text : null;
}
function innerJson(out: unknown): Json | null {
  const text = innerText(out);
  if (text === null) return isObj(out) ? out : null;
  try {
    const parsed = JSON.parse(text) as unknown;
    return isObj(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// The risk agent's `ask` answer: a tab-separated table, a header and one row, then `explain=<id>`.
export function parseAsk(text: string): { orders: number | null; cancellations: number | null; disputes: number | null; status: string | null; principal: string | null; explainId: string | null } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  const header = (lines[0] ?? '').split('\t');
  const row = (lines[1] ?? '').split('\t');
  const cell = (name: string) => {
    const i = header.indexOf(name);
    return i >= 0 ? (row[i] ?? null) : null;
  };
  const explain = /explain=([0-9a-f]{12})/.exec(text)?.[1] ?? null;
  return { orders: num(cell('orders')), cancellations: num(cell('cancellations')), disputes: num(cell('disputes')), status: cell('status'), principal: cell('principal'), explainId: explain };
}

const mark = (m: ErrandModel, step: StepKey, at: number) => {
  if (m.arrived[step] === undefined) m.arrived[step] = at;
};

const roleOf = (ens: string): string => ens.split('.')[0] ?? ens;

// Fold one frame into the model (a new object; the old one is left as it was).
export function foldFrame(prev: ErrandModel, event: string, data: string, at: number): ErrandModel {
  let body: unknown;
  try {
    body = JSON.parse(data);
  } catch {
    return prev;
  }
  const m: ErrandModel = { ...prev, arrived: { ...prev.arrived }, risk: { ...prev.risk }, frames: prev.frames + 1 };
  if (event === 'started' && isObj(body)) {
    m.runId = str(body.runId);
    return m;
  }
  if (event === 'failed') {
    const error = isObj(body) ? str(body.error) : null;
    if (!m.end) m.end = { status: 'failed', reason: error, at };
    return m;
  }
  if (event === 'result' && isObj(body)) return foldResult(m, body, at);
  if (event !== 'trace' || !isObj(body)) return m;
  const t = body;
  const type = t.type;
  if (type === 'message') {
    const from = str(t.from) ?? '';
    const to = str(t.to) ?? '';
    const text = str(t.text) ?? '';
    const fromRole = roleOf(from);
    const toRole = roleOf(to);
    if (toRole === 'concierge' && fromRole !== 'scout' && fromRole !== 'analyst' && fromRole !== 'payer' && m.request === null) {
      m.request = text;
      m.persona = from;
      mark(m, 'ask', at);
    } else if (fromRole === 'concierge' && (toRole === 'scout' || toRole === 'analyst')) {
      // Both hand-offs are the team step; it arrives with the second.
      m.handoffs += 1;
      if (m.handoffs >= 2) mark(m, 'team', at);
    } else if (fromRole === 'analyst' && toRole === 'concierge' && /best eligible/i.test(text)) {
      mark(m, 'best', at);
    } else if (fromRole === 'concierge' && toRole === 'payer') {
      mark(m, 'order', at);
    } else if (fromRole === 'storefront' && toRole === 'risk') {
      m.risk.buyer = /\bvet\s+(\S+)/.exec(text)?.[1] ?? m.risk.buyer;
      mark(m, 'vet', at);
    } else if (fromRole === 'risk' && toRole === 'storefront') {
      if (m.risk.approved === null) m.risk.approved = /^approve/i.test(text);
    } else if (fromRole === 'storefront' && toRole === 'payer' && /^402\b/.test(text)) {
      mark(m, 'bill402', at);
    } else if (fromRole === 'payer' && toRole === 'storefront' && /signature/i.test(text)) {
      m.signed = true;
      mark(m, 'sign', at);
      mark(m, 'verify', at);
    } else if (fromRole === 'storefront' && toRole === 'payer' && /^settled\b/.test(text)) {
      const tx = /0x[0-9a-fA-F]{64}/.exec(text)?.[0] ?? null;
      if (tx) m.settledTx = tx.toLowerCase();
      mark(m, 'settled', at);
    } else if (fromRole === 'dispatch') {
      const iso = /arrives\s+(\S+)/.exec(text)?.[1] ?? null;
      if (iso && !Number.isNaN(Date.parse(iso))) m.dispatchEta = iso;
      mark(m, 'dispatch', at);
    }
    return m;
  }
  if (type === 'agent.start') {
    const agent = str(t.agent);
    if (agent && !m.woke.includes(agent)) m.woke = [...m.woke, agent];
    return m;
  }
  if (type === 'guard') {
    const detail = str(t.detail) ?? '';
    if (t.guard === 'G1' && m.budgetUsdt === null) {
      m.budgetUsdt = /at most\s+([0-9.]+)\s+USDT/.exec(detail)?.[1] ?? null;
      m.deadlineIso = /by\s+(\d{4}-\d\d-\d\dT[0-9:+\-.Z]+)/.exec(detail)?.[1] ?? null;
    }
    if (t.guard === 'G9') {
      m.risk.approved = t.ok === true && /^approved/i.test(detail);
      mark(m, 'verdict', at);
    }
    return m;
  }
  if (type === 'tool.call' && t.tool === 'pay_shop' && isObj(t.input)) {
    const shop = str(t.input.shopEns);
    if (shop) m.order = { shop, quantity: m.order?.quantity ?? 1 };
    return m;
  }
  if (type === 'tool.result') return foldTool(m, str(t.tool) ?? '', t.output, at);
  return m;
}

function foldTool(m: ErrandModel, tool: string, out: unknown, at: number): ErrandModel {
  if (tool === 'directory_list' && isObj(out) && Array.isArray(out.shops)) {
    m.directory = out.shops.filter((s): s is string => typeof s === 'string');
    return m;
  }
  if (tool === 'catalog_read' && isObj(out) && Array.isArray(out.offers)) {
    const offers = [...m.offers];
    for (const o of out.offers) {
      if (!isObj(o) || typeof o.shop !== 'string' || typeof o.priceUsdt !== 'string') continue;
      if (offers.some((x) => x.shop === o.shop)) continue;
      offers.push({ shop: o.shop, sku: str(o.sku) ?? '', priceUsdt: o.priceUsdt, etaMinutes: num(o.etaMinutes), distanceKm: num(o.distanceKm) });
    }
    m.offers = offers;
    if (m.directory.length > 0 && m.directory.every((s) => offers.some((o) => o.shop === s))) mark(m, 'shops', at);
    return m;
  }
  if (tool === 'scout' && isObj(out) && Array.isArray(out.offers)) {
    // The scout's whole answer to the concierge: every offer is in.
    mark(m, 'shops', at);
    return m;
  }
  if (tool === 'graphql') {
    const answer = innerJson(out);
    const ext = isObj(answer?.extensions) && isObj(answer.extensions.arkiv) ? answer.extensions.arkiv : null;
    const nodes = isObj(answer?.data) && Array.isArray(answer.data.nodes) ? answer.data.nodes : [];
    const boards: Scoreboard[] = nodes.filter(isObj).flatMap((n) => {
      const ens = str(n.ens);
      const rep = isObj(n.reputation) ? n.reputation : null;
      return ens ? [{ ens, orders: num(rep?.orders), refundRate: num(rep?.refundRate), onTimeRate: num(rep?.onTimeRate), synthetic: rep?.synthetic === true }] : [];
    });
    const explainId = str(ext?.explainId);
    m.graph = {
      query: m.graph?.query ?? null,
      explainId: explainId && EXPLAIN.test(explainId) ? explainId : null,
      calls: num(ext?.calls),
      entityKeys: Array.isArray(ext?.entityKeys) ? (ext.entityKeys as unknown[]).filter((k): k is string => typeof k === 'string' && HASH.test(k)) : [],
      boards,
    };
    mark(m, 'graphql', at);
    return m;
  }
  if (tool === 'analyst' && isObj(out) && Array.isArray(out.ranking)) {
    // The ranking code recomputed (the concierge's view of the analyst).
    m.ranking = out.ranking.filter(isObj).flatMap((r) => (typeof r.ens === 'string' ? [{ ens: r.ens, score: num(r.score), eligible: r.eligible === true }] : []));
    m.best = m.ranking.find((r) => r.eligible)?.ens ?? null;
    return m;
  }
  if (tool === 'ens_check' && isObj(out)) {
    const records = isObj(out.records) ? out.records : {};
    m.risk.buyer = str(out.name) ?? m.risk.buyer;
    m.risk.owner = str(records['graphpay.principal']) ?? m.risk.owner;
    m.risk.ensStatus = str(records['graphpay.status']) ?? (str(out.status)?.toLowerCase() ?? null);
    if (m.risk.paidOrders !== null) mark(m, 'checks', at);
    return m;
  }
  if (tool === 'ask') {
    const text = innerText(out);
    if (text) {
      const ask = parseAsk(text);
      m.risk.paidOrders = ask.orders;
      m.risk.cancellations = ask.cancellations;
      m.risk.disputes = ask.disputes;
      m.risk.explainId = ask.explainId;
      m.risk.owner = m.risk.owner ?? ask.principal;
      m.risk.ensStatus = m.risk.ensStatus ?? ask.status;
    }
    if (m.risk.ensStatus !== null) mark(m, 'checks', at);
    return m;
  }
  if (tool === 'get_quote' && isObj(out) && out.ok === true && typeof out.orderId === 'string') {
    m.quote = { orderId: out.orderId, shop: str(out.shop) ?? m.order?.shop ?? '', priceUsdt: str(out.priceUsdt) ?? '0', etaMinutes: num(out.etaMinutes), quantity: num(out.quantity) ?? 1 };
    mark(m, 'quote', at);
    return m;
  }
  if (tool === 'pay_order' && isObj(out)) {
    if (out.status === 'paid' && typeof out.transaction === 'string' && typeof out.orderId === 'string') {
      m.paid = { orderId: out.orderId, tx: out.transaction.toLowerCase(), amountUsdt: str(out.amountUsdt) ?? m.quote?.priceUsdt ?? '0', arrivesAt: str(out.arrivesAt) };
      m.settledTx = m.settledTx ?? m.paid.tx;
      mark(m, 'settled', at);
    }
    return m;
  }
  return m;
}

function foldResult(m: ErrandModel, r: Json, at: number): ErrandModel {
  const status = r.status === 'paid' || r.status === 'refused' || r.status === 'no-purchase' || r.status === 'unsettled' ? r.status : 'no-purchase';
  const receipt = isObj(r.receipt) ? r.receipt : null;
  if (status === 'paid' && receipt && typeof receipt.transaction === 'string' && typeof r.orderId === 'string' && !m.paid) {
    m.paid = { orderId: r.orderId, tx: receipt.transaction.toLowerCase(), amountUsdt: str(receipt.amountUsdt) ?? str(r.priceUsdt) ?? '0', arrivesAt: str(r.arrivesAt) };
    m.settledTx = m.settledTx ?? m.paid.tx;
  }
  if (Array.isArray(r.ranking) && m.ranking.length === 0) {
    m.ranking = r.ranking.filter(isObj).flatMap((x) => (typeof x.ens === 'string' ? [{ ens: x.ens, score: num(x.score), eligible: x.eligible === true }] : []));
    m.best = m.best ?? m.ranking.find((x) => x.eligible)?.ens ?? null;
  }
  const refusal = Array.isArray(r.refusals) ? r.refusals.find(isObj) : undefined;
  if (!m.end) m.end = { status, reason: refusal ? str(refusal.reason) : null, at };
  if (status === 'paid') mark(m, 'paid', at);
  return m;
}

// Keep the analyst's real query text (the tool call's input), so the stage can show it.
export function foldQuery(m: ErrandModel, event: string, data: string): ErrandModel {
  if (event !== 'trace') return m;
  try {
    const t = JSON.parse(data) as Json;
    if (t.type === 'tool.call' && t.tool === 'graphql' && isObj(t.input) && typeof t.input.query === 'string') {
      return { ...m, graph: { query: t.input.query, explainId: m.graph?.explainId ?? null, calls: m.graph?.calls ?? null, entityKeys: m.graph?.entityKeys ?? [], boards: m.graph?.boards ?? [] } };
    }
  } catch {
    // not JSON: skipped
  }
  return m;
}

// Both folds, in the order the frames came.
export function foldAll(frames: readonly { event: string; data: string; at: number }[]): ErrandModel {
  let m = emptyErrand();
  for (const f of frames) m = foldQuery(foldFrame(m, f.event, f.data, f.at), f.event, f.data);
  return m;
}

export const isFinished = (m: ErrandModel): boolean => m.end !== null;
