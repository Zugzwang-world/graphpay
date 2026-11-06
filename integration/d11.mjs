// ALLOW_REAL_NETWORK=1 node integration/d11.mjs     (D11's presence half, Friday item 3)
// Runs `pnpm e2e:food` once with a known run id and watches its agents' presence rows on Arkiv:
// every 5 s until they appear, then every 60 s until they are gone (at most 20 minutes after the
// errand ends). The errand's start and end are the times of e2e:food's "errand as" and
// "errand:" lines. Pass: rows within 30 s of the start, gone within 15 minutes of the end, all
// owned by W_DIRECTORY. Also counts the run's handoff rows. Writes
// docs/sessions/integration/hosted/d11-<time>.json; e2e:food writes its own run file.

import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentsOnline, connectArkiv, handoffsFor, writerAddresses } from '@graphpay/money-graph';

const here = dirname(fileURLToPath(import.meta.url));
const say = (l) => process.stdout.write(`${new Date().toISOString().slice(11, 19)} d11: ${l}\n`);
const runId = `run-${randomBytes(8).toString('hex')}`;
const requestId = `0x${createHash('sha256').update(runId).digest('hex')}`;
const owner = writerAddresses().W_DIRECTORY;
const arkiv = await connectArkiv({ backend: 'rabdi', env: {} });
const out = { runId, owner, startedAt: new Date().toISOString(), polls: [] };

const save = () => {
  out.endedAt = new Date().toISOString();
  const dir = join(here, '..', 'docs', 'sessions', 'integration', 'hosted');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `d11-${out.startedAt.replace(/[:.]/g, '-')}.json`), `${JSON.stringify(out, null, 2)}\n`);
};
process.on('exit', save);

// The errand, as a child process; its output is passed through (it redacts its own).
const child = spawn(process.execPath, [join(here, 'e2e-food.mjs')], { env: { ...process.env, E2E_RUN_ID: runId }, stdio: ['ignore', 'pipe', 'inherit'] });
let buf = '';
child.stdout.on('data', (d) => {
  process.stdout.write(d);
  buf += d;
  const lines = buf.split('\n');
  buf = lines.pop();
  for (const l of lines) {
    if (!out.errandStartMs && / errand as /.test(l)) out.errandStartMs = Date.now();
    if (!out.errandEndMs && / errand: /.test(l)) {
      out.errandEndMs = Date.now();
      out.errandLine = l.slice(9, 200);
    }
  }
});
const exited = new Promise((ok) => child.on('exit', (code) => ok(code)));

// This run's rows, owned by W_DIRECTORY: agentsOnline reads only that owner and re-checks each
// row's owner (arkiv-graph's trustedRows), so a row from anyone else is never counted.
async function poll() {
  const rows = await agentsOnline(arkiv.publicClient, { session: runId });
  const p = { at: Date.now(), rows: rows.length, agents: rows.map((r) => r.agentEns) };
  out.polls.push(p);
  return rows;
}

const t0 = Date.now();
let seen = null;
while (!seen && Date.now() - t0 < 30 * 60_000) {
  const rows = await poll().catch(() => []);
  if (rows.length) {
    seen = Date.now();
    out.firstSeenMs = seen;
    out.firstRows = rows.map((r) => ({ key: r.key, agentEns: r.agentEns, role: r.role, expiresAt: r.expiresAt }));
    say(`presence: ${rows.length} rows (${rows.map((r) => r.role).join(', ')})`);
  } else await new Promise((ok) => setTimeout(ok, 5_000));
}
out.exitCode = await exited;
say(`e2e:food exited ${out.exitCode}`);
out.handoffs = (await handoffsFor(arkiv.publicClient, requestId).catch(() => [])).length;

while (seen && out.errandEndMs && Date.now() - out.errandEndMs < 20 * 60_000) {
  await new Promise((ok) => setTimeout(ok, 60_000));
  const rows = await poll().catch(() => null);
  if (rows && rows.length === 0) {
    out.goneMs = Date.now();
    break;
  }
}
const s = (ms) => (ms ? Math.round(ms / 100) / 10 : null);
out.secondsToPresence = out.firstSeenMs && out.errandStartMs ? s(out.firstSeenMs - out.errandStartMs) : null;
out.minutesToGone = out.goneMs && out.errandEndMs ? Math.round((out.goneMs - out.errandEndMs) / 600) / 100 : null;
out.pass = out.secondsToPresence !== null && out.secondsToPresence <= 30 && out.minutesToGone !== null && out.minutesToGone <= 15;
say(`presence ${out.secondsToPresence} s after the start, gone ${out.minutesToGone} min after the end, handoffs ${out.handoffs}: ${out.pass ? 'pass' : 'FAIL'}`);
