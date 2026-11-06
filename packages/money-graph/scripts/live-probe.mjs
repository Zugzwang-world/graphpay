// M7a's live probe on Arkiv Rabdi (planning/PROMPTS/07a step 6; M7 amendment §4, §6):
//   1. W_LEDGER writes two labelled synthetic probe events (1-day life, readonly edges,
//      node kind "probe", stream "probe"): the first creates its rows, the second is the
//      steady state, whose gas compares with the lab's 310,527 (333,320 with the link).
//   2. A simulated patch of the second edge from W_LEDGER must revert (readonly) and a
//      simulated patch of a tally must pass (acceptance D9). Nothing is sent for these.
//   3. W_DIRECTORY writes one labelled probe shop row (1-day life) at the persona's
//      configured point; a box around it finds it, a box beside it does not.
//   pnpm -s --filter @graphpay/money-graph probe
// Prints public addresses, hashes, keys and gas only.

import { connectArkiv, createLedger, discoverShops, boxAround, ENTITIES, ENTITY_CONTRACT, LIFETIME, RABDI, writeShop } from '../index.mjs';
import { readAll } from '@graphpay_ethglobal/arkiv-graph';
import { story } from '@graphpay/config';
import { loadSecrets, simulatePatch } from './lib.mjs';

const env = loadSecrets();
const out = {};
const tx = (h) => `${RABDI.explorer}/tx/${h}`;

// 1. Two probe events from W_LEDGER.
const ledgerConn = await connectArkiv({ backend: 'rabdi', env, role: 'W_LEDGER' });
out.rpc = ledgerConn.label;
const ledger = createLedger({ arkiv: ledgerConn, stream: 'probe', synthetic: { dataset: 'probe' }, lifetimeDays: LIFETIME.probeDays });
await ledger.load();
const now = Math.floor(Date.now() / 1000);
const probe = (ref, ts) => ({
  ref,
  kind: 'pay',
  from: { ens: 'payer.probe.sim.graphpay.eth', epoch: 0, kind: 'probe' },
  to: { ens: 'shop.probe.sim.graphpay.eth', epoch: 0, kind: 'probe' },
  amountMicro: 1_000_000n,
  ts,
});
const first = await ledger.apply(probe(`probe:m7a:${now}:1`, now));
const second = await ledger.apply(probe(`probe:m7a:${now}:2`, now + 1));
const report = (r) => ({ tx: r.txs[0]?.hash, link: r.txs[0] ? tx(r.txs[0].hash) : null, block: String(r.txs[0]?.blockNumber), gasUsed: String(r.txs[0]?.gasUsed), creates: r.txs[0]?.creates, patches: r.txs[0]?.patches });
out.firstEvent = report(first);
out.steadyEvent = report(second);
out.steadyGasAgainstLab = { lab: 310_527, labWithLink: 333_320, event: Number(second.txs[0]?.gasUsed ?? 0) };
const edgeKey = second.edgeKeys[`probe:m7a:${now}:2`];
out.edgeKey = edgeKey;

// 2. Readonly receipts (D9): simulations only.
const [edgeRow] = (await readAll(ledgerConn.publicClient, ENTITIES.edge, { owner: ledgerConn.owner })).filter((r) => r.$key === edgeKey);
out.edgeFlags = edgeRow?.$creationFlags;
out.edgePatchSimulation = await simulatePatch(ledgerConn.publicClient, { entityContract: ENTITY_CONTRACT, from: ledgerConn.owner, entityKey: edgeKey, column: 'amount_micro', value: 5n });
const [tally] = await readAll(ledgerConn.publicClient, ENTITIES.tally, { owner: ledgerConn.owner });
out.tallyPatchSimulation = await simulatePatch(ledgerConn.publicClient, { entityContract: ENTITY_CONTRACT, from: ledgerConn.owner, entityKey: tally.$key, column: 'orders', value: tally.orders });

// 3. One probe shop row from W_DIRECTORY; the box query in and beside it.
const dir = await connectArkiv({ backend: 'rabdi', env, role: 'W_DIRECTORY' });
const point = story.locations.persona;
const lat = Math.round(point.lat * 1e6);
const lng = Math.round(point.lng * 1e6);
const shop = await writeShop(dir, { shopEns: `shop-${now}.probe.sim.graphpay.eth`, category: 'probe', lat, lng, synthetic: true, dataset: 'probe', name: 'probe row (synthetic)' }, { lifetimeDays: LIFETIME.probeDays });
out.shop = { tx: shop.txHash, link: tx(shop.txHash), key: shop.entityKey };
const inside = await discoverShops(dir.publicClient, { category: 'probe', box: boxAround(point, 1), synthetic: true, owner: dir.owner });
const beside = await discoverShops(dir.publicClient, { category: 'probe', box: boxAround({ lat: point.lat + 0.05, lng: point.lng }, 1), synthetic: true, owner: dir.owner });
out.boxInside = { found: inside.shops.map((s) => s.ens), calls: inside.calls, query: inside.queries[0] };
out.boxBeside = { found: beside.shops.length, calls: beside.calls };
out.calls = { ledger: ledgerConn.stats.calls, directory: dir.stats.calls, status: { ...ledgerConn.stats.status }, lowestRemaining: Math.min(ledgerConn.stats.lowestRemaining ?? 5000, dir.stats.lowestRemaining ?? 5000) };
console.log(JSON.stringify(out, (_, v) => (typeof v === 'bigint' ? String(v) : v), 2));
