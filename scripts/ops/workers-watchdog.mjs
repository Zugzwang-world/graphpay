// node scripts/ops/workers-watchdog.mjs [--dir <checkout>] [--every <s>] [--stall <s>]
// Keeps the one workers process (`pnpm workers`: the mirror and the ENS watcher) running on
// this Mac all night (W5 Ops). Every --every seconds (default 60) it reads the workers' /status
// on 127.0.0.1:8788:
// - no workers process: start one from --dir (default: this checkout), detached, with its output
//   appended to <dir>/.workers.log;
// - running, but neither healthy nor scanning further for --stall seconds (default 1800): stop it
//   and start a new one. The fuse is longer than Arkiv's rate-limit window: a mirror refused by
//   the shared keyless budget waits out the reset the endpoint reports (up to about 25 minutes)
//   and resumes by itself, while a restart reloads all of W_LEDGER's rows three times (adopt)
//   and spends that budget again (W2's diagnosis, 00:28 IST Sat 7 Nov; the 22:02 and 23:29
//   stalls of Fri 6 Nov). The stop is SIGINT, then TERM, then KILL: an Arkiv call waiting out a
//   reset holds the process's own shutdown. The mirror resumes from its checkpoint, and its
//   lease is free once the pid has exited.
// A file <dir>/.workers.hold pauses both, for a maintenance window. Never starts a second
// process (the workers' lease would refuse it too). Prints times, pids and block numbers only.

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, openSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({ options: { dir: { type: 'string' }, every: { type: 'string', default: '60' }, stall: { type: 'string', default: '1800' } } });
const dir = resolve(args.dir ?? join(fileURLToPath(new URL('.', import.meta.url)), '..', '..'));
const everyMs = Number(args.every) * 1000;
const stallMs = Number(args.stall) * 1000;
const PATTERN = '^node packages/mirror/src/main\\.mjs';
const STATUS = 'http://127.0.0.1:8788/status';

const say = (line) => process.stdout.write(`${new Date().toISOString()} ${line}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function workerPids() {
  try {
    return execFileSync('pgrep', ['-f', PATTERN], { encoding: 'utf8' }).split('\n').map(Number).filter((n) => n > 0 && n !== process.pid);
  } catch {
    return []; // pgrep exits 1 when nothing matches
  }
}

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

async function stop(pid) {
  for (const [signal, waitS] of [['SIGINT', 30], ['SIGTERM', 10], ['SIGKILL', 5]]) {
    say(`stop ${pid}: ${signal}`);
    try {
      process.kill(pid, signal);
    } catch {
      return;
    }
    for (let i = 0; i < waitS; i++) {
      if (!alive(pid)) return say(`stop ${pid}: exited after ${signal}`);
      await sleep(1000);
    }
  }
}

function start() {
  const out = openSync(join(dir, '.workers.log'), 'a');
  const child = spawn('fnm', ['exec', '--using=22.23.4', 'pnpm', 'workers'], { cwd: dir, detached: true, stdio: ['ignore', out, out] });
  child.unref();
  say(`start: pnpm workers in ${dir} (launcher pid ${child.pid})`);
}

async function status() {
  try {
    const res = await fetch(STATUS, { signal: AbortSignal.timeout(10_000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// Healthy as /health says (running, a good poll in the last 30 s), or still scanning further:
// a catch-up after a restart has no good poll yet, but its scan moves.
export function progressed(s, last, now) {
  const healthy = Boolean(s?.running && s.lastPollOk && now - s.lastPollOk < 30_000);
  const scannedTo = Number(s?.mirror?.scannedTo ?? 0);
  return { healthy, scannedTo, moved: healthy || scannedTo > last.scannedTo };
}

async function main() {
  say(`watchdog: every ${everyMs / 1000} s, restart after ${stallMs / 1000} s with no progress; checkout ${dir}; hold file ${join(dir, '.workers.hold')}`);
  let last = { at: Date.now(), scannedTo: 0 };
  for (;;) {
    const hold = existsSync(join(dir, '.workers.hold'));
    const pids = workerPids();
    if (hold) {
      last = { at: Date.now(), scannedTo: last.scannedTo };
    } else if (pids.length === 0) {
      start();
      last = { at: Date.now(), scannedTo: 0 };
    } else {
      const now = Date.now();
      const p = progressed(await status(), last, now);
      if (p.moved) last = { at: now, scannedTo: Math.max(p.scannedTo, last.scannedTo) };
      else if (now - last.at > stallMs) {
        say(`stalled: no good poll and no scan past block ${last.scannedTo} for ${Math.round((now - last.at) / 1000)} s; restarting ${pids.join(', ')}`);
        for (const pid of pids) await stop(pid);
        start();
        last = { at: Date.now(), scannedTo: 0 };
      }
    }
    await sleep(everyMs);
  }
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) await main();
