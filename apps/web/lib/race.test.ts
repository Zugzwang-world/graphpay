import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, test } from 'node:test';
import { generatePrivateKey } from 'viem/accounts';
import { story } from '@graphpay/config';
import { RACE_QUESTIONS, connectArkiv, newSim, writerAddresses } from '@graphpay/money-graph';
import { generateCity, newManifest, seedGraph, seedPlain } from '@graphpay/city';
import { createRaceLock, kbOf, parseBenchCsv, parseRaceQuery } from './race.ts';
import { SEEDED_END, runRace, type RaceFrame } from './race.server.ts';

const q = (s: string) => parseRaceQuery(new URLSearchParams(s), RACE_QUESTIONS);

test('a race query is validated: question, side, size and pages in flight', () => {
  assert.deepEqual(q('question=Q2&mode=graph'), { question: 'Q2', mode: 'graph', inFlight: 1 });
  assert.deepEqual(q('question=Q2&mode=plain&inFlight=all&size=S'), { question: 'Q2', mode: 'plain', inFlight: 'all' });
  // The graph side has no pages: whatever is asked, it is read once.
  assert.deepEqual(q('question=Q5&mode=graph&inFlight=8'), { question: 'Q5', mode: 'graph', inFlight: 1 });
  for (const bad of ['question=Q3&mode=graph', 'question=Q2', 'question=Q2&mode=plain&inFlight=1000', 'question=Q2&mode=plain&size=M', 'mode=graph']) {
    assert.ok('error' in q(bad), bad);
  }
});

test('one race per side at a time', () => {
  const lock = createRaceLock();
  const release = lock.take('plain');
  assert.ok(release);
  assert.equal(lock.take('plain'), null);
  assert.ok(lock.take('graph'));
  release();
  assert.ok(lock.take('plain'));
});

test('the committed benchmark parses to reads, bytes and correctness, with no time anywhere', () => {
  const csv = readFileSync(new URL('../../../bench/results/questions-S.csv', import.meta.url), 'utf8');
  const rows = parseBenchCsv(csv);
  assert.deepEqual(rows.map((r) => r.question), ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6']);
  const q2 = rows.find((r) => r.question === 'Q2');
  assert.equal(q2?.graphReads, 2);
  assert.equal(q2?.plainRightByIdentity, false);
  assert.equal(q2?.graphRight, true);
  assert.equal(Object.keys(q2 ?? {}).some((k) => /ms|time/i.test(k)), false);
  assert.equal(kbOf(135088), '131.9');
  assert.throws(() => parseBenchCsv('a,b\n1,2'), /no calls column|no question column/);
});

let connect: Parameters<typeof runRace>[2];

before(async () => {
  const sim = newSim();
  const seed = await connectArkiv({ backend: 'sim', sim, role: 'W_SEED_EVENT', privateKey: generatePrivateKey() });
  const city = generateCity({ story, size: 'S', end: SEEDED_END }) as { dataset: string };
  const m = (store: string) => newManifest({ size: 'S', store, owner: seed.owner, dataset: city.dataset, backend: 'sim' });
  await seedGraph(city, seed, { manifest: m('graph') });
  await seedPlain(city, seed, { manifest: m('plain') });
  connect = { connect: (log) => connectArkiv({ backend: 'sim', sim, log }), writers: { ...writerAddresses(), W_SEED_EVENT: seed.owner as `0x${string}` } } as Parameters<typeof runRace>[2];
});

for (const [mode, inFlight, reads] of [['graph', 1, 2], ['plain', 1, 5], ['plain', 'all', 6]] as const) {
  test(`the live race on the seeded city: ${mode} (${inFlight} in flight) ticks per read, then answers correctly in ${reads} reads`, async () => {
    const frames: RaceFrame[] = [];
    await runRace({ question: 'Q2', mode, inFlight }, (f) => frames.push(f), connect);
    const calls = frames.filter((f) => f.event === 'call');
    const answer = frames.at(-1);
    assert.equal(answer?.event, 'answer');
    assert.equal(calls.length, reads);
    assert.deepEqual(calls.map((f) => (f.data as { call: number }).call), calls.map((_, i) => i + 1));
    const a = answer?.data as { calls: number; bytes: number; correct: boolean; truthBasis: string };
    assert.equal(a.calls, reads);
    assert.equal(a.correct, true);
    assert.equal(a.truthBasis, mode === 'graph' ? 'identity' : 'name');
    assert.equal(calls.reduce((n, f) => n + (f.data as { bytes: number }).bytes, 0), a.bytes);
    assert.equal(Object.keys(a).includes('ms'), false);
  });
}
