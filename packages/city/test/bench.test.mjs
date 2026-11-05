// M9 on ArkivSim: the six benchmark questions asked both ways over the seeded S city.
// Graph Arkiv is right by identity, plain by name; Q2's calls are exact (plain reads
// every payment row; Graph Arkiv reads 2); the race reports each call as it lands.
import assert from 'node:assert/strict';
import { test, before } from 'node:test';
import { generatePrivateKey } from 'viem/accounts';
import { story } from '@graphpay/config';
import { QUESTIONS, ask, callTap, connectArkiv, newSim, raceQuestion, score, writerAddresses } from '@graphpay/money-graph';
import { benchParams, benchTruth, generateCity, newManifest, seedGraph, seedPlain, truthOf } from '../index.mjs';

let reader;
let tap;
let writers;
let params;
let truth;

before(async () => {
  const sim = newSim();
  const seed = await connectArkiv({ backend: 'sim', sim, role: 'W_SEED_EVENT', privateKey: generatePrivateKey() });
  const city = generateCity({ story, size: 'S', end: '2026-11-05' });
  const m = (store) => newManifest({ size: 'S', store, owner: seed.owner, dataset: city.dataset, backend: 'sim' });
  await seedGraph(city, seed, { manifest: m('graph') });
  await seedPlain(city, seed, { manifest: m('plain') });
  writers = { ...writerAddresses(), W_SEED_EVENT: seed.owner };
  tap = callTap();
  reader = await connectArkiv({ backend: 'sim', sim, log: tap.log });
  params = benchParams(city);
  truth = benchTruth(city, truthOf(city), params);
});

test('every question: Graph Arkiv right by identity, plain right by name', async () => {
  for (const question of QUESTIONS) {
    for (const mode of ['graph', 'plain']) {
      const r = await ask(reader, { question, mode, params, writers });
      const s = score(question, mode, r.answer, truth);
      assert.equal(s.correct, true, `${question} ${mode}: ${JSON.stringify(r.answer)} against ${JSON.stringify(truth[question][s.truthBasis])}`);
      assert.ok(r.calls > 0, `${question} ${mode} made no call`);
    }
  }
});

test('Q2 calls are exact: plain one page at a time ceil(R / 100), in parallel one more, Graph Arkiv 2', async () => {
  const pages = Math.ceil(truth.payRows / 100);
  assert.equal((await ask(reader, { question: 'Q2', mode: 'graph', params, writers })).calls, 2);
  assert.equal((await ask(reader, { question: 'Q2', mode: 'plain', params, writers })).calls, pages);
  for (const inFlight of [4, 8, 'all']) {
    const r = await ask(reader, { question: 'Q2', mode: 'plain', params, writers, inFlight });
    assert.equal(r.calls, pages + 1, `${inFlight} in flight`);
    assert.equal(score('Q2', 'plain', r.answer, truth).correct, true);
  }
});

test("a list of agents' edges is one batched read: Q3 by Graph Arkiv is agents, epochs, edges", async () => {
  assert.equal((await ask(reader, { question: 'Q3', mode: 'graph', params, writers })).calls, 3);
});

test('the race reports each call as it lands, then the answer and its basis', async () => {
  for (const [mode, inFlight] of [['graph', 1], ['plain', 'all']]) {
    const seen = [];
    const r = await raceQuestion(reader, { question: 'Q2', mode, inFlight, params, truth, tap, writers, onCall: (c) => seen.push(c) });
    assert.equal(seen.length, r.calls);
    assert.deepEqual(seen.map((c) => c.call), seen.map((_, i) => i + 1));
    assert.equal(seen.reduce((a, c) => a + c.bytes, 0), r.bytes);
    assert.equal(r.correct, true);
    assert.equal(r.truthBasis, mode === 'graph' ? 'identity' : 'name');
  }
  await assert.rejects(raceQuestion(reader, { question: 'Q3', mode: 'graph', params, writers }), /race mode asks/);
});
