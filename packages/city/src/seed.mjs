// Seeding a generated city into Arkiv (planning/SPEC/ARKIV_GRAPH.md §8): the graph store
// (standard model, through the same ledger and tally planner as the mirror) and the plain
// store (one record per event, one profile per actor) under the size's seed wallet, and
// the shop directory under W_DIRECTORY. 25 events per logical batch, split by bytes. A
// store an owner already holds is refused; a failed run is wiped, then seeded again.

import { ENTITY_EVENTS_ABI, ExpirationTime } from '@arkiv-network/sdk';
import { decodeEventLog } from 'viem';
import { countRows, readAll } from '@graphpay_ethglobal/arkiv-graph';
import { ENTITIES, LIFETIME, createLedger, microDegrees, nodeOf, shopValues } from '@graphpay/money-graph';
import { key } from '@arkiv-network/sdk';
import { eq } from '@arkiv-network/sdk/query';

const nodeColumns = (a, city) => ({
  ens: a.ens,
  verified: a.verified,
  owner_node: a.owner ? nodeOf(a.owner) : undefined,
  category: a.category ?? undefined,
  city: city.actors.get(a.ens)?.city ?? undefined,
  status: 'active',
});

// The generator's events as ledger events, each end carrying its node row's columns.
export function ledgerEvents(city) {
  return city.events.map((e) => {
    const end = (x) => ({ ...x, verified: city.actors.get(x.ens).verified, columns: nodeColumns(city.actors.get(x.ens), city) });
    return { ...e, from: end(e.from), to: end(e.to) };
  });
}

export function plainRecords(city) {
  return city.events.map((e) => ({
    from_name: e.from.ens,
    to_name: e.to.ens,
    kind: e.kind,
    amount_micro: e.amountMicro,
    day: BigInt(Math.floor(e.ts / 86_400)),
    ts: BigInt(e.ts),
    ref: e.ref,
    synthetic: true,
    dataset: city.dataset,
  }));
}

export function plainProfiles(city) {
  return [...city.actors.values()].map((a) => ({ name: a.ens, kind: a.kind, owner_name: a.owner, synthetic: true, dataset: city.dataset }));
}

// Directory rows: the cast's shops as real listings, the generated ones labelled synthetic.
export function directoryRows(city) {
  return city.shops.map((s) =>
    shopValues({
      shopEns: s.ens,
      epoch: s.ens === city.reShop ? Math.max(...city.events.filter((e) => e.to.ens === s.ens).map((e) => e.to.epoch)) : 0,
      category: s.category,
      area: s.area ?? undefined,
      city: s.city,
      lat: microDegrees(s.lat),
      lng: microDegrees(s.lng),
      synthetic: !s.cast,
      dataset: s.cast ? undefined : city.dataset,
      name: s.displayName,
    }),
  );
}

function chunks(list, n) {
  const out = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

export function newManifest({ size, store, owner, dataset, backend }) {
  return { synthetic: true, size, store, owner, dataset, backend, transactions: 0, creates: 0, patches: 0, deletes: 0, gas: '0', tglm: '0', firstTx: null, lastTx: null, started: new Date().toISOString(), finished: null, minutes: null, httpStatus: {}, lowestRateLimitRemaining: null, status: 'running' };
}

function account(manifest, txs, conn) {
  let gas = BigInt(manifest.gas);
  let wei = BigInt(Math.round(Number(manifest.tglm) * 1e18));
  for (const t of txs) {
    manifest.transactions += 1;
    manifest.creates += t.creates;
    manifest.patches += t.patches;
    gas += t.gasUsed;
    wei += t.gasUsed * (t.effectiveGasPrice ?? 0n);
    manifest.firstTx ??= t.hash;
    manifest.lastTx = t.hash;
  }
  manifest.gas = String(gas);
  manifest.tglm = (Number(wei) / 1e18).toFixed(6);
  manifest.httpStatus = { ...conn.stats.status };
  manifest.lowestRateLimitRemaining = conn.stats.lowestRemaining;
}

function finish(manifest, status = 'done') {
  manifest.finished = new Date().toISOString();
  manifest.minutes = Number(((Date.parse(manifest.finished) - Date.parse(manifest.started)) / 60_000).toFixed(1));
  manifest.status = status;
  return manifest;
}

export async function assertEmpty(conn, types) {
  for (const t of types) {
    const n = await countRows(conn.publicClient, ENTITIES[t], { owner: conn.owner });
    if (n > 0n) throw new Error(`city: ${conn.owner} already holds ${n} ${t} rows; wipe it first (one store per owner)`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A failure worth waiting out: the node answered 429 (a spent query window) or 5xx, or the request
// timed out or the connection dropped. Anything else (a 4xx, a refusal of ours) is not.
function transient(error) {
  for (let e = error, depth = 0; e && depth < 8; e = e.cause, depth += 1) {
    if (e.status === 429 || (Number.isInteger(e.status) && e.status >= 500)) return true;
    if (e.name === 'TimeoutError' || /took too long to respond|fetch failed|ECONNRESET|socket hang up/i.test(e.message ?? '')) return true;
  }
  return false;
}

// A read that failed for a transient reason is tried again after a minute, for up to 40 minutes:
// reads change nothing, so trying again is always safe.
async function readAgain(fn, log, what) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= 40 || !transient(error)) throw error;
      log(`${what}: ${(error.shortMessage ?? error.message).split('\n')[0]}; again in 60 s`);
      await sleep(60_000);
    }
  }
}

// This wallet's transactions at or after `nonce`, from `fromBlock` on, once none is pending: what
// each created and patched (the entity contract's EntityCreated and EntityPatched logs).
async function landedSince(conn, { nonce, fromBlock, toBlock = null }) {
  const owner = conn.owner.toLowerCase();
  let settled = false;
  for (let i = 0; i < 60 && !settled; i += 1) {
    const [latest, pending] = await Promise.all([conn.publicClient.getTransactionCount({ address: owner, blockTag: 'latest' }), conn.publicClient.getTransactionCount({ address: owner, blockTag: 'pending' })]);
    settled = latest === pending;
    if (!settled) await sleep(2_000);
  }
  // A transaction still pending could land after the scan, so nothing is undone until none is.
  if (!settled) throw new Error('city: a transaction of this wallet is still pending after 2 minutes; nothing undone, run again later');
  const head = toBlock === null ? await conn.publicClient.getBlockNumber() : BigInt(toBlock);
  const out = [];
  for (let b = BigInt(fromBlock); b <= head; b += 1n) {
    const block = await conn.publicClient.getBlock({ blockNumber: b, includeTransactions: true });
    for (const tx of block.transactions) {
      if (tx.from?.toLowerCase() !== owner || Number(tx.nonce) < nonce) continue;
      const receipt = await conn.publicClient.getTransactionReceipt({ hash: tx.hash });
      const created = [];
      const updated = [];
      for (const l of receipt.status === 'success' ? receipt.logs : []) {
        try {
          const d = decodeEventLog({ abi: ENTITY_EVENTS_ABI, topics: l.topics, data: l.data });
          if (d.eventName === 'EntityCreated') created.push(d.args.entityKey.toLowerCase());
          if (d.eventName === 'EntityPatched') updated.push(d.args.entityKey.toLowerCase());
        } catch {
          // an event this ABI does not describe
        }
      }
      out.push({ hash: tx.hash, nonce: Number(tx.nonce), blockNumber: b, gasUsed: receipt.gasUsed, effectiveGasPrice: receipt.effectiveGasPrice ?? 0n, created, updated });
    }
  }
  return out;
}

// Undoes what this wallet's transactions since `nonce` did to the graph store: their creates are
// deleted and their patches set back to `state`, the rows the failed plan was made from. Without a
// state (a run that stopped earlier), only creates can be undone; a patch to undo is refused.
export async function undoSince(conn, state, { nonce, fromBlock, toBlock = null }) {
  const landed = await landedSince(conn, { nonce, fromBlock, toBlock });
  const created = landed.flatMap((t) => t.created);
  const updated = [...new Set(landed.flatMap((t) => t.updated))];
  const rows = state ? [...state.totals.values(), ...state.links.values(), ...state.nodes.values()] : [];
  const restore = [];
  for (const k of updated) {
    const row = rows.find((r) => String(r.key).toLowerCase() === k);
    if (!row) throw new Error(`city: transaction ${landed.find((t) => t.updated.includes(k)).hash} patched ${k}, which this run cannot set back; wipe the graph store instead`);
    restore.push(row);
  }
  const defOf = (row) => (state.totals.has(`${row.values.node}:${row.values.epoch}:${row.values.window}`) ? ENTITIES.tally : row.values.from_node ? ENTITIES.link : ENTITIES.node);
  // A row's identity never changes in a patch; everything else is set back.
  const IDENTITY = new Set(['project', 'type', 'schema_v', 'node', 'epoch', 'window', 'day', 'kind', 'from_node', 'to_node', 'from_epoch', 'to_epoch', 'ens', 'owner_node']);
  const backTo = (row) => Object.fromEntries(Object.entries(row.values).filter(([k]) => !IDENTITY.has(k)));
  const txs = [];
  if (created.length > 0) txs.push(...(await conn.writer.send({ deletes: created.map((key) => ({ key })) }, { split: true })).txs);
  if (restore.length > 0) txs.push(...(await conn.writer.send({ patches: restore.map((r) => ({ def: defOf(r), key: r.key, values: backTo(r) })) }, { split: true })).txs);
  return { landed, txs, deleted: created.length, restored: restore.length };
}

// The block after the last of `txs` to land, and the nonce after its own: where the next batch's
// transactions can start (null when nothing landed).
async function positionAfter(conn, txs) {
  const last = txs.filter((t) => t.blockNumber !== undefined && t.blockNumber !== null).reduce((a, t) => (!a || BigInt(t.blockNumber) > BigInt(a.blockNumber) ? t : a), null);
  if (!last) return null;
  const tx = await conn.publicClient.getTransaction({ hash: last.hash });
  return { block: BigInt(last.blockNumber), nonce: Number(tx.nonce) + 1 };
}

// The graph store, batch by batch. `fromBatch` resumes a run that stopped there, once undoSince has
// set Arkiv back to the batch before it. A batch goes out in several transactions, so one the node
// refuses can leave the ones before it landed: those are undone back to the state the plan was made
// from, and after a pause for the node the batch is sent again (`retries` times).
// undoOnFailure: false leaves a failed batch as it landed, as a process that dies would (tests).
export async function seedGraph(city, conn, { log = () => {}, batchEvents = 25, manifest, fromBatch = 0, retries = 3, pauseMs = 15_000, undoOnFailure = true }) {
  const events = ledgerEvents(city);
  if (!Number.isInteger(fromBatch) || fromBatch < 0) throw new Error(`city: fromBatch ${fromBatch} is not a batch number`);
  if (fromBatch === 0) await readAgain(() => assertEmpty(conn, ['edge', 'node', 'tally', 'link']), log, 'graph: the empty check');
  else {
    // A run resumes only where the store ends: one edge per event of the batches before, none after.
    const have = await readAgain(() => countRows(conn.publicClient, ENTITIES.edge, { owner: conn.owner }), log, 'graph: the resume check');
    const want = Math.min(fromBatch * batchEvents, events.length);
    if (have !== BigInt(want)) throw new Error(`city: ${conn.owner} holds ${have} edge rows, but batch ${fromBatch + 1} follows ${want}; undo the stopped run's partial batch first`);
  }
  const ledger = createLedger({ arkiv: conn, synthetic: { dataset: city.dataset }, createNodes: true, reloadOnError: false });
  await readAgain(() => ledger.load(), log, 'graph: the load');
  const batches = chunks(events, batchEvents);
  // Where a batch's own transactions can start: after the last receipt of the batch before (a
  // `latest` read right after a receipt can answer one behind), at the nonce after its last one.
  let after = null;
  for (let i = fromBatch; i < batches.length; i += 1) {
    for (let attempt = 1; ; attempt += 1) {
      const fromBlock = after ? after.block + 1n : await conn.publicClient.getBlockNumber();
      const nonce = Math.max(await conn.writer.confirmedNonce(), after?.nonce ?? 0);
      try {
        const r = await ledger.applyBatch(batches[i]);
        account(manifest, r.txs, conn);
        after = (await positionAfter(conn, r.txs)) ?? after;
        break;
      } catch (error) {
        if (!undoOnFailure) throw Object.assign(error, { batch: i, nonce, fromBlock });
        // What landed of the batch is undone first, back to the state its plan was made from, so a
        // run that stops here leaves Arkiv exactly at the batch before.
        const undo = await undoSince(conn, ledger.state, { nonce, fromBlock });
        account(manifest, [...undo.landed.map((t) => ({ ...t, creates: t.created.length, patches: t.updated.length })), ...undo.txs], conn);
        after = (await positionAfter(conn, [...undo.landed, ...undo.txs])) ?? after;
        log(`graph batch ${i + 1}: ${(error.shortMessage ?? error.message).split('\n')[0]}; undid ${undo.deleted} creates and ${undo.restored} patches from ${undo.landed.length} landed txs${attempt > retries ? '; stopping' : `; again in ${pauseMs / 1000} s`}`);
        if (attempt > retries) {
          Object.assign(error, { batch: i, nonce, fromBlock, undone: { deleted: undo.deleted, restored: undo.restored } });
          throw error;
        }
        await sleep(pauseMs);
      }
    }
    if ((i + 1) % 5 === 0 || i === batches.length - 1) log(`graph ${i + 1}/${batches.length} batches, ${manifest.transactions} txs, ${manifest.tglm} tGLM`);
  }
  return finish(manifest);
}

// The plain store's rows are independent creates, so a stopped run can resume: with
// `resume`, the rows already written (by ref and by name) are read back and skipped.
export async function seedPlain(city, conn, { log = () => {}, batchEvents = 25, manifest, resume = false }) {
  let haveRefs = new Set();
  let haveNames = new Set();
  if (resume) {
    haveRefs = new Set((await readAll(conn.publicClient, ENTITIES.record, { owner: conn.owner, cap: 200_000 })).map((r) => r.ref));
    haveNames = new Set((await readAll(conn.publicClient, ENTITIES.profile, { owner: conn.owner, cap: 200_000 })).map((r) => r.name));
    log(`plain resume: ${haveRefs.size} records and ${haveNames.size} profiles already written`);
  } else {
    await readAgain(() => assertEmpty(conn, ['record', 'profile']), log, 'plain: the empty check');
  }
  const exp = () => ExpirationTime.fromDays(LIFETIME.syntheticDays);
  const profiles = chunks(plainProfiles(city).filter((p) => !haveNames.has(p.name)), batchEvents * 2);
  for (const p of profiles) {
    const r = await conn.writer.send({ creates: p.map((values) => ({ def: ENTITIES.profile, values, expiration: exp() })) }, { split: true });
    account(manifest, r.txs, conn);
  }
  const batches = chunks(plainRecords(city).filter((r) => !haveRefs.has(r.ref)), batchEvents);
  for (const [i, batch] of batches.entries()) {
    const r = await conn.writer.send({ creates: batch.map((values) => ({ def: ENTITIES.record, values, expiration: exp() })) }, { split: true });
    account(manifest, r.txs, conn);
    if ((i + 1) % 10 === 0 || i === batches.length - 1) log(`plain ${i + 1}/${batches.length} batches, ${manifest.transactions} txs, ${manifest.tglm} tGLM`);
  }
  return finish(manifest);
}

// Creates the directory rows W_DIRECTORY does not hold yet (by shop_key), in one split batch.
export async function seedDirectory(city, conn, { log = () => {}, manifest }) {
  const rows = directoryRows(city);
  const held = new Set();
  for (const r of rows) {
    const found = await readAll(conn.publicClient, ENTITIES.shop, { owner: conn.owner, where: [eq('shop_key', key(r.shop_key))], cap: 10, truncate: true });
    if (found.length > 0) held.add(r.shop_key);
  }
  const missing = rows.filter((r) => !held.has(r.shop_key));
  if (missing.length > 0) {
    const r = await conn.writer.send({ creates: missing.map((values) => ({ def: ENTITIES.shop, values, expiration: ExpirationTime.fromDays(LIFETIME.shopDays) })) }, { split: true });
    account(manifest, r.txs, conn);
  }
  log(`directory: ${missing.length} rows written, ${held.size} already listed`);
  return finish(manifest);
}

// Deletes every row of the given types an owner holds, 60 per transaction, halving on refusal.
export async function wipe(conn, types, { log = () => {}, manifest }) {
  for (const t of types) {
    const rows = await readAll(conn.publicClient, ENTITIES[t], { owner: conn.owner, cap: 200_000 });
    let size = 60;
    for (let i = 0; i < rows.length; ) {
      const part = rows.slice(i, i + size);
      try {
        const r = await conn.writer.send({ deletes: part.map((x) => ({ key: x.$key })) });
        account(manifest, r.txs, conn);
        manifest.deletes += part.length;
        i += part.length;
      } catch (error) {
        if (size === 1) throw error;
        size = Math.max(1, Math.floor(size / 2));
      }
    }
    log(`wiped ${rows.length} ${t} rows`);
  }
  return finish(manifest);
}
