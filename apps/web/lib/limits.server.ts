// The payer agent's limits, shown live (ADR-0073; planning/ACCEPTANCE_TESTS.md B3 and C4(b)):
// - Over the pass: the payer agent asks the shop for the story's "everyone" order and signs it; our
//   facilitator refuses it before anything is sent (the ENS gate's CAP_EXCEEDED: the lower of the ENS
//   cap and the policy cap), and the facilitator's recorder writes the refusal to Arkiv as a `fail` edge.
//   This route only starts an attempt that really is over what is left of the pass: it never pays.
// - The agent tries to raise its own cap in ENS: simulated as the agent's own key on Sepolia, the
//   name's resolver refuses (EACUnauthorizedAccountRoles: only the owner may set it). Nothing is sent;
//   the attempt and its revert reason are recorded on Arkiv as a `request` edge, agent to owner.
// This file holds the decisions; the reads, the signature and the writes are injected
// (lib/limits-live.server.ts), so the checks are tested without a key.
import { siteModel } from './site.server.ts';

export const LIMITS_WAITING_FOR = "the payer agent's and the recorder's keys on this server (the Coordinator sets them in Vercel)";
// One attempt of each kind per instance at most this often: each writes to Arkiv with the recorder's key.
export const LIMIT_COOLDOWN_MS = 60_000;
// The largest cap an attempt may ask for (micro-USDT): a simulated value, but a bounded one.
export const MAX_ATTEMPTED_CAP_MICRO = 1_000_000_000_000n;

export type LimitRefusalCode = 'NOT_OVER_PASS' | 'QUOTE_CHANGED' | 'NOT_A_RAISE' | 'BAD_CAP' | 'TOO_SOON' | 'NOT_REFUSED';
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
}

export interface OverPassQuote {
  orderId: string;
  priceMicro: string;
  quantity: number;
  item: string;
}

// What the shop answered to the signed attempt.
export interface AttemptOutcome {
  status: 'refused' | 'paid' | 'unknown' | 'failed';
  reason?: string;
  transaction?: string;
}

export interface OverPassDeps {
  pass(): Promise<Pass>;
  quote(): Promise<OverPassQuote>;
  attempt(quote: OverPassQuote): Promise<AttemptOutcome>;
  // The refusal's record on Arkiv, once the recorder has written it (null if not seen in time).
  record(orderId: string): Promise<{ ref: string; entityKey: string | null } | null>;
  now(): number;
}

export interface OverPassResult {
  refused: boolean;
  reason: string | null;
  sent: boolean;
  request: string;
  item: string;
  quantity: number;
  attemptedMicro: string;
  passMicro: string;
  spentTodayMicro: string;
  leftMicro: string;
  orderId: string;
  arkiv: { ref: string; entityKey: string | null } | null;
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

const last = new Map<string, number>();
const busy = new Set<string>();

// One attempt of a kind at a time and per cooldown; a refusal before anything was signed or written frees it.
const BEFORE_ANY_WRITE = new Set<LimitRefusalCode>(['NOT_OVER_PASS', 'QUOTE_CHANGED', 'NOT_A_RAISE', 'BAD_CAP']);
async function held<T>(kind: string, now: number, run: () => Promise<T>): Promise<T> {
  if (busy.has(kind) || now - (last.get(kind) ?? Number.NEGATIVE_INFINITY) < LIMIT_COOLDOWN_MS) throw new LimitRefusal('TOO_SOON', 429);
  busy.add(kind);
  last.set(kind, now);
  try {
    return await run();
  } catch (error) {
    if (error instanceof LimitRefusal && BEFORE_ANY_WRITE.has(error.code)) last.delete(kind);
    throw error;
  } finally {
    busy.delete(kind);
  }
}

export async function overPass(deps: OverPassDeps): Promise<OverPassResult> {
  const plan = overPassPlan();
  return held('over-pass', deps.now(), async () => {
    const pass = await deps.pass();
    const passMicro = pass.ensCapMicro < pass.policyCapMicro ? pass.ensCapMicro : pass.policyCapMicro;
    const left = passMicro > pass.spentMicro ? passMicro - pass.spentMicro : 0n;
    // Only an attempt that is over what is left of the pass is ever signed.
    if (plan.priceMicro <= left) throw new LimitRefusal('NOT_OVER_PASS');
    const quote = await deps.quote();
    if (quote.priceMicro !== String(plan.priceMicro) || quote.quantity !== plan.quantity || quote.item !== plan.sku) throw new LimitRefusal('QUOTE_CHANGED');
    const outcome = await deps.attempt(quote);
    if (outcome.status === 'paid') console.error('over-pass: the attempt was paid; the pass did not hold');
    const refused = outcome.status === 'refused';
    const record = refused ? await deps.record(quote.orderId) : null;
    return {
      refused,
      reason: outcome.reason ?? null,
      sent: Boolean(outcome.transaction),
      request: plan.request,
      item: plan.item,
      quantity: plan.quantity,
      attemptedMicro: String(plan.priceMicro),
      passMicro: String(passMicro),
      spentTodayMicro: String(pass.spentMicro),
      leftMicro: String(left),
      orderId: quote.orderId,
      arkiv: record,
    };
  });
}

export interface RaiseCapDeps {
  // The owner's published ENS cap now.
  ensCap(): Promise<bigint>;
  // As the agent's own key: the setText of its cap record, simulated, never sent.
  simulate(capMicro: bigint): Promise<{ reverted: true; revert: string; resolver: string } | { reverted: false; resolver: string }>;
  record(entry: { attemptedMicro: bigint; currentMicro: bigint; revert: string; resolver: string; ts: number }): Promise<{ entityKey: string; txHash: string }>;
  now(): number;
}

export interface RaiseCapResult {
  refused: true;
  sent: false;
  revert: string;
  agent: string;
  owner: string;
  key: string;
  attemptedMicro: string;
  currentMicro: string;
  resolver: string;
  arkivTx: string;
  entityKey: string;
}

export async function raiseOwnCap(input: { capMicro?: unknown }, deps: RaiseCapDeps, key: string): Promise<RaiseCapResult> {
  const model = siteModel();
  return held('raise-cap', deps.now(), async () => {
    const current = await deps.ensCap();
    let attempted: bigint;
    if (input.capMicro === undefined || input.capMicro === null) {
      attempted = current > 0n ? current * 2n : 1_000_000n;
    } else {
      if (typeof input.capMicro !== 'string' || !/^[1-9][0-9]{0,12}$/.test(input.capMicro)) throw new LimitRefusal('BAD_CAP', 400);
      attempted = BigInt(input.capMicro);
    }
    if (attempted > MAX_ATTEMPTED_CAP_MICRO) throw new LimitRefusal('BAD_CAP', 400);
    if (attempted <= current) throw new LimitRefusal('NOT_A_RAISE', 400);
    const sim = await deps.simulate(attempted);
    // The resolver let the agent's own key set its cap: a broken scope. Nothing is sent, and no
    // "refused" record is written for something that was not refused.
    if (!sim.reverted) {
      console.error('raise-cap: the agent key could set its own cap in simulation; nothing sent');
      throw new LimitRefusal('NOT_REFUSED', 500);
    }
    const written = await deps.record({ attemptedMicro: attempted, currentMicro: current, revert: sim.revert, resolver: sim.resolver, ts: Math.floor(deps.now() / 1000) });
    return {
      refused: true,
      sent: false,
      revert: sim.revert,
      agent: model.payer.ens,
      owner: model.persona.ens,
      key,
      attemptedMicro: String(attempted),
      currentMicro: String(current),
      resolver: sim.resolver,
      arkivTx: written.txHash,
      entityKey: written.entityKey,
    };
  });
}

// For tests only.
export function forgetLimits(): void {
  last.clear();
  busy.clear();
}
