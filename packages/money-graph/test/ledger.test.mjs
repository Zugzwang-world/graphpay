import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ExpirationTime, u64 } from '@arkiv-network/sdk';
import { entityValues, readAll } from '@graphpay/arkiv-graph';
import { generatePrivateKey } from 'viem/accounts';
import { encodeFunctionData } from 'viem';
import {
  ENTITIES,
  ENTITY_CONTRACT,
  boxAround,
  connectArkiv,
  createGraphEngine,
  createLedger,
  createQuote,
  discoverShops,
  findQuotes,
  quoteValues,
  newSim,
  nodeOf,
  recordEdge,
  runGraphql,
  writeHeartbeat,
  writerAddresses,
  writeShop,
} from '../index.mjs';

// Test names only (sim.*): no story names in code.
const SHOP = 'alpha-sweets.sim.example.eth';
const BUYER = 'buyer.person.sim.example.eth';
const at = (s) => 1_760_000_000 + s;

async function wallets() {
  const sim = newSim();
  const conn = (role) => connectArkiv({ backend: 'sim', sim, role, privateKey: generatePrivateKey(), recoveryMs: 300, pollMs: 20 });
  return { sim, ledger: await conn('W_LEDGER'), sync: await conn('W_SYNC'), directory: await conn('W_DIRECTORY'), reader: await connectArkiv({ backend: 'sim', sim }) };
}

const ev = (ref, kind, amount, s, extra = {}) => ({
  ref,
  kind,
  from: { ens: BUYER, epoch: 0, kind: 'agent' },
  to: { ens: SHOP, epoch: 0, kind: 'shop' },
  amountMicro: amount,
  ts: at(s),
  ...extra,
});

test('a recorded flow gives exact tallies on both ends; replays and duplicates are no-ops', async () => {
  const w = await wallets();
  const ledger = createLedger({ arkiv: w.ledger, stream: 'whitechain' });
  await ledger.load();
  let pos = 0;
  const p = () => ({ block: BigInt(100 + pos++), logIndex: 0 });
  for (const e of [ev('o1', 'order', 0n, 1), ev('p1', 'pay', 4_800_000n, 2), ev('d1', 'deliver', 0n, 3), ev('r1', 'refund', 800_000n, 4), ev('f1', 'fail', 0n, 5), ev('f2', 'fail', 0n, 6, { reason: 'DUPLICATE' })]) {
    await ledger.apply({ ...e, position: p() });
  }
  // The same event again: the edge with that ref exists, nothing is written.
  const again = await ledger.apply({ ...ev('p1', 'pay', 4_800_000n, 2), position: { block: 101n, logIndex: 0 } });
  assert.deepEqual(again.skipped, ['p1']);
  // A restart: state re-read from Arkiv; replaying the whole stream changes nothing.
  const restarted = createLedger({ arkiv: w.ledger, stream: 'whitechain' });
  await restarted.load();
  const replay = await restarted.applyBatch([{ ...ev('o1', 'order', 0n, 1), position: { block: 100n, logIndex: 0 } }]);
  assert.deepEqual(replay.skipped, ['o1']);
  const tallies = await readAll(w.reader.publicClient, ENTITIES.tally, { owner: w.ledger.owner });
  const shopAll = tallies.find((t) => t.node === nodeOf(SHOP) && t.window === 'all');
  assert.equal(shopAll.orders, 1n);
  assert.equal(shopAll.paid_micro, 4_800_000n);
  assert.equal(shopAll.refunds, 1n);
  assert.equal(shopAll.refunded_micro, 800_000n);
  assert.equal(shopAll.fails, 1n, 'the DUPLICATE refusal is not counted');
  assert.equal(shopAll.delivered, 1n);
  const edges = await readAll(w.reader.publicClient, ENTITIES.edge, { owner: w.ledger.owner });
  assert.equal(edges.length, 6);
  const links = await readAll(w.reader.publicClient, ENTITIES.link, { owner: w.ledger.owner });
  assert.deepEqual(links.map((l) => l.kind).sort(), ['fail', 'pay', 'refund']);
});

test('a fixed nonce read before the anchors is refused once another transaction takes it', async () => {
  const w = await wallets();
  const ledger = createLedger({ arkiv: w.ledger, stream: 's' });
  await ledger.load();
  const nonce = await ledger.confirmedNonce();
  await ledger.apply(ev('a', 'order', 0n, 1));
  await assert.rejects(ledger.apply(ev('b', 'order', 0n, 2), { nonce }), (e) => e.code === 'NONCE_TAKEN');
});

test('recorder edges (W_SYNC) are create-only; the mirror folds them into tallies without a second edge', async () => {
  const w = await wallets();
  const r = await recordEdge(w.sync, { ref: 'facilitator:1', kind: 'fail', from: { ens: BUYER, epoch: 0 }, to: { ens: SHOP, epoch: 0 }, ts: at(10) });
  assert.match(r.entityKey, /^0x[0-9a-f]{64}$/);
  const ledger = createLedger({ arkiv: w.ledger, stream: 'recorder' });
  await ledger.load();
  await ledger.foldRecorder([{ ...ev('facilitator:1', 'fail', 0n, 10), position: { block: BigInt(at(10)), logIndex: 0 } }]);
  await assert.rejects(ledger.foldRecorder([ev('facilitator:2', 'fail', 0n, 11)]), /no position/);
  const tally = (await readAll(w.reader.publicClient, ENTITIES.tally, { owner: w.ledger.owner })).find((t) => t.node === nodeOf(SHOP) && t.window === 'all');
  assert.equal(tally.fails, 1n);
  assert.equal((await readAll(w.reader.publicClient, ENTITIES.edge, { owner: w.ledger.owner })).length, 0);
  assert.equal((await readAll(w.reader.publicClient, ENTITIES.edge, { owner: w.sync.owner })).length, 1);
});

// getEntity returns the columns under $attributes: a send that landed but was reported
// as failed is found by nonce, read back and adopted, never sent a second time.
test('an uncertain send is adopted by nonce: recorder edge, quote and unstreamed ledger land once', async () => {
  const w = await wallets();
  const uncertain = () => w.sim.injectFault({ method: 'eth_sendRawTransaction', kind: 'apply-then-fail' });

  uncertain();
  const r = await recordEdge(w.sync, { ref: 'facilitator:9', kind: 'fail', from: { ens: BUYER, epoch: 0 }, to: { ens: SHOP, epoch: 0 }, ts: at(10) });
  assert.equal(r.recovered, true);
  const syncEdges = await readAll(w.reader.publicClient, ENTITIES.edge, { owner: w.sync.owner });
  assert.deepEqual(syncEdges.map((e) => e.$key), [r.entityKey], 'one recorder edge');

  uncertain();
  const requestId = `0x${'8'.repeat(64)}`;
  const q = await createQuote(w.directory, { requestId, shopKey: `0x${'5'.repeat(64)}`, agentEns: BUYER, price: 4_800_000n, validUntil: at(600) });
  assert.equal(q.recovered, true);
  assert.deepEqual((await findQuotes(w.reader.publicClient, requestId, { owner: w.directory.owner })).map((f) => f.key), [q.entityKey], 'one quote');

  const ledger = createLedger({ arkiv: w.ledger });
  await ledger.load();
  uncertain();
  const out = await ledger.apply(ev('p9', 'pay', 4_800_000n, 20));
  assert.equal(out.txs[0].recovered, true);
  const edges = (await readAll(w.reader.publicClient, ENTITIES.edge, { owner: w.ledger.owner })).filter((e) => e.ref === 'p9');
  assert.equal(edges.length, 1, 'one ledger edge');
});

// Two instances share W_DIRECTORY's nonces: one's send is lost, and the other's quote
// for the same errand (same requestId and validUntil, another shop) lands at that nonce.
// The other instance is another process, so it sends through the SDK, outside this
// process's writer queue. The first must not adopt that quote; both land.
test('a quote for another shop found at the pinned nonce is not adopted', async () => {
  const sim = newSim();
  const privateKey = generatePrivateKey();
  const a = await connectArkiv({ backend: 'sim', sim, role: 'W_DIRECTORY', privateKey, recoveryMs: 2_000, pollMs: 20 });
  const b = await connectArkiv({ backend: 'sim', sim, role: 'W_DIRECTORY', privateKey });
  const requestId = `0x${'9'.repeat(64)}`;
  const quote = (shop) => ({ requestId, shopKey: `0x${shop.repeat(64)}`, agentEns: BUYER, price: 4_800_000n, validUntil: at(600) });

  sim.injectFault({ method: 'eth_sendRawTransaction', kind: 'fail' });
  const first = createQuote(a, quote('a'));
  while (sim.faults.length > 0) await new Promise((r) => setTimeout(r, 5));
  const other = { schema: ENTITIES.quote.schema, values: entityValues(ENTITIES.quote, quoteValues(quote('b'))), expiration: ExpirationTime.fromMinutes(15), flags: { readonly: true } };
  await b.walletClient.executeBatch({ creates: [other] }, { nonce: 0 });
  const mine = await first;

  assert.equal(mine.recovered, false, 'sent again at the next nonce, not adopted');
  const found = await findQuotes(b.publicClient, requestId, { owner: a.owner });
  assert.equal(found.length, 2);
  assert.equal(found.find((q) => q.key === mine.entityKey)?.shopKey, `0x${'a'.repeat(64)}`);
});

// A real node can carry the mirror's labelled synthetic history: its tallies say
// synthetic, so its reputation must too, in the all-time window and in a day window.
test('reputation is labelled synthetic when any tally row it reads is, even for a real node', async () => {
  const w = await wallets();
  const OTHER = 'beta-sweets.sim.example.eth';
  const now = Math.floor(Date.now() / 1000);
  const history = createLedger({ arkiv: w.ledger, stream: 'history', synthetic: { dataset: 'history' } });
  await history.load();
  await history.apply({ ...ev('h1', 'order', 0n, 0), ts: now - 3_600, position: { block: 1n, logIndex: 0 } });
  const live = createLedger({ arkiv: w.ledger, stream: 'whitechain', createNodes: true });
  await live.load();
  await live.apply({ ...ev('o1', 'order', 0n, 0), ts: now - 60, position: { block: 10n, logIndex: 0 } });
  await live.apply({ ...ev('o2', 'order', 0n, 0), to: { ens: OTHER, epoch: 0, kind: 'shop' }, ts: now - 30, position: { block: 11n, logIndex: 0 } });

  const writers = { ...writerAddresses(), W_LEDGER: w.ledger.owner, W_SYNC: w.sync.owner };
  const ask = (ens) => runGraphql({ engine: createGraphEngine(w.reader), dataset: 'live', writers, query: `{ node(ens: "${ens}") { synthetic all: reputation(window: ALL) { orders synthetic } d30: reputation(window: D30) { synthetic } } }` });
  const mixed = (await ask(SHOP)).data.node;
  assert.equal(mixed.synthetic, false, 'the node row is real');
  assert.equal(mixed.all.orders, '2');
  assert.equal(mixed.all.synthetic, true);
  assert.equal(mixed.d30.synthetic, true);
  const real = (await ask(OTHER)).data.node;
  assert.equal(real.all.synthetic, false);
  assert.equal(real.d30.synthetic, false);
});

test('a receipt cannot be edited: a simulated patch of an edge reverts, a tally patch would pass', async () => {
  const w = await wallets();
  const ledger = createLedger({ arkiv: w.ledger, stream: 's' });
  await ledger.load();
  await ledger.apply(ev('p1', 'pay', 1_000_000n, 1));
  const [edge] = await readAll(w.reader.publicClient, ENTITIES.edge, { owner: w.ledger.owner });
  const [tally] = await readAll(w.reader.publicClient, ENTITIES.tally, { owner: w.ledger.owner });
  assert.equal(edge.$creationFlags.readonly, true);
  const patchCall = (entityKey) => w.sim.dispatch('eth_call', [{ from: w.ledger.owner, to: ENTITY_CONTRACT, data: patchData(entityKey) }]);
  await assert.rejects(patchCall(edge.$key), /ReadOnlyEntity|reverted/);
  await patchCall(tally.$key); // tallies stay mutable
});

// execute([(2, abi.encode(key, [(name, u64 type, value)]))]) built by hand for the simulation.
function patchData(entityKey) {
  const name = `0x${Buffer.from('amount_micro').toString('hex').padEnd(64, '0')}`;
  const value = `0x${(5n).toString(16).padStart(64, '0')}`;
  const op = encodeFunctionData({ abi: [{ type: 'function', name: 'x', inputs: [{ type: 'tuple', components: [{ type: 'bytes32' }, { type: 'tuple[]', components: [{ type: 'bytes32' }, { type: 'uint8' }, { type: 'bytes' }] }] }] }], functionName: 'x', args: [[entityKey, [[name, 3, value]]]] });
  return encodeFunctionData({
    abi: [{ type: 'function', name: 'execute', inputs: [{ type: 'tuple[]', components: [{ type: 'uint8' }, { type: 'bytes' }] }], outputs: [{ type: 'bytes32[]' }] }],
    functionName: 'execute',
    args: [[[2, `0x${op.slice(10)}`]]],
  });
}

test('discovery finds only W_DIRECTORY shops inside the box; a spoofed row and a side box find nothing', async () => {
  const w = await wallets();
  const centre = { lat: 19.07, lng: 72.88 };
  const near = { lat: 19.075, lng: 72.885 };
  await writeShop(w.directory, { shopEns: SHOP, category: 'sweets', lat: Math.round(near.lat * 1e6), lng: Math.round(near.lng * 1e6), name: 'Alpha Sweets' });
  await writeShop(w.directory, { shopEns: 'beta.sim.example.eth', category: 'sweets', lat: Math.round(near.lat * 1e6), lng: Math.round(near.lng * 1e6), synthetic: true, dataset: 'S' });
  // The same attributes from another wallet: never returned.
  const spoofer = await connectArkiv({ backend: 'sim', sim: w.sim, role: 'W_DIRECTORY', privateKey: generatePrivateKey() });
  await writeShop(spoofer, { shopEns: 'spoof.sim.example.eth', category: 'sweets', lat: Math.round(near.lat * 1e6), lng: Math.round(near.lng * 1e6) });
  const box = boxAround(centre, 3);
  const real = await discoverShops(w.reader.publicClient, { category: 'sweets', box, owner: w.directory.owner });
  assert.deepEqual(real.shops.map((s) => s.ens), [SHOP]);
  assert.equal(real.calls, 1);
  assert.match(real.queries[0], /lat BETWEEN i32\(/);
  assert.match(real.queries[0], /lng BETWEEN i32\(/);
  assert.match(real.queries[0], /\$owner = addr\(/);
  const all = await discoverShops(w.reader.publicClient, { category: 'sweets', box, synthetic: true, owner: w.directory.owner });
  assert.equal(all.shops.length, 2);
  const side = boxAround({ lat: 19.2, lng: 72.88 }, 3);
  assert.equal((await discoverShops(w.reader.publicClient, { category: 'sweets', box: side, synthetic: true, owner: w.directory.owner })).shops.length, 0);
  // Query-before-create: writing the same shop again patches it.
  const again = await writeShop(w.directory, { shopEns: SHOP, category: 'sweets', lat: Math.round(near.lat * 1e6), lng: Math.round(near.lng * 1e6), status: 'paused' });
  assert.equal(again.created, false);
  assert.equal((await discoverShops(w.reader.publicClient, { category: 'sweets', box, owner: w.directory.owner })).shops.length, 0, 'a paused shop is not listed');
});

test('a quote is readonly, found by requestId from W_DIRECTORY only, and gone 15 minutes later', async () => {
  const w = await wallets();
  const requestId = `0x${'7'.repeat(64)}`;
  const shopKey = `0x${'5'.repeat(64)}`;
  const q = await createQuote(w.directory, { requestId, shopKey, agentEns: BUYER, price: 4_800_000n, validUntil: at(600) });
  const found = await findQuotes(w.reader.publicClient, requestId, { owner: w.directory.owner });
  assert.equal(found.length, 1);
  assert.equal(found[0].key, q.entityKey);
  assert.equal(found[0].price, 4_800_000n);
  assert.equal((await findQuotes(w.reader.publicClient, requestId, { owner: w.sync.owner })).length, 0);
  w.sim.advanceSeconds(16 * 60);
  assert.equal((await findQuotes(w.reader.publicClient, requestId, { owner: w.directory.owner })).length, 0);
});

test('the heartbeat row is created, then patched and extended', async () => {
  const w = await wallets();
  const values = { instance: 'mac-1', state: 'running', cursorBlock: 10, cursorLog: 0, headBlock: 12, lagBlocks: 2, updatedTs: at(0) };
  const key = await writeHeartbeat(w.ledger, values);
  await writeHeartbeat(w.ledger, { ...values, cursorBlock: 11, lagBlocks: 1 }, { key, extend: true });
  const [row] = await readAll(w.reader.publicClient, ENTITIES.heartbeat, { owner: w.ledger.owner });
  assert.equal(row.cursor_block, 11n);
  assert.equal(row.$key, key);
});

test('a standing change patches the node row with the checkpoint', async () => {
  const w = await wallets();
  const ledger = createLedger({ arkiv: w.ledger, stream: 'policy', createNodes: true });
  await ledger.load();
  await ledger.applyBatch([ev('o1', 'order', 0n, 1)]);
  await ledger.writeStanding({ ref: 'policy:1', ens: BUYER, epoch: 0, status: 'paused', capMicro: 1_000_000n, ts: at(2) });
  const node = (await readAll(w.reader.publicClient, ENTITIES.node, { owner: w.ledger.owner })).find((n) => n.node === nodeOf(BUYER));
  assert.equal(node.status, 'paused');
  assert.equal(node.cap_micro, 1_000_000n);
  assert.equal(typeof u64, 'function');
});
