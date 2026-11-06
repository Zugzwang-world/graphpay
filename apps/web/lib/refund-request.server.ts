// The customer phone's "Request refund" (WEBSITE_SPEC.md §3, §7): a `request` edge on Arkiv,
// payer agent to shop, written by the recorder's W_SYNC key. It is gasless, moves no tally and
// moves no money: the merchant decides and refunds on Whitechain themselves. The order is never
// taken from the page: it is the payer agent's newest payment (the same read the phone shows),
// checked against the checkout contract (this shop's, paid, with an amount left to refund).
import { namehash, toHex } from 'viem';
import { recordEdge } from '@graphpay/money-graph';
import { sharedCustomerState } from './customer-state.server.ts';
import { readOrder, type OrderState } from './merchant-actions.server.ts';
import { syncConnection, whitechain } from './payments.server.ts';
import { checkoutAddress, siteModel } from './site.server.ts';
import { MAX_SYNC_WRITES_PER_MINUTE, forgetSyncWrites, takeSyncWrite } from './sync-writes.server.ts';

export const REFUND_WAITING_FOR = "the recorder's key on this server (the Coordinator sets it in Vercel)";
const KEY_SHAPE = /^0x[0-9a-fA-F]{64}$/;
export const REASON_MAX = 140;
// One request per order per minute on this instance: a double tap is one record, not two.
export const COOLDOWN_MS = 60_000;

export type RefundRefusalCode = 'NO_ORDER' | 'NOT_THIS_ORDER' | 'NOT_OURS' | 'NOT_REFUNDABLE' | 'BAD_AMOUNT' | 'OVER_REFUNDABLE' | 'BAD_REASON' | 'TOO_SOON';
export class RefundRefusal extends Error {
  code: RefundRefusalCode;
  status: number;
  constructor(code: RefundRefusalCode, status = 409) {
    super(code);
    this.name = 'RefundRefusal';
    this.code = code;
    this.status = status;
  }
}

export function recorderKeyConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return KEY_SHAPE.test(env.W_SYNC_PRIVATE_KEY ?? '');
}

export interface RefundDeps {
  // The payer agent's newest payment, and the ENS epoch its edges carry.
  lastOrder(): Promise<{ orderId: string; epoch: number } | null>;
  readOrder(orderId: string): Promise<OrderState>;
  record(edge: Parameters<typeof recordEdge>[1]): Promise<{ entityKey: string; txHash: string }>;
  now(): number;
}

const liveDeps: RefundDeps = {
  lastOrder: async () => {
    const state = await sharedCustomerState();
    return state.lastOrder ? { orderId: state.lastOrder.orderId, epoch: state.agent.epoch } : null;
  },
  readOrder: async (orderId) => {
    const checkout = checkoutAddress();
    if (!checkout) throw new Error('the checkout is not deployed');
    const w = await whitechain();
    const chain = { publicClient: w.publicClient, checkout: checkout as `0x${string}` };
    return readOrder(chain, orderId);
  },
  record: async (edge) => recordEdge(await syncConnection(), edge),
  now: () => Date.now(),
};

const recent = new Map<string, number>();
const inFlight = new Set<string>();
// Shared with the shop's declines (lib/sync-writes.server.ts).
export const MAX_WRITES_PER_MINUTE = MAX_SYNC_WRITES_PER_MINUTE;

// Plain printable text only: the reason is written to a public graph. No contact details or links
// either (no personal data, ADR-0003): no @, / or :, and no run of six digits or more.
export function cleanReason(value: unknown): string {
  if (typeof value !== 'string') throw new RefundRefusal('BAD_REASON', 400);
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length === 0 || text.length > REASON_MAX || /[^\p{L}\p{M}\p{N}\p{P}\p{Zs}\p{Sc}]/u.test(text)) throw new RefundRefusal('BAD_REASON', 400);
  if (/[@/:]/.test(text) || /\p{N}{6,}/u.test(text)) throw new RefundRefusal('BAD_REASON', 400);
  return text;
}

export async function requestRefund(input: { orderId?: unknown; amountMicro: unknown; reason: unknown }, deps: RefundDeps = liveDeps): Promise<{ orderId: string; amountMicro: string; arkivTx: string; entityKey: string }> {
  const reason = cleanReason(input.reason);
  if (typeof input.amountMicro !== 'string' || !/^[1-9][0-9]{0,15}$/.test(input.amountMicro)) throw new RefundRefusal('BAD_AMOUNT', 400);
  const amount = BigInt(input.amountMicro);
  const last = await deps.lastOrder();
  if (!last) throw new RefundRefusal('NO_ORDER');
  const orderId = last.orderId;
  // The page may name the order; it can only name this one.
  if (input.orderId !== undefined && input.orderId !== null && String(input.orderId).toLowerCase() !== orderId.toLowerCase()) throw new RefundRefusal('NOT_THIS_ORDER');
  const model = siteModel();
  const order = await deps.readOrder(orderId);
  if (order.status === 'NONE') throw new RefundRefusal('NO_ORDER', 404);
  if (order.shopNode.toLowerCase() !== namehash(model.merchant.ens).toLowerCase()) throw new RefundRefusal('NOT_OURS');
  // The buyer on the order is the payer agent or the person it acts for.
  const buyers = [model.payer.ens, model.persona.ens].map((ens) => namehash(ens).toLowerCase());
  if (!buyers.includes(order.buyerNode.toLowerCase())) throw new RefundRefusal('NOT_OURS');
  if (order.status !== 'PAID' && order.status !== 'DELIVERED') throw new RefundRefusal('NOT_REFUNDABLE');
  const left = order.amountMicro - order.refundedMicro;
  if (left <= 0n) throw new RefundRefusal('NOT_REFUNDABLE');
  if (amount > left) throw new RefundRefusal('OVER_REFUNDABLE');

  const key = orderId.toLowerCase();
  const now = deps.now();
  const lastAt = recent.get(key);
  if (inFlight.has(key) || (lastAt !== undefined && now - lastAt < COOLDOWN_MS)) throw new RefundRefusal('TOO_SOON', 429);
  // A cap on all orders too: W_SYNC's nonce is shared with the facilitator's refusal recorder.
  if (!takeSyncWrite(now)) throw new RefundRefusal('TOO_SOON', 429);
  inFlight.add(key);
  try {
    const ts = Math.floor(now / 1000);
    const written = await deps.record({
      // At most 81 characters (Arkiv refuses a string over 128). One ref per order and
      // minute, so a retry after an uncertain write is the same record, which recordEdge reads back.
      ref: `req:${key}:${Math.floor(ts / 60)}`,
      kind: 'request',
      from: { ens: model.payer.ens, epoch: last.epoch },
      to: { ens: model.merchant.ens, epoch: 0 },
      amountMicro: amount,
      ts,
      orderId: key,
      payload: toHex(JSON.stringify({ orderId: key, amountMicro: String(amount), reason })),
    });
    recent.set(key, now);
    return { orderId: key, amountMicro: String(amount), arkivTx: written.txHash, entityKey: written.entityKey };
  } finally {
    inFlight.delete(key);
  }
}

// For tests only.
export function forgetRefundRequests(): void {
  recent.clear();
  inFlight.clear();
  forgetSyncWrites();
}
