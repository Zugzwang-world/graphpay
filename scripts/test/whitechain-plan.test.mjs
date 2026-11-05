import assert from 'node:assert/strict';
import { test } from 'node:test';
import { namehash } from 'viem';
import { activeCast, castEntries } from '../../packages/config/index.mjs';
import { MERCHANT_FLOAT_MICRO, merchantPlan, policyAction, policyPlan } from '../whitechain/plan.mjs';

const cast = activeCast();
const fake = (i) => `0x${String(i).padStart(40, '0')}`;
const paying = castEntries(cast).filter((e) => e.kind === 'buyer-agent' && e.pays);
const roles = Object.fromEntries(paying.map((e, i) => [e.walletRole, fake(i + 1)]));
const ZERO_NODE = `0x${'0'.repeat(64)}`;
const NO_POLICY = { epoch: 0, wallet: `0x${'0'.repeat(40)}`, revoked: false, dailyCapMicro: 0n, expiry: 0n };

test('one policy per paying agent, from the story, on its own wallet', () => {
  const plan = policyPlan({ roles, now: 1_000 });
  assert.deepEqual(plan.map((p) => p.ensName).sort(), paying.map((e) => e.ensName).sort());
  for (const p of plan) {
    const entry = paying.find((e) => e.ensName === p.ensName);
    assert.equal(p.node, namehash(p.ensName));
    assert.equal(p.capMicro, BigInt(entry.capMicro));
    assert.equal(p.wallet, roles[entry.walletRole]);
    assert.equal(p.epoch, 0);
    assert.equal(p.expiry, 0n);
  }
});

test('owner wallets are never bound', () => {
  const persona = { ...cast, buyerAgents: [...cast.buyerAgents, { key: 'x', label: 'x', displayName: 'X', walletRole: cast.persona.walletRole, pays: true, capMicro: 1 }] };
  assert.throws(() => policyPlan({ roles: { ...roles, [cast.persona.walletRole]: fake(99) }, now: 0, cast: persona }), /owner wallet/);
});

test('two agents on one wallet are refused, and a missing key stops', () => {
  const shared = Object.fromEntries(Object.keys(roles).map((r) => [r, fake(7)]));
  assert.throws(() => policyPlan({ roles: shared, now: 0 }), /already backs/);
  const [first] = Object.keys(roles);
  const missing = { ...roles };
  delete missing[first];
  assert.throws(() => policyPlan({ roles: missing, now: 0 }), /no key/);
});

test('a disposable agent gets the story cap and expiry', () => {
  const plan = policyPlan({ roles: { ...roles, DISPOSABLE_3: fake(50) }, now: 1_000 });
  const d = plan.find((p) => p.walletRole === 'DISPOSABLE_3');
  assert.equal(d.capMicro, BigInt(cast.disposable.capMicro));
  assert.equal(d.expiry, BigInt(1_000 + cast.disposable.expiryDays * 86_400));
});

test('setPolicy runs only when the chain differs, and stops on a foreign binding', () => {
  const [p] = policyPlan({ roles, now: 0 });
  assert.equal(policyAction(p, NO_POLICY, ZERO_NODE).action, 'create');
  const same = { epoch: 0, wallet: p.wallet, revoked: false, dailyCapMicro: p.capMicro, expiry: 0n };
  assert.equal(policyAction(p, same, p.node).action, 'skip');
  assert.equal(policyAction(p, { ...same, revoked: true }, p.node).action, 'update');
  assert.equal(policyAction(p, NO_POLICY, namehash('other.example')).action, 'stop');
  assert.equal(policyAction(p, { ...same, epoch: 2, dailyCapMicro: 1n }, p.node).action, 'stop');
});

test('every cast shop keeps a bounded float', () => {
  const plan = merchantPlan();
  assert.deepEqual(plan.map((m) => m.walletRole), cast.shops.map((s) => s.walletRole));
  assert.ok(plan.every((m) => m.floatMicro === MERCHANT_FLOAT_MICRO));
});
