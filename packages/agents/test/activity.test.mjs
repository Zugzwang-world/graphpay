// The optional presence and handoff hooks (EVENT_ADDENDUM A7, A8): no-ops when
// absent, names from the cast, fire and forget, errors scrubbed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PRESENCE_RENEW_MS, runErrand, STEPS, teamCast } from '../index.mjs';
import { createMockActivity, createMockWorld } from '../mocks/index.mjs';

const cast = teamCast();
const good = cast.shopByRole('good').ens;
const NOON_IST = Date.parse('2026-11-06T06:30:00.000Z');

async function errand({ activity, ...extra } = {}) {
  const world = createMockWorld({ now: NOON_IST });
  const hooks = activity ? { ...world.hooks, ...activity } : world.hooks;
  const out = await runErrand({ now: NOON_IST, mode: 'mock', cast: world.cast, hooks, mcp: world.mcp, mockModels: world.mockModels, ...extra });
  return { ...out, world };
}

test('hooks absent: nothing changes, and recording hooks leave the run log byte-identical', async () => {
  const bare = await errand();
  const again = await errand();
  const hooked = await errand({ activity: createMockActivity() });
  assert.equal(JSON.stringify(again.runLog), JSON.stringify(bare.runLog));
  assert.equal(JSON.stringify(hooked.runLog), JSON.stringify(bare.runLog));
  assert.equal(bare.runLog.result.status, 'paid');
});

test('presence starts once per agent with its owner and the run id as session', async () => {
  const activity = createMockActivity();
  const { runLog } = await errand({ activity });
  const starts = activity.presences.filter((p) => p.phase === 'start');
  const names = starts.map((p) => p.agentEns).sort();
  assert.equal(new Set(names).size, names.length, 'one start per agent');
  const expected = [...Object.values(cast.buyer), cast.payers.payer.ens, ...Object.values(cast.shopAgentNames(good))];
  for (const name of Object.values(cast.buyer)) assert.ok(names.includes(name), `${name} announced itself`);
  assert.ok(names.includes(cast.payers.payer.ens));
  assert.ok(names.every((n) => expected.includes(n)));
  for (const p of starts) {
    assert.equal(p.session, runLog.runId);
    const shopAgent = Object.values(cast.shopAgentNames(good)).includes(p.agentEns);
    assert.equal(p.ownerEns, shopAgent ? good : cast.persona.ens);
  }
  const roles = Object.fromEntries(starts.map((p) => [p.agentEns, p.role]));
  assert.equal(roles[cast.buyer.concierge], 'concierge');
  assert.equal(roles[cast.shopAgentNames(good).risk], 'risk');
});

test('handoffs follow every message between two agents, in lane order, with the run id', async () => {
  const activity = createMockActivity();
  const { runLog } = await errand({ activity });
  assert.ok(activity.handoffs.length >= 10);
  assert.ok(activity.handoffs.every((h) => h.requestId === runLog.runId));
  assert.ok(activity.handoffs.every((h) => h.from !== cast.persona.ens && h.to !== cast.persona.ens), "the human's own message is not a handoff");
  assert.equal(activity.handoffs.length, runLog.edges.length - 1, 'every edge but the human ask');
  const lanes = [...new Set(activity.handoffs.map((h) => h.step))];
  assert.deepEqual(lanes.sort(), Object.values(STEPS).sort());
  // The steps are lanes, not a global order: the quote call runs the shop's check back inside it.
  const at = (step, last = false) => (last ? activity.handoffs.findLastIndex((h) => h.step === step) : activity.handoffs.findIndex((h) => h.step === step));
  assert.ok(at(STEPS.ask) < at(STEPS.check), 'the concierge asks before the team reports back');
  assert.ok(at(STEPS.quote) < at(STEPS.checkBack), 'the shop checks the buyer inside the quote');
  assert.ok(at(STEPS.quote, true) < at(STEPS.pay, true), 'the last edge is a pay edge');
  const vet = activity.handoffs.find((h) => h.step === STEPS.checkBack);
  assert.equal(vet.from, cast.shopAgentNames(good).storefront);
  assert.equal(vet.to, cast.shopAgentNames(good).risk);
});

for (const fail of ['sync', 'async']) {
  test(`a ${fail} hook failure never stops an agent step and is scrubbed into the log`, async () => {
    const secret = 'S'.repeat(24);
    const activity = createMockActivity({ fail, message: `HTTP request failed. URL: https://rpc.invalid/v1/${secret}` });
    const { runLog, world } = await errand({ activity, secrets: [secret] });
    assert.equal(runLog.result.status, 'paid');
    assert.equal(world.hooks.signed.length, 1);
    const notes = runLog.events.filter((e) => e.type === 'guard' && e.guard === 'HOOKS');
    assert.ok(notes.length > 0);
    assert.ok(notes.every((e) => e.ok === true && /hook failed/.test(e.detail)));
    assert.equal(JSON.stringify(runLog).includes(secret), false);
  });
}

test('a hook that never settles does not hold the errand', async () => {
  const activity = createMockActivity({ hang: true });
  const { runLog } = await errand({ activity });
  assert.equal(runLog.result.status, 'paid');
  assert.ok(activity.presences.length > 0 && activity.handoffs.length > 0);
});

test('renewals run on a timer while the errand runs and stop when it ends', async () => {
  const timers = [];
  const cleared = [];
  const setTimer = (fn, ms) => {
    const timer = { fn, ms };
    timers.push(timer);
    return timer;
  };
  const clearTimer = (timer) => cleared.push(timer);
  const activity = createMockActivity();
  let renewed = false;
  const handoff = activity.handoff;
  activity.handoff = (...args) => {
    if (!renewed && timers[0]) {
      renewed = true;
      timers[0].fn(); // a renewal tick in the middle of the errand
    }
    return handoff(...args);
  };
  const { runLog } = await errand({ activity, setTimer, clearTimer });
  assert.equal(runLog.result.status, 'paid');
  assert.equal(timers.length, 1, 'one timer for the whole errand');
  assert.equal(timers[0].ms, PRESENCE_RENEW_MS);
  assert.ok(PRESENCE_RENEW_MS < 15 * 60_000, 'renewed inside the 15 minute expiry');
  assert.deepEqual(cleared, [timers[0]]);
  const renews = activity.presences.filter((p) => p.phase === 'renew');
  const starts = activity.presences.filter((p) => p.phase === 'start');
  assert.ok(renews.length > 0 && renews.length <= starts.length);
  assert.ok(renews.every((r) => starts.some((s) => s.agentEns === r.agentEns && s.session === r.session)));
});

test('no presence hook, no timer', async () => {
  let made = 0;
  await errand({ activity: { handoff: () => {} }, setTimer: () => { made += 1; return null; } });
  assert.equal(made, 0);
});
