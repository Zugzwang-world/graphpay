// An order's trail (WEBSITE_SPEC.md §1 route /order/:id): every edge that carries the
// order id, read through GraphQL `order(id)` and put in time order. The words are the
// website's own for each edge kind; the amounts, names and times are chain data.

import { settlementTxOf } from './merchant-feed.ts';

export interface TrailEdge {
  kind: string;
  from: { ens: string };
  to: { ens: string };
  amountMicro: string;
  ts: string;
  ref: string;
  synthetic: boolean;
}

export const ORDER_QUERY = 'query Order($id: String!) { order(id: $id) { kind amountMicro ts ref synthetic from { ens } to { ens } } }';

export function orderRequestUrl(orderId: string): string {
  const params = new URLSearchParams({ query: ORDER_QUERY, variables: JSON.stringify({ id: orderId }) });
  return `/api/graphql?${params.toString()}`;
}

const WORDS: Record<string, string> = {
  request: 'Requested',
  order: 'Order created',
  pay: 'Paid',
  deliver: 'Dispatched',
  refund: 'Refunded',
  fail: 'Refused',
  subscribe: 'Subscribed',
  renew: 'Renewed',
};

export const kindWord = (kind: string): string => WORDS[kind] ?? kind;

// The shop's answer to a refund request is a `request` edge too, the other way round (ref `dec:`,
// lib/refund-decline.server.ts): it is a decline, and it moves no money.
const isDecline = (e: Pick<TrailEdge, 'kind' | 'ref'>) => e.kind === 'request' && e.ref.startsWith('dec:');

export interface TrailStep {
  word: string;
  kind: string;
  from: string;
  to: string;
  amountMicro: string | null;
  ts: number;
  settlementTx: string | null;
  synthetic: boolean;
}

// Oldest first; money amounts only on the kinds that move money (zero otherwise).
export function trailOf(edges: TrailEdge[]): TrailStep[] {
  return [...edges]
    .sort((a, b) => Number(BigInt(a.ts) - BigInt(b.ts)) || (a.ref < b.ref ? -1 : 1))
    .map((e) => ({
      word: isDecline(e) ? 'Refund declined' : kindWord(e.kind),
      kind: e.kind,
      from: e.from.ens,
      to: e.to.ens,
      amountMicro: BigInt(e.amountMicro) > 0n && !isDecline(e) ? e.amountMicro : null,
      ts: Number(e.ts),
      settlementTx: settlementTxOf(e.ref),
      synthetic: e.synthetic,
    }));
}

// What a refund leaves of a payment: the shop's net for the order.
export function netMicro(edges: Pick<TrailEdge, 'kind' | 'amountMicro'>[]): bigint {
  return edges.reduce((sum, e) => (e.kind === 'pay' || e.kind === 'renew' ? sum + BigInt(e.amountMicro) : e.kind === 'refund' ? sum - BigInt(e.amountMicro) : sum), 0n);
}
