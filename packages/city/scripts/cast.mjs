// The final story's shops on Arkiv under their own names (ADR-0073, ADR-0077), from story
// syntheticCity.casts.final, all at epoch 0: their directory rows (W_DIRECTORY), their node
// rows and their shop agents' (W_LEDGER, the values the mirror writes for a cast actor), and
// the labelled synthetic history the mirror writes for the cast shops (the scenario's 90
// days at the same 5% scale, through the mirror's own history code). Nothing here pays.
//   node packages/city/scripts/cast.mjs                                    dry run: names, keys, counts
//   node packages/city/scripts/cast.mjs --execute [--store directory,nodes,history]
//   node packages/city/scripts/cast.mjs --execute --store delist-test
//       after W1's flip: the test cast's directory rows (the old labels) are delisted, so the map and
//       discovery list each shop once; their graph rows stay as history
// W_LEDGER is the running mirror's wallet: every write goes through the mirror's ledger port at
// a nonce read first, and a nonce the mirror takes meanwhile is retried, never sent twice. A
// stopped history resumes from its checkpoint. Prints names, keys, hashes and counts only.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ExpirationTime, key } from '@arkiv-network/sdk';
import { eq, or } from '@arkiv-network/sdk/query';
import { findOne, readAll } from '@graphpay_ethglobal/arkiv-graph';
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The keyless endpoint meters queries (arkiv_query) on their own window, per IP, and the running
// mirror on this Mac shares it: this script never takes the last 40% of it. The transport's and
// the writer's events are logged as names and numbers only, never a URL.
const queries = { remaining: null, limit: null, resetAt: 0 };
const arkivLog = (e) => {
  if (e.method === 'arkiv_query' && e.ratelimit) Object.assign(queries, { remaining: e.ratelimit.remaining, limit: e.ratelimit.limit, resetAt: Date.now() + e.ratelimit.reset * 1000 });
  if (e.event) log(`arkiv: ${e.event}${e.nonce !== undefined ? ` nonce ${e.nonce}` : ''}${e.kind ? ` ${e.kind}` : ''}`);
  else if (e.status && e.status !== 200) log(`arkiv: HTTP ${e.status} on ${e.method}`);
};
// The endpoint's header shows whichever window is tighter: the query window only once it is low.
async function withinQueryBudget() {
  if (queries.limit === null || queries.remaining >= queries.limit * 0.4 || Date.now() >= queries.resetAt) return;
  log(`pausing ${Math.ceil((queries.resetAt - Date.now()) / 1000)} s: ${queries.remaining} of ${queries.limit} queries left in this window`);
  await sleep(queries.resetAt - Date.now() + 2_000);
}
// The mirror heartbeats every 30 to 40 s from the same wallet; a part sent in the gap after a beat
// does not race it for a nonce (a batch of parts takes up to about 12 s, the next beat comes 30 s
// after the last). Its last beat comes from its local status endpoint (no Arkiv read).
const MIRROR_STATUS = `http://127.0.0.1:${env.MIRROR_PORT ?? 8788}/status`;
async function betweenBeats() {
  for (const start = Date.now(); Date.now() - start < 60_000; ) {
    let last = null;
    try {
      last = (await (await fetch(MIRROR_STATUS, { signal: AbortSignal.timeout(2_000) })).json()).lastBeat ?? null;
    } catch {
      return; // no mirror on this Mac: nothing to keep clear of
    }
    const age = Date.now() - last;
    if (last === null || age > 45_000 || (age >= 1_000 && age <= 16_000)) return;
    await sleep(age < 1_000 ? 1_000 - age : 1_000);
  }
}

// The mirror's own rule: a nonce another write took is retried after a pause. One more case is
// the same event seen from the writer's recovery: the transaction found at our pinned nonce
// created other entities than ours would (the mirror's heartbeat or a live payment took the
// nonce; a part lands whole or not at all, and a signed transaction only at its own nonce). And
// the keyless endpoint's transient failures (a timeout, a failed request). Every history part
// carries its stream's checkpoint, and every retry re-reads it and sends at the confirmed nonce,
// so a part that did land is skipped and at most one copy of a part can land.
const retryable = (err) =>
  err?.code === 'NONCE_TAKEN' ||
  /nonce \d+ is ahead of the confirmed|created \d+ entities for [1-9]\d* creates|took too long to respond|HTTP request failed|fetch failed|ECONNRESET|socket hang up|Too Many Requests/.test(err?.message ?? '');
async function retrying(fn, tries = 30) {
  for (let i = 1; ; i += 1) {
    try {
      return await fn();
    } catch (err) {
      if (i >= tries || !retryable(err)) throw err;
      log(`retry ${i}: ${err.code ?? err.name ?? 'write'} (${/entities for|NONCE|ahead of/.test(`${err.code} ${err.message}`) ? 'another write took the nonce' : 'the endpoint failed a request'})`);
      await sleep(3_000);
      await withinQueryBudget();
    }
  }
}

if (stores.includes('directory')) {
  const dir = await connectArkiv({ backend: 'rabdi', env, role: 'W_DIRECTORY', log: arkivLog });
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
    // W_DIRECTORY is shared with the live site: a transaction found by nonce must be this batch.
    const ours = async (createdKeys) => {
      if (creates.length === 0) return false;
      const e = createdKeys[0] ? await dir.publicClient.getEntity(createdKeys[0]) : null;
      const a = e?.$attributes ?? e?.attributes;
      return a?.type?.value === ENTITIES.shop.type && String(a?.shop_key?.value ?? '').toLowerCase() === creates[0].values.shop_key.toLowerCase();
    };
    const r = await dir.writer.send({ creates, patches }, { verifyRecovered: ours });
    creates.forEach((c, i) => {
      shops.find((s) => s.shopKey === c.values.shop_key).entityKey = r.createdKeys[i];
    });
    manifest.written.directory = { creates: creates.length, patches: patches.length, txs: r.txs.map((t) => t.hash) };
    log(`directory: ${creates.length} created, ${patches.length} patched in ${r.txs.map((t) => t.hash).join(' ')}`);
  } else log('directory: all three rows already listed');
  save();
}

if (stores.includes('delist-test')) {
  const live = story.shops.map((s) => s.label);
  const test = pinnedCast(story, 'test').shops.map((s) => s.label);
  if (test.some((l) => live.includes(l))) throw new Error('cast: the live story still uses the test labels; delist them only after the flip');
  const dir = await connectArkiv({ backend: 'rabdi', env, role: 'W_DIRECTORY', log: arkivLog });
  for (const label of test) {
    const shopKey = identityKey(nodeOf(`${label}.${root}`), 0);
    const row = await findOne(dir.publicClient, ENTITIES.shop, { owner: dir.owner, where: [eq('shop_key', key(shopKey))] });
    if (!row || row.status === 'delisted') {
      log(`delist: ${label} ${row ? 'already delisted' : 'has no directory row'}`);
      continue;
    }
    const delisted = async () => (await findOne(dir.publicClient, ENTITIES.shop, { owner: dir.owner, where: [eq('shop_key', key(shopKey))] }))?.status === 'delisted';
    const { txs } = await dir.writer.send({ patches: [{ def: ENTITIES.shop, key: row.$key, values: { status: 'delisted' } }] }, { verifyRecovered: delisted });
    manifest.written.delisted = [...(manifest.written.delisted ?? []), { label, entityKey: row.$key, tx: txs[0].hash }];
    log(`delist: ${label} ${txs[0].hash}`);
  }
  save();
}

if (stores.includes('nodes') || stores.includes('history')) {
  const arkiv = await connectArkiv({ backend: 'rabdi', env, role: 'W_LEDGER', log: arkivLog });
  // Its own stream name: this process never writes the mirror's chain stream.
  const ledger = arkivLedger({ arkiv, stream: 'city:cast-final', log });
  // Which of these actors have node rows: one query on their keys, not a read of every W_LEDGER row.
  const known = new Set();
  const look = async (list) => {
    const keys = [...new Set(list.map((a) => nodeOf(a.ens)))];
    for (let i = 0; i < keys.length; i += 24) {
      const rows = await readAll(arkiv.publicClient, ENTITIES.node, { owner: arkiv.owner, where: [or(...keys.slice(i, i + 24).map((k) => eq('node', key(k))))] });
      for (const r of rows) known.add(r.node.toLowerCase());
    }
  };
  const missing = (list) => list.filter((a) => !known.has(nodeOf(a.ens)));
  await retrying(() => look([...castNodes, ...historyBuyers()]));
  // Every attempt reads the nonce, then which rows exist, and creates only those still missing:
  // a row that landed before an error is never created twice.
  const registerMissing = (list) =>
    retrying(async () => {
      const nonce = await ledger.confirmedNonce();
      await look(list);
      const left = missing(list);
      if (left.length > 0) await ledger.registerActors(left, { nonce });
      for (const a of left) known.add(nodeOf(a.ens));
    });

  if (stores.includes('nodes')) {
    const fresh = missing(castNodes);
    if (fresh.length > 0) await registerMissing(fresh);
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
    // Resume the stream this cast wrote (the manifest names it once a run has started), and never
    // start a new one beside it: if a story change moved the parameters, a second history would
    // count the same three shops twice.
    const recorded = manifest.written.history?.stream ?? null;
    const own = streams.find((s) => {
      if (recorded) return s.stream === recorded;
      const p = parseHistoryStream(s.stream);
      return Boolean(p) && historyStream(paramsFor(p.endDay)) === s.stream;
    });
    if (recorded && !own) throw new Error(`cast: the manifest's history stream ${recorded} is not on Arkiv; refusing to start another`);
    if (own && historyStream(paramsFor(parseHistoryStream(own.stream).endDay)) !== own.stream) throw new Error(`cast: the story no longer gives the stream ${own.stream}; refusing to resume it with other parameters`);
    if (!own && streams.length > 1) throw new Error(`cast: ${streams.length} history streams on Arkiv and none is this cast's; refusing to start another`);
    const endDay = own ? parseHistoryStream(own.stream).endDay : utcDay(Math.floor(Date.now() / 1000));
    const plan = planHistory(paramsFor(endDay));
    ledger.openHistory(plan.stream);
    const buyers = historyBuyers().map((b) => ({ ...b, dataset: plan.stream }));
    if (missing(buyers).length > 0) await registerMissing(buyers);
    const actors = new Actors();
    for (const a of [...castNodes, ...buyers]) actors.register(a);
    log(`history: stream ${plan.stream}, ${plan.events.length} events${own ? ` (resuming at ${own.events})` : ''}; ${streams.length} history stream(s) on Arkiv before`);
    manifest.written.history = { ...(manifest.written.history ?? {}), stream: plan.stream, endDay, events: plan.events.length };
    save();
    before ??= Number(await arkiv.publicClient.getBalance({ address: arkiv.owner }));
    const out = await writeHistory({
      ledger,
      plan,
      actors,
      run: (fn) =>
        retrying(async () => {
          await withinQueryBudget();
          await betweenBeats();
          return fn();
        }),
      log,
    });
    const after = Number(await arkiv.publicClient.getBalance({ address: arkiv.owner }));
    const cp = await ledger.readCheckpoint(plan.stream);
    // W_LEDGER's balance change over this run: the mirror's own writes count too unless it was stopped.
    manifest.written.history = { stream: plan.stream, endDay, events: plan.events.length, written: out.written, done: out.done, checkpointEvents: cp?.events ?? null, lastRunTglm: ((before - after) / 1e18).toFixed(6) };
    log(`history: ${out.written} written, done ${out.done}, checkpoint ${cp?.events} of ${plan.events.length}, W_LEDGER spent ${manifest.written.history.lastRunTglm} tGLM in this run`);
    save();
  };
  if (stores.includes('history')) await retrying(writeCastHistory);
}

manifest.finished = new Date().toISOString();
save();
log('done');
