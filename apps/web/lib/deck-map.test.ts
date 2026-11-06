import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DECK_MAP, ERRAND_KEYS, isDeckKey } from './deck-map.ts';

// The deck's slide titles, in order (the `slides` array of the deck page).
function deckTitles(): string[] {
  const html = readFileSync(new URL('../public/deck/index.html', import.meta.url), 'utf8');
  return [...html.matchAll(/^ {2}\{ kind: '[a-z]+', title: '((?:[^'\\]|\\.)*)'/gm)].map((m) => (m[1] ?? '').replace(/\\'/g, "'").replace(/’/g, '’'));
}

test('every row of the table points at the slide with that title', () => {
  const titles = deckTitles();
  assert.ok(titles.length >= 16, `read ${titles.length} slide titles`);
  for (const [key, spot] of Object.entries(DECK_MAP)) assert.equal(titles[spot.slide - 1], spot.title, key);
});

test('the errand has seven steps in order, each its own row', () => {
  assert.deepEqual(ERRAND_KEYS, ['ask', 'team', 'check', 'check-back', 'quote', 'payment', 'record']);
  assert.deepEqual(ERRAND_KEYS.map((k) => DECK_MAP[k].errand), [1, 2, 3, 4, 5, 6, 7]);
});

test('only known keys are accepted from a phone', () => {
  assert.equal(isDeckKey('refund'), true);
  for (const bad of ['', 'toString', '__proto__', 42, null, undefined, {}]) assert.equal(isDeckKey(bad), false);
});
