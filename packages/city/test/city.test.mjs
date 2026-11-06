import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { story } from '@graphpay/config';
import { cityDigest, generateCity, pinnedCast, truthOf } from '../index.mjs';

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

// A seeded city is generated again exactly as it was seeded (ADR-0077): its truth file in
// docs/sessions/arkiv/city/ is what race mode and the benchmark check answers against, so a
// story change that would move it (a shop's label, the renewal price) fails here instead.
test('every seeded city generates again as seeded', () => {
  for (const size of Object.keys(story.syntheticCity.sizes)) {
    const file = new URL(`../../../docs/sessions/arkiv/city/truth-${size}.json`, import.meta.url);
    if (!existsSync(file)) continue;
    const seeded = JSON.parse(readFileSync(file, 'utf8'));
    const city = generateCity({ story, size, end: seeded.generated.end });
    assert.deepEqual(JSON.parse(JSON.stringify(truthOf(city))), seeded.truth, `size ${size}`);
  }
});

// Stronger than the answers: every event and every actor of a seeded city, by digest.
test('every seeded city generates the same events and actors again', () => {
  const seeded = JSON.parse(readFileSync(new URL('../../../docs/sessions/arkiv/city/digests.json', import.meta.url), 'utf8'));
  const sizes = Object.keys(seeded).filter((k) => k !== 'about');
  assert.ok(sizes.includes('S'));
  for (const size of sizes) {
    const { end, ...digest } = seeded[size];
    assert.deepEqual(cityDigest(generateCity({ story, size, end })), digest, `size ${size}`);
  }
});

test('a size is generated with its own cast: labels, category, places and renewal by story role', () => {
  const casts = story.syntheticCity.casts;
  for (const name of ['test', 'final']) {
    const cast = pinnedCast(story, name);
    for (const s of cast.shops) {
      const p = casts[name].shops[s.storyRole];
      assert.equal(s.label, p.label);
      assert.equal(s.category, casts[name].category);
      assert.deepEqual(s.location, p.lat === undefined ? null : { lat: p.lat, lng: p.lng });
    }
    assert.equal(cast.renewal.priceMicro, casts[name].renewalPriceMicro);
  }
  const city = generateCity({ story, size: 'S', end: '2026-11-05' });
  assert.equal(city.byRole.good, `${casts.test.shops.good.label}.${city.root}`);
  assert.throws(() => pinnedCast(story, 'none'), /no cast "none"/);
});

// W1's flip (ADR-0077): the live labels and the live category change in one PR, or the
// analyst would rank one cast's shops by the other cast's category.
test('the live shops carry the final cast\'s category whenever they carry its labels', () => {
  const final = story.syntheticCity.casts.final;
  const flipped = story.shops.filter((s) => s.label === final.shops[s.storyRole]?.label);
  if (flipped.length === 0) return;
  assert.equal(flipped.length, story.shops.length, 'flip all three labels together');
  for (const s of story.shops) assert.equal(s.category, final.category, `${s.storyRole}: shops[].category flips with the label`);
});
