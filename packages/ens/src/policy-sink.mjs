// The watcher's policy sink (planning/SPEC/IDENTITY_ENS.md §8): turns "this name's standing
// changed" into a setPolicy call built only from the chain's own policy and the payments setup's
// configured cap (to reopen a policy). It never creates a policy (no policy on chain: a no-op),
// never reads an ENS record, and never lets an ENS cap or address near a policy.
//   configured(node) → { wallet, capMicro } | undefined   the payments setup's list (only its cap is used, and only to reopen a policy)
//   readPolicy(node) → { epoch, wallet, revoked, dailyCapMicro, expiry }   the checkout's policy (wallet 0x0 = none)
//   writePolicy({ node, epoch, wallet, revoked, capMicro, expiry })   one setPolicy, serialised by the caller

import { isAddressEqual, zeroAddress } from 'viem';

export function createPolicySink({ configured, readPolicy, writePolicy, log = () => {} }) {
  async function updatePolicy({ node, epoch, revoked, expiry }) {
    const cur = await readPolicy(node);
    if (!cur || isAddressEqual(cur.wallet, zeroAddress)) return { skipped: 'no policy on chain (the watcher never creates one)' };
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
