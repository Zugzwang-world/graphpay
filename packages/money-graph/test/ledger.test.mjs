import assert from 'node:assert/strict';
import { test } from 'node:test';
import { u64 } from '@arkiv-network/sdk';
import { readAll } from '@graphpay/arkiv-graph';
import { generatePrivateKey } from 'viem/accounts';
import { encodeFunctionData } from 'viem';
import {
  ENTITIES,
  ENTITY_CONTRACT,
  boxAround,
  connectArkiv,
  createLedger,
  createQuote,
  discoverShops,
  findQuotes,
  newSim,
  nodeOf,
  recordEdge,
  writeHeartbeat,
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
  await ledger.foldRecorder([ev('facilitator:1', 'fail', 0n, 10)]);
  const tally = (await readAll(w.reader.publicClient, ENTITIES.tally, { owner: w.ledger.owner })).find((t) => t.node === nodeOf(SHOP) && t.window === 'all');
  assert.equal(tally.fails, 1n);
  assert.equal((await readAll(w.reader.publicClient, ENTITIES.edge, { owner: w.ledger.owner })).length, 0);
  assert.equal((await readAll(w.reader.publicClient, ENTITIES.edge, { owner: w.sync.owner })).length, 1);
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
