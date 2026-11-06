// The merchant phone's "Decline" (WEBSITE_SPEC.md §4, §7): the shop's answer to a refund request,
// recorded on Arkiv as a `request` edge from the shop to the payer agent (ref `dec:<order>:<minute>`),
// written by the recorder's W_SYNC key. It moves no money and no tally (a decline is not a failed
// payment). The order is read from the checkout contract (this shop's, the story persona's, still
// refundable) and the request it answers is read from the graph: no request on the record, no decline.
// The kind is `request` on purpose: the recorder writes `fail` and `request` only, and a `fail`
// touching the shop would count against it.
import { namehash, toHex } from 'viem';
import { recordEdge, runGraphql } from '@graphpay/money-graph';
import { arkivEngine } from '../app/api/graphql/arkiv.server.ts';
import { readOrder, type OrderState } from './merchant-actions.server.ts';
import { syncConnection, whitechain } from './payments.server.ts';
import { cleanReason } from './refund-request.server.ts';
import { checkoutAddress, siteModel } from './site.server.ts';
import { forgetSyncWrites, takeSyncWrite } from './sync-writes.server.ts';

export const DECLINE_COOLDOWN_MS = 60_000;
const HEX32 = /^0x[0-9a-fA-F]{64}$/;
// The graph's order(id) answers at most this many edges; a longer trail is not read whole.
const TRAIL_CAP = 100;

export type DeclineRefusalCode = 'BAD_ORDER' | 'NO_SUCH_ORDER' | 'NOT_OURS' | 'NOT_THE_STORY_BUYER' | 'NOT_REFUNDABLE' | 'NO_REQUEST' | 'ALREADY_DECIDED' | 'STILL_PENDING' | 'TRAIL_TOO_LONG' | 'BAD_NOTE' | 'TOO_SOON';
export class DeclineRefusal extends Error {
  code: DeclineRefusalCode;
  status: number;
  constructor(code: DeclineRefusalCode, status = 409) {
    super(code);
    this.name = 'DeclineRefusal';
    this.code = code;
    this.status = status;
  }
}

// An edge that carries the order id, as the graph's `order(id)` answers it.
export interface TrailEdge {
  kind: string;
  amountMicro: string;
  ts: string;
  ref: string;
  fromEpoch: number;
  from: { ens: string };
  to: { ens: string };
}

export interface DeclineDeps {
  readOrder(orderId: string): Promise<OrderState>;
  trail(orderId: string): Promise<TrailEdge[]>;
  record(edge: Parameters<typeof recordEdge>[1]): Promise<{ entityKey: string; txHash: string }>;
  now(): number;
}

const liveDeps: DeclineDeps = {
  readOrder: async (orderId) => {
    const checkout = checkoutAddress();
    if (!checkout) throw new Error('the checkout is not deployed');
    const w = await whitechain();
    return readOrder({ publicClient: w.publicClient, checkout: checkout as `0x${string}` }, orderId);
  },
  trail: async (orderId) => {
    const answer = await runGraphql({ engine: await arkivEngine(), query: 'query($id: String!) { order(id: $id) { kind amountMicro ts ref fromEpoch from { ens } to { ens } } }', variables: { id: orderId } });
    if (answer.errors?.length || answer.data === undefined) throw new Error('the graph did not answer');
    return (answer.data as { order: TrailEdge[] }).order;
  },
  record: async (edge) => recordEdge(await syncConnection(), edge),
  now: () => Date.now(),
};

const recent = new Map<string, number>();
const inFlight = new Set<string>();

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export interface DeclineResult {
  orderId: string;
  decision: 'declined';
  amountMicro: string;
  requestRef: string;
  ref: string;
  note: string | null;
  // null when this decline was already on the record (a retry after a write that did land).
  arkivTx: string | null;
  entityKey: string | null;
}

export async function declineRefund(input: { orderId?: unknown; note?: unknown }, deps: DeclineDeps = liveDeps): Promise<DeclineResult> {
  if (typeof input.orderId !== 'string' || !HEX32.test(input.orderId)) throw new DeclineRefusal('BAD_ORDER', 400);
  const orderId = input.orderId.toLowerCase();
  let note: string | null = null;
  if (input.note !== undefined && input.note !== null && input.note !== '') {
    try {
      note = cleanReason(input.note);
    } catch {
      throw new DeclineRefusal('BAD_NOTE', 400);
    }
  }
  const model = siteModel();
  // One decline per order at a time, and per minute, before anything is read.
  const now = deps.now();
  const lastAt = recent.get(orderId);
  if (inFlight.has(orderId) || (lastAt !== undefined && now - lastAt < DECLINE_COOLDOWN_MS)) throw new DeclineRefusal('TOO_SOON', 429);
  inFlight.add(orderId);
  try {
    return await decide(orderId, note, model, deps, now);
  } finally {
    inFlight.delete(orderId);
  }
}

async function decide(orderId: string, note: string | null, model: ReturnType<typeof siteModel>, deps: DeclineDeps, now: number): Promise<DeclineResult> {
  const order = await deps.readOrder(orderId);
  if (order.status === 'NONE') throw new DeclineRefusal('NO_SUCH_ORDER', 404);
  if (!same(order.shopNode, namehash(model.merchant.ens))) throw new DeclineRefusal('NOT_OURS');
  // Public access (ADR-0069): a visitor answers for the shop only on the story persona's own orders.
  if (!same(order.buyerNode, namehash(model.persona.ens))) throw new DeclineRefusal('NOT_THE_STORY_BUYER', 403);
  if ((order.status !== 'PAID' && order.status !== 'DELIVERED') || order.amountMicro - order.refundedMicro <= 0n) throw new DeclineRefusal('NOT_REFUNDABLE');

  // The request this answers: the newest refund request from the payer agent to this shop for the order.
  const trail = await deps.trail(orderId);
  if (trail.length >= TRAIL_CAP) throw new DeclineRefusal('TRAIL_TOO_LONG');
  // A refund the chain has but the graph does not show yet (the mirror is behind): nothing is
  // decided against a trail that is not up to date.
  const refundedOnGraph = trail.filter((e) => e.kind === 'refund').reduce((sum, e) => sum + BigInt(e.amountMicro), 0n);
  if (order.refundedMicro > refundedOnGraph) throw new DeclineRefusal('STILL_PENDING');
  const byTs = (a: TrailEdge, b: TrailEdge) => Number(BigInt(b.ts) - BigInt(a.ts));
  const request = trail.filter((e) => e.kind === 'request' && e.ref.startsWith('req:') && same(e.from.ens, model.payer.ens) && same(e.to.ens, model.merchant.ens)).sort(byTs)[0];
  if (!request) throw new DeclineRefusal('NO_REQUEST');
  // One decline per request: its ref carries the request's own minute, so a retry or a second instance
  // writes the same ref (readers merge by ref), and a decline already on the record is answered as done.
  const minute = request.ref.split(':')[2];
  const ref = `dec:${orderId}:${/^\d{1,12}$/.test(minute ?? '') ? minute : Math.floor(Number(BigInt(request.ts)) / 60)}`;
  const amount = BigInt(request.amountMicro);
  const done = { orderId, decision: 'declined' as const, amountMicro: String(amount), requestRef: request.ref, ref, note };
  if (trail.some((e) => e.kind === 'request' && e.ref === ref && same(e.from.ens, model.merchant.ens))) return { ...done, arkivTx: null, entityKey: null };
  // Answered already: declined, or refunded, since the request.
  const answered = trail.find((e) => BigInt(e.ts) >= BigInt(request.ts) && ((e.kind === 'request' && e.ref.startsWith('dec:') && same(e.from.ens, model.merchant.ens)) || e.kind === 'refund'));
  if (answered) throw new DeclineRefusal('ALREADY_DECIDED');
  // W_SYNC's nonce is shared with the facilitator's refusal recorder and the refund requests: one cap.
  if (!takeSyncWrite(now)) throw new DeclineRefusal('TOO_SOON', 429);
  const ts = Math.floor(now / 1000);
  const written = await deps.record({
    ref,
    kind: 'request',
    from: { ens: model.merchant.ens, epoch: 0 },
    // The payer agent's epoch as its request carried it.
    to: { ens: model.payer.ens, epoch: request.fromEpoch },
    amountMicro: amount,
    ts,
    orderId,
    payload: toHex(JSON.stringify({ orderId, decision: 'declined', amountMicro: String(amount), requestRef: request.ref, note })),
  });
  recent.set(orderId, now);
  return { ...done, arkivTx: written.txHash, entityKey: written.entityKey };
}

// For tests only.
export function forgetDeclines(): void {
  recent.clear();
  inFlight.clear();
  forgetSyncWrites();
}
