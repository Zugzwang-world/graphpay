// The setup plan, from the story config only (ADR-0047): which agent gets which policy, and
// which merchants keep a refund float. Pure functions, so the tests check the rules without a chain.

import { namehash } from 'viem';
import { activeCast, castEntries, disposableEntry } from '../../packages/config/index.mjs';

// The bounded refund float each merchant approves for the checkout (planning/PROMPTS/02, setup).
export const MERCHANT_FLOAT_MICRO = 20_000_000n;

// One policy per paying agent, each on its own wallet (planning/SPEC/PAYMENTS_WHITECHAIN.md §2):
// the story's paying buyer and working agents, plus every DISPOSABLE_<n> that has a key.
// Owner wallets (the persona, the shops) are never bound. Epoch and expiry: the ENS track's
// values when M5 publishes them (epochOf); until then the namehash at epoch 0, no expiry, and
// a disposable agent's expiry from the story (expiryDays) counted from `now`.
export function policyPlan({ roles, now, epochOf = () => 0, cast = activeCast() }) {
  const owners = new Set([cast.persona.walletRole, ...cast.shops.map((s) => s.walletRole)]);
  const agents = castEntries(cast).filter((e) => e.kind === 'buyer-agent' && e.pays);
  for (const role of Object.keys(roles)) {
    const n = /^DISPOSABLE_([1-9][0-9]*)$/.exec(role)?.[1];
    if (n) agents.push({ ...disposableEntry(Number(n), cast), expiryDays: cast.disposable.expiryDays });
  }
  const seen = new Map();
  return agents.map((a) => {
    if (owners.has(a.walletRole)) throw new Error(`${a.ensName}: refused, ${a.walletRole} is an owner wallet`);
    const wallet = roles[a.walletRole];
    if (!wallet) throw new Error(`${a.ensName}: no key for ${a.walletRole}`);
    const other = seen.get(wallet.toLowerCase());
    if (other) throw new Error(`${a.ensName}: ${a.walletRole} already backs ${other}`);
    seen.set(wallet.toLowerCase(), a.ensName);
    if (!Number.isSafeInteger(a.capMicro) || a.capMicro < 0) throw new Error(`${a.ensName}: no cap in the story`);
    return {
      ensName: a.ensName,
      node: namehash(a.ensName),
      walletRole: a.walletRole,
      wallet,
      epoch: epochOf(a.ensName),
      capMicro: BigInt(a.capMicro),
      expiry: a.expiryDays ? BigInt(now + a.expiryDays * 86_400) : 0n,
    };
  });
}

export function merchantPlan({ cast = activeCast() } = {}) {
  return cast.shops.map((s) => ({ shop: s.key, walletRole: s.walletRole, floatMicro: MERCHANT_FLOAT_MICRO }));
}

// What setPolicy would change, given the policy and the binding the chain holds now.
export function policyAction(planned, onChain, boundNode) {
  const zero = `0x${'0'.repeat(64)}`;
  if (boundNode !== zero && boundNode !== planned.node) return { action: 'stop', why: 'the wallet is bound to another node' };
  const same =
    onChain.wallet.toLowerCase() === planned.wallet.toLowerCase() &&
    !onChain.revoked &&
    BigInt(onChain.dailyCapMicro) === planned.capMicro &&
    Number(onChain.epoch) === planned.epoch;
  if (same) return { action: 'skip' };
  if (onChain.wallet !== `0x${'0'.repeat(40)}` && planned.epoch < Number(onChain.epoch)) {
    return { action: 'stop', why: 'the chain holds a newer epoch' };
  }
  // An existing disposable keeps the expiry it was given; setup never extends a kill.
  const expiry = onChain.wallet !== `0x${'0'.repeat(40)}` && planned.expiry !== 0n ? BigInt(onChain.expiry) : planned.expiry;
  return { action: onChain.wallet === `0x${'0'.repeat(40)}` ? 'create' : 'update', expiry };
}
