// The customer phone's state (WEBSITE_SPEC.md §3, §7), assembled from three sources that
// each fail on their own: the agent's ENS name on Sepolia (status), the checkout contract's
// AgentPolicy and spent-today on Whitechain (cap, expiry, revoked), and the money graph on
// Arkiv (the last order and what became of it). A stopped agent never reads Active: any
// source that says paused, revoked or expired wins, and an unreadable name is UNKNOWN.

import type { AgentStatus, OrderSummary } from './contracts.ts';
import { settlementTxOf } from './merchant-feed.ts';

export interface Policy {
  epoch: number;
  wallet: string;
  revoked: boolean;
  dailyCapMicro: bigint;
  // Unix seconds; 0 means no expiry.
  expiry: bigint;
}

const ZERO = '0x0000000000000000000000000000000000000000';

// null when the contract holds no policy for the node (nothing was ever set).
export function policyOf(raw: { epoch: number | bigint; wallet: string; revoked: boolean; dailyCapMicro: bigint; expiry: bigint }): Policy | null {
  if (raw.wallet.toLowerCase() === ZERO && !raw.revoked && raw.dailyCapMicro === 0n && raw.expiry === 0n) return null;
  return { epoch: Number(raw.epoch), wallet: raw.wallet, revoked: raw.revoked, dailyCapMicro: raw.dailyCapMicro, expiry: raw.expiry };
}

export type EnsStatus = 'ACTIVE' | 'PAUSED' | 'REVOKED' | 'EXPIRED' | 'UNKNOWN';

// What the phone shows. Revoked beats expired beats paused beats active; the ENS name
// being unreadable is UNKNOWN (never Active), and so is a name with no policy.
export function agentStatusOf(ens: EnsStatus, policy: Policy | null, nowS: number): AgentStatus {
  if (policy?.revoked || ens === 'REVOKED') return 'REVOKED';
  if (ens === 'EXPIRED' || (policy && policy.expiry > 0n && policy.expiry <= BigInt(nowS))) return 'EXPIRED';
  if (ens === 'PAUSED') return 'PAUSED';
  if (ens === 'ACTIVE' && policy) return 'ACTIVE';
  return 'UNKNOWN';
}

export interface OrderEdge {
  kind: string;
  amountMicro: string;
  ts: string;
  ref: string;
  orderId: string | null;
  to?: { ens: string };
}

// The newest payment among the payer's `pay` edges that carries an order id.
export function newestPayment(edges: OrderEdge[]): OrderEdge | null {
  let best: OrderEdge | null = null;
  for (const e of edges) {
    if (e.kind !== 'pay' || !e.orderId) continue;
    if (!best || BigInt(e.ts) > BigInt(best.ts)) best = e;
  }
  return best;
}

// What became of an order, from every edge that carries its id.
export function orderStatusOf(payment: OrderEdge, trail: Pick<OrderEdge, 'kind' | 'amountMicro'>[]): OrderSummary['status'] {
  const refunded = trail.filter((e) => e.kind === 'refund').reduce((sum, e) => sum + BigInt(e.amountMicro), 0n);
  const paid = BigInt(payment.amountMicro);
  if (refunded > 0n) return refunded >= paid ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
  if (trail.some((e) => e.kind === 'deliver')) return 'DELIVERED';
  return 'PAID';
}

export function orderSummary(payment: OrderEdge, trail: Pick<OrderEdge, 'kind' | 'amountMicro'>[]): OrderSummary | null {
  const tx = settlementTxOf(payment.ref);
  if (!payment.orderId || !payment.to || !tx) return null;
  return { orderId: payment.orderId, shopEns: payment.to.ens, item: null, quantity: null, amountMicro: payment.amountMicro, status: orderStatusOf(payment, trail), transaction: tx };
}
