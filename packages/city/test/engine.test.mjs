// M7b on ArkivSim: the seeded S city read back through GraphQL and MCP equals the truth.
import assert from 'node:assert/strict';
import { test, before } from 'node:test';
import { generatePrivateKey } from 'viem/accounts';
import { story } from '@graphpay/config';
import { compileFilter } from '@graphpay/arkiv-graph';
import { ENTITIES, connectArkiv, createGraphEngine, handleMcpRequest, newSim, runGraphql, writerAddresses } from '@graphpay/money-graph';
import { generateCity, seedDirectory, seedGraph, seedPlain, truthOf, newManifest } from '../index.mjs';

let engine;
let city;
let truth;
let writers;
let reader;

before(async () => {
  const sim = newSim();
  const seed = await connectArkiv({ backend: 'sim', sim, role: 'W_SEED_EVENT', privateKey: generatePrivateKey() });
  const dir = await connectArkiv({ backend: 'sim', sim, role: 'W_DIRECTORY', privateKey: generatePrivateKey() });
  city = generateCity({ story, size: 'S', end: '2026-11-05' });
  truth = truthOf(city);
  const m = (store) => newManifest({ size: 'S', store, owner: seed.owner, dataset: city.dataset, backend: 'sim' });
  await seedDirectory(city, dir, { manifest: m('directory') });
  await seedGraph(city, seed, { manifest: m('graph') });
  await seedPlain(city, seed, { manifest: m('plain') });
  // Point the dataset owners at the sim's wallets.
  const real = writerAddresses();
  writers = { ...real, W_SEED_EVENT: seed.owner, W_DIRECTORY: dir.owner };
  reader = await connectArkiv({ backend: 'sim', sim });
  engine = createGraphEngine(reader);
});

const q = (query, extra = {}) => runGraphql({ engine, query, dataset: 'S', writers, ...extra });

test('Q2: top 10 shops by sales in 2 calls, equal to the identity truth; the same work gives the same explain id', async () => {
  const doc = '{ top(kind: "shop", by: "paid_micro", limit: 10) { node { ens epoch } value } }';
  const a = await q(doc);
  assert.equal(a.errors, undefined);
  assert.deepEqual(a.data.top.map((r) => r.value), truth.q2.identity.map((r) => r.paidMicro));
  assert.equal(a.extensions.arkiv.calls, 2);
  for (const text of a.extensions.arkiv.queries) assert.match(text, /\$owner = addr\(/);
  const b = await q(doc);
  assert.equal(b.extensions.arkiv.explainId, a.extensions.arkiv.explainId);
  assert.ok(engine.explainStore.get(a.extensions.arkiv.explainId));
});

test('Q1: the good shop all-time, verified by count() of the same epoch', async () => {
  const r = await q(`{ node(ens: "${truth.q1.shop}") { reputation(window: ALL, verify: true) { orders refunds source refundRate } } }`);
  assert.equal(r.errors, undefined);
  assert.equal(Number(r.data.node.reputation.orders), truth.q1.orders);
  assert.equal(Number(r.data.node.reputation.refunds), truth.q1.refunds);
  assert.equal(r.data.node.reputation.source, 'RAW_VERIFIED');
});

test('reputation for three shops costs 2 calls', async () => {
  const shops = city.shops.slice(0, 3).map((s) => s.ens);
  const r = await q(`{ ${shops.map((s, i) => `s${i}: node(ens: "${s}") { reputation(window: ALL) { orders } }`).join(' ')} }`);
  assert.equal(r.errors, undefined);
  assert.equal(r.extensions.arkiv.calls, 2);
});

test('a re-registered name starts empty in its new epoch', async () => {
  const r = await q(`{ node(ens: "${city.reShop}") { epoch reputation(window: ALL) { orders } } }`);
  assert.equal(r.data.node.epoch, story.syntheticCity.reRegisteredShop.epoch);
  const after = city.events.filter((e) => e.to.ens === city.reShop && e.ts >= city.reRegisteredAt && (e.kind === 'order' || e.kind === 'subscribe')).length;
  assert.equal(Number(r.data.node.reputation.orders), after);
});

test('Q3 and Q5: the persona agents\' spend this week, and a payment path within 3 hops', async () => {
  const since = city.lastDay - 6;
  const agents = Object.values(city.personaAgents);
  const r = await q(`{ ${agents.map((a, i) => `a${i}: node(ens: "${a}") { out(kind: "pay", sinceDay: ${since}) { to { ens } amountMicro } }`).join(' ')} }`);
  const spend = {};
  for (const a of Object.values(r.data)) for (const e of a.out) spend[e.to.ens] = String(BigInt(spend[e.to.ens] ?? 0) + BigInt(e.amountMicro));
  assert.deepEqual(Object.entries(spend).sort(), Object.entries(truth.q3.spendByShop).sort());
  const p = await q(`{ path(from: "${truth.q5.from}", to: "${truth.q5.to}", maxDepth: 3, kinds: ["pay"]) { found hops } }`);
  assert.equal(p.data.path.found, truth.q5.hops !== null);
  if (truth.q5.hops !== null) assert.equal(p.data.path.hops, truth.q5.hops);
});

test('TRUNCATED, not TALLY, when the row cap bites', async () => {
  const small = createGraphEngine(reader, { rowCap: 20 });
  const r = await runGraphql({ engine: small, query: `{ node(ens: "${truth.q1.shop}") { reputation(window: D90) { source } } }`, dataset: 'S', writers });
  assert.equal(r.data.node.reputation.source, 'TRUNCATED');
  assert.equal(r.extensions.arkiv.truncated, true);
});

test('limits: more than 8 top-level fields, depth through fragments, mutations', async () => {
  const many = Array.from({ length: 9 }, (_, i) => `t${i}: today`).join(' ');
  assert.match((await q(`{ ${many} }`)).errors[0].message, /top-level/);
  const deep = 'fragment F on Node { owner { owner { owner { owner { owner { owner { owner { ens } } } } } } } } { node(ens: "a.eth") { ...F } }';
  assert.match((await q(deep)).errors[0].message, /depth/);
  assert.ok((await q('mutation { x }')).errors);
});

test('MCP: tools/list is exactly schema, ask, graphql, explain; ask answers with an explain line', async () => {
  const call = async (body) => {
    const res = await handleMcpRequest(new Request('http://localhost/api/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), { engine, dataset: 'S' });
    return res.json();
  };
  await call({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
  const list = await call({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  assert.deepEqual(list.result.tools.map((t) => t.name).sort(), ['ask', 'explain', 'graphql', 'schema']);
  const bad = await call({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'ask', arguments: { intent: 'shop_reputation', ens: [''] } } });
  assert.equal(bad.result.isError, true);
  const tooMany = await call({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'graphql', arguments: { query: `{ ${Array.from({ length: 7 }, (_, i) => `t${i}: today`).join(' ')} }` } } });
  assert.equal(tooMany.result.isError, true);
});

test('the filter compiler rejects what it must', () => {
  assert.throws(() => compileFilter(ENTITIES.edge, { nope: { eq: 1 } }), /unknown field/);
  assert.throws(() => compileFilter(ENTITIES.edge, { amount_micro: { eq: 1 } }), /stored only/);
  assert.throws(() => compileFilter(ENTITIES.edge, { kind: { gt: 'a' } }), /ranges/);
  assert.throws(() => compileFilter(ENTITIES.edge, { day: { eq: -1 } }), /u64/);
  assert.throws(() => compileFilter(ENTITIES.edge, { from_node: { eq: '0x12' } }), /32-byte/);
  assert.throws(() => compileFilter(ENTITIES.edge, { ref: { exists: false } }), /exists/);
  assert.equal(compileFilter(ENTITIES.edge, { kind: { in: [] } }), null);
});

test('a nested document stops at the call budget and is marked truncated', async () => {
  const r = await q('{ edges(kind: "pay", limit: 50) { from { out(limit: 50) { to { in(limit: 50) { from { ens } } } } } } }', { callBudget: 10 });
  assert.ok(r.extensions.arkiv.calls <= 10, JSON.stringify({ calls: r.extensions.arkiv.calls, errors: r.errors?.slice(0, 2) }));
  assert.equal(r.extensions.arkiv.truncated, true, JSON.stringify({ calls: r.extensions.arkiv.calls, errors: r.errors?.slice(0, 2), warnings: r.extensions.arkiv.warnings }));
  assert.equal(r.extensions.arkiv.truncated, true);
});

test('a chain of fragments that spread each other twice is checked in linear time', async () => {
  const n = 30;
  const frags = Array.from({ length: n }, (_, i) => (i === n - 1 ? `fragment F${i} on Node { ens }` : `fragment F${i} on Node { ...F${i + 1} ...F${i + 1} }`)).join(' ');
  const t0 = Date.now();
  await q(`{ node(ens: "a.eth") { ...F0 } } ${frags}`);
  assert.ok(Date.now() - t0 < 2000);
});
