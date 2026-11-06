// The customer phone's Re-order (WEBSITE_SPEC.md §3, §7): the payer agent signs one payment for
// the story's re-order, as a child of its newest order, through the hosted shop and facilitator.
// This file holds every decision; the signer and the shop calls are injected (lib/reorder-live.server.ts),
// so the checks are tested without a key. Nothing the page sends chooses the order, the item, the
// quantity, the price or the shop: they come from the chain and the story.
import { namehash } from 'viem';
import type { OrderState } from './merchant-actions.server.ts';
import { siteModel } from './site.server.ts';

export const REORDER_WAITING_FOR = "the payer agent's key on this server (the Coordinator sets it in Vercel)";
// A tap is one re-order: another for the same parent waits this long (the shop's order id changes
// with every quote, so only this guard and the pass's cap stand between a double tap and two payments).
export const REORDER_COOLDOWN_MS = 120_000;

export type ReorderRefusalCode = 'NO_ORDER' | 'NOT_THIS_ORDER' | 'NOT_OURS' | 'NOT_REORDERABLE' | 'PRICE_CHANGED' | 'TOO_SOON';
export class ReorderRefusal extends Error {
  code: string;
  status: number;
  constructor(code: ReorderRefusalCode | string, status = 409) {
    super(code);
    this.name = 'ReorderRefusal';
    this.code = code;
    this.status = status;
  }
}

export interface ReorderQuote {
  // The buyer name the quote was built for (the payer agent signs as it).
  buyer: string;
  terms: Record<string, unknown>;
  payUrl: string;
  priceMicro: string;
  quantity: number;
}

// What the payer agent's buyer answers (the payer's pay step): paid, unknown (the signature may still
// settle), failed, not_payable or free.
export interface PayOutcome {
  status: string;
  orderId?: string;
  transaction?: string;
  reason?: string;
  amountMicro?: bigint | string;
}

export interface ReorderDeps {
  lastOrderId(): Promise<string | null>;
  readOrder(orderId: string): Promise<OrderState>;
  quote(input: { parentOrderId: string; buyer: string }): Promise<ReorderQuote>;
  pay(quote: ReorderQuote): Promise<PayOutcome>;
  now(): number;
}

export interface ReorderResult {
  status: 'paid' | 'pending';
  orderId: string | null;
  parentOrderId: string;
  amountMicro: string;
  transaction?: string;
}

// Holds, by parent order and for the payer agent as a whole: the newest order moves to the child
// once its edge reaches the graph, so a hold on the parent alone would let the same tap pay twice.
const holds = new Map<string, number>();
let busy = false;

// A buyer's refusal code (the buyer's refusal code, such as OVER_PERIOD_CAP or PASS_REVOKED)
// reaches the phone; any other failure text never does.
const SAFE_CODE = /^[A-Z][A-Z0-9_]{2,39}$/;
export const codeOf = (value: unknown): string | null => {
  const code = (value as { code?: unknown } | null)?.code;
  return typeof code === 'string' && SAFE_CODE.test(code) ? code : null;
};

// Refusals the buyer raises before it signs anything: after one of these no signature exists, so
// the hold is released. Any other error keeps the hold (a signature may exist).
const BEFORE_SIGNING = new Set([
  'NOT_FOR_THIS_PAYER', 'NOT_FOR_THIS_BUYER', 'ORDER_EXPIRED', 'DEADLINE_TOO_FAR', 'MERCHANT_NOT_ALLOWED', 'OVER_PAYMENT_MAX',
  'OVER_CALLER_MAX', 'MANDATE_EXPIRED', 'MERCHANT_NOT_IN_MANDATE', 'OVER_BUDGET', 'MERCHANT_NOT_VERIFIED', 'MERCHANT_HIGH_RISK',
  'OVER_PERIOD_CAP', 'NO_PASS', 'PASS_REVOKED', 'PASS_EXPIRED', 'OVER_DAILY_CAP', 'WRONG_CHAIN', 'BAD_402',
]);

// The quote's own terms must be what was asked for (the key signs these, and nothing else).
export function termsMatch(terms: Record<string, unknown>, expected: Record<string, string | number>): boolean {
  return Object.entries(expected).every(([field, value]) => String(terms[field] ?? '').toLowerCase() === String(value).toLowerCase());
}

export async function reorder(input: { parentOrderId?: unknown }, deps: ReorderDeps): Promise<ReorderResult> {
  const parentOrderId = await deps.lastOrderId();
  if (!parentOrderId) throw new ReorderRefusal('NO_ORDER');
  const key = parentOrderId.toLowerCase();
  // The page may name the order; it can only name this one.
  if (input.parentOrderId !== undefined && input.parentOrderId !== null && String(input.parentOrderId).toLowerCase() !== key) throw new ReorderRefusal('NOT_THIS_ORDER');
  const model = siteModel();
  const parent = await deps.readOrder(key);
  if (parent.status === 'NONE') throw new ReorderRefusal('NO_ORDER', 404);
  if (parent.shopNode.toLowerCase() !== namehash(model.merchant.ens).toLowerCase()) throw new ReorderRefusal('NOT_OURS');
  // The buyer name the first order used: whichever of the payer agent and its person hashes to the order's buyer.
  const buyer = [model.payer.ens, model.persona.ens].find((ens) => namehash(ens).toLowerCase() === parent.buyerNode.toLowerCase());
  if (!buyer) throw new ReorderRefusal('NOT_OURS');
  // A refunded order may be ordered again (the checkout and the shop accept it: the coffee that was
  // refunded is exactly what "another coffee" replaces); an unpaid or cancelled one may not.
  if (parent.status !== 'PAID' && parent.status !== 'DELIVERED' && parent.status !== 'REFUNDED') throw new ReorderRefusal('NOT_REORDERABLE');

  const now = deps.now();
  const agentKey = `agent:${model.payer.ens}`;
  const held = (k: string) => (holds.get(k) ?? 0) > now;
  if (busy || held(key) || held(agentKey)) throw new ReorderRefusal('TOO_SOON', 429);
  busy = true;
  const release = () => {
    holds.delete(key);
    holds.delete(agentKey);
  };
  try {
    const quote = await deps.quote({ parentOrderId: key, buyer });
    // What the phone shows is what is paid: the shop's price and quantity must be the story's, and the
    // terms the key will sign must be this shop's, this item, this buyer and this parent.
    const expected = { shop: model.merchant.ens, item: model.order.reorder.sku, quantity: model.order.reorder.quantity, priceMicro: model.order.reorder.priceMicro, parentOrderId: key, buyer, payer: model.payer.ens };
    if (quote.priceMicro !== model.order.reorder.priceMicro || quote.quantity !== model.order.reorder.quantity || !termsMatch(quote.terms, expected)) throw new ReorderRefusal('PRICE_CHANGED');
    // From here a signature may exist, and it can settle until its deadline (plus a minute for clock skew):
    // no other re-order starts before then, unless this one is known paid or known unsigned.
    const exp = Number(quote.terms.exp);
    const settleBy = Number.isFinite(exp) ? exp * 1000 + 60_000 : now + 11 * 60_000;
    const until = Math.max(now + REORDER_COOLDOWN_MS, settleBy);
    holds.set(key, until);
    holds.set(agentKey, until);
    let outcome: PayOutcome;
    try {
      outcome = await deps.pay(quote);
    } catch (error) {
      const code = codeOf(error);
      if (code && BEFORE_SIGNING.has(code)) release();
      throw error;
    }
    const amountMicro = String(outcome.amountMicro ?? quote.priceMicro);
    if (outcome.status === 'paid') {
      // Settled: the next re-order may follow after the cooldown (the graph needs a moment to show the child).
      holds.set(key, now + REORDER_COOLDOWN_MS);
      holds.set(agentKey, now + REORDER_COOLDOWN_MS);
      return { status: 'paid', orderId: outcome.orderId ?? null, parentOrderId: key, amountMicro, transaction: outcome.transaction };
    }
    // The signature may still settle: it is pending, never a refusal, and the hold stays until it cannot.
    if (outcome.status === 'unknown') return { status: 'pending', orderId: outcome.orderId ?? null, parentOrderId: key, amountMicro, transaction: outcome.transaction };
    // Definitely not paid (the buyer released the signature) or nothing to sign.
    release();
    throw new ReorderRefusal(outcome.status === 'failed' && outcome.reason && SAFE_CODE.test(outcome.reason) ? outcome.reason : 'NOT_PAID');
  } finally {
    busy = false;
  }
}

// For tests only.
export function forgetReorders(): void {
  holds.clear();
  busy = false;
}
