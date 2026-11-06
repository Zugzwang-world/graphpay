import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { OwnerActions } from '@graphpay/ens';
import { Busy, MAX_PENDING, changeStatus, failureKind, ownerConfigured, ownerKeyName, pausableAgents, pickAgent } from './owner-actions.server.ts';
import { siteModel } from './site.server.ts';

// These tests check the gated mode; the public-access guards are tested on their own.
process.env.GRAPHPAY_PUBLIC_ACCESS = '0';

const hash = `0x${'ab'.repeat(32)}` as const;
const fake = (calls: string[], overrides: Partial<OwnerActions> = {}): OwnerActions => ({
  pause: async (name) => {
    calls.push(`pause ${name}`);
    return { changed: true, hash };
  },
  resume: async (name) => {
    calls.push(`resume ${name}`);
    return { changed: false, reason: 'already active' };
  },
  ...overrides,
});

test("pause and resume act on the story's payer agent, never a name from a request", async () => {
  const calls: string[] = [];
  const paused = await changeStatus(true, { actionsFor: async () => fake(calls) });
  assert.deepEqual(paused, { changed: true, sepoliaTx: hash, note: null });
  const resumed = await changeStatus(false, { actionsFor: async () => fake(calls) });
  assert.deepEqual(resumed, { changed: false, sepoliaTx: null, note: 'already active' });
  assert.deepEqual(calls, [`pause ${siteModel().payer.ens}`, `resume ${siteModel().payer.ens}`]);
});

test('overlapping changes run one at a time, in order, and a failure does not jam the queue', async () => {
  const order: string[] = [];
  const slow: OwnerActions = {
    pause: async () => {
      order.push('pause start');
      await new Promise((r) => setTimeout(r, 30));
      order.push('pause end');
      throw new Error('boom');
    },
    resume: async () => {
      order.push('resume');
      return { changed: true, hash };
    },
  };
  const [a, b] = await Promise.allSettled([changeStatus(true, { actionsFor: async () => slow }), changeStatus(false, { actionsFor: async () => slow })]);
  assert.equal(a.status, 'rejected');
  assert.equal(b.status, 'fulfilled');
  assert.deepEqual(order, ['pause start', 'pause end', 'resume']);
});

test("the owner's key is named from the namespace plan and counted only when it is a well-formed key", () => {
  const name = ownerKeyName(siteModel().payer.ens);
  assert.match(name, /^[A-Z0-9_]+_PRIVATE_KEY$/);
  assert.equal(ownerConfigured({}), false);
  assert.equal(ownerConfigured({ [name]: '0x1234' }), false);
  assert.equal(ownerConfigured({ [name]: `0x${'1'.repeat(64)}` }), true);
});

test('a client cannot stack changes: past the queue limit the next one is refused at once', async () => {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((r) => (release = r));
  const held: OwnerActions = {
    pause: async () => {
      await gate;
      return { changed: true, hash };
    },
    resume: async () => ({ changed: false, reason: 'already active' }),
  };
  const first = Array.from({ length: MAX_PENDING }, () => changeStatus(true, { actionsFor: async () => held }));
  await assert.rejects(changeStatus(false, { actionsFor: async () => held }), Busy);
  release();
  await Promise.all(first);
  assert.equal((await changeStatus(false, { actionsFor: async () => held })).changed, false, 'the queue accepts again once it has drained');
});

test('a failure is logged as a kind, never as its message (which can carry an RPC URL)', () => {
  assert.equal(failureKind(new Error('nonce too low at https://rpc.example/key')), 'nonce');
  assert.equal(failureKind(new Error('refused: the RPC reports chain 1')), 'chain');
  assert.equal(failureKind(new Error('execution reverted: EACUnauthorizedAccountRoles')), 'revert');
  assert.equal(failureKind(new Error('pause receipt: not visible on chain after 60 s')), 'timeout');
  assert.equal(failureKind('weird'), 'error');
});

test('public access: changes are at most one per cooldown, and the gated mode is unchanged', async () => {
  const { CHANGE_COOLDOWN_MS } = await import('./owner-actions.server.ts');
  const calls: string[] = [];
  const t0 = 10_000_000;
  await changeStatus(true, { actionsFor: async () => fake(calls), open: true, now: t0 });
  await assert.rejects(changeStatus(false, { actionsFor: async () => fake(calls), open: true, now: t0 + CHANGE_COOLDOWN_MS - 1 }), Busy);
  await changeStatus(false, { actionsFor: async () => fake(calls), open: true, now: t0 + CHANGE_COOLDOWN_MS });
  await changeStatus(true, { actionsFor: async () => fake(calls), open: false, now: t0 + CHANGE_COOLDOWN_MS + 1 });
  assert.equal(calls.length, 3);
});

test('pause per agent: the tapped card names the agent; only buyer agents with a spending pass are pausable', () => {
  const model = siteModel();
  const pausable = pausableAgents(model);
  assert.deepEqual(
    pausable.map((a) => a.key),
    model.buyerAgents.filter((a) => a.pays && a.capMicro !== null).map((a) => a.key),
  );
  assert.ok(pausable.some((a) => a.key === 'payer') && pausable.some((a) => a.key === 'scout'), 'the payer and the scout hold passes');
  // None named: the payer, as the phones' first build sends {}.
  for (const none of [undefined, null, '']) assert.deepEqual(pickAgent(none, model), { ok: true, agent: model.payer });
  const scout = pausable.find((a) => a.key === 'scout')!;
  assert.deepEqual(pickAgent(scout.ens, model), { ok: true, agent: scout });
  assert.deepEqual(pickAgent(` ${scout.ens.toUpperCase()} `, model), { ok: true, agent: scout }, 'a name in any case');
  assert.deepEqual(pickAgent('scout', model), { ok: true, agent: scout }, 'or the story key');
  for (const other of model.buyerAgents.filter((a) => !pausable.includes(a))) {
    const refused = pickAgent(other.ens, model);
    assert.equal(refused.ok, false);
    if (refused.ok) continue;
    assert.equal(refused.status, 409);
    assert.equal(refused.reason, 'NO_PASS');
    assert.ok(refused.error.startsWith(`${other.displayName} has no spending pass`), refused.error);
    for (const a of pausable) assert.ok(refused.error.includes(a.displayName), `the refusal names ${a.displayName}`);
  }
  // Never a name outside the buyer team, a working agent's or a shop's included.
  for (const bad of ['someone.else.eth', model.merchant.ens, model.merchant.agents[0]!.ens]) assert.deepEqual(pickAgent(bad, model), { ok: false, status: 400, error: 'not an agent of this story', reason: 'NOT_AN_AGENT' });
  assert.equal(pickAgent(42, model).ok, false);
});

test('a change acts on the agent it is given, and the owner key is the one for that agent', async () => {
  const calls: string[] = [];
  const scout = pausableAgents().find((a) => a.key === 'scout')!;
  await changeStatus(true, { actionsFor: async () => fake(calls), agent: scout.ens });
  assert.deepEqual(calls, [`pause ${scout.ens}`]);
  assert.equal(ownerConfigured({ [ownerKeyName(scout.ens)]: `0x${'1'.repeat(64)}` }, scout.ens), true);
});
