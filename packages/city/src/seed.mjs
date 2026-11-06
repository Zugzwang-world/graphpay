// Seeding a generated city into Arkiv (planning/SPEC/ARKIV_GRAPH.md §8): the graph store
// (standard model, through the same ledger and tally planner as the mirror) and the plain
// store (one record per event, one profile per actor) under the size's seed wallet, and
// the shop directory under W_DIRECTORY. 25 events per logical batch, split by bytes. A
// store an owner already holds is refused; a failed run is wiped, then seeded again.

import { ExpirationTime } from '@arkiv-network/sdk';
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

export async function seedGraph(city, conn, { log = () => {}, batchEvents = 25, manifest }) {
  await assertEmpty(conn, ['edge', 'node', 'tally', 'link']);
  const ledger = createLedger({ arkiv: conn, synthetic: { dataset: city.dataset }, createNodes: true });
  await ledger.load();
  const batches = chunks(ledgerEvents(city), batchEvents);
  for (const [i, batch] of batches.entries()) {
    const r = await ledger.applyBatch(batch);
    account(manifest, r.txs, conn);
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
    await assertEmpty(conn, ['record', 'profile']);
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
