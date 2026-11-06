import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { ExpirationTime } from '@arkiv-network/sdk';
import { checkDefinition, checkedOwner, defineGraph, readAll, redactError, WriteRevertedError } from '../index.mjs';
import { event, setup, socialGraph } from './helpers.mjs';

const day = ExpirationTime.fromDays(1);
const send = (t, planned, opts) => t.writer.send({ creates: planned.creates.map((c) => ({ ...c, expiration: day })), patches: planned.patches }, opts);

async function apply(t, g, state, events, opts = {}) {
  const planned = g.plan(events, state, { stream: 's', ...opts });
  if (planned.creates.length + planned.patches.length === 0) return planned;
  const res = await send(t, planned, { split: opts.split });
  planned.commit(res.createdKeys);
  return { ...planned, res };
}

test('the definition check: conventions present, at most 30 attributes, no bytes on totals', () => {
  const g = socialGraph();
  for (const def of Object.values(g.defs)) assert.deepEqual(checkDefinition(def), []);
  assert.throws(() => defineGraph({ project: 'demo', totals: { counters: [], columns: ['blob:bytes'] } }), /carries no bytes/);
  assert.throws(() => defineGraph({ project: 'demo', node: { columns: Array.from({ length: 25 }, (_, i) => `c${i}:str`) } }), /more than 30/);
  assert.throws(() => defineGraph({ project: '' }), /project/);
});

test('totals are absolute, both ends, all and day windows; one batch per event with the checkpoint', async () => {
  const t = setup();
  const g = socialGraph();
  const state = g.newState();
  const first = await apply(t, g, state, [event('e1', 'tip', 1, 2, { value: 5n })]);
  assert.equal(first.creates.length, 7); // edge, 4 totals, link, checkpoint
  assert.equal(first.res.txs.length, 1);
  const second = await apply(t, g, state, [event('e2', 'tip', 1, 2, { value: 7n })]);
  assert.equal(second.creates.length, 1);
  assert.equal(second.patches.length, 6);
  const rows = await readAll(t.publicClient, g.defs.totals, { owner: t.owner });
  assert.equal(rows.length, 4);
  for (const r of rows) {
    assert.equal(r.tips, 2n);
    assert.equal(r.tipped, 12n);
    assert.equal(r.last_event, 'e2');
  }
  const [cp] = await readAll(t.publicClient, g.defs.checkpoint, { owner: t.owner });
  assert.equal(cp.events, 2n);
});

test('replay after a restart is a no-op with the anchor; rows re-read from Arkiv', async () => {
  const t = setup();
  const g = socialGraph();
  const state = g.newState();
  await apply(t, g, state, [event('e1', 'like', 1, 2, { position: { block: 10n, logIndex: 0 } })]);
  await apply(t, g, state, [event('e2', 'like', 1, 2, { position: { block: 11n, logIndex: 0 } })]);
  // A restart: state rebuilt from what Arkiv holds.
  const fresh = g.newState();
  const strip = (r) => ({ key: r.$key, values: Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith('$'))) });
  for (const r of await readAll(t.publicClient, g.defs.totals, { owner: t.owner })) fresh.totals.set(`${r.node}:${r.epoch}:${r.window}`, strip(r));
  for (const r of await readAll(t.publicClient, g.defs.checkpoint, { owner: t.owner })) fresh.checkpoints.set(r.stream, strip(r));
  const replay = g.plan([event('e1', 'like', 1, 2, { position: { block: 10n, logIndex: 0 } }), event('e2', 'like', 1, 2, { position: { block: 11n, logIndex: 0 } })], fresh, { stream: 's' });
  assert.deepEqual(replay.skipped, ['e1', 'e2']);
  assert.equal(replay.creates.length + replay.patches.length, 0);
  // Without an anchor, a row naming the event as its last one still stops a duplicate.
  const noAnchor = g.plan([event('e2', 'like', 1, 2)], fresh, {});
  assert.deepEqual(noAnchor.skipped, ['e2']);
});

test('epochs are separate identities: a new epoch starts from empty totals', async () => {
  const t = setup();
  const g = socialGraph();
  const state = g.newState();
  await apply(t, g, state, [event('e1', 'like', 1, 2, { epochs: [0, 0] })]);
  await apply(t, g, state, [event('e2', 'like', 1, 2, { epochs: [0, 1] })]);
  const rows = await readAll(t.publicClient, g.defs.totals, { owner: t.owner });
  const of = (epoch) => rows.filter((r) => r.node.endsWith('2') && r.epoch === epoch && r.window === 'all')[0];
  assert.equal(of(0n).likes, 1n);
  assert.equal(of(1n).likes, 1n);
});

test('a commit without every created key throws; a patch of a row without a key throws', () => {
  const g = socialGraph();
  const state = g.newState();
  const planned = g.plan([event('e1', 'like', 1, 2)], state, {});
  assert.throws(() => planned.commit([]), /without a key/);
  state.totals.set(`${event('x', 'like', 1, 2).from.node}:0:all`, { key: null, values: { likes: 1n, seq: 1n, last_ts: 0n, last_event: 'z' } });
  assert.throws(() => g.plan([event('e3', 'like', 1, 2)], state, {}), /needs its key/);
});

test('an uncertain send is recovered by nonce, never resent blindly', async () => {
  const t = setup();
  const g = socialGraph();
  const state = g.newState();
  t.sim.injectFault({ method: 'eth_sendRawTransaction', kind: 'apply-then-fail' });
  const r = await apply(t, g, state, [event('e1', 'like', 1, 2)]);
  assert.equal(r.res.txs[0].recovered, true);
  const edges = await readAll(t.publicClient, g.defs.edge, { owner: t.owner });
  assert.equal(edges.length, 1, 'exactly one edge landed');
});

test('a send lost before the node saw it is sent again with the same nonce', async () => {
  const t = setup();
  const g = socialGraph();
  t.sim.injectFault({ method: 'eth_sendRawTransaction', kind: 'fail' });
  const r = await apply(t, g, g.newState(), [event('e1', 'like', 1, 2)]);
  assert.equal(r.res.txs.length, 1);
  assert.equal((await readAll(t.publicClient, g.defs.edge, { owner: t.owner })).length, 1);
});

test('split mode cuts a large batch by bytes; without split mode it is refused', async () => {
  const t = setup();
  const g = socialGraph();
  const events = Array.from({ length: 300 }, (_, i) => event(`e${i}`, 'tip', i + 10, 1, { value: 1n }));
  assert.throws(() => send(t, g.plan(events, g.newState(), {}), {}), /split mode/);
  const state = g.newState();
  const r = await apply(t, g, state, events, { split: true });
  assert.ok(r.res.txs.length > 1);
  const [hub] = (await readAll(t.publicClient, g.defs.totals, { owner: t.owner })).filter((x) => x.node.endsWith('1') && x.window === 'all' && x.node === events[0].to.node);
  assert.equal(hub.tips, 300n);
});

test('a 413 halves the batch and retries (split mode)', async () => {
  const t = setup({ simOptions: { requestLimit: 40_000 } });
  const g = socialGraph();
  const events = Array.from({ length: 40 }, (_, i) => event(`e${i}`, 'like', i + 10, 1));
  const r = await apply(t, g, g.newState(), events, { split: true });
  assert.ok(t.sim.stats.status[413] >= 1);
  assert.equal((await readAll(t.publicClient, g.defs.edge, { owner: t.owner })).length, 40);
  assert.ok(r.res.txs.length >= 2);
});

test('a revert stops the writer', async () => {
  const t = setup();
  const g = socialGraph();
  const state = g.newState();
  const r = await apply(t, g, state, [event('e1', 'like', 1, 2)]);
  const edgeKey = Object.values(r.commit ? {} : {})[0];
  const [edge] = await readAll(t.publicClient, g.defs.edge, { owner: t.owner });
  await assert.rejects(t.writer.send({ patches: [{ def: { ...g.defs.edge, readonly: false }, key: edge.$key, values: { note: 'edited' } }] }), WriteRevertedError);
  assert.equal(edgeKey, undefined);
});

test('a blank or malformed owner is an error, never any owner', () => {
  assert.throws(() => checkedOwner(''), /blank/);
  assert.throws(() => checkedOwner('0x1234'), /malformed/);
  assert.throws(() => checkedOwner(`0x${'0'.repeat(40)}`), /malformed/);
});

test('errors leave with secrets redacted, codes kept', () => {
  const secret = 'k3y-in-the-url-path';
  const inner = Object.assign(new Error(`HTTP request failed. URL: https://node.example/${secret}`), { status: 500, details: `at ${secret}` });
  const outer = Object.assign(new Error(`failed: ${secret}`, { cause: inner }), { code: -32000, shortMessage: `short ${secret}` });
  redactError(outer, [secret]);
  assert.doesNotMatch(`${outer.message} ${outer.shortMessage} ${inner.message} ${inner.details}`, /k3y-in-the-url-path/);
  assert.equal(outer.code, -32000);
  assert.equal(inner.status, 500);
});

// The package is a generic Arkiv graph SDK: nothing payment-specific or project-specific
// in its source (ADR-0057).
test('boundary: no payment words, project entity names or project imports in src', () => {
  const words = /\b(pay|pays|paid|payment|payments|payer|payee|refunds?|refunded|renew|renewal|merchant|shops?|usdt|wbt|x402|whitechain|checkout|reputation|tally|tallies|quotes?|graphpay|ens|namehash|sepolia|micro_?usdt)\b/i;
  const files = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${f.name}`;
      if (f.isDirectory()) walk(p);
      else if (p.endsWith('.mjs') || p.endsWith('.d.ts')) files.push(p);
    }
  };
  const root = new URL('..', import.meta.url).pathname;
  walk(`${root}src`);
  walk(`${root}examples`);
  files.push(`${root}index.mjs`, `${root}README.md`, `${root}CHANGELOG.md`, `${root}FEEDBACK.md`);
  for (const f of files) {
    // The docs may name the project that built the package, and the README's Reference app
    // section says how that project uses it (ADR-0076); the rest of the docs and the source may not.
    const text = readFileSync(f, 'utf8').replace(/^## Reference app\n[\s\S]*?(?=^## )/m, '').replace(/graphpay[\w./@-]*/gi, '');
    const hit = words.exec(text);
    assert.equal(hit, null, `${f.slice(root.length)} mentions "${hit?.[0]}"`);
    assert.doesNotMatch(text, /from '@graphpay\//, `${f.slice(root.length)} imports a project package`);
  }
});
