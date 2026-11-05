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
import { heartbeatAgeS, STALE_AFTER_S } from './lease.mjs';
import { connectMirror, loadWorkersEnv } from './setup.mjs';

const MODES = new Set(['dry', 'lost-cursor', 'race', 'crash']);
const { values: args } = parseArgs({
  options: { mode: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, at: { type: 'string' } },
});
if (!MODES.has(args.mode)) throw new Error('replay: --mode dry, lost-cursor, race or crash');
const writes = args.mode === 'race' || args.mode === 'crash';
if (args.mode === 'race' && !/^\d+$/.test(args.at ?? '')) throw new Error('replay: race needs --at <unix ms> (the same for both processes)');

const { env, log } = loadWorkersEnv();
let cap = Infinity;
const { arkiv, ledger, mirror, deployBlock, confirmations, stream } = await connectMirror({
  env,
  log,
  // The pass ends at --to: the head is capped so `to` is the last confirmed block.
  wrapSource: (s) => ({ ...s, head: async () => Math.min(await s.head(), cap + s.confirmations), events: s.events, blockTime: s.blockTime }),
});
const from = args.from ? Number(args.from) : deployBlock;
if (args.to) cap = Number(args.to);
if (!Number.isInteger(from) || from < deployBlock) throw new Error(`replay: --from must be a block at or after the deploy block ${deployBlock}`);
if (Number.isFinite(cap) && (!Number.isInteger(cap) || cap < from)) throw new Error('replay: --to must be a block at or after --from');

if (writes) {
  const rows = await ledger.readHeartbeats();
  const arkivBlock = await ledger.arkivBlock();
  const live = rows.find((r) => r.state === 'running' && heartbeatAgeS(r, { arkivBlock }) <= STALE_AFTER_S);
  if (live) throw new Error(`replay: refused, workers instance ${live.instance} is running (stop it cleanly first)`);
}

const nonceAtStart = await ledger.confirmedNonce();
const sends = { attempted: 0, refused: [], raw: [] };
if (!writes) {
  // Every write port sends nothing and records what it was asked to write: here that
  // would be a second copy of a mirrored event. The pass goes on, so all are counted.
  for (const name of ['writeEdge', 'writeStanding', 'registerActors']) {
    ledger[name] = async (what) => {
      sends.attempted += 1;
      sends.refused.push({ port: name, ref: what?.ref ?? null });
    };
  }
} else {
  // The raw transaction is where a send becomes real: race holds it to --at, crash
  // dies right after the node took it.
  const wallet = arkiv.walletClient;
  const request = wallet.request.bind(wallet);
  let first = true;
  wallet.request = async (req, opts) => {
    if (req?.method !== 'eth_sendRawTransaction') return request(req, opts);
    sends.attempted += 1;
    if (first && args.mode === 'race') await new Promise((r) => setTimeout(r, Math.max(0, Number(args.at) - Date.now())));
    const wasFirst = first;
    first = false;
    try {
      const hash = await request(req, opts);
      sends.raw.push({ hash, at: Date.now() });
      if (wasFirst && args.mode === 'crash') {
        process.stdout.write(`replay: ${JSON.stringify({ mode: 'crash', killedAfterSend: hash, nonceBefore: nonceAtStart })}\n`);
        process.kill(process.pid, 'SIGKILL');
      }
      return hash;
    } catch (err) {
      sends.raw.push({ error: err.shortMessage ?? err.message, at: Date.now() });
      throw err;
    }
  };
}

await mirror.adopt();
const adopted = mirror.checkpoint;
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
process.stdout.write(`replay: ${JSON.stringify(out)}\n`);
process.exit((error && !error.recovered) || sends.refused.length > 0 ? 1 : 0);
