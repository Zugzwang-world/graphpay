import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { siteModel } from './site.server.ts';
import { CAP_COOLDOWN_MS, OwnerCapRefusal, POLICY_WAIT_MS, forgetOwnerCap, setOwnerCap, type OwnerCapDeps } from './owner-cap.server.ts';

const T0 = 1_800_000_000_000;
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e: unknown) => (e instanceof OwnerCapRefusal ? e.code : `error:${String(e)}`));

function deps(over: { policyAfter?: bigint[]; at?: number } = {}) {
  let clock = over.at ?? T0;
  const writes: bigint[] = [];
  const records: Parameters<OwnerCapDeps['record']>[0][] = [];
  const policies = [...(over.policyAfter ?? [300_000_000n, 50_000_000n])];
  const d: OwnerCapDeps = {
    configuredMicro: () => 300_000_000n,
    ensCap: async () => 300_000_000n,
    setEnsCap: async (cap) => {
      writes.push(cap);
      return { changed: true, sepoliaTx: `0x${'5e'.repeat(32)}` };
    },
    policyCap: async () => (policies.length > 1 ? policies.shift()! : policies[0]!),
    record: async (entry) => {
      records.push(entry);
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
  assert.deepEqual([out.policy.applied, out.policy.capMicro, out.effectiveMicro, out.ens.beforeMicro], [true, '50000000', '50000000', '300000000']);
  assert.equal(out.agent, siteModel().payer.ens);
  assert.equal(records[0]!.applied, true);
});

test('a policy that has not followed in time is reported as not applied, and the lower of the two is what holds', async () => {
  const { d, records } = deps({ policyAfter: [300_000_000n] });
  const out = await setOwnerCap({ capMicro: '50000000' }, d);
  assert.deepEqual([out.policy.applied, out.policy.capMicro, out.effectiveMicro], [false, '300000000', '50000000']);
  assert.equal(records[0]!.applied, false);
  assert.ok(POLICY_WAIT_MS > 0);
});

test('the owner can never lift the cap above the configured one; bad figures are refused before anything', async () => {
  const { d, writes } = deps();
  assert.equal(await code(setOwnerCap({ capMicro: '300000001' }, d)), 'OVER_CONFIGURED');
  assert.equal(await code(setOwnerCap({ capMicro: '0' }, d)), 'BAD_CAP');
  assert.equal(await code(setOwnerCap({ capMicro: 5 }, d)), 'BAD_CAP');
  assert.equal(writes.length, 0);
});

test('one change at a time, and one per 20 s', async () => {
  assert.equal(await code(setOwnerCap({ capMicro: '50000000' }, deps().d)), 'ok');
  assert.equal(await code(setOwnerCap({ capMicro: '60000000' }, deps({ at: T0 + 1000 }).d)), 'TOO_SOON');
  assert.equal(await code(setOwnerCap({ capMicro: '60000000' }, deps({ at: T0 + CAP_COOLDOWN_MS + 60_000 }).d)), 'ok');
});
