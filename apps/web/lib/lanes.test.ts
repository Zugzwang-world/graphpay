import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generatePrivateKey } from 'viem/accounts';
import { connectArkiv, createGraphEngine, newSim, recordHandoff, runGraphql, writerAddresses } from '@graphpay/money-graph';
import { HANDOFFS_QUERY, LANES, agentLabel, handoffsUrl, lanesOf, reached, type HandoffRow } from './lanes.ts';

const row = (step: string, n = 1): HandoffRow => ({ key: `0x${n.toString(16).padStart(64, '0')}`, step, from: { ens: 'concierge.p.sim.example.eth' }, to: { ens: 'scout.p.sim.example.eth' } });

test('the lanes are the five steps of the addendum, in order', () => {
  assert.deepEqual(LANES.map((l) => l.step), ['ask', 'check', 'check-back', 'quote', 'pay']);
  assert.deepEqual(LANES.map((l) => l.title), ['Ask', 'Check', 'Check back', '402 quote', 'Pay']);
});

test('handoffs fall into their lane, keep their order, and an unknown step is shown apart, not dropped', () => {
  const rows = [row('ask', 1), row('check', 2), row('check', 3), row('check-back', 4), row('mystery', 5)];
  const { lanes, other } = lanesOf(rows);
  assert.deepEqual(lanes.map((l) => l.rows.length), [1, 2, 1, 0, 0]);
  assert.deepEqual(other.map((r) => r.step), ['mystery']);
  assert.equal(reached(rows), 2, 'the last lane with a row');
  assert.equal(reached([]), -1);
  assert.equal(agentLabel('a.b.sim.example.eth'), 'a');
});

test('the run id travels as a variable, never inside the query text', () => {
  const params = new URL(handoffsUrl('run-abc'), 'https://example.test').searchParams;
  assert.equal(params.get('query'), HANDOFFS_QUERY);
  assert.deepEqual(JSON.parse(params.get('variables') ?? ''), { id: 'run-abc' });
  assert.ok(!HANDOFFS_QUERY.includes('run-abc'));
});

test('handoffs written the way the agents write them come back through GraphQL into their lanes', async () => {
  const sim = newSim();
  const dir = await connectArkiv({ backend: 'sim', sim, role: 'W_DIRECTORY', privateKey: generatePrivateKey(), recoveryMs: 300, pollMs: 20 });
  const reader = await connectArkiv({ backend: 'sim', sim });
  const run = 'run-0123456789abcdef';
  const A = (label: string) => `${label}.person.sim.example.eth`;
  for (const [from, to, step] of [['concierge', 'scout', 'ask'], ['concierge', 'analyst', 'ask'], ['scout', 'concierge', 'check-back'], ['payer', 'storefront', 'quote'], ['payer', 'storefront', 'pay']] as const) {
    await recordHandoff(dir, { requestId: run, fromAgent: A(from), toAgent: A(to), step });
  }
  await recordHandoff(dir, { requestId: 'another-run', fromAgent: A('concierge'), toAgent: A('scout'), step: 'ask' });
  const answer = await runGraphql({ engine: createGraphEngine(reader), query: HANDOFFS_QUERY, variables: { id: run }, writers: { ...writerAddresses(), W_DIRECTORY: dir.owner as `0x${string}` } });
  assert.equal(answer.errors, undefined);
  const rows = (answer.data as { handoffs: HandoffRow[] }).handoffs;
  assert.equal(rows.length, 5, "another run's handoffs are not in this run's lanes");
  const { lanes } = lanesOf(rows);
  assert.deepEqual(lanes.map((l) => l.rows.length), [2, 0, 1, 1, 1]);
  assert.ok(rows.every((r) => /^0x[0-9a-f]{64}$/.test(r.key)), 'every chip has an entity key to open on the explorer');
});
