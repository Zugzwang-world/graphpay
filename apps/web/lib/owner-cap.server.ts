// The owner changes the payer agent's daily cap (the W3 brief, item 4b), in both records:
// - the ENS record: the owner's wallet sets `graphpay.cap_micro` on the agent's name (Ethereum Sepolia),
//   with @graphpay/ens's setCap; the gate reads it within its 20 s cache;
// - the spending policy on the checkout: only the policy writer can write it, and that key stays on the
//   Mac by design (ADR-0021: no hosted key may lift a cap). The policy writer there applies the owner's
//   change as min(the owner's cap, the payments setup's configured cap); this route waits for it.
// The owner may lower the pass, or restore it up to the configured cap, never lift it above that. The
// change is recorded on Arkiv as a `request` edge from the owner to the agent. This file holds the
// decisions; the writes and reads are injected (lib/owner-cap-live.server.ts).
import { siteModel } from './site.server.ts';

export const OWNER_CAP_WAITING_FOR = "the owner's and the recorder's keys on this server (the Coordinator sets them in Vercel)";
export const CAP_COOLDOWN_MS = 20_000;
// How long the route waits for the policy writer to apply the change.
export const POLICY_WAIT_MS = 45_000;
const POLL_MS = 3_000;

export type OwnerCapRefusalCode = 'BAD_CAP' | 'OVER_CONFIGURED' | 'TOO_SOON';
export class OwnerCapRefusal extends Error {
  code: OwnerCapRefusalCode;
  status: number;
  constructor(code: OwnerCapRefusalCode, status = 409) {
    super(code);
    this.name = 'OwnerCapRefusal';
    this.code = code;
    this.status = status;
  }
}

export interface OwnerCapDeps {
  // The payments setup's cap for the payer agent (the story's), the bound no owner change passes.
  configuredMicro(): bigint;
  ensCap(): Promise<bigint>;
  setEnsCap(capMicro: bigint): Promise<{ changed: boolean; sepoliaTx: string | null }>;
  policyCap(): Promise<bigint>;
  record(entry: { capMicro: bigint; ensBeforeMicro: bigint; policyMicro: bigint; applied: boolean; sepoliaTx: string | null; ts: number }): Promise<{ entityKey: string; txHash: string }>;
  now(): number;
  sleep(ms: number): Promise<void>;
}

export interface OwnerCapResult {
  agent: string;
  owner: string;
  capMicro: string;
  configuredMicro: string;
  ens: { changed: boolean; beforeMicro: string; sepoliaTx: string | null };
  policy: { capMicro: string; applied: boolean };
  // What the gate enforces now: the lower of the two.
  effectiveMicro: string;
  arkivTx: string;
  entityKey: string;
}

let busy = false;
let lastChange = Number.NEGATIVE_INFINITY;

export async function setOwnerCap(input: { capMicro?: unknown }, deps: OwnerCapDeps): Promise<OwnerCapResult> {
  const model = siteModel();
  if (typeof input.capMicro !== 'string' || !/^[1-9][0-9]{0,12}$/.test(input.capMicro)) throw new OwnerCapRefusal('BAD_CAP', 400);
  const cap = BigInt(input.capMicro);
  const configured = deps.configuredMicro();
  if (cap > configured) throw new OwnerCapRefusal('OVER_CONFIGURED');
  const now = deps.now();
  // One change at a time and at most one per 20 s on this instance: each is a Sepolia transaction of the owner's.
  if (busy || now - lastChange < CAP_COOLDOWN_MS) throw new OwnerCapRefusal('TOO_SOON', 429);
  busy = true;
  lastChange = now;
  try {
    const before = await deps.ensCap();
    const ens = await deps.setEnsCap(cap);
    // The policy follows by the policy writer on the Mac; the route waits a while for it.
    let policy = await deps.policyCap();
    const until = deps.now() + POLICY_WAIT_MS;
    while (policy !== cap && deps.now() + POLL_MS <= until) {
      await deps.sleep(POLL_MS);
      policy = await deps.policyCap();
    }
    const applied = policy === cap;
    const written = await deps.record({ capMicro: cap, ensBeforeMicro: before, policyMicro: policy, applied, sepoliaTx: ens.sepoliaTx, ts: Math.floor(deps.now() / 1000) });
    return {
      agent: model.payer.ens,
      owner: model.persona.ens,
      capMicro: String(cap),
      configuredMicro: String(configured),
      ens: { changed: ens.changed, beforeMicro: String(before), sepoliaTx: ens.sepoliaTx },
      policy: { capMicro: String(policy), applied },
      effectiveMicro: String(cap < policy ? cap : policy),
      arkivTx: written.txHash,
      entityKey: written.entityKey,
    };
  } finally {
    busy = false;
  }
}

// For tests only.
export function forgetOwnerCap(): void {
  busy = false;
  lastChange = Number.NEGATIVE_INFINITY;
}
