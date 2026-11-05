// node acceptance/mirror.mjs <check> [options]   (the mirror's checks, read-only unless noted)
//
//   d1   --ref 1874:<tx>:<logIndex> | --tx <whitechain tx>   the mirror's Rabdi transaction for
//        that PaymentSettled: the pay edge, 4 tally rows, the link, the checkpoint; gas vs 310,527
//   d2a  replays --from..--to twice outside the workers (checkpoint forgotten, then the anchor
//        hidden too): no transaction may be sent. Safe while the workers run.
//   d2b  --block N   (workers stopped) two replay processes send the batch of the first unmirrored
//        event at or after block N at the same time with the same nonce: exactly one lands
//   d2c  --block N   (workers stopped) a replay kills itself after its first raw transaction, a
//        second replay restarts: the restart finds the mined transaction, no second edge
//   d3   --ens <name> [--ens <name>]   reputation(window: ALL, verify: true) and a full recount by paging
//   refs --from N --to N   every event in the window has its one edge (an edge event) or none (D15)
//   lag  the workers' heartbeat: cursor, head, lag
//
// Prints one `result:` JSON line per check (id, pass, measured, expected, evidence) and
// writes it to docs/sessions/integration/acceptance/<id>.json. Names and public values only.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { checkoutAbi } from '../packages/contracts/index.mjs';
import { config } from '../packages/config/index.mjs';
import { d1Verdict, epochOf, LAB_PAY_GAS, mirrorTxOf, recount, refCounts, storedTally } from '../packages/mirror/src/checks.mjs';
import { decodeLogs } from '../packages/mirror/src/decode.mjs';
import { connectArkiv, createGraphEngine, nodeOf, readHeartbeats, runGraphql, writerAddresses } from '../packages/money-graph/index.mjs';
import { clientsFor } from '../scripts/lib/chains.mjs';
import { loadEnv } from '../scripts/lib/env-loader.mjs';
import { installErrorBoundary } from '../scripts/lib/redact.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let values = new Map();
installErrorBoundary(() => values);
values = loadEnv().values;
const env = Object.fromEntries(values);

const [check, ...rest] = process.argv.slice(2);
const { values: args } = parseArgs({
  args: rest,
  options: { ref: { type: 'string' }, tx: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, block: { type: 'string' }, ens: { type: 'string', multiple: true } },
});

const owner = writerAddresses().W_LEDGER;
const checkout = config.whitechain.contracts.checkout;
const address = checkout.address.toLowerCase();
const stream = `chain:${config.networks.whitechain.chainId}:${address}`;
const explorer = { whitechain: (h) => `${config.networks.whitechain.explorer}/tx/${h}`, rabdi: (h) => `${config.networks.rabdi.explorer}/tx/${h}` };

async function arkivRead() {
  return connectArkiv({ backend: env.ARKIV_BACKEND ?? 'rabdi', env });
}

async function chainEvents(from, to) {
  const { publicClient, chain } = await clientsFor('whitechain', env);
  const out = [];
  for (let b = from; b <= to; b += 1000) {
    const logs = await publicClient.getLogs({ address, fromBlock: BigInt(b), toBlock: BigInt(Math.min(to, b + 999)) });
    out.push(...decodeLogs(checkoutAbi, logs, { chainId: chain.id }).events);
  }
  return { events: out, publicClient };
}

const json = (v, space) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x), space);

function result(id, body) {
  const r = { id, at: new Date().toISOString(), ...body };
  mkdirSync(join(root, 'docs', 'sessions', 'integration', 'acceptance'), { recursive: true });
  writeFileSync(join(root, 'docs', 'sessions', 'integration', 'acceptance', `${id}.json`), `${json(r, 2)}\n`);
  process.stdout.write(`result: ${json(r)}\n`);
  return r;
}

function replay(mode, extra = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(root, 'packages/mirror/src/replay.mjs'), '--mode', mode, ...extra], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code, signal) => {
      const line = out.split('\n').reverse().find((l) => l.startsWith('replay: '));
      let report = null;
      try {
        report = line ? JSON.parse(line.slice(8)) : null;
      } catch {
        report = null;
      }
      resolve({ code, signal, report, tail: report ? undefined : out.split('\n').slice(-5).join('\n') });
    });
  });
}

// The first edge event at or after `block` that the mirror has not written yet.
async function unmirrored(block) {
  const arkiv = await arkivRead();
  const { publicClient } = await clientsFor('whitechain', env);
  const head = Number(await publicClient.getBlockNumber({ cacheTime: 0 })) - 2;
  const { events } = await chainEvents(block, head);
  const counts = await refCounts(arkiv.publicClient, { owner, events });
  const todo = counts.wrong.find((r) => r.edges === 0 && r.want === 1);
  return { arkiv, events, todo };
}

switch (check) {
  case 'd1': {
    let ref = args.ref;
    let settle = null;
    if (!ref && args.tx) {
      const { publicClient, chain } = await clientsFor('whitechain', env);
      const receipt = await publicClient.getTransactionReceipt({ hash: args.tx });
      const logs = receipt.logs.filter((l) => l.address.toLowerCase() === address);
      settle = decodeLogs(checkoutAbi, logs, { chainId: chain.id }).events.find((e) => e.name === 'PaymentSettled');
      if (!settle) throw new Error('d1: no PaymentSettled from the checkout in that transaction');
      ref = settle.id;
    }
    if (!ref) throw new Error('d1: --ref or --tx');
    const arkiv = await arkivRead();
    const tx = await mirrorTxOf(arkiv.publicClient, { ref, owner });
    const edge = tx.ops?.find((o) => o.type === 'edge');
    const row = edge ? (await arkiv.publicClient.getEntity(tx.edgeKey)).$attributes : null;
    const shopNode = row?.to_node?.value?.toLowerCase();
    const payerNode = row?.from_node?.value?.toLowerCase();
    const v = d1Verdict(tx, { shopNode, payerNode, stream });
    result('D1', {
      pass: v.pass,
      what: 'one payment event writes its edge and tallies in one atomic batch',
      measured: { ...v, ops: tx.ops?.map((o) => `${o.op} ${o.type}${o.window ? `:${o.window}` : ''}${o.kind ? `:${o.kind}` : ''}`) },
      expected: { ops: 'create edge:pay, 4 tally rows (shop all and day, payer all and day), the link, patch checkpoint; one transaction', gas: `recorded, lab ${LAB_PAY_GAS}` },
      evidence: { ref, rabdiTx: tx.txHash ? explorer.rabdi(tx.txHash) : null, arkivBlock: tx.arkivBlock, whitechainTx: ref.split(':')[1] ? explorer.whitechain(ref.split(':')[1]) : null },
    });
    break;
  }
  case 'd2a': {
    const from = args.from ?? String(checkout.deployBlock);
    const range = ['--from', from, ...(args.to ? ['--to', args.to] : [])];
    const a = await replay('dry', range);
    const b = await replay('lost-cursor', range);
    const sent = (r) => r.report?.sends?.refused?.length ?? NaN;
    const weighed = (r) => (r.report?.stats?.skippedCheckpoint ?? 0) + (r.report?.stats?.skippedRef ?? 0);
    // (a) as the pack states it: the checkpoint forgotten, nothing may be sent. The stronger
    // pass with the anchor hidden too may send no edge; it may re-apply a standing patch (a
    // known limit: standings carry no ref; replayed in chain order they end in the latest).
    const edgeSends = (r) => (r.report?.sends?.refused ?? []).filter((x) => x.port !== 'writeStanding').length;
    const clean = a.code !== null && sent(a) === 0 && edgeSends(b) === 0;
    // A range with no mirrored edge event tests nothing: reported as not run, not pass.
    const pass = !clean ? false : weighed(a) > 0 && weighed(b) > 0 ? true : null;
    result('D2a', {
      pass,
      ...(pass === null ? { why: 'no mirrored edge event in the range yet' } : {}),
      what: 'the mirror step again over the same blocks sends no transaction',
      measured: {
        checkpointForgotten: { stats: a.report?.stats, wouldSend: a.report?.sends?.refused, nonce: a.report?.nonce },
        anchorHiddenToo: { stats: b.report?.stats, wouldSend: b.report?.sends?.refused, edgeSends: edgeSends(b), nonce: b.report?.nonce },
      },
      expected: { checkpointForgotten: 'no send', anchorHiddenToo: 'no edge send (standing re-applies listed)' },
      evidence: { range: { from: a.report?.from, to: a.report?.to }, errors: [a.tail, b.tail].filter(Boolean) },
    });
    break;
  }
  case 'd2b':
  case 'd2c': {
    if (!args.block) throw new Error(`${check}: --block N (the first block to look for an unmirrored event)`);
    const { arkiv, events, todo } = await unmirrored(Number(args.block));
    if (!todo) throw new Error(`${check}: no unmirrored edge event at or after block ${args.block}; make one first (with the workers stopped)`);
    // The replays go on from the checkpoint up to the event's block, like the workers.
    const range = ['--to', String(todo.block)];
    let runs;
    if (check === 'd2b') {
      const at = String(Date.now() + 25_000);
      runs = await Promise.all([replay('race', [...range, '--at', at]), replay('race', [...range, '--at', at])]);
    } else {
      const crash = await replay('crash', range);
      const restart = await replay('race', [...range, '--at', '0']);
      runs = [crash, restart];
    }
    const window = events.filter((e) => e.block <= todo.block);
    const counts = await refCounts(arkiv.publicClient, { owner, events: window });
    const raws = runs.map((r) => r.report?.sends?.raw ?? []);
    const firsts = raws.map((r) => r[0]).filter(Boolean);
    const mined = new Map();
    for (const h of new Set(raws.flat().map((x) => x.hash).filter(Boolean))) {
      try {
        mined.set(h, (await arkiv.publicClient.getTransactionReceipt({ hash: h })).status === 'success');
      } catch {
        mined.set(h, false);
      }
    }
    const landed = [...mined].filter(([, ok]) => ok).map(([h]) => h);
    // D2b: both first sends at one nonce, exactly one of them mined. D2c: the crash run was
    // killed right after its send, and that transaction was mined.
    const pass =
      check === 'd2b'
        ? counts.pass && counts.edgeEvents > 0 && firsts.length === 2 && firsts[0].nonce === firsts[1].nonce && new Set(firsts.map((f) => f.hash).filter((h) => mined.get(h))).size === 1
        : counts.pass && counts.edgeEvents > 0 && runs[0].signal === 'SIGKILL' && Boolean(firsts[0] && mined.get(firsts[0].hash));
    result(check === 'd2b' ? 'D2b' : 'D2c', {
      pass,
      what: check === 'd2b' ? 'the same batch sent twice at once with the same confirmed nonce: exactly one lands' : 'stopped after sending, before the receipt; the restart finds the mined transaction',
      measured: { window: { events: counts.events, edgeEvents: counts.edgeEvents, wrong: counts.wrong }, runs: runs.map((r) => ({ exit: r.code, signal: r.signal, stats: r.report?.stats, error: r.report?.error, nonce: r.report?.nonce, raw: r.report?.sends?.raw })) },
      expected: check === 'd2b' ? 'both first sends at one nonce, exactly one mined; count(edge where ref = id) = 1 for every edge event up to the raced one' : 'the crash run killed after its send, that transaction mined, the restart sends no copy; one edge per event',
      evidence: { event: todo.id, mined: landed.map((h) => explorer.rabdi(h)), firstSends: firsts.map((f) => ({ hash: f.hash, nonce: f.nonce, mined: mined.get(f.hash) ?? false })) },
    });
    break;
  }
  case 'd3': {
    const names = args.ens ?? [];
    if (names.length === 0) throw new Error('d3: --ens <name> (a shop, a payer agent)');
    const arkiv = await arkivRead();
    const engine = createGraphEngine(arkiv);
    const rows = [];
    for (const ens of names) {
      const node = nodeOf(ens);
      const q = `query($e: String!) { node(ens: $e) { kind reputation(window: ALL, verify: true) { orders refunds fails delivered paidUsdt refundedUsdt source synthetic } } }`;
      const answer = await runGraphql({ engine, query: q, variables: { e: ens } });
      const kind = answer.data?.node?.kind;
      const epoch = await epochOf(arkiv.publicClient, { owner, node });
      const stored = await storedTally(arkiv.publicClient, { owner, node, epoch });
      const counted = await recount(arkiv.publicClient, { owner, node, epoch });
      const rep = answer.data?.node?.reputation;
      const same = stored && ['orders', 'refunds', 'delivered', 'onTime', 'paidMicro', 'refundedMicro'].every((k) => stored[k] === counted[k]);
      rows.push({ ens, kind, epoch, source: rep?.source, reputation: rep, stored, counted, recountMatches: Boolean(same), explainId: answer.extensions?.arkiv?.explainId, errors: answer.errors });
    }
    result('D3', {
      pass: rows.every((r) => r.source === 'RAW_VERIFIED' && r.recountMatches),
      what: 'tallies recomputed from edges equal the stored tallies',
      measured: rows,
      expected: { source: 'RAW_VERIFIED', recount: 'orders, refunds, paid and refunded equal the all-time tally' },
      evidence: { explainIds: rows.map((r) => r.explainId) },
    });
    break;
  }
  case 'refs': {
    if (!args.from || !args.to) throw new Error('refs: --from N --to N');
    const arkiv = await arkivRead();
    const { events } = await chainEvents(Number(args.from), Number(args.to));
    const counts = await refCounts(arkiv.publicClient, { owner, events });
    result('D15-refs', {
      pass: !counts.pass ? false : counts.edgeEvents > 0 ? true : null,
      ...(counts.edgeEvents === 0 ? { why: 'no edge event in the window yet' } : {}),
      what: 'no event in the window skipped or written twice',
      measured: counts,
      expected: 'count(edge where ref = id) = 1 for every edge event, 0 for the rest',
      evidence: { from: Number(args.from), to: Number(args.to) },
    });
    break;
  }
  case 'lag': {
    const arkiv = await arkivRead();
    const beats = await readHeartbeats(arkiv.publicClient, { owner });
    const nowS = Math.floor(Date.now() / 1000);
    const rows = beats.map((b) => ({ instance: b.instance, state: b.state, cursorBlock: Number(b.cursor_block), headBlock: Number(b.head_block), lagBlocks: Number(b.lag_blocks), ageS: nowS - Number(b.updated_ts) }));
    const running = rows.filter((r) => r.state === 'running' && r.ageS <= 90);
    result('lag', {
      pass: running.length === 1,
      what: 'exactly one workers process, its heartbeat fresh',
      measured: rows,
      expected: 'one running heartbeat under 90 s old',
      evidence: {},
    });
    break;
  }
  default:
    throw new Error('acceptance/mirror.mjs: d1, d2a, d2b, d2c, d3, refs or lag');
}
