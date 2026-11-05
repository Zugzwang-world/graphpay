// The payment gate (planning/SPEC/IDENTITY_ENS.md §7) and the agents' ens_check
// (planning/SPEC/AGENTS.md §5), on the same reads. Fail closed: every exception is a
// refusal, nothing throws into the payment path. The ENS cap is owner-writable, so it is
// never an authority: the gate enforces min(ENS cap, AgentPolicy cap).

import { config } from '@graphpay/config';
import { isAddressEqual, zeroAddress } from 'viem';
import { CACHE_TTL_MS, resolveRecord, ttlCache, walkName } from './reads.mjs';
import { KEYS } from './records.mjs';
import { STATUS } from './names.mjs';

export const GATE_REASONS = Object.freeze([
  'AMOUNT_INVALID',
  'ENS_READ_FAILED',
  'ENS_NAME_INVALID',
  'ENS_ROOT_NOT_ALLOWED',
  'ENS_NOT_FOUND',
  'ENS_EXPIRED_OR_REVOKED',
  'ENS_ANCESTOR_INACTIVE',
  'ENS_EPOCH_MISMATCH',
  'ENS_NO_POLICY',
  'ENS_RESOLVER_MISMATCH',
  'ENS_PAUSED',
  'ENS_SYNTHETIC',
  'ENS_RECORD_INVALID',
  'CAP_EXCEEDED',
]);

const refuse = (reason, extra = {}) => ({ ok: false, reason, ...extra });
// A text record through the Universal Resolver: { value, resolver }.
const textVia = (client) => (name, node, key) => resolveRecord(client, name, { functionName: 'text', args: [node, key] });

// The gate's chain reads for one name, cached together: the registry walk, then the status
// and cap records read from the leaf's own resolver (the answer must come from that resolver
// at offset 0: a parent's default record is a leak, §6 trap 3).
async function loadFacts({ walk: walkOf, text }, name) {
  const walk = await walkOf(name);
  if (!walk.ok) return { ok: false, reason: walk.reason, walk };
  try {
    const [status, cap] = await Promise.all([text(walk.name, walk.node, KEYS.status), text(walk.name, walk.node, KEYS.capMicro)]);
    if (!isAddressEqual(status.resolver, walk.resolver) || !isAddressEqual(cap.resolver, walk.resolver)) return { ok: false, reason: 'ENS_RESOLVER_MISMATCH', walk: { ok: false, reason: 'ENS_RESOLVER_MISMATCH', detail: 'records not from the leaf resolver' } };
    return { ok: true, walk, status: status.value, cap: cap.value };
  } catch {
    return { ok: false, reason: 'ENS_READ_FAILED', walk: { ok: false, reason: 'ENS_READ_FAILED', detail: 'records' } };
  }
}

// deps (all but `client` injectable for tests):
//   walk(name) and text(name, node, key): the chain reads (default: walkName and the Universal Resolver); tests fake them
//   expectedEpoch(node) → number | null | undefined   the epoch the policy was set for (none → ENS_NO_POLICY)
//   policyCapMicro(node, epoch) → bigint | null        the AgentPolicy's daily cap; null = no policy
//   spentToday(node, epoch) → bigint                   what the epoch spent today (Arkiv tallies or the contract)
export function createEnsGate({
  client,
  expectedEpoch,
  policyCapMicro,
  spentToday,
  ttlMs = CACHE_TTL_MS,
  clock = Date.now,
  allowedRoots = [config.root.ens],
  walk = (name) => walkName(client, name, { allowedRoots }),
  text = textVia(client),
}) {
  const reads = { walk, text };
  const facts = ttlCache(ttlMs, clock);
  const checks = ttlCache(ttlMs, clock);

  // Cached per exact spelling (a look-alike gets its own, refused entry), stamped before the reads.
  const factsOf = (name) => facts.get(name, () => loadFacts(reads, name));

  async function ensGate(name, amountMicro) {
    try {
      if (typeof amountMicro !== 'bigint' || amountMicro <= 0n) return refuse('AMOUNT_INVALID');
      if (typeof name !== 'string') return refuse('ENS_NAME_INVALID');
      const f = await factsOf(name);
      if (!f.walk.ok) return refuse(f.walk.reason, f.walk.detail ? { detail: f.walk.detail } : {});
      const { node, epoch, expiry } = f.walk;
      // A cache hit can outlive the expiry it recorded: never pay a name past its own expiry.
      if (expiry <= BigInt(Math.floor(clock() / 1000))) return refuse('ENS_EXPIRED_OR_REVOKED', { node, epoch, detail: 'expired since the read' });
      // Step 4: the epoch the policy was written for.
      const expected = await expectedEpoch(node);
      if (expected === null || expected === undefined) return refuse('ENS_NO_POLICY', { node, epoch });
      if (Number(expected) !== epoch) return refuse('ENS_EPOCH_MISMATCH', { node, epoch, detail: `policy epoch ${expected}` });
      // Step 6: the owner's pause and the published cap.
      if (f.status !== 'active') return refuse('ENS_PAUSED', { node, epoch });
      if (typeof f.cap !== 'string' || !/^\d+$/.test(f.cap)) return refuse('ENS_RECORD_INVALID', { node, epoch, detail: KEYS.capMicro });
      // Step 7: the lower of the owner-writable ENS cap and the policy cap.
      const policyCap = await policyCapMicro(node, epoch);
      if (policyCap === null || policyCap === undefined) return refuse('ENS_NO_POLICY', { node, epoch });
      const ensCap = BigInt(f.cap);
      const capMicro = ensCap < BigInt(policyCap) ? ensCap : BigInt(policyCap);
      // Step 8.
      const spent = BigInt(await spentToday(node, epoch));
      if (spent + amountMicro > capMicro) return refuse('CAP_EXCEEDED', { node, epoch, detail: `cap ${capMicro}, spent ${spent}` });
      return { ok: true, node, epoch, expiry, capMicro, checks: { epoch: true, tally: true, policyCap: true } };
    } catch {
      return refuse('ENS_READ_FAILED');
    }
  }

  // ens_check: registry state (never resolution) plus the six public records.
  const CHECK_KEYS = [KEYS.agentContext, KEYS.agentEndpointMcp, KEYS.status, KEYS.capMicro, KEYS.principal, KEYS.kind];
  const checkRecords = Object.freeze(Object.fromEntries(CHECK_KEYS.map((k) => [k, ''])));
  const unknown = (name) => ({ name, registryState: 'UNKNOWN', status: 'UNKNOWN', records: checkRecords });

  async function loadCheck(name) {
    const walked = await walk(name);
    if (!walked.ok) {
      if (walked.reason === 'ENS_READ_FAILED') return { ok: false, reason: walked.reason };
      if (walked.reason === 'ENS_EXPIRED_OR_REVOKED') {
        // An unregister burns the token (latest owner 0x0) and is "revoked"; a lapse keeps its
        // owner and is only "expired" (measured on the fork, test-fork/gate.fork.test.mjs).
        const l = walked.leaf;
        const lapsed = l?.status === STATUS.AVAILABLE && l.latestOwner !== undefined && !isAddressEqual(l.latestOwner, zeroAddress);
        return { ok: true, value: { name, registryState: lapsed ? 'EXPIRED' : 'UNREGISTERED', status: lapsed ? 'EXPIRED' : 'REVOKED', records: checkRecords } };
      }
      if (walked.reason === 'ENS_ANCESTOR_INACTIVE') return { ok: true, value: { name, registryState: 'EXPIRED', status: 'EXPIRED', records: checkRecords } };
      return { ok: true, value: unknown(name) };
    }
    try {
      const values = await Promise.all(CHECK_KEYS.map((k) => text(walked.name, walked.node, k)));
      if (values.some((v) => !isAddressEqual(v.resolver, walked.resolver))) return { ok: true, value: unknown(name) };
      const records = Object.fromEntries(CHECK_KEYS.map((k, i) => [k, values[i].value]));
      return { ok: true, value: { name: walked.name, registryState: 'REGISTERED', status: records[KEYS.status] === 'paused' ? 'PAUSED' : 'ACTIVE', records } };
    } catch {
      return { ok: false, reason: 'ENS_READ_FAILED' };
    }
  }

  async function ensCheck(name) {
    try {
      if (typeof name !== 'string') return unknown(String(name));
      const r = await checks.get(name, () => loadCheck(name));
      return r.ok ? r.value : unknown(name);
    } catch {
      return unknown(String(name));
    }
  }

  return {
    ensGate,
    ensCheck,
    invalidate: (name) => {
      facts.invalidate(name);
      checks.invalidate(name);
    },
  };
}
