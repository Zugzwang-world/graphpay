// The seeding driver (planning/PROMPTS/08): size S with the test cast, size M with the final
// cast (ADR-0077).
//   node packages/city/scripts/seed.mjs --size S --end <YYYY-MM-DD> --backend sim
//       the whole run on an in-process ArkivSim: counts against a direct load, tallies
//       against the generator's truth, and the estimated live cost (no secrets needed)
//   node packages/city/scripts/seed.mjs --size S --end <YYYY-MM-DD> --backend rabdi --dry-run
//       the wallets' balances against the --backend sim estimate (nothing is sent)
//   node packages/city/scripts/seed.mjs --size S --end <YYYY-MM-DD> --backend rabdi --execute [--store directory,graph,plain]
//   node packages/city/scripts/seed.mjs --size S --end <YYYY-MM-DD> --backend rabdi --execute --store plain --resume
//       the plain store only, skipping the rows a stopped run already wrote
//   node packages/city/scripts/seed.mjs --size S --backend rabdi --wipe --execute [--store graph,plain]
//   node packages/city/scripts/seed.mjs --size M --end <YYYY-MM-DD> --backend rabdi --execute --store graph --from-batch <n> [--undo-from-nonce <k> --undo-from-block <b> [--undo-to-block <c>]]
//       the graph store from batch n (0-based) on, after undoing what a stopped run's partial batch
//       landed (this wallet's transactions from nonce k, block b on; creates only)
// Manifests go to docs/sessions/arkiv/city/. Prints addresses, hashes and numbers only.

import { mkdirSync, writeFileSync } from 'node:fs';
import { generatePrivateKey } from 'viem/accounts';
import { readAll } from '@graphpay_ethglobal/arkiv-graph';
import { story, config } from '@graphpay/config';
import { ENTITIES, connectArkiv, graph, newSim, nodeOf, seedOwner, writerAddresses } from '@graphpay/money-graph';
import { generateCity, truthOf, seedGraph, seedPlain, seedDirectory, undoSince, wipe, newManifest, ledgerEvents } from '../index.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const flag = (name) => args.includes(`--${name}`);
// A whole number option: a nonce, a block or a batch.
const whole = (name) => {
  const v = opt(name);
  if (v === null) return null;
  if (!/^\d+$/.test(v)) throw new Error(`seed: --${name} takes a whole number`);
  return BigInt(v);
};
const size = opt('size');
const backend = opt('backend', 'sim');
const end = opt('end');
const stores = (opt('store', 'directory,graph,plain') ?? '').split(',');
const log = (line) => console.log(`${new Date().toISOString().slice(11, 19)}Z ${line}`);
const json = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? String(x) : x), 2);

if (size !== 'S' && size !== 'M') throw new Error('seed: --size S or M');
// A city is seeded only with a cast pinned for its size, and M never with the test cast
// (ADR-0049, ADR-0077): the pin is what lets it be generated again as seeded.
const sizeCast = story.syntheticCity.sizes[size]?.cast;
if (!story.syntheticCity.casts?.[sizeCast]) throw new Error(`seed: size ${size} has no cast pinned in syntheticCity.casts (ADR-0077)`);
if (size === 'M' && sizeCast !== 'final') throw new Error('seed: size M is seeded only with the final cast (ADR-0049, ADR-0077)');
if (!flag('wipe') && !end) throw new Error('seed: --end YYYY-MM-DD (the UTC midnight the city ends at)');

// Generated files carry names and addresses, so they live with the session's records.
const manifestDir = new URL('../../../docs/sessions/arkiv/city/', import.meta.url);
mkdirSync(manifestDir, { recursive: true });
const save = (name, value) => writeFileSync(new URL(name, manifestDir), `${json(value)}\n`);

// Expected rows of a direct load: one edge per event, one node per (name, epoch), one
// tally per (node, epoch, window) an event moves, one link per money pair and kind.
function expectedCounts(city) {
  const nodes = new Set();
  const tallies = new Set();
  const links = new Set();
  for (const e of ledgerEvents(city)) {
    for (const x of [e.from, e.to]) nodes.add(`${x.ens}#${x.epoch}`);
    const inc = graph.incrementsOf({ ...e, value: e.amountMicro });
    if (!inc) continue;
    const day = Math.floor(e.ts / 86_400);
    for (const x of [e.from, e.to]) for (const w of ['all', `day:${day}`]) tallies.add(`${x.ens}#${x.epoch}#${w}`);
    if (['pay', 'refund', 'fail', 'renew'].includes(e.kind)) links.add(`${e.from.ens}#${e.from.epoch}#${e.to.ens}#${e.to.epoch}#${e.kind}`);
  }
  return { edge: city.events.length, node: nodes.size, tally: tallies.size, link: links.size, record: city.events.length, profile: city.actors.size, shop: city.shops.length };
}

// Live gas per simulated gas, from M7a's probe on Rabdi (docs/technical/FACTS.md, T3 rows:
// first event 1,301,681 and steady event 377,893 gas), replayed on ArkivSim.
async function liveGasRatio() {
  const sim = newSim();
  const conn = await connectArkiv({ backend: 'sim', sim, role: 'W_LEDGER', privateKey: generatePrivateKey() });
  const { createLedger } = await import('@graphpay/money-graph');
  const ledger = createLedger({ arkiv: conn, stream: 'probe', synthetic: { dataset: 'probe' }, lifetimeDays: 1 });
  await ledger.load();
  const ev = (ref, ts) => ({ ref, kind: 'pay', from: { ens: 'payer.probe.sim.graphpay.eth', epoch: 0, kind: 'probe' }, to: { ens: 'shop.probe.sim.graphpay.eth', epoch: 0, kind: 'probe' }, amountMicro: 1_000_000n, ts });
  const a = await ledger.apply(ev('p1', 1_793_908_755));
  const b = await ledger.apply(ev('p2', 1_793_908_756));
  return Math.max(1_301_681 / Number(a.txs[0].gasUsed), 377_893 / Number(b.txs[0].gasUsed));
}

const city = flag('wipe') ? null : generateCity({ story, size, end });
const owner = seedOwner(size, story);
const writers = writerAddresses();

if (city) {
  const truth = truthOf(city);
  const counts = expectedCounts(city);
  log(`city ${city.dataset}: ${city.actors.size} actors, ${city.shops.length} shops, ${city.events.length} events, ${truth.q2.payRows} pay and renew rows (${Math.ceil(truth.q2.payRows / 100)} plain pages)`);
  save(`truth-${size}.json`, { generated: { end, seed: story.syntheticCity.seed, story: story.name }, counts, truth });
}

if (backend === 'sim') {
  // No emulated quota for the dry run: ArkivSim's request counter never resets, so past 90% of
  // its default 5,000 every call would wait out a 10 s reset (size M makes far more calls).
  const sim = newSim({ rateLimit: 1_000_000_000 });
  const seedConn = await connectArkiv({ backend: 'sim', sim, role: 'W_SEED_EVENT', privateKey: generatePrivateKey() });
  const dirConn = await connectArkiv({ backend: 'sim', sim, role: 'W_DIRECTORY', privateKey: generatePrivateKey() });
  const base = { size, owner: seedConn.owner, dataset: city.dataset, backend: 'sim' };
  const m = {};
  m.directory = await seedDirectory(city, dirConn, { log, manifest: newManifest({ ...base, store: 'directory', owner: dirConn.owner }) });
  m.graph = await seedGraph(city, seedConn, { log, batchEvents: story.syntheticCity.generator.batchEvents, manifest: newManifest({ ...base, store: 'graph' }) });
  m.plain = await seedPlain(city, seedConn, { log, batchEvents: story.syntheticCity.generator.batchEvents, manifest: newManifest({ ...base, store: 'plain' }) });
  // Counts against a direct load.
  const expected = expectedCounts(city);
  const got = {};
  for (const t of ['edge', 'node', 'tally', 'link', 'record', 'profile']) got[t] = (await readAll(seedConn.publicClient, ENTITIES[t], { owner: seedConn.owner, cap: 200_000 })).length;
  got.shop = (await readAll(seedConn.publicClient, ENTITIES.shop, { owner: dirConn.owner })).length;
  const countsOk = Object.keys(expected).every((k) => expected[k] === got[k]);
  // Tallies against the truth: Q1 counts and the Q2 identity top 10.
  const truth = truthOf(city);
  const tallies = await readAll(seedConn.publicClient, ENTITIES.tally, { owner: seedConn.owner, cap: 200_000 });
  const nodes = await readAll(seedConn.publicClient, ENTITIES.node, { owner: seedConn.owner, cap: 200_000 });
  const currentEpoch = new Map();
  for (const n of nodes) currentEpoch.set(n.node, n.epoch > (currentEpoch.get(n.node) ?? -1n) ? n.epoch : currentEpoch.get(n.node));
  const top = tallies
    .filter((t) => t.window === 'all' && t.kind === 'shop' && t.epoch === currentEpoch.get(t.node))
    .sort((a, b) => (b.paid_micro > a.paid_micro ? 1 : b.paid_micro < a.paid_micro ? -1 : 0))
    .slice(0, 10)
    .map((t) => String(t.paid_micro));
  const q2ok = JSON.stringify(top) === JSON.stringify(truth.q2.identity.map((x) => x.paidMicro));
  const good = tallies.find((t) => t.node === nodeOf(truth.q1.shop) && t.window === 'all' && t.epoch === currentEpoch.get(t.node));
  const q1ok = Number(good.orders) === truth.q1.orders && Number(good.refunds) === truth.q1.refunds;
  const ratio = await liveGasRatio();
  const est = { ratio: Number(ratio.toFixed(3)) };
  for (const s of ['directory', 'graph', 'plain']) est[s] = { transactions: m[s].transactions, gasLive: Math.round(Number(m[s].gas) * ratio), tglmLive: Number(((Number(m[s].gas) * ratio) / 1e9).toFixed(4)) };
  const report = { synthetic: true, size, end, backend: 'sim', expected, got, countsOk, q1ok, q2ok, estimateLive: est };
  save(`sim-check-${size}.json`, report);
  console.log(json(report));
  if (!countsOk || !q1ok || !q2ok) process.exitCode = 1;
} else if (backend === 'rabdi') {
  const { loadSecrets } = await import('../../money-graph/scripts/lib.mjs');
  const env = loadSecrets();
  if (flag('wipe')) {
    if (!flag('execute')) throw new Error('seed: --wipe needs --execute');
    const conn = await connectArkiv({ backend: 'rabdi', env, role: story.syntheticCity.sizes[size].owner });
    const types = stores.flatMap((s) => (s === 'graph' ? ['edge', 'node', 'tally', 'link'] : s === 'plain' ? ['record', 'profile'] : []));
    const mf = await wipe(conn, types, { log, manifest: newManifest({ size, store: `wipe:${stores.join('+')}`, owner: conn.owner, dataset: null, backend }) });
    save(`wipe-${size}-${Date.now()}.json`, mf);
  } else {
    const reader = await connectArkiv({ backend: 'rabdi', env });
    const bal = async (a) => Number(await reader.publicClient.getBalance({ address: a })) / 1e18;
    const balances = { seed: await bal(owner), directory: await bal(writers.W_DIRECTORY) };
    log(`balances: seed wallet ${balances.seed.toFixed(4)} tGLM, W_DIRECTORY ${balances.directory.toFixed(4)} tGLM (owner ${owner})`);
    if (!flag('execute')) {
      log('dry run: run the same command with --backend sim for the estimate, then with --execute to seed');
    } else {
      const seedConn = await connectArkiv({ backend: 'rabdi', env, role: story.syntheticCity.sizes[size].owner });
      if (seedConn.owner !== owner) throw new Error('seed: the seed key is not the size owner');
      const base = { size, owner, dataset: city.dataset, backend: 'rabdi' };
      if (stores.includes('directory')) {
        const dirConn = await connectArkiv({ backend: 'rabdi', env, role: 'W_DIRECTORY' });
        const mf = newManifest({ ...base, store: 'directory', owner: dirConn.owner });
        try {
          save(`seed-${size}-directory.json`, await seedDirectory(city, dirConn, { log, manifest: mf }));
        } catch (error) {
          save(`seed-${size}-directory.json`, { ...mf, status: 'failed', error: error.shortMessage ?? error.message });
          throw error;
        }
      }
      const fromBatch = Number(whole('from-batch') ?? 0n);
      if (whole('undo-from-nonce') !== null) {
        if (whole('undo-from-block') === null) throw new Error('seed: --undo-from-nonce needs --undo-from-block');
        const undo = await undoSince(seedConn, null, { nonce: Number(whole('undo-from-nonce')), fromBlock: whole('undo-from-block'), toBlock: whole('undo-to-block') });
        log(`undid ${undo.deleted} creates from ${undo.landed.length} landed txs (${undo.landed.map((t) => t.hash).join(' ')}) in ${undo.txs.map((t) => t.hash).join(' ')}`);
        save(`undo-${size}-${Date.now()}.json`, { synthetic: true, size, landed: undo.landed.map((t) => ({ hash: t.hash, nonce: t.nonce, created: t.created.length, updated: t.updated.length })), txs: undo.txs.map((t) => t.hash), deleted: undo.deleted });
      }
      for (const store of ['graph', 'plain']) {
        if (!stores.includes(store)) continue;
        const mf = newManifest({ ...base, store });
        const run = store === 'graph' ? seedGraph : seedPlain;
        try {
          save(`seed-${size}-${store}${store === 'graph' && fromBatch > 0 ? `-from-${fromBatch}` : ''}.json`, await run(city, seedConn, { log, batchEvents: story.syntheticCity.generator.batchEvents, manifest: mf, resume: store === 'plain' && flag('resume'), fromBatch: store === 'graph' ? fromBatch : 0 }));
          log(`${store} done: ${mf.transactions} txs, ${mf.tglm} tGLM, ${mf.minutes} min, last ${mf.lastTx}`);
        } catch (error) {
          save(`seed-${size}-${store}${store === 'graph' && fromBatch > 0 ? `-from-${fromBatch}` : ''}.json`, { ...mf, status: 'failed', error: error.shortMessage ?? error.message });
          throw error;
        }
      }
    }
  }
} else {
  throw new Error(`seed: unknown backend ${backend}`);
}
void config;
