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
import { sharedCustomerState } from './customer-state.server.ts';
import { readOrder, type OrderState } from './merchant-actions.server.ts';
import { syncConnection, whitechain } from './payments.server.ts';
import { cleanReason } from './refund-request.server.ts';
import { checkoutAddress, siteModel } from './site.server.ts';

export const DECLINE_COOLDOWN_MS = 60_000;
export const MAX_DECLINES_PER_MINUTE = 6;
const HEX32 = /^0x[0-9a-fA-F]{64}$/;

export type DeclineRefusalCode = 'BAD_ORDER' | 'NO_SUCH_ORDER' | 'NOT_OURS' | 'NOT_THE_STORY_BUYER' | 'NOT_REFUNDABLE' | 'NO_REQUEST' | 'ALREADY_DECIDED' | 'BAD_NOTE' | 'TOO_SOON';
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
  from: { ens: string };
  to: { ens: string };
}

export interface DeclineDeps {
  readOrder(orderId: string): Promise<OrderState>;
  trail(orderId: string): Promise<TrailEdge[]>;
  // The payer agent's ENS epoch, as its edges carry it.
  payerEpoch(): Promise<number>;
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
    const answer = await runGraphql({ engine: await arkivEngine(), query: 'query($id: String!) { order(id: $id) { kind amountMicro ts ref from { ens } to { ens } } }', variables: { id: orderId } });
    if (answer.errors?.length || answer.data === undefined) throw new Error('the graph did not answer');
    return (answer.data as { order: TrailEdge[] }).order;
  },
  payerEpoch: async () => (await sharedCustomerState()).agent.epoch,
  record: async (edge) => recordEdge(await syncConnection(), edge),
  now: () => Date.now(),
};

const recent = new Map<string, number>();
const inFlight = new Set<string>();
const writes: number[] = [];

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export async function declineRefund(input: { orderId?: unknown; note?: unknown }, deps: DeclineDeps = liveDeps): Promise<{ orderId: string; decision: 'declined'; amountMicro: string; requestRef: string; arkivTx: string; entityKey: string }> {
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
  const order = await deps.readOrder(orderId);
  if (order.status === 'NONE') throw new DeclineRefusal('NO_SUCH_ORDER', 404);
  if (!same(order.shopNode, namehash(model.merchant.ens))) throw new DeclineRefusal('NOT_OURS');
  // Public access (ADR-0069): a visitor answers for the shop only on the story persona's own orders.
  if (!same(order.buyerNode, namehash(model.persona.ens))) throw new DeclineRefusal('NOT_THE_STORY_BUYER', 403);
  if ((order.status !== 'PAID' && order.status !== 'DELIVERED') || order.amountMicro - order.refundedMicro <= 0n) throw new DeclineRefusal('NOT_REFUNDABLE');

  // The request this answers: the newest refund request from the payer agent to this shop for the order.
  const trail = await deps.trail(orderId);
  const byTs = (a: TrailEdge, b: TrailEdge) => Number(BigInt(b.ts) - BigInt(a.ts));
  const request = trail.filter((e) => e.kind === 'request' && e.ref.startsWith('req:') && same(e.from.ens, model.payer.ens) && same(e.to.ens, model.merchant.ens)).sort(byTs)[0];
  if (!request) throw new DeclineRefusal('NO_REQUEST');
  // Answered already: declined, or refunded, since the request.
  const answered = trail.find((e) => BigInt(e.ts) >= BigInt(request.ts) && ((e.kind === 'request' && e.ref.startsWith('dec:') && same(e.from.ens, model.merchant.ens)) || e.kind === 'refund'));
  if (answered) throw new DeclineRefusal('ALREADY_DECIDED');

  const now = deps.now();
  const lastAt = recent.get(orderId);
  if (inFlight.has(orderId) || (lastAt !== undefined && now - lastAt < DECLINE_COOLDOWN_MS)) throw new DeclineRefusal('TOO_SOON', 429);
  // W_SYNC's nonce is shared with the facilitator's refusal recorder and the refund requests.
  const cutoff = now - 60_000;
  while (writes.length && writes[0]! <= cutoff) writes.shift();
  if (writes.length >= MAX_DECLINES_PER_MINUTE) throw new DeclineRefusal('TOO_SOON', 429);
  writes.push(now);
  inFlight.add(orderId);
  try {
    const ts = Math.floor(now / 1000);
    const amount = BigInt(request.amountMicro);
    const written = await deps.record({
      // One ref per order and minute (at most 81 characters), so a retry after an uncertain write is the same record.
      ref: `dec:${orderId}:${Math.floor(ts / 60)}`,
      kind: 'request',
      from: { ens: model.merchant.ens, epoch: 0 },
      to: { ens: model.payer.ens, epoch: await deps.payerEpoch() },
      amountMicro: amount,
      ts,
      orderId,
      payload: toHex(JSON.stringify({ orderId, decision: 'declined', amountMicro: String(amount), requestRef: request.ref, note })),
    });
    recent.set(orderId, now);
    return { orderId, decision: 'declined', amountMicro: String(amount), requestRef: request.ref, arkivTx: written.txHash, entityKey: written.entityKey };
  } finally {
    inFlight.delete(orderId);
  }
}

// For tests only.
export function forgetDeclines(): void {
  recent.clear();
  inFlight.clear();
  writes.length = 0;
}
