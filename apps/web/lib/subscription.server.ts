// The customer's Subscribe and Cancel (WEBSITE_SPEC.md §3, §7; planning/SPEC/PAYMENTS_WHITECHAIN.md §3):
// the story's renewal plan as a subscription on the checkout. The payer agent's wallet is the
// subscriber and signs (it pays no gas); the story's persona is the subscriber node, so a cancel
// never counts against the paying agent's standing; RENEWER, the second relayer (E-1), sends; the
// renewal cron charges it on the labelled demo clock. The allowance the payer signs covers the
// plan's maxCharges and no more. This file holds every decision; the chain reads and the sends are
// injected (lib/subscription-live.server.ts), so the checks are tested without a key. Nothing the
// page sends chooses the plan, the price, the period, the shop or the subscription.
import { namehash } from 'viem';
import { siteModel } from './site.server.ts';
import type { SubscriptionSummary } from './contracts.ts';

export const SUBSCRIBE_WAITING_FOR = "the payer agent's and the renewer's keys on this server (the Coordinator sets them in Vercel)";
// One subscribe per instance at most this often: each costs the renewer's gas and the payer its first charge.
export const SUBSCRIBE_COOLDOWN_MS = 60_000;

export type SubscriptionRefusalCode =
  | 'NOT_THIS_PLAN'
  | 'ALREADY_SUBSCRIBED'
  | 'NO_SUBSCRIPTION'
  | 'NOT_THIS_SUBSCRIPTION'
  | 'NOT_ACTIVE'
  | 'TOO_SOON'
  | 'PAYER_NOT_ACTIVE'
  | 'PAYER_NOT_BOUND'
  | 'OVER_PASS'
  | 'BALANCE_LOW'
  | 'PAYEE_UNRESOLVED'
  | 'PAYEE_MISMATCH'
  | 'RENEWER_LOW'
  | 'CHECKOUT_REFUSED';
export class SubscriptionRefusal extends Error {
  code: SubscriptionRefusalCode;
  status: number;
  // Safe to show: a subscription id, or the checkout's own revert name.
  extra: Record<string, string>;
  constructor(code: SubscriptionRefusalCode, status = 409, extra: Record<string, string> = {}) {
    super(code);
    this.name = 'SubscriptionRefusal';
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

export type SubStatus = 'NONE' | 'ACTIVE' | 'LAPSED' | 'CANCELLED';

// One subscription as the checkout keeps it (GraphPayCheckout.SubState, plus its id).
export interface SubState {
  subId: string;
  subscriberNode: string;
  shopNode: string;
  payerNode: string;
  subscriber: string;
  merchant: string;
  amountMicro: bigint;
  period: number;
  nextChargeAt: bigint;
  cycle: number;
  retryAt: bigint;
  failures: number;
  status: SubStatus;
}

// The story's plan, as the chain sees it.
export interface Plan {
  plan: string;
  item: string;
  sku: string;
  shopEns: string;
  shopNode: string;
  subscriberEns: string;
  subscriberNode: string;
  payerEns: string;
  payerNode: string;
  priceMicro: bigint;
  periodSeconds: number;
  periodLabel: string;
  maxCharges: number;
}

export function planOf(model = siteModel()): Plan {
  const r = model.renewal;
  const priceMicro = BigInt(r.priceMicro);
  const { seconds, label, maxCharges } = r.demoPeriod;
  // A malformed story never reaches a signature.
  if (priceMicro <= 0n || !Number.isInteger(seconds) || seconds < 60 || !Number.isInteger(maxCharges) || maxCharges < 1 || maxCharges > 10) throw new Error('story config: renewal is malformed');
  return {
    plan: r.plan,
    item: r.item,
    sku: r.sku,
    shopEns: r.shopEns,
    shopNode: namehash(r.shopEns).toLowerCase(),
    subscriberEns: model.persona.ens,
    subscriberNode: namehash(model.persona.ens).toLowerCase(),
    payerEns: model.payer.ens,
    payerNode: namehash(model.payer.ens).toLowerCase(),
    priceMicro,
    periodSeconds: seconds,
    periodLabel: label,
    maxCharges,
  };
}

// The payer's own subscriptions to the plan, in the order given (newest first).
export function ofPlan(subs: SubState[], plan: Plan): SubState[] {
  return subs.filter((s) => s.payerNode.toLowerCase() === plan.payerNode && s.subscriberNode.toLowerCase() === plan.subscriberNode && s.shopNode.toLowerCase() === plan.shopNode && s.status !== 'NONE');
}

// What a send answers: 'confirmed' with what its receipt shows, or 'pending' (sent, no receipt in time).
export interface Created {
  subId: string;
  transaction: string;
  status: 'confirmed' | 'pending';
  firstChargeAt: number;
  // When the checkout charges next (its nextChargeAt, or its retry time after a failed charge).
  nextChargeAt: number;
  // The first charge runs in the same transaction: its renewal order, or the reason it failed.
  charged: boolean | null;
  firstOrderId: string | null;
  failReason: string | null;
  allowanceMicro: string;
}

export interface Cancelled {
  subId: string;
  transaction: string;
  status: 'confirmed' | 'pending';
  effectiveAt: number | null;
}

export interface SubscriptionDeps {
  // The payer agent's status as the customer phone reads it (ENS and the policy).
  payerStatus(): Promise<string>;
  // The checkout's newest subscriptions, newest first.
  latest(): Promise<SubState[]>;
  create(plan: Plan): Promise<Created>;
  cancel(sub: SubState, plan: Plan): Promise<Cancelled>;
  now(): number;
}

export interface SubscribeResult {
  status: 'active' | 'pending';
  subId: string;
  plan: string;
  item: string;
  sku: string;
  shopEns: string;
  priceMicro: string;
  periodSeconds: number;
  period: string;
  maxCharges: number;
  allowanceMicro: string;
  firstChargeAt: string;
  nextChargeAt: string;
  transaction: string;
  firstCharge: { orderId: string | null; charged: boolean | null; failReason: string | null };
}

export interface CancelResult {
  status: 'cancelled' | 'pending';
  subId: string;
  transaction: string;
  effectiveAt: string | null;
}

const iso = (s: number | bigint) => new Date(Number(s) * 1000).toISOString();

let subscribing = false;
let cancelling = false;
let lastSubscribe = Number.NEGATIVE_INFINITY;

export async function subscribe(input: { plan?: unknown }, deps: SubscriptionDeps): Promise<SubscribeResult> {
  const plan = planOf();
  // The page may name the plan; it can only name this one.
  if (input.plan !== undefined && input.plan !== null && input.plan !== plan.plan) throw new SubscriptionRefusal('NOT_THIS_PLAN', 400);
  const now = deps.now();
  if (subscribing || now - lastSubscribe < SUBSCRIBE_COOLDOWN_MS) throw new SubscriptionRefusal('TOO_SOON', 429);
  subscribing = true;
  try {
    // A paused, revoked or unreadable payer agent starts nothing.
    if ((await deps.payerStatus()) !== 'ACTIVE') throw new SubscriptionRefusal('PAYER_NOT_ACTIVE');
    // One live subscription to the plan at a time: a second would share the payer's one Permit2 allowance.
    const active = ofPlan(await deps.latest(), plan).find((s) => s.status === 'ACTIVE');
    if (active) throw new SubscriptionRefusal('ALREADY_SUBSCRIBED', 409, { subId: active.subId });
    lastSubscribe = now;
    let created: Created;
    try {
      created = await deps.create(plan);
    } catch (error) {
      // A refusal before anything was signed or sent frees the cooldown; any other failure keeps it.
      if (error instanceof SubscriptionRefusal) lastSubscribe = Number.NEGATIVE_INFINITY;
      throw error;
    }
    return {
      status: created.status === 'confirmed' ? 'active' : 'pending',
      subId: created.subId,
      plan: plan.plan,
      item: plan.item,
      sku: plan.sku,
      shopEns: plan.shopEns,
      priceMicro: String(plan.priceMicro),
      periodSeconds: plan.periodSeconds,
      period: plan.periodLabel,
      maxCharges: plan.maxCharges,
      allowanceMicro: created.allowanceMicro,
      firstChargeAt: iso(created.firstChargeAt),
      nextChargeAt: iso(created.nextChargeAt),
      transaction: created.transaction,
      firstCharge: { orderId: created.firstOrderId, charged: created.charged, failReason: created.failReason },
    };
  } finally {
    subscribing = false;
  }
}

export async function cancelSubscription(input: { subId?: unknown }, deps: SubscriptionDeps): Promise<CancelResult> {
  const plan = planOf();
  if (cancelling) throw new SubscriptionRefusal('TOO_SOON', 429);
  cancelling = true;
  try {
    const mine = ofPlan(await deps.latest(), plan);
    let sub: SubState | undefined;
    // The page may name the subscription; it can only name one of the payer's own to this plan.
    if (input.subId !== undefined && input.subId !== null) {
      sub = mine.find((s) => s.subId.toLowerCase() === String(input.subId).toLowerCase());
      if (!sub) throw new SubscriptionRefusal('NOT_THIS_SUBSCRIPTION');
    } else {
      sub = mine.find((s) => s.status === 'ACTIVE');
      if (!sub) throw new SubscriptionRefusal('NO_SUBSCRIPTION', 404);
    }
    if (sub.status !== 'ACTIVE') throw new SubscriptionRefusal('NOT_ACTIVE', 409, { subId: sub.subId });
    const sent = await deps.cancel(sub, plan);
    return { status: sent.status === 'confirmed' ? 'cancelled' : 'pending', subId: sent.subId, transaction: sent.transaction, effectiveAt: sent.effectiveAt === null ? null : iso(sent.effectiveAt) };
  } finally {
    cancelling = false;
  }
}

// The customer phone's subscription line: the payer's newest subscription to the plan, with its
// charges (newest first) and how many more the allowance it signed still covers.
export function summaryOf(sub: SubState, plan: Plan, charges: { at: number; transaction: string }[], allowance: { amount: bigint; expiration: number }, nowS: number): SubscriptionSummary {
  const active = sub.status === 'ACTIVE';
  const usable = allowance.expiration > nowS ? allowance.amount : 0n;
  const chargesLeft = active && sub.amountMicro > 0n ? Number(usable / sub.amountMicro) : 0;
  const due = sub.retryAt > sub.nextChargeAt ? sub.retryAt : sub.nextChargeAt;
  return {
    subId: sub.subId,
    plan: plan.plan,
    period: plan.periodLabel,
    priceMicro: String(sub.amountMicro),
    nextChargeAt: active && chargesLeft > 0 ? iso(due) : null,
    renewals: [...charges].sort((a, b) => b.at - a.at).map((c) => ({ at: iso(c.at), transaction: c.transaction })),
    active,
    status: sub.status === 'NONE' ? 'CANCELLED' : sub.status,
    cycle: sub.cycle,
    periodSeconds: sub.period,
    chargesLeft,
    item: plan.item,
    shopEns: plan.shopEns,
  };
}

// For tests only.
export function forgetSubscriptions(): void {
  subscribing = false;
  cancelling = false;
  lastSubscribe = Number.NEGATIVE_INFINITY;
}
