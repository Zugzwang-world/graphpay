import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { OwnerActions } from '@graphpay/ens';
import { changeStatus, ownerConfigured, ownerKeyName } from './owner-actions.server.ts';
import { siteModel } from './site.server.ts';

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
