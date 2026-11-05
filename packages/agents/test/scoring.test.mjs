import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buyerRiskReasons, rankShops, talliesFromNodes, teamCast, volumeReference } from '../index.mjs';
import { mockGraphRows } from '../mocks/index.mjs';

const cast = teamCast();
const good = cast.shopByRole('good').ens;
const trap = cast.shopByRole('trap').ens;
const runnerUp = cast.shopByRole('runner-up').ens;

const shopNodes = (rows) => rows.filter((r) => r.kind === 'shop').map((r) => ({ ...r, reputation: { ...r.d90, synthetic: true } }));
const scores = (ranking) => Object.fromEntries(ranking.map((r) => [r.ens, Number(r.score.toFixed(3))]));

test('code ranks the story shops 0.986 > 0.934 and excludes the trap at 0.821', () => {
  const ranking = rankShops(talliesFromNodes(shopNodes(mockGraphRows(cast))), volumeReference(cast));
  assert.deepEqual(
    ranking.map((r) => r.ens),
    [good, runnerUp, trap],
  );
  assert.deepEqual(scores(ranking), { [good]: 0.986, [runnerUp]: 0.934, [trap]: 0.821 });
  assert.deepEqual(
    ranking.map((r) => r.eligible),
    [true, true, false],
  );
});

test('the trap is ineligible and the ranking says why (refunds above 10%, on time below 80%)', () => {
  const ranking = rankShops(talliesFromNodes(shopNodes(mockGraphRows(cast))), volumeReference(cast));
  const t = ranking.find((r) => r.ens === trap);
  assert.equal(t.eligible, false);
  assert.match(t.reasons.join(' '), /refund rate 18\.4% is above 10\.0%/);
  assert.match(t.reasons.join(' '), /on-time rate 71\.0% is below 80\.0%/);
});

test('a smaller history keeps the volume reference (acceptance E2 on Rabdi: about 0.916 / 0.863 / 0.750)', () => {
  const smaller = { [good]: 241, [runnerUp]: 60, [trap]: 110 };
  const nodes = shopNodes(mockGraphRows(cast)).map((n) => ({ ...n, reputation: { ...n.reputation, orders: smaller[n.ens] } }));
  const ranking = rankShops(talliesFromNodes(nodes), volumeReference(cast));
  assert.deepEqual(scores(ranking), { [good]: 0.916, [runnerUp]: 0.863, [trap]: 0.75 });
});

test('a shop whose reputation cannot be read reliably ranks ineligible (fail closed)', () => {
  const nodes = shopNodes(mockGraphRows(cast));
  nodes[0].reputation = { ...nodes[0].reputation, source: 'TRUNCATED' };
  nodes[1].reputation = null;
  const ranking = rankShops(talliesFromNodes(nodes), volumeReference(cast));
  const byEns = Object.fromEntries(ranking.map((r) => [r.ens, r]));
  assert.equal(byEns[nodes[0].ens].eligible, false);
  assert.match(byEns[nodes[0].ens].reasons.join(), /TRUNCATED/);
  assert.equal(byEns[nodes[1].ens].eligible, false);
});

test('the buyer policy declines a non-active agent, a high cancel rate, many disputes and a passed cap', () => {
  const clean = { status: 'ACTIVE', orders: 100, cancellations: 15, disputes: 5, dailyCapMicro: 6_000_000n, spendTodayMicro: 1_200_000n };
  assert.deepEqual(buyerRiskReasons(clean, 4_800_000n), []);
  assert.equal(buyerRiskReasons({ ...clean, status: 'REVOKED' }, 1n).length, 1);
  assert.equal(buyerRiskReasons({ ...clean, cancellations: 16 }, 1n).length, 1);
  assert.equal(buyerRiskReasons({ ...clean, disputes: 6 }, 1n).length, 1);
  assert.equal(buyerRiskReasons(clean, 4_800_001n).length, 1);
});
