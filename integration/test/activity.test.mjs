import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { agentsOnline, connectArkiv, handoffsFor, newSim } from '@graphpay/money-graph';
import { batchedActivity } from '../src/activity.mjs';

// Test-only names; ArkivSim with a throwaway key.
const AGENT = 'scout.persona.example.eth';
const OWNER = 'persona.example.eth';
const RUN = `0x${'0f'.repeat(32)}`;

test('ArkivSim: hook calls return at once and land as one transaction a phase, read back by T3\'s readers', async () => {
  const arkiv = await connectArkiv({ backend: 'sim', sim: newSim(), role: 'W_DIRECTORY', privateKey: `0x${randomBytes(32).toString('hex')}`, recoveryMs: 300, pollMs: 20 });
  const timers = [];
  const a = batchedActivity(arkiv, { setTimer: (fn) => (timers.push(fn), timers.length), clearTimer: () => {} });
  a.presence('start', { agentEns: AGENT, ownerEns: OWNER, role: 'scout', session: RUN });
  for (const step of ['ask', 'check', 'check-back', 'quote', 'pay']) a.handoff(AGENT, `analyst.${OWNER}`, step, { requestId: RUN });
  // Nothing is sent from the hook calls themselves: one flush timer, no transaction yet.
  assert.equal(timers.length, 1);
  assert.equal(a.stats.txs, 0);
  assert.equal(await arkiv.publicClient.getTransactionCount({ address: arkiv.owner }), 0);
  const first = await a.flush();
  assert.equal(first.txs, 1);
  assert.equal(first.written, 6);
  a.presence('renew', { agentEns: AGENT, ownerEns: OWNER, role: 'scout', session: RUN });
  const second = await a.flush();
  assert.equal(second.txs, 2);
  assert.equal(second.dropped, 0);
  const online = await agentsOnline(arkiv.publicClient, { owner: arkiv.owner, session: RUN });
  assert.deepEqual(online.map((r) => r.agentEns), [AGENT]);
  const steps = (await handoffsFor(arkiv.publicClient, RUN, { owner: arkiv.owner })).map((h) => h.step);
  assert.deepEqual([...steps].sort(), ['ask', 'check', 'check-back', 'pay', 'quote']);
});

test('hold(): nothing goes out while held, overlapping holds release at the last one, then it flushes', async () => {
  const arkiv = await connectArkiv({ backend: 'sim', sim: newSim(), role: 'W_DIRECTORY', privateKey: `0x${randomBytes(32).toString('hex')}`, recoveryMs: 300, pollMs: 20 });
  const a = batchedActivity(arkiv, { setTimer: () => 1, clearTimer: () => {} });
  const releaseA = await a.hold();
  const releaseB = await a.hold();
  a.handoff(AGENT, `analyst.${OWNER}`, 'quote', { requestId: RUN });
  const flushed = a.flush();
  await new Promise((ok) => setTimeout(ok, 50));
  assert.equal(a.stats.txs, 0); // held
  releaseA();
  releaseA(); // a second release of the same hold does nothing
  await new Promise((ok) => setTimeout(ok, 50));
  assert.equal(a.stats.txs, 0); // B still holds
  releaseB();
  const s = await flushed;
  assert.equal(s.txs, 1);
  assert.equal(s.written, 1);
});
