// pnpm -s workers:replay --mode <dry|lost-cursor|race|crash> [--from N] [--to N] [--at MS]
//
// D2 (ACCEPTANCE_TESTS.md): one mirror pass over a block range of the real chain
// stream, outside the workers process, to show that a retry never writes twice.
//   dry          (a) the range again with the checkpoint forgotten in memory: every
//                event must be skipped by the anchor on Arkiv; any send is refused
//                and counted (it would be a duplicate). Safe while the workers run.
//   lost-cursor  (a) as dry, with the anchor hidden too: edges are skipped by `ref`,
//                standings found unchanged. Safe while the workers run.
//   race         (b) run twice at once with the same --at (unix ms): each process holds
//                its first raw transaction until then, so both send the same event's
//                batch at the same confirmed nonce. Exactly one may land.
//   crash        (c) the process kills itself right after the node accepted its first
//                raw transaction, before any receipt. A restart must find it.
// race and crash write as W_LEDGER, so they refuse while a workers heartbeat is fresh:
// stop the workers process cleanly (Ctrl-C) first, restart it after.
// Prints one JSON line (`replay:`) with the counts; names only, never a secret.

import { parseArgs } from 'node:util';
import { withRawSendHook } from './intercept.mjs';
import { heartbeatAgeS, STALE_AFTER_S } from './lease.mjs';
import { connectMirror, loadWorkersEnv } from './setup.mjs';

const MODES = new Set(['dry', 'lost-cursor', 'race', 'crash']);
const { values: args } = parseArgs({
  options: { mode: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, at: { type: 'string' } },
});
if (!MODES.has(args.mode)) throw new Error('replay: --mode dry, lost-cursor, race or crash');
const writes = args.mode === 'race' || args.mode === 'crash';
if (args.mode === 'race' && !/^\d+$/.test(args.at ?? '')) throw new Error('replay: race needs --at <unix ms> (the same for both processes)');

const { env, log, redact } = loadWorkersEnv();
const say = (obj) => process.stdout.write(`replay: ${redact(JSON.stringify(obj))}\n`);
const sends = { attempted: 0, refused: [], raw: [] };
let ledgerRef = null;
let first = true;

// Workers running? (the write modes refuse; checked again just before a held send).
async function liveWorkers() {
  const rows = await ledgerRef.readHeartbeats();
  const arkivBlock = await ledgerRef.arkivBlock();
  return rows.find((r) => r.state === 'running' && heartbeatAgeS(r, { arkivBlock }) <= STALE_AFTER_S) ?? null;
}

// The hold sits at the transport (intercept.mjs): connectArkiv captures globalThis.fetch.
const realFetch = globalThis.fetch;
globalThis.fetch = withRawSendHook(realFetch, async ({ send, hash, nonce }) => {
  sends.attempted += 1;
  if (!writes) {
    // A second guard behind the replaced write ports: the read modes never send.
    sends.refused.push({ port: 'raw', hash, nonce });
    throw Object.assign(new Error('replay: a raw send was refused in a read mode'), { code: 'DRY_SEND' });
  }
  const wasFirst = first;
  first = false;
  if (wasFirst && args.mode === 'race') await new Promise((r) => setTimeout(r, Math.max(0, Number(args.at) - Date.now())));
  const rival = await liveWorkers();
  if (rival) {
    say({ mode: args.mode, refused: `workers instance ${rival.instance} started during the hold; nothing sent` });
    process.exit(2);
  }
  const res = await send();
  let error = null;
  try {
    const body = await res.clone().json();
    error = (Array.isArray(body) ? body : [body]).find((m) => m?.error)?.error?.message ?? null;
  } catch {
    // not JSON: left to the writer
  }
  sends.raw.push({ hash, nonce, at: Date.now(), error });
  if (wasFirst && args.mode === 'crash' && !error) {
    say({ mode: 'crash', killedAfterSend: hash, nonce, sends });
    process.kill(process.pid, 'SIGKILL');
  }
  return res;
});

let cap = Infinity;
const { ledger, mirror, deployBlock, confirmations, stream } = await connectMirror({
  env,
  log,
  // The pass ends at --to: the head is capped so `to` is the last confirmed block.
  wrapSource: (s) => ({ ...s, head: async () => Math.min(await s.head(), cap + s.confirmations), events: s.events, blockTime: s.blockTime }),
});
ledgerRef = ledger;
const from = args.from ? Number(args.from) : deployBlock;
if (args.to) cap = Number(args.to);
if (!Number.isInteger(from) || from < deployBlock) throw new Error(`replay: --from must be a block at or after the deploy block ${deployBlock}`);
if (Number.isFinite(cap) && (!Number.isInteger(cap) || cap < from)) throw new Error('replay: --to must be a block at or after --from');

if (writes) {
  const live = await liveWorkers();
  if (live) throw new Error(`replay: refused, workers instance ${live.instance} is running (stop it cleanly first)`);
}

const nonceAtStart = await ledger.confirmedNonce();
if (!writes) {
  // Every write port sends nothing and records what it was asked to write: here that
  // would be a second copy of a mirrored event. The pass goes on, so all are counted.
  for (const name of ['writeEdge', 'writeStanding', 'registerActors']) {
    ledger[name] = async (what) => {
      sends.attempted += 1;
      sends.refused.push({ port: name, ref: what?.ref ?? null });
    };
  }
}

await mirror.adopt();
const adopted = mirror.checkpoint;
if (!writes && !args.to) {
  // Without --to, only what the workers have already weighed: up to the checkpoint, or
  // (no checkpoint yet) the last event their heartbeat reports.
  const beats = await ledger.readHeartbeats();
  const seen = Math.max(0, ...beats.map((r) => r.cursorBlock ?? 0));
  cap = Math.max(from, adopted?.block ?? seen ?? deployBlock);
}
if (!writes) {
  // Forget the checkpoint in memory, so every event in the range is weighed again.
  mirror.checkpoint = null;
  mirror.cursor = null;
  if (args.mode === 'lost-cursor') ledger.readCheckpoint = async () => null;
}
// The write modes go on from the checkpoint, like the workers (starting later would
// carry the checkpoint past an event no one wrote); the read modes start at --from.
if (!writes) mirror.scannedTo = from - 1;

let error = null;
try {
  await mirror.poll();
} catch (err) {
  error = { code: err.code ?? err.name, message: err.shortMessage ?? err.message };
}
// In the write modes a lost race fails one poll and re-adopts; the next sees the winner's write.
if (writes && error) {
  try {
    await mirror.poll();
    error = { ...error, recovered: true };
  } catch (err) {
    error = { code: err.code ?? err.name, message: err.shortMessage ?? err.message };
  }
}
const s = mirror.status();
const out = {
  mode: args.mode,
  stream,
  from,
  to: Number.isFinite(cap) ? cap : s.scannedTo,
  confirmations,
  adoptedCheckpoint: adopted,
  checkpoint: s.checkpoint,
  stats: s.stats,
  parked: s.parked.length,
  sends,
  nonce: { before: nonceAtStart, after: await ledger.confirmedNonce() },
  error,
};
say(out);
process.exit((error && !error.recovered) || sends.refused.length > 0 ? 1 : 0);
