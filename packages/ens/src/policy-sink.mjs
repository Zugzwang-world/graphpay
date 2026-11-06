// The watcher's policy sink (planning/SPEC/IDENTITY_ENS.md §8): turns "this name's standing
// changed" into a setPolicy call built only from the chain's own policy and the payments setup's
// configured cap. It never creates a policy (no policy on chain: a no-op), never reads an ENS
// record, and never lets an ENS address near a policy. The owner's ENS cap, when the watcher
// passes it, sets a live policy's cap to min(owner's cap, configured cap) and nothing else (the
// Coordinator's decision, Fri 6 Nov; W3's cap ADR): never above the configured cap, never a
// reopened revocation, another epoch or wallet (ADR-0021 holds for lifting a pass).
//   configured(node) → { wallet, capMicro } | undefined   the payments setup's list (its cap: the ceiling, and the cap a reopened policy takes)
//   readPolicy(node) → { epoch, wallet, revoked, dailyCapMicro, expiry }   the checkout's policy (wallet 0x0 = none)
//   writePolicy({ node, epoch, wallet, revoked, capMicro, expiry }, { expected? })   one setPolicy, serialised by
//     the caller; with `expected` (the policy this write was built from) the caller re-reads it just
//     before signing and sends nothing if it moved (another policy writer acted in between), answering
//     { moved: true }: the sink then throws, so the watcher's batch (or the cap's tick) tries again

import { isAddressEqual, zeroAddress } from 'viem';

const MOVED = 'the policy moved since it was read (another policy writer acted); tried again';
async function written(write) {
  if ((await write)?.moved) throw new Error(MOVED);
}

const asRead = (p) => ({ epoch: Number(p.epoch), wallet: p.wallet, revoked: Boolean(p.revoked), dailyCapMicro: BigInt(p.dailyCapMicro), expiry: BigInt(p.expiry) });

// True when the chain's policy is no longer the one a write was built from.
export function policyMoved(expected, now) {
  const n = asRead(now);
  return n.epoch !== expected.epoch || !isAddressEqual(n.wallet, expected.wallet) || n.revoked !== expected.revoked || n.dailyCapMicro !== expected.dailyCapMicro || n.expiry !== expected.expiry;
}

export function createPolicySink({ configured, readPolicy, writePolicy, log = () => {} }) {
  // The owner's cap: the policy takes min(owner's cap, configured cap) and nothing else moves (the
  // chain's wallet, epoch and expiry stay). A revoked policy, another epoch or a name outside the
  // configured list is left alone.
  async function ownerCap(node, epoch, ownerCapMicro, cur) {
    if (cur.revoked) return { skipped: 'a revoked policy takes no cap' };
    if (epoch !== Number(cur.epoch)) return { skipped: `the chain holds epoch ${cur.epoch}` };
    const cfg = configured(node);
    if (!cfg) return { skipped: 'no configured policy' };
    const limit = BigInt(cfg.capMicro);
    const capMicro = ownerCapMicro < limit ? ownerCapMicro : limit;
    if (BigInt(cur.dailyCapMicro) === capMicro) return { inStep: true };
    const next = { epoch, wallet: cur.wallet, revoked: false, capMicro, expiry: BigInt(cur.expiry) };
    await written(writePolicy({ node, ...next }, { expected: asRead(cur) }));
    log(`policy sink: setPolicy epoch ${epoch} cap ${capMicro} (the owner's ${ownerCapMicro}, at most the configured ${limit})`);
    return { written: next };
  }

  async function updatePolicy({ node, epoch, revoked, expiry, ownerCapMicro }) {
    const cur = await readPolicy(node);
    if (!cur || isAddressEqual(cur.wallet, zeroAddress)) return { skipped: 'no policy on chain (the watcher never creates one)' };
    if (ownerCapMicro !== undefined) return ownerCap(node, epoch, BigInt(ownerCapMicro), cur);
    if (epoch < Number(cur.epoch)) return { skipped: `the chain holds a newer epoch (${cur.epoch})` };
    // A revocation is built from the chain's own policy alone, so it never depends on the list. Anything
    // that opens a policy again needs the configured cap; the wallet is the one the chain already binds.
    // An unregister bumps the epoch, so a label can never be live again at the epoch it was killed at: a lift
    // at the same epoch is a replay, or someone else's revocation, and is not the watcher's to undo.
    if (revoked === false && cur.revoked && epoch === Number(cur.epoch)) return { skipped: 'a revocation at this epoch is not lifted' };
    const cfg = configured(node);
    const isRevoked = revoked ?? Boolean(cur.revoked);
    const reopens = !isRevoked && (Boolean(cur.revoked) || epoch !== Number(cur.epoch));
    if (reopens && !cfg) return { skipped: 'no configured policy' };
    const next = isRevoked
      ? { epoch, wallet: cur.wallet, revoked: true, capMicro: 0n, expiry: 0n }
      : {
          epoch,
          wallet: cur.wallet,
          revoked: false,
          // a lifted revocation or a new epoch goes back to the configured cap; otherwise the cap stays as set
          capMicro: reopens ? BigInt(cfg.capMicro) : BigInt(cur.dailyCapMicro),
          // a policy that never expires (0) stays so on a plain renew; a lifted revocation takes the ENS expiry
          expiry: expiry !== undefined && (revoked === false || BigInt(cur.expiry) !== 0n) ? BigInt(expiry) : BigInt(cur.expiry),
        };
    const same =
      Number(cur.epoch) === next.epoch &&
      Boolean(cur.revoked) === next.revoked &&
      BigInt(cur.dailyCapMicro) === next.capMicro &&
      BigInt(cur.expiry) === next.expiry;
    if (same) return { inStep: true };
    // A revocation is always sent (idempotent, and a kill must never wait on a race); anything that
    // keeps or reopens a pass is sent only if the policy is still the one it was built from.
    await written(writePolicy({ node, ...next }, next.revoked ? {} : { expected: asRead(cur) }));
    log(`policy sink: setPolicy epoch ${next.epoch} revoked ${next.revoked}`);
    return { written: next };
  }
  return { updatePolicy };
}
