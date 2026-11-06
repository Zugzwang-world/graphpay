import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { siteModel } from './site.server.ts';
import { CAP_COOLDOWN_MS, OwnerCapRefusal, POLICY_WAIT_MS, forgetOwnerCap, setOwnerCap, type OwnerCapDeps } from './owner-cap.server.ts';

const T0 = 1_800_000_000_000;
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e: unknown) => (e instanceof OwnerCapRefusal ? e.code : `error:${String(e)}`));

function deps(over: { policyAfter?: (bigint | Error)[]; at?: number; recordFails?: boolean } = {}) {
  let clock = over.at ?? T0;
  const writes: bigint[] = [];
  const records: Parameters<OwnerCapDeps['record']>[0][] = [];
  const policies = [...(over.policyAfter ?? [300_000_000n, 50_000_000n])];
  const d: OwnerCapDeps = {
    configuredMicro: () => 300_000_000n,
    floorMicro: () => 6_000_000n,
    ensCap: async () => 300_000_000n,
    setEnsCap: async (cap) => {
      writes.push(cap);
      return { changed: true, sepoliaTx: `0x${'5e'.repeat(32)}` };
    },
    policy: async () => {
      const next = policies.length > 1 ? policies.shift()! : policies[0]!;
      if (next instanceof Error) throw next;
      return { capMicro: next, epoch: 0 };
    },
    record: async (entry) => {
      records.push(entry);
      if (over.recordFails) throw new Error('write failed');
      return { entityKey: '0xkey', txHash: '0xtx' };
    },
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
  };
  return { d, writes, records };
}

beforeEach(() => forgetOwnerCap());

test('the owner lowers the cap: the ENS record first, then the policy follows, and the change is recorded', async () => {
  const { d, writes, records } = deps();
  const out = await setOwnerCap({ capMicro: '50000000' }, d);
  assert.deepEqual(writes, [50_000_000n]);
  assert.deepEqual([out.policy.applied, out.policy.capMicro, out.effectiveMicro, out.ens.beforeMicro, out.arkivTx], [true, '50000000', '50000000', '300000000', '0xtx']);
  assert.equal(out.agent, siteModel().payer.ens);
  assert.deepEqual([records[0]!.applied, records[0]!.ensChanged, records[0]!.epoch], [true, true, 0]);
});

test('a policy that has not followed in time is reported as not applied, and the lower of the two is what holds', async () => {
  const { d, records } = deps({ policyAfter: [300_000_000n] });
  const out = await setOwnerCap({ capMicro: '50000000' }, d);
  assert.deepEqual([out.policy.applied, out.policy.capMicro, out.effectiveMicro], [false, '300000000', '50000000']);
  assert.equal(records[0]!.applied, false);
  assert.ok(POLICY_WAIT_MS > 0);
});

test('after the ENS change, a failed policy read or Arkiv write never loses the answer', async () => {
  const flaky = deps({ policyAfter: [new Error('rpc'), new Error('rpc'), 50_000_000n] });
  const out = await setOwnerCap({ capMicro: '50000000' }, flaky.d);
  assert.deepEqual([out.policy.applied, flaky.records.length], [true, 1]);
  forgetOwnerCap();
  const unread = deps({ policyAfter: [new Error('rpc')] });
  const none = await setOwnerCap({ capMicro: '50000000' }, unread.d);
  assert.deepEqual([none.policy.capMicro, none.policy.applied, none.effectiveMicro], [null, false, '50000000']);
  assert.equal(unread.records[0]!.policyMicro, null);
  forgetOwnerCap();
  const lost = await setOwnerCap({ capMicro: '50000000' }, deps({ recordFails: true }).d);
  assert.deepEqual([lost.ens.changed, lost.arkivTx], [true, null]);
});

test('the owner can never lift the cap above the configured one, nor a visitor drop it below the errand\'s budget', async () => {
  const { d, writes } = deps();
  assert.equal(await code(setOwnerCap({ capMicro: '300000001' }, d)), 'OVER_CONFIGURED');
  assert.equal(await code(setOwnerCap({ capMicro: '5999999' }, d)), 'UNDER_FLOOR');
  assert.equal(await code(setOwnerCap({ capMicro: '0' }, d)), 'BAD_CAP');
  assert.equal(await code(setOwnerCap({ capMicro: 5 }, d)), 'BAD_CAP');
  assert.equal(writes.length, 0);
});

test('one change at a time, and one per 20 s', async () => {
  assert.equal(await code(setOwnerCap({ capMicro: '50000000' }, deps().d)), 'ok');
  assert.equal(await code(setOwnerCap({ capMicro: '60000000' }, deps({ at: T0 + 1000 }).d)), 'TOO_SOON');
  assert.equal(await code(setOwnerCap({ capMicro: '60000000' }, deps({ at: T0 + CAP_COOLDOWN_MS + 60_000 }).d)), 'ok');
});
