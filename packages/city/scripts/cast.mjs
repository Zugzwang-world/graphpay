// The final story's shops on Arkiv under their own names (ADR-0073, ADR-0077), from story
// syntheticCity.casts.final, all at epoch 0: their directory rows (W_DIRECTORY), their node
// rows and their shop agents' (W_LEDGER, the values the mirror writes for a cast actor), and
// the labelled synthetic history the mirror writes for the cast shops (the scenario's 90
// days at the same 5% scale, through the mirror's own history code). Nothing here pays.
//   node packages/city/scripts/cast.mjs                                    dry run: names, keys, counts
//   node packages/city/scripts/cast.mjs --execute [--store directory,nodes,history]
// W_LEDGER is the running mirror's wallet: every write goes through the mirror's ledger port at
// a nonce read first, and a nonce the mirror takes meanwhile is retried, never sent twice. A
// stopped history resumes from its checkpoint. Prints names, keys, hashes and counts only.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ExpirationTime, key } from '@arkiv-network/sdk';
import { eq } from '@arkiv-network/sdk/query';
import { findOne } from '@graphpay_ethglobal/arkiv-graph';
import { castEntries, config, story } from '@graphpay/config';
import { ENTITIES, LIFETIME, connectArkiv, identityKey, microDegrees, nodeOf, shopValues } from '@graphpay/money-graph';
import { pinnedCast } from '../index.mjs';
// The mirror's history and ledger port, by path: the city package does not depend on the mirror.
import { Actors, castActors, historyBuyers, historyCounts, historyParams, historyStream, parseHistoryStream, planHistory, utcDay, writeHistory } from '../../mirror/index.mjs';
import { arkivLedger } from '../../mirror/src/arkiv.mjs';

const args = process.argv.slice(2);
const execute = args.includes('--execute');
const stores = (args.includes('--store') ? args[args.indexOf('--store') + 1] : 'directory,nodes,history').split(',');
// The scale of the test cast's history (the mirror's E2E_HISTORY_SCALE default).
const SCALE = 0.05;
const root = config.root.ens;
const log = (line) => console.log(`${new Date().toISOString().slice(11, 19)}Z ${line}`);
const json = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? String(x) : x), 2);

const cast = pinnedCast(story, 'final');
const city = cast.city.name.toLowerCase();
const shops = cast.shops.map((s) => {
  const ens = `${s.label}.${root}`;
  return { role: s.storyRole, ens, shopKey: identityKey(nodeOf(ens), 0), category: s.category, area: s.area, lat: microDegrees(s.location.lat), lng: microDegrees(s.location.lng), name: s.displayName };
});
// The cast's shops and shop agents as the mirror registers them (actors.mjs), epoch 0.
const shopNames = new Set(castEntries(cast, root).filter((e) => e.kind === 'shop' || e.kind === 'shop-agent').map((e) => e.ensName));
const castNodes = castActors({ cast, root }).filter((a) => shopNames.has(a.ens));
const paramsFor = (endDay) => historyParams({ cast, source: story, scale: SCALE, endDay });

// One manifest across runs: a later run keeps what an earlier one wrote.
const manifestFile = new URL('../../../docs/sessions/arkiv/city/cast-final.json', import.meta.url);
const earlier = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {};
const manifest = { synthetic: true, cast: 'final', category: cast.shops[0].category, scale: SCALE, shops, nodes: castNodes.map((a) => a.ens), written: earlier.written ?? {}, started: earlier.started ?? new Date().toISOString() };
for (const s of shops) s.entityKey = earlier.shops?.find((e) => e.shopKey === s.shopKey)?.entityKey;
const save = () => writeFileSync(manifestFile, `${json(manifest)}\n`);

for (const s of shops) log(`${s.role}: ${s.ens} shop_key ${s.shopKey} ${s.category} ${s.area} (${s.lat}, ${s.lng})`);
for (const s of cast.shops) {
  const c = historyCounts(s, SCALE);
  log(`history ${s.label}: ${c.orders} orders, ${c.refunds} refunds, ${c.late} late (of ${c.full.orders}, ${c.full.refunds}, ${c.full.late})`);
}
log(`node rows: ${castNodes.length} (${castNodes.filter((a) => a.kind === 'shop').length} shops and their agents)`);
if (!execute) {
  log(`dry run: history stream today would be ${historyStream(paramsFor(utcDay(Math.floor(Date.now() / 1000))))}; nothing sent`);
  process.exit(0);
}

const { loadSecrets } = await import('../../money-graph/scripts/lib.mjs');
const env = loadSecrets();

// The mirror's own rule: a nonce another write took is retried after a pause. Two more cases
// are the same event seen from the writer's recovery: the transaction found at our pinned nonce
// created no entity where ours creates some (the mirror's heartbeat took the nonce; a signed
// transaction lands only at its own nonce, so ours never will), and a read that timed out.
// Every retry re-reads the checkpoint and the rows, so nothing is written twice.
const retryable = (err) =>
  err?.code === 'NONCE_TAKEN' ||
  /nonce \d+ is ahead of the confirmed|created 0 entities for [1-9]\d* creates|took too long to respond/.test(err?.message ?? '');
async function retrying(fn, tries = 30) {
  for (let i = 1; ; i += 1) {
    try {
      return await fn();
    } catch (err) {
      if (i >= tries || !retryable(err)) throw err;
      log(`retry ${i}: ${err.code ?? err.name ?? 'write'} (${/took too long/.test(err.message ?? '') ? 'a read timed out' : 'another write took the nonce'})`);
      await new Promise((r) => setTimeout(r, 3_000));
    }
  }
}

if (stores.includes('directory')) {
  const dir = await connectArkiv({ backend: 'rabdi', env, role: 'W_DIRECTORY' });
  const creates = [];
  const patches = [];
  for (const s of shops) {
    const values = shopValues({ shopEns: s.ens, epoch: 0, category: s.category, area: s.area, city, lat: s.lat, lng: s.lng, status: 'active', synthetic: false, name: s.name });
    const row = await findOne(dir.publicClient, ENTITIES.shop, { owner: dir.owner, where: [eq('shop_key', key(s.shopKey))] });
    if (!row) creates.push({ def: ENTITIES.shop, values, expiration: ExpirationTime.fromDays(LIFETIME.shopDays) });
    else {
      const { shop_key: _k, ...set } = values;
      if (row.category !== set.category || row.lat !== set.lat || row.lng !== set.lng || row.area !== set.area || row.status !== 'active') patches.push({ def: ENTITIES.shop, key: row.$key, values: set });
      s.entityKey = row.$key;
    }
  }
  if (creates.length + patches.length > 0) {
    const r = await dir.writer.send({ creates, patches });
    creates.forEach((c, i) => {
      shops.find((s) => s.shopKey === c.values.shop_key).entityKey = r.createdKeys[i];
    });
    manifest.written.directory = { creates: creates.length, patches: patches.length, txs: r.txs.map((t) => t.hash) };
    log(`directory: ${creates.length} created, ${patches.length} patched in ${r.txs.map((t) => t.hash).join(' ')}`);
  } else log('directory: all three rows already listed');
  save();
}

if (stores.includes('nodes') || stores.includes('history')) {
  const arkiv = await connectArkiv({ backend: 'rabdi', env, role: 'W_LEDGER' });
  // Its own stream name: this process never writes the mirror's chain stream.
  const ledger = arkivLedger({ arkiv, stream: 'city:cast-final', log });
  const known = new Map((await ledger.readActors()).map((a) => [nodeOf(a.ens), a]));
  const missing = (list) => list.filter((a) => !known.has(nodeOf(a.ens)));

  if (stores.includes('nodes')) {
    const fresh = missing(castNodes);
    if (fresh.length > 0) {
      await retrying(async () => ledger.registerActors(missing(fresh), { nonce: await ledger.confirmedNonce() }));
      for (const a of fresh) known.set(nodeOf(a.ens), a);
    }
    manifest.written.nodes = { created: fresh.map((a) => a.ens) };
    log(`nodes: ${fresh.length} created, ${castNodes.length - fresh.length} already on Arkiv`);
    save();
  }

  // The whole step again on a retryable error: it resumes from the stream's checkpoint.
  let before = null;
  const writeCastHistory = async () => {
    if (missing(castNodes).length > 0) throw new Error('cast: write the node rows first (--store nodes)');
    // Resume this cast's own stream if one is on Arkiv; otherwise a new one ending today.
    const streams = await ledger.findStreams('history:');
    const own = streams.find((s) => {
      const p = parseHistoryStream(s.stream);
      return p && historyStream(paramsFor(p.endDay)) === s.stream;
    });
    const endDay = own ? parseHistoryStream(own.stream).endDay : utcDay(Math.floor(Date.now() / 1000));
    const plan = planHistory(paramsFor(endDay));
    ledger.openHistory(plan.stream);
    const buyers = historyBuyers().map((b) => ({ ...b, dataset: plan.stream }));
    if (missing(buyers).length > 0) await retrying(async () => ledger.registerActors(missing(buyers), { nonce: await ledger.confirmedNonce() }));
    const actors = new Actors();
    for (const a of [...castNodes, ...buyers]) actors.register(a);
    log(`history: stream ${plan.stream}, ${plan.events.length} events${own ? ` (resuming at ${own.events})` : ''}; ${streams.length} history stream(s) on Arkiv before`);
    before ??= Number(await arkiv.publicClient.getBalance({ address: arkiv.owner }));
    const out = await writeHistory({ ledger, plan, actors, run: (fn) => retrying(fn), log });
    const after = Number(await arkiv.publicClient.getBalance({ address: arkiv.owner }));
    const cp = await ledger.readCheckpoint(plan.stream);
    manifest.written.history = { stream: plan.stream, endDay, events: plan.events.length, written: out.written, done: out.done, checkpointEvents: cp?.events ?? null, tglm: ((before - after) / 1e18).toFixed(6) };
    log(`history: ${out.written} written, done ${out.done}, checkpoint ${cp?.events} of ${plan.events.length}, ${manifest.written.history.tglm} tGLM`);
    save();
  };
  if (stores.includes('history')) await retrying(writeCastHistory);
}

manifest.finished = new Date().toISOString();
save();
log('done');
