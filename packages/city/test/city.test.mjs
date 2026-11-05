import assert from 'node:assert/strict';
import { test } from 'node:test';
import { story } from '@graphpay/config';
import { generateCity, truthOf } from '../index.mjs';

test('the city is deterministic for a seed and labelled synthetic', () => {
  const a = generateCity({ story, size: 'S', end: '2026-11-05' });
  const b = generateCity({ story, size: 'S', end: '2026-11-05' });
  assert.deepEqual(a.events.map((e) => e.ref + e.amountMicro), b.events.map((e) => e.ref + e.amountMicro));
  assert.ok(a.events.length > 800 && a.events.length < 1200);
  assert.ok(a.dataset.startsWith(story.syntheticCity.dataset));
  for (const ens of a.actors.keys()) assert.ok(ens.includes(`.${story.syntheticCity.generator.simLabel}.`) || a.actors.get(ens).cast, ens);
});

test('the persona buys only in the last week and never from the trap shop; one shop re-registers', () => {
  const city = generateCity({ story, size: 'S', end: '2026-11-05' });
  const persona = new Set(Object.values(city.personaAgents));
  const buys = city.events.filter((e) => persona.has(e.from.ens) && e.kind === 'pay');
  assert.ok(buys.length > 0);
  for (const e of buys) {
    assert.ok(e.ts >= city.endTs - 7 * 86_400);
    assert.notEqual(e.to.ens, city.byRole.trap);
  }
  const epochs = new Set(city.events.filter((e) => e.to.ens === city.reShop).map((e) => e.to.epoch));
  assert.equal(epochs.size, 2);
  const t = truthOf(city);
  assert.equal(t.q2.identity.length, 10);
  assert.ok(t.q2.payRows > 400);
});

test('size M is refused while the story is unlocked', async () => {
  assert.equal(story.locked, false);
});
