// The merchant's view of the money graph: the shop's edges read through T3's GraphQL
// (the same query the route runs against Arkiv), mapped to the stream's events and to
// the accountant's CSV. Pure functions over a query runner, so tests run on a double.

import type { EdgeKind, MerchantEdgeEvent } from './contracts.ts';
import { formatMicro } from './money.ts';
import { txUrl, type ExplorerBases } from './explorer.ts';

export interface GraphqlAnswer {
  data?: unknown;
  errors?: { message: string }[];
  extensions?: { arkiv?: { truncated?: boolean } };
}
export type GraphqlRunner = (query: string, variables: Record<string, unknown>) => Promise<GraphqlAnswer>;

export interface EdgeEnd {
  ens: string;
  owner: { ens: string | null } | null;
}

export interface EdgeRow {
  kind: string;
  from: EdgeEnd;
  to: EdgeEnd;
  amountMicro: string;
  day: number;
  ts: string;
  ref: string;
  orderId: string | null;
}

const EDGE_FIELDS = 'kind amountMicro day ts ref orderId from { ens owner { ens } } to { ens owner { ens } }';

// Every edge that touches the shop in the last days, both directions (orders, payments,
// requests and failures arrive at the shop; refunds and deliveries leave it).
export const SHOP_EDGES_QUERY = `query ShopEdges($ens: String!, $sinceDay: Int!, $limit: Int!) {
  node(ens: $ens) {
    in(sinceDay: $sinceDay, limit: $limit) { ${EDGE_FIELDS} }
    out(sinceDay: $sinceDay, limit: $limit) { ${EDGE_FIELDS} }
  }
  today
}`;

export const EDGE_KINDS: readonly EdgeKind[] = ['order', 'pay', 'refund', 'deliver', 'fail', 'request', 'subscribe', 'renew'];
const isKind = (v: string): v is EdgeKind => (EDGE_KINDS as readonly string[]).includes(v);

const DAY_S = 86_400;

export interface ShopEdges {
  edges: EdgeRow[];
  today: number;
  // Rows may be missing: a list reached its cap, or the engine stopped at its own row cap. Never silent.
  truncated: boolean;
  // How many days back the edges reach (0 is today only).
  daysBack: number;
}

// The most edges one list returns. The graph returns each node's OLDEST edges first and cuts the rest
// without a flag, so a cap below the window's size hides the newest payments: the engine's own row cap
// is 500 and a list of that size is the largest honest answer (runGraphql gets the same listCap).
export const LIST_CAP = 500;

// `daysBack` of 1 reads today and yesterday (the day boundary must not hide an edge).
export async function fetchShopEdges(run: GraphqlRunner, shopEns: string, { daysBack = 1, limit = LIST_CAP, nowS = Date.now() / 1000 }: { daysBack?: number; limit?: number; nowS?: number } = {}): Promise<ShopEdges> {
  const sinceDay = Math.floor(nowS / DAY_S) - daysBack;
  const answer = await run(SHOP_EDGES_QUERY, { ens: shopEns, sinceDay, limit });
  if (answer.errors?.length || answer.data === undefined) throw new Error(`the graph did not answer: ${answer.errors?.[0]?.message ?? 'no data'}`);
  const data = answer.data as { node: { in: EdgeRow[]; out: EdgeRow[] } | null; today: number };
  // A shop that has no node on Arkiv yet has no edges; that is an empty feed, not an error.
  const edges = data.node ? [...data.node.in, ...data.node.out] : [];
  edges.sort((a, b) => (BigInt(a.ts) < BigInt(b.ts) ? -1 : BigInt(a.ts) > BigInt(b.ts) ? 1 : a.ref < b.ref ? -1 : 1));
  const full = data.node ? data.node.in.length >= limit || data.node.out.length >= limit : false;
  return { edges, today: data.today, truncated: full || answer.extensions?.arkiv?.truncated === true, daysBack };
}

// The longest window, up to `daysBack` days, whose answer is complete: it tries the whole window, then
// half of it, down to today only. If even today only is cut, that answer comes back flagged truncated.
export async function fetchShopEdgesFitting(run: GraphqlRunner, shopEns: string, { daysBack = 1, limit = LIST_CAP, nowS = Date.now() / 1000 }: { daysBack?: number; limit?: number; nowS?: number } = {}): Promise<ShopEdges> {
  const windows: number[] = [];
  for (let d = daysBack; d > 0; d = Math.floor(d / 2)) windows.push(d);
  windows.push(0);
  let last: ShopEdges | null = null;
  for (const days of windows) {
    last = await fetchShopEdges(run, shopEns, { daysBack: days, limit, nowS });
    if (!last.truncated) return last;
  }
  return last as ShopEdges;
}

// `<chain id>:<tx hash>:<log index>` is a chain event's ref (the mirror's event id).
export function settlementTxOf(ref: string): string | null {
  const match = /^\d+:(0x[0-9a-fA-F]{64}):\d+$/.exec(ref);
  return match ? (match[1] as string).toLowerCase() : null;
}

export function toEvent(row: EdgeRow): MerchantEdgeEvent | null {
  if (!isKind(row.kind)) return null;
  return {
    kind: row.kind,
    from: row.from.ens,
    to: row.to.ens,
    amountMicro: row.amountMicro,
    orderId: row.orderId,
    ref: row.ref,
    ts: row.ts,
    // The GraphQL edge carries neither the Arkiv entity key nor its transaction yet.
    entityKey: null,
    arkivTx: null,
    settlementTx: settlementTxOf(row.ref),
  };
}

export const edgeKey = (row: Pick<EdgeRow, 'kind' | 'ref'>): string => `${row.kind}|${row.ref}`;

// The rows a stream has not sent yet: at or after the cursor, never one already sent.
export function freshEdges(rows: EdgeRow[], cursorS: number, sent: Set<string>): EdgeRow[] {
  return rows.filter((r) => Number(r.ts) >= cursorS && !sent.has(edgeKey(r)));
}

// A spreadsheet runs a cell that starts with one of these as a formula; names and refs
// come from chain data, so they are never trusted to be plain text.
function cell(value: string, numeric = false): string {
  const safe = !numeric && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export const CSV_COLUMNS = ['date_utc', 'date_local', 'order_id', 'kind', 'buyer_ens', 'payer_ens', 'shop_ens', 'amount_usdt', 'net_effect_usdt', 'token', 'tx_hash', 'explorer_link', 'ref'] as const;

// The columns that hold a number (amount_usdt, net_effect_usdt), which are never text.
const NUMERIC_COLUMNS = new Set([CSV_COLUMNS.indexOf('amount_usdt'), CSV_COLUMNS.indexOf('net_effect_usdt')]);

const SIGN: Record<string, 1 | -1 | 0> = { pay: 1, renew: 1, refund: -1 };
const CSV_KINDS = new Set(['order', 'pay', 'refund', 'deliver', 'subscribe', 'renew']);

export function localTime(unixS: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(unixS * 1000));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

// One row per ledger event of the shop, oldest first: orders, payments, refunds,
// deliveries, subscriptions and renewals. `net_effect_usdt` is signed: payments and
// renewals add, refunds subtract, the rest are 0. Every row reads from the graph.
export function buildCsv(rows: EdgeRow[], { shopEns, timeZone, tokenSymbol, explorers }: { shopEns: string; timeZone: string; tokenSymbol: string; explorers: ExplorerBases }): string {
  const lines = [CSV_COLUMNS.join(',')];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!CSV_KINDS.has(row.kind) || seen.has(edgeKey(row))) continue;
    seen.add(edgeKey(row));
    const buyerEnd = row.from.ens === shopEns ? row.to : row.from;
    const tx = settlementTxOf(row.ref);
    const ts = Number(row.ts);
    const sign = SIGN[row.kind] ?? 0;
    const net = sign === 0 ? 0n : BigInt(row.amountMicro) * BigInt(sign);
    lines.push(
      [
        new Date(ts * 1000).toISOString(),
        localTime(ts, timeZone),
        row.orderId ?? '',
        row.kind,
        buyerEnd.owner?.ens ?? buyerEnd.ens,
        buyerEnd.ens,
        shopEns,
        formatMicro(row.amountMicro, 2),
        (net < 0n ? '-' : '') + formatMicro(net < 0n ? -net : net, 2),
        tokenSymbol,
        tx ?? '',
        (tx && txUrl(explorers, 'whitechain', tx)) || '',
        row.ref,
      ]
        .map((value, i) => cell(value, NUMERIC_COLUMNS.has(i)))
        .join(','),
    );
  }
  return `${lines.join('\r\n')}\r\n`;
}
