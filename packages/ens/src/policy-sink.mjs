// The watcher's policy sink (planning/SPEC/IDENTITY_ENS.md §8): turns "this name's standing
// changed" into a setPolicy call built only from the chain's own policy and the payments setup's
// configured cap (to reopen a policy). It never creates a policy (no policy on chain: a no-op),
// never reads an ENS record, and never lets an ENS address near a policy. The owner's ENS cap,
// when the watcher passes it, only ever lowers a live policy: min(owner's cap, configured cap)
// (the Coordinator's decision, Fri 6 Nov; ADR-0021 holds, a stolen owner key cannot lift a pass).
//   configured(node) → { wallet, capMicro } | undefined   the payments setup's list (only its cap is used, and only to reopen a policy)
//   readPolicy(node) → { epoch, wallet, revoked, dailyCapMicro, expiry }   the checkout's policy (wallet 0x0 = none)
//   writePolicy({ node, epoch, wallet, revoked, capMicro, expiry })   one setPolicy, serialised by the caller

import { isAddressEqual, zeroAddress } from 'viem';

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
    await writePolicy({ node, ...next });
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
    await writePolicy({ node, ...next });
    log(`policy sink: setPolicy epoch ${next.epoch} revoked ${next.revoked}`);
    return { written: next };
  }
  return { updatePolicy };
}
