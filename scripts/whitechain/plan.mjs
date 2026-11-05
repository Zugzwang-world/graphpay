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
// Roles that hold money or run infrastructure: never an agent's wallet.
const INFRA = /^(?:FUNDER|OPERATOR|DEPLOYER|FACILITATOR|RENEWER|POLICY_WRITER|W_[A-Z0-9_]+)$/;

export function policyPlan({ roles, now, epochOf = () => 0, cast = activeCast() }) {
  const owners = new Set([cast.persona.walletRole, ...cast.shops.map((s) => s.walletRole)]);
  const refused = new Set(
    Object.entries(roles)
      .filter(([role, a]) => a && (owners.has(role) || INFRA.test(role)))
      .map(([, a]) => a.toLowerCase()),
  );
  const agents = castEntries(cast).filter((e) => e.kind === 'buyer-agent' && e.pays);
  for (const role of Object.keys(roles)) {
    const n = /^DISPOSABLE_([1-9][0-9]*)$/.exec(role)?.[1];
    if (n) agents.push({ ...disposableEntry(Number(n), cast), expiryDays: cast.disposable.expiryDays });
  }
  const seen = new Map();
  return agents.map((a) => {
    if (owners.has(a.walletRole) || INFRA.test(a.walletRole)) throw new Error(`${a.ensName}: refused, ${a.walletRole} is an owner or infrastructure wallet`);
    const wallet = roles[a.walletRole];
    if (!wallet) throw new Error(`${a.ensName}: no key for ${a.walletRole}`);
    if (refused.has(wallet.toLowerCase())) throw new Error(`${a.ensName}: refused, ${a.walletRole} shares an owner or infrastructure wallet`);
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

// What setPolicy would change, given the policy and the binding the chain holds now. Setup
// creates policies and moves epochs; it never lifts a revocation or an expiry that someone set
// on purpose (the revoked-agent beat, a disposable agent's kill): both are carried forward.
export function policyAction(planned, onChain, boundNode) {
  const zero = `0x${'0'.repeat(64)}`;
  const none = onChain.wallet === `0x${'0'.repeat(40)}`;
  if (boundNode !== zero && boundNode !== planned.node) return { action: 'stop', why: 'the wallet is bound to another node' };
  if (none) return { action: 'create', revoked: false, expiry: planned.expiry };
  if (planned.epoch < Number(onChain.epoch)) return { action: 'stop', why: 'the chain holds a newer epoch' };
  const revoked = Boolean(onChain.revoked);
  const expiry = BigInt(onChain.expiry) !== 0n ? BigInt(onChain.expiry) : planned.expiry;
  const same =
    onChain.wallet.toLowerCase() === planned.wallet.toLowerCase() &&
    BigInt(onChain.dailyCapMicro) === planned.capMicro &&
    Number(onChain.epoch) === planned.epoch &&
    BigInt(onChain.expiry) === expiry;
  if (same) return { action: 'skip', revoked };
  return { action: 'update', revoked, expiry };
}
