// The payer agent's limits, shown live (ADR-0073; planning/ACCEPTANCE_TESTS.md B3 and C4(b)):
// - Over the pass: the payer agent asks the shop for the story's "everyone" order and signs it; the
//   signed attempt goes to our facilitator's verify step only, which can never send. It refuses
//   (the ENS gate's CAP_EXCEEDED: the lower of the ENS cap and the policy cap) and its recorder writes
//   the refusal to Arkiv as a `fail` edge. Only an attempt above the whole pass is signed at all.
// - The agent tries to raise its own cap in ENS: simulated as the agent's own address on Sepolia, the
//   name's resolver refuses (EACUnauthorizedAccountRoles: only the owner may set it). Nothing is sent;
//   the attempt and its revert reason are recorded on Arkiv as a `request` edge, agent to owner.
// A repeat within a minute (another visitor's tap) is answered with the last result, so the stage never
// sees a 429 and Arkiv one record. This file holds the decisions; the reads, the signature and the
// writes are injected (lib/limits-live.server.ts), so the checks are tested without a key.
import { siteModel } from './site.server.ts';

export const LIMITS_WAITING_FOR = "the payer agent's, the recorder's and the facilitator's keys on this server (the Coordinator sets them in Vercel)";
// One attempt of each kind per instance at most this often; a repeat inside it gets the last result.
export const LIMIT_COOLDOWN_MS = 60_000;
// The largest cap an attempt may ask for (micro-USDT): a simulated value, but a bounded one.
export const MAX_ATTEMPTED_CAP_MICRO = 1_000_000_000_000n;
// The resolver's refusal of a write by an account without the role (acceptance B3); any other revert
// is no proof of the scope, so nothing is recorded for it.
export const EXPECTED_REVERT = 'EACUnauthorizedAccountRoles';

export type LimitRefusalCode = 'NOT_OVER_PASS' | 'BALANCE_COVERS' | 'QUOTE_CHANGED' | 'NOT_A_RAISE' | 'BAD_CAP' | 'NOT_REFUSED';
export class LimitRefusal extends Error {
  code: LimitRefusalCode;
  status: number;
  constructor(code: LimitRefusalCode, status = 409) {
    super(code);
    this.name = 'LimitRefusal';
    this.code = code;
    this.status = status;
  }
}

export interface Pass {
  // The policy's daily cap on the checkout, the owner's published ENS cap, and today's spend.
  policyCapMicro: bigint;
  ensCapMicro: bigint;
  spentMicro: bigint;
  // What the payer agent's wallet holds now (micro-USDT).
  balanceMicro: bigint;
}

// The facilitator gave no answer to the signed attempt. It was sent to verify only, so nothing can have
// moved; the order id is returned so the attempt can be looked up.
export class AttemptUnanswered extends Error {
  orderId: string;
  reason: string | null;
  signed: boolean;
  constructor(orderId: string, reason: string | null, signed: boolean) {
    super('the attempt reached no decision');
    this.name = 'AttemptUnanswered';
    this.orderId = orderId;
    this.reason = reason;
    this.signed = signed;
  }
}

export interface OverPassQuote {
  orderId: string;
  priceMicro: string;
  quantity: number;
  item: string;
}

// What our facilitator's verify step answered for the signed attempt. 'refused' is a decision on the
// payer (its pass or its standing); 'valid' means the pass did not hold: nothing is sent all the same
// (verify never sends); 'unknown' is no decision: no answer, a failed read of the facilitator's own,
// or a step before verify that failed. `signed` says whether a signature was made at all.
export interface AttemptOutcome {
  status: 'refused' | 'valid' | 'unknown';
  reason?: string;
  signed?: boolean;
}

// The facilitator's refusals that are decisions on the payer; anything else is no verdict.
export const DECISIONS = new Set(['CAP_EXCEEDED', 'SPEND_CAP', 'insufficient_balance', 'ENS_PAUSED', 'ENS_EXPIRED_OR_REVOKED', 'AGENT_REVOKED', 'AGENT_EXPIRED']);
// The whole attempt (quote, 402, payee, signature, verify, record) runs inside this, well within the
// route's 120 s; no signature is made with less than SIGN_MARGIN_MS of it left.
export const ATTEMPT_BUDGET_MS = 95_000;
export const SIGN_MARGIN_MS = 35_000;

export interface OverPassDeps {
  pass(): Promise<Pass>;
  quote(): Promise<OverPassQuote>;
  // `until`: the attempt's deadline (ms); no step may run past it, and none signs too close to it.
  attempt(quote: OverPassQuote, until: number): Promise<AttemptOutcome>;
  // The refusal's record on Arkiv, once the recorder has written it (null if not seen by `until`).
  record(orderId: string, until: number): Promise<{ ref: string; entityKey: string | null } | null>;
  now(): number;
}

export interface OverPassResult {
  refused: boolean;
  reason: string | null;
  // Always false: the attempt is only ever verified, never settled.
  sent: false;
  request: string;
  item: string;
  quantity: number;
  attemptedMicro: string;
  passMicro: string;
  spentTodayMicro: string;
  leftMicro: string;
  orderId: string;
  arkiv: { ref: string; entityKey: string | null } | null;
  // true when this answer is the last attempt's (a repeat within a minute).
  repeated?: boolean;
}

// The story's "everyone" order: its quantity of the order's own item, priced from the shop's catalog.
export function overPassPlan(model = siteModel()): { request: string; item: string; sku: string; quantity: number; priceMicro: bigint } {
  const { request, quantity } = model.order.overPass;
  const product = model.merchant.products.find((p) => p.sku === model.order.sku);
  if (!product || !Number.isInteger(quantity) || quantity < 2) throw new Error('story config: order.overPass is malformed');
  const unit = BigInt(product.priceMicro);
  const per = BigInt(product.quantity);
  return { request, item: model.order.item, sku: product.sku, quantity, priceMicro: (unit * BigInt(quantity) + per - 1n) / per };
}

// One attempt of a kind at a time on this instance: a tap while one runs waits for its answer, and a tap
// within the cooldown after it gets that answer again. A failure is never kept.
const inflight = new Map<string, Promise<unknown>>();
const lastResult = new Map<string, { at: number; value: unknown }>();
async function shared<T extends object>(kind: string, now: number, run: () => Promise<T>): Promise<T & { repeated?: boolean }> {
  const running = inflight.get(kind) as Promise<T> | undefined;
  if (running) return { ...(await running), repeated: true };
  const last = lastResult.get(kind);
  if (last && now - last.at < LIMIT_COOLDOWN_MS) return { ...(last.value as T), repeated: true };
  const attempt = run();
  inflight.set(kind, attempt);
  try {
    const value = await attempt;
    lastResult.set(kind, { at: now, value });
    return value;
  } finally {
    inflight.delete(kind);
  }
}

export async function overPass(deps: OverPassDeps): Promise<OverPassResult> {
  return shared('over-pass', deps.now(), async (): Promise<OverPassResult> => {
    const until = deps.now() + ATTEMPT_BUDGET_MS;
    const plan = overPassPlan();
    const pass = await deps.pass();
    const passMicro = pass.ensCapMicro < pass.policyCapMicro ? pass.ensCapMicro : pass.policyCapMicro;
    const left = passMicro > pass.spentMicro ? passMicro - pass.spentMicro : 0n;
    // Only an attempt above the whole pass is signed, not merely above what is left of it: a cap
    // raised in the next seconds can then never make it fit. And never one the payer could pay.
    if (plan.priceMicro <= passMicro) throw new LimitRefusal('NOT_OVER_PASS');
    if (plan.priceMicro <= pass.balanceMicro) throw new LimitRefusal('BALANCE_COVERS');
    const quote = await deps.quote();
    if (quote.priceMicro !== String(plan.priceMicro) || quote.quantity !== plan.quantity || quote.item !== plan.sku) throw new LimitRefusal('QUOTE_CHANGED');
    const outcome = await deps.attempt(quote, until);
    // Only a decision on the payer is a refusal; a failed read or a failed step is no verdict.
    if (outcome.status === 'unknown' || (outcome.status === 'refused' && !DECISIONS.has(outcome.reason ?? ''))) throw new AttemptUnanswered(quote.orderId, outcome.reason ?? null, outcome.signed ?? outcome.status === 'refused');
    if (outcome.status === 'valid') console.error('over-pass: the facilitator would have accepted the attempt; nothing was sent');
    const refused = outcome.status === 'refused';
    return {
      refused,
      reason: outcome.reason ?? null,
      sent: false,
      request: plan.request,
      item: plan.item,
      quantity: plan.quantity,
      attemptedMicro: String(plan.priceMicro),
      passMicro: String(passMicro),
      spentTodayMicro: String(pass.spentMicro),
      leftMicro: String(left),
      orderId: quote.orderId,
      arkiv: refused ? await deps.record(quote.orderId, until) : null,
    };
  });
}

export interface RaiseCapDeps {
  // The owner's published ENS cap now.
  ensCap(): Promise<bigint>;
  // As the agent's own address: the setText of its cap record, simulated (an eth_call), never sent.
  simulate(capMicro: bigint): Promise<({ reverted: true; revert: string } | { reverted: false }) & { resolver: string; block: string }>;
  record(entry: { attemptedMicro: bigint; currentMicro: bigint; revert: string; resolver: string; block: string; ts: number }): Promise<{ entityKey: string; txHash: string }>;
  now(): number;
}

export interface RaiseCapResult {
  refused: true;
  sent: false;
  simulated: true;
  revert: string;
  agent: string;
  owner: string;
  key: string;
  attemptedMicro: string;
  currentMicro: string;
  resolver: string;
  // The Sepolia block the simulation ran at, so anyone can run the same call again.
  block: string;
  arkivTx: string;
  entityKey: string;
  repeated?: boolean;
}

export async function raiseOwnCap(input: { capMicro?: unknown }, deps: RaiseCapDeps, key: string): Promise<RaiseCapResult> {
  const model = siteModel();
  // The figure is checked before anything is read.
  let requested: bigint | null = null;
  if (input.capMicro !== undefined && input.capMicro !== null) {
    if (typeof input.capMicro !== 'string' || !/^[1-9][0-9]{0,12}$/.test(input.capMicro)) throw new LimitRefusal('BAD_CAP', 400);
    requested = BigInt(input.capMicro);
    if (requested > MAX_ATTEMPTED_CAP_MICRO) throw new LimitRefusal('BAD_CAP', 400);
  }
  return shared('raise-cap', deps.now(), async (): Promise<RaiseCapResult> => {
    const current = await deps.ensCap();
    const attempted = requested ?? (current > 0n ? current * 2n : 1_000_000n);
    if (attempted <= current) throw new LimitRefusal('NOT_A_RAISE', 400);
    const sim = await deps.simulate(attempted);
    // The resolver let the agent's own address set its cap: a broken scope. Nothing is sent, and no
    // "refused" record is written for something that was not refused.
    if (!sim.reverted) {
      console.error('raise-cap: the agent could set its own cap in simulation; nothing sent');
      throw new LimitRefusal('NOT_REFUSED', 500);
    }
    if (sim.revert !== EXPECTED_REVERT) throw new Error('the resolver refused for another reason');
    const written = await deps.record({ attemptedMicro: attempted, currentMicro: current, revert: sim.revert, resolver: sim.resolver, block: sim.block, ts: Math.floor(deps.now() / 1000) });
    return {
      refused: true,
      sent: false,
      simulated: true,
      revert: sim.revert,
      agent: model.payer.ens,
      owner: model.persona.ens,
      key,
      attemptedMicro: String(attempted),
      currentMicro: String(current),
      resolver: sim.resolver,
      block: sim.block,
      arkivTx: written.txHash,
      entityKey: written.entityKey,
    };
  });
}

// For tests only.
export function forgetLimits(): void {
  inflight.clear();
  lastResult.clear();
}
