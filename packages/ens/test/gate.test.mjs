// The payment gate with fakes for the chain reads (planning/PROMPTS/06-ens-gate-kill-watcher.md):
// every reason code, the 20 s cache, and the rule that the owner-writable ENS cap never raises
// what the policy allows. The registry walk itself is exercised on the fork and on Sepolia.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEnsGate, exactName, GATE_REASONS, KEYS, namehash, namespacePlan } from '../index.mjs';

const RESOLVER = '0x1111111111111111111111111111111111111111';
const OTHER = '0x2222222222222222222222222222222222222222';
const NAME = namespacePlan().agents.find((a) => a.capMicro > 0n && a.selfHeld).name;
const NODE = namehash(NAME);

// A fake chain: `world.names[name]` is a walk result; `world.texts[name][key]` the record.
function world(over = {}) {
  const w = {
    walks: { [NAME]: { ok: true, name: NAME, node: NODE, epoch: 0, expiry: 9_999_999_999n, resolver: RESOLVER } },
    texts: { [NAME]: { [KEYS.status]: 'active', [KEYS.capMicro]: '5000000' } },
    textResolver: RESOLVER,
    walkCalls: 0,
    textCalls: 0,
    epoch: 0,
    policyCap: 5_000_000n,
    spent: 0n,
    now: 0,
    throwOn: null,
    ...over,
  };
  w.deps = {
    clock: () => w.now,
    walk: async (name) => {
      w.walkCalls += 1;
      if (w.throwOn === 'walk') return { ok: false, reason: 'ENS_READ_FAILED' };
      try {
        exactName(name);
      } catch {
        return { ok: false, reason: 'ENS_NAME_INVALID' };
      }
      return w.walks[name] ?? { ok: false, reason: 'ENS_NOT_FOUND' };
    },
    text: async (name, _node, key) => {
      w.textCalls += 1;
      if (w.throwOn === 'text') throw new Error('rpc down');
      return { value: w.texts[name]?.[key] ?? '', resolver: w.textResolver };
    },
    expectedEpoch: async () => w.epoch,
    policyCapMicro: async () => w.policyCap,
    spentToday: async () => w.spent,
  };
  return w;
}
const gateOf = (w) => createEnsGate({ client: {}, ...w.deps });
const reasonOf = async (w, amount = 1_000_000n, name = NAME) => (await gateOf(w).ensGate(name, amount)).reason;

test('gate: an active agent inside both caps passes, with the lower cap and the checks it ran', async () => {
  const r = await gateOf(world()).ensGate(NAME, 1_000_000n);
  assert.equal(r.ok, true);
  assert.equal(r.capMicro, 5_000_000n);
  assert.deepEqual(r.checks, { epoch: true, tally: true, policyCap: true });
  assert.equal(r.node, NODE);
});

test('gate: every reason is a documented code', async () => {
  const reasons = new Set();
  const w = world();
  reasons.add(await reasonOf(w, 0n));
  reasons.add(await reasonOf(w, -1n));
  reasons.add(await reasonOf(w, 1_000_000n, `x.evil.eth`));
  assert.ok([...reasons].every((r) => GATE_REASONS.includes(r)));
});

test('gate: a zero, negative or non-bigint amount is AMOUNT_INVALID, before any read', async () => {
  const w = world();
  const g = gateOf(w);
  for (const amount of [0n, -5n, 1, '1', null, undefined]) assert.equal((await g.ensGate(NAME, amount)).reason, 'AMOUNT_INVALID');
  assert.equal(w.walkCalls, 0);
});

test('gate: a look-alike spelling is refused and never poisons the real entry', async () => {
  const w = world();
  const g = gateOf(w);
  const lookAlike = NAME.replace('a', 'а'); // a Cyrillic а
  const upper = NAME.toUpperCase();
  assert.notEqual(lookAlike, NAME);
  assert.equal((await g.ensGate(lookAlike, 1n)).reason, 'ENS_NAME_INVALID');
  assert.equal((await g.ensGate(upper, 1n)).reason, 'ENS_NAME_INVALID');
  assert.equal((await g.ensGate(NAME, 1_000_000n)).ok, true);
  assert.equal((await g.ensGate(lookAlike, 1n)).reason, 'ENS_NAME_INVALID');
});

test('gate: a name outside graphpay.eth, a missing name and a non-string are refused', async () => {
  const w = world({ walks: {} });
  const g = gateOf(w);
  assert.equal((await g.ensGate('x.evil.eth', 1n)).reason, 'ENS_NOT_FOUND'); // the real walk says ENS_ROOT_NOT_ALLOWED
  assert.equal((await g.ensGate(42, 1n)).reason, 'ENS_NAME_INVALID');
  assert.equal((await g.ensGate(undefined, 1n)).reason, 'ENS_NAME_INVALID');
});

test('gate: the walk reasons pass through (RESERVED sim ancestor, RESERVED leaf after renew, lapsed parent, resolver mismatch)', async () => {
  for (const reason of ['ENS_SYNTHETIC', 'ENS_NOT_FOUND', 'ENS_EXPIRED_OR_REVOKED', 'ENS_ANCESTOR_INACTIVE', 'ENS_RESOLVER_MISMATCH', 'ENS_ROOT_NOT_ALLOWED']) {
    const w = world({ walks: { [NAME]: { ok: false, reason } } });
    assert.equal(await reasonOf(w), reason);
  }
});

test('gate: a read error anywhere is ENS_READ_FAILED and is not cached', async () => {
  const w = world({ throwOn: 'walk' });
  const g = gateOf(w);
  assert.equal((await g.ensGate(NAME, 1n)).reason, 'ENS_READ_FAILED');
  w.throwOn = 'text';
  assert.equal((await g.ensGate(NAME, 1n)).reason, 'ENS_READ_FAILED');
  w.throwOn = null;
  assert.equal((await g.ensGate(NAME, 1n)).ok, true); // the blip did not refuse the name for 20 s
});

test('gate: a throwing dependency fails closed, never into the payment path', async () => {
  const w = world();
  w.deps.policyCapMicro = async () => {
    throw new Error('whitechain rpc down');
  };
  assert.equal(await reasonOf(w), 'ENS_READ_FAILED');
  const w2 = world();
  w2.deps.spentToday = async () => {
    throw new Error('arkiv down');
  };
  assert.equal(await reasonOf(w2), 'ENS_READ_FAILED');
});

test('gate: no expected epoch is ENS_NO_POLICY; a different one is ENS_EPOCH_MISMATCH', async () => {
  const w = world({ epoch: null });
  assert.equal(await reasonOf(w), 'ENS_NO_POLICY');
  const w2 = world({ epoch: 1 });
  assert.equal(await reasonOf(w2), 'ENS_EPOCH_MISMATCH');
});

test('gate: status other than exactly "active" is ENS_PAUSED', async () => {
  for (const status of ['paused', '', 'Active', 'active ', 'killed']) {
    const w = world({ texts: { [NAME]: { [KEYS.status]: status, [KEYS.capMicro]: '5000000' } } });
    assert.equal(await reasonOf(w), 'ENS_PAUSED', JSON.stringify(status));
  }
});

test('gate: a cap that is not decimal digits is ENS_RECORD_INVALID', async () => {
  for (const cap of ['', '1.5', '-1', '1e6', '0x10', ' 5', 'NaN']) {
    const w = world({ texts: { [NAME]: { [KEYS.status]: 'active', [KEYS.capMicro]: cap } } });
    assert.equal(await reasonOf(w), 'ENS_RECORD_INVALID', JSON.stringify(cap));
  }
});

test('gate: records that do not come from the leaf resolver (a default-record leak) are refused', async () => {
  const w = world({ textResolver: OTHER });
  assert.equal(await reasonOf(w), 'ENS_RESOLVER_MISMATCH');
});

test('gate: no policy is ENS_NO_POLICY; the epoch check runs first', async () => {
  const w = world({ policyCap: null });
  assert.equal(await reasonOf(w), 'ENS_NO_POLICY');
});

test('gate: an owner-raised ENS cap above the policy cap changes nothing: min(ENS cap, policy cap) decides', async () => {
  const w = world({ texts: { [NAME]: { [KEYS.status]: 'active', [KEYS.capMicro]: '900000000000' } }, policyCap: 2_000_000n });
  const g = gateOf(w);
  const ok = await g.ensGate(NAME, 2_000_000n);
  assert.equal(ok.ok, true);
  assert.equal(ok.capMicro, 2_000_000n);
  assert.equal((await g.ensGate(NAME, 2_000_001n)).reason, 'CAP_EXCEEDED');
});

test('gate: an owner-lowered ENS cap binds too, and a revoked policy (cap 0) never passes', async () => {
  const lowered = world({ texts: { [NAME]: { [KEYS.status]: 'active', [KEYS.capMicro]: '1000000' } }, policyCap: 5_000_000n });
  assert.equal(await reasonOf(lowered, 1_000_001n), 'CAP_EXCEEDED');
  assert.equal(await reasonOf(lowered, 1_000_000n), undefined);
  const revoked = world({ policyCap: 0n });
  assert.equal(await reasonOf(revoked), 'CAP_EXCEEDED');
});

test('gate: spent today plus the amount over the cap is CAP_EXCEEDED; exactly the cap passes', async () => {
  const w = world({ spent: 4_000_000n });
  assert.equal(await reasonOf(w, 1_000_000n), undefined);
  assert.equal(await reasonOf(w, 1_000_001n), 'CAP_EXCEEDED');
});

test('gate: the chain reads are cached 20 s per exact spelling and stamped before the reads', async () => {
  const w = world();
  const g = gateOf(w);
  await g.ensGate(NAME, 1n);
  await g.ensGate(NAME, 1n);
  assert.equal(w.walkCalls, 1);
  w.now = 19_999;
  await g.ensGate(NAME, 1n);
  assert.equal(w.walkCalls, 1);
  w.now = 20_000;
  await g.ensGate(NAME, 1n);
  assert.equal(w.walkCalls, 2);
});

test('gate: a pause is seen once the cache lapses or is invalidated; the policy side is never cached', async () => {
  const w = world();
  const g = gateOf(w);
  assert.equal((await g.ensGate(NAME, 1n)).ok, true);
  w.texts[NAME][KEYS.status] = 'paused';
  assert.equal((await g.ensGate(NAME, 1n)).ok, true); // still inside the 20 s window
  g.invalidate(NAME);
  assert.equal((await g.ensGate(NAME, 1n)).reason, 'ENS_PAUSED');
  w.texts[NAME][KEYS.status] = 'active';
  w.now = 20_000;
  assert.equal((await g.ensGate(NAME, 1n)).ok, true);
  w.policyCap = 0n; // a revocation by the watcher bites at once
  assert.equal((await g.ensGate(NAME, 1n)).reason, 'CAP_EXCEEDED');
});

test('ens_check: registry state first, then the six public records', async () => {
  const records = {
    [KEYS.agentContext]: 'a synthetic demo cast member',
    [KEYS.agentEndpointMcp]: 'https://example/mcp',
    [KEYS.status]: 'active',
    [KEYS.capMicro]: '5000000',
    [KEYS.principal]: 'owner.graphpay.eth',
    [KEYS.kind]: 'agent',
  };
  const w = world({ texts: { [NAME]: records } });
  const g = gateOf(w);
  const ok = await g.ensCheck(NAME);
  assert.equal(ok.registryState, 'REGISTERED');
  assert.equal(ok.status, 'ACTIVE');
  assert.deepEqual(ok.records, records);
  w.texts[NAME][KEYS.status] = 'paused';
  g.invalidate(NAME);
  assert.equal((await g.ensCheck(NAME)).status, 'PAUSED');
});

test('ens_check: unregistered is REVOKED, a lapse is EXPIRED, a lapsed parent is EXPIRED, unknown and read errors are UNKNOWN', async () => {
  const leaf = (status, expiry) => ({ ok: false, reason: 'ENS_EXPIRED_OR_REVOKED', leaf: { status, expiry, latestOwner: RESOLVER, now: 1000n } });
  const unregistered = world({ walks: { [NAME]: { ok: false, reason: 'ENS_EXPIRED_OR_REVOKED', leaf: { status: 1, expiry: 5000n, latestOwner: '0x0000000000000000000000000000000000000000', now: 1000n } } } });
  assert.deepEqual(pick(await gateOf(unregistered).ensCheck(NAME)), { registryState: 'UNREGISTERED', status: 'REVOKED' });
  const lapsed = world({ walks: { [NAME]: leaf(0, 900n) } });
  assert.deepEqual(pick(await gateOf(lapsed).ensCheck(NAME)), { registryState: 'EXPIRED', status: 'EXPIRED' });
  const ancestor = world({ walks: { [NAME]: { ok: false, reason: 'ENS_ANCESTOR_INACTIVE' } } });
  assert.deepEqual(pick(await gateOf(ancestor).ensCheck(NAME)), { registryState: 'EXPIRED', status: 'EXPIRED' });
  assert.deepEqual(pick(await gateOf(world({ walks: {} })).ensCheck(NAME)), { registryState: 'UNKNOWN', status: 'UNKNOWN' });
  assert.deepEqual(pick(await gateOf(world({ throwOn: 'walk' })).ensCheck(NAME)), { registryState: 'UNKNOWN', status: 'UNKNOWN' });
  assert.deepEqual(pick(await gateOf(world({ throwOn: 'text' })).ensCheck(NAME)), { registryState: 'UNKNOWN', status: 'UNKNOWN' });
});

const pick = ({ registryState, status }) => ({ registryState, status });
