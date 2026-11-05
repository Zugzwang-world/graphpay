// pnpm acceptance [--only C,D2,E] [--dry-run] [--friday] [--report-only]
//
// Runs the acceptance checks in order and writes ACCEPTANCE_REPORT.md. The ids and their
// wording come from planning/ACCEPTANCE_TESTS.md and docs/plan/ACCEPTANCE_ADDITIONS.md
// (the additions win where they amend), so no check can be left out. Each check that has
// a runner here is run; its result lands in docs/sessions/integration/acceptance/<id>.json. A check without
// a runner yet is reported `not run`, never `pass`. Friday checks run only with --friday.
// --dry-run prints the plan and runs nothing; --report-only rewrites the report from the
// results already on disk.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { activeCast, castEntries } from '../packages/config/index.mjs';
import { loadEnv } from '../scripts/lib/env-loader.mjs';
import { installErrorBoundary } from '../scripts/lib/redact.mjs';
import { checks as liveChecks } from './checks.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { values: args } = parseArgs({ options: { only: { type: 'string' }, 'dry-run': { type: 'boolean' }, friday: { type: 'boolean' }, 'report-only': { type: 'boolean' } } });

// The only checks that may be blocked, and why (join.md; ADR-0054).
export const MAY_BLOCK = { D7: 'waiting for the locked story (the M city is seeded only after the founder locks it)' };

// Every table row whose first cell is a check id, with its section and wording.
export function parseChecks(text, source) {
  const out = [];
  let section = null;
  let amending = false;
  for (const line of text.split('\n')) {
    const h = line.match(/^## (.+)$/);
    if (h) {
      section = h[1].trim();
      amending = /^Amended/i.test(section);
      continue;
    }
    const m = line.match(/^\| ([A-F]\d+)( \(Friday\))? \| (.+?) \|/);
    if (!m) continue;
    out.push({ id: m[1], friday: Boolean(m[2]), what: m[3].trim(), section, source, amends: amending });
  }
  return out;
}

export function allChecks() {
  const pack = parseChecks(readFileSync(join(root, 'planning/ACCEPTANCE_TESTS.md'), 'utf8'), 'pack');
  const adds = parseChecks(readFileSync(join(root, 'docs/plan/ACCEPTANCE_ADDITIONS.md'), 'utf8'), 'additions');
  const byId = new Map(pack.map((c) => [c.id, c]));
  for (const a of adds) {
    if (a.amends && byId.has(a.id)) byId.set(a.id, { ...byId.get(a.id), amended: a.what });
    else if (!a.amends) byId.set(a.id, a);
  }
  const order = (id) => [id.charCodeAt(0), Number(id.slice(1))];
  return [...byId.values()].sort((x, y) => {
    const [a1, a2] = order(x.id);
    const [b1, b2] = order(y.id);
    return a1 - b1 || a2 - b2;
  });
}

// The runners this repo has so far. Each is a command; its result file is docs/sessions/integration/acceptance/<file>.json.
const node = process.execPath;
// Names by story role, never typed here (ADR-0047): the good shop and the acceptance payer.
const cast = activeCast();
const entries = castEntries(cast);
const goodShop = entries.find((e) => e.kind === 'shop' && e.storyRole === 'good').ensName;
const acceptancePayer = entries.find((e) => e.kind === 'buyer-agent' && e.key === 'acceptance').ensName;
const mirror = (...a) => ({ cmd: [node, join(root, 'acceptance/mirror.mjs'), ...a] });
let envValues = new Map();
installErrorBoundary(() => envValues);
envValues = loadEnv().values;
const LIVE = liveChecks(root, Object.fromEntries(envValues));
const RUNNERS = {
  ...Object.fromEntries(Object.entries(LIVE).map(([id, fn]) => [id, { fn, files: [id] }])),
  D2: { ...mirror('d2a'), files: ['D2a', 'D2b', 'D2c'], note: 'D2b and D2c run with the workers stopped, on a fresh payment (docs/sessions/integration/mirror.md)' },
  D3: { ...mirror('d3', '--ens', goodShop, '--ens', acceptancePayer), files: ['D3'] },
};

function selected(c) {
  if (c.friday && !args.friday) return false;
  if (!args.only) return true;
  return args.only.split(',').some((p) => c.id === p || c.id.startsWith(p) && /^[A-F]$/.test(p));
}

function readResult(file) {
  const p = join(root, 'docs', 'sessions', 'integration', 'acceptance', `${file}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
}

function statusOf(c) {
  const runner = RUNNERS[c.id];
  const files = runner?.files ?? [c.id];
  const results = files.map(readResult).filter(Boolean);
  if (MAY_BLOCK[c.id]) return { status: 'blocked', why: MAY_BLOCK[c.id], results };
  if (results.length === 0) return { status: 'not run', why: runner ? 'no result yet' : 'no runner yet', results };
  const allIn = results.length === files.length;
  const pass = allIn && results.every((r) => r.pass === true);
  const why = results.find((r) => r.pass === null)?.why ?? (allIn ? '' : `${files.length - results.length} of ${files.length} parts not run`);
  return { status: pass ? 'pass' : results.some((r) => r.pass === false) ? 'fail' : 'not run', why, results };
}

const checks = allChecks().filter(selected);

if (args['dry-run']) {
  for (const c of checks) {
    const r = RUNNERS[c.id];
    process.stdout.write(`${c.id.padEnd(4)} ${r ? 'run   ' : 'manual'} ${c.what.slice(0, 90)}${r?.note ? ` (${r.note})` : ''}\n`);
  }
  process.stdout.write(`${checks.length} checks; ${checks.filter((c) => RUNNERS[c.id]).length} with a runner here. Spend: the runners here only read, except D2b/D2c (two Rabdi writes, about 0.0006 tGLM).\n`);
  process.exit(0);
}

if (!args['report-only']) {
  for (const c of checks) {
    const r = RUNNERS[c.id];
    if (!r) continue;
    process.stdout.write(`${c.id}: running\n`);
    if (r.fn) {
      let body;
      try {
        body = await r.fn();
      } catch (err) {
        body = { pass: false, what: c.what, measured: { error: String(err.shortMessage ?? err.message).slice(0, 300) }, expected: 'the check runs', evidence: {} };
      }
      const res = { id: c.id, at: new Date().toISOString(), ...body };
      writeFileSync(join(root, 'docs', 'sessions', 'integration', 'acceptance', `${c.id}.json`), `${JSON.stringify(res, (_, x) => (typeof x === 'bigint' ? x.toString() : x), 2)}\n`);
      process.stdout.write(`${c.id}: ${res.pass === true ? 'pass' : res.pass === false ? 'FAIL' : 'not run'}\n`);
      continue;
    }
    const out = spawnSync(r.cmd[0], r.cmd.slice(1), { cwd: root, encoding: 'utf8', timeout: 15 * 60_000 });
    const line = (out.stdout ?? '').split('\n').find((l) => l.startsWith('result: '));
    process.stdout.write(`${c.id}: ${line ? (JSON.parse(line.slice(8)).pass ? 'pass' : 'FAIL') : `no result (exit ${out.status})`}\n`);
  }
}

// The report: the summary table first, then one section per check.
const rows = allChecks().filter((c) => !c.friday || args.friday).map((c) => ({ c, s: statusOf(c) }));
const count = (st) => rows.filter((r) => r.s.status === st).length;
const cell = (t) => String(t).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const lines = [
  '# Acceptance report',
  '',
  `Written by \`pnpm acceptance\` at ${new Date().toISOString()}. Checks and pass criteria: \`planning/ACCEPTANCE_TESTS.md\` and \`docs/plan/ACCEPTANCE_ADDITIONS.md\`. Only D7 may be \`blocked\` (C7 and E3 no longer wait on supply, ADR-0054); a check without a result is \`not run\`, never \`pass\`.`,
  '',
  `**${count('pass')} pass, ${count('fail')} fail, ${count('blocked')} blocked, ${count('not run')} not run** (of ${rows.length}).`,
  '',
  '| id | check | status | note |',
  '|---|---|---|---|',
  ...rows.map(({ c, s }) => `| ${c.id} | ${cell(c.what)} | ${s.status} | ${cell(s.why)} |`),
  '',
];
for (const { c, s } of rows) {
  if (s.results.length === 0) continue;
  lines.push(`## ${c.id}: ${c.what}`, '', `Status: **${s.status}**${s.why ? ` (${s.why})` : ''}.`, '');
  for (const r of s.results) {
    lines.push(`### ${r.id} (${r.at})`, '', `- What: ${r.what}`, `- Pass: ${r.pass}`, `- Expected: ${typeof r.expected === 'string' ? r.expected : `\`${JSON.stringify(r.expected)}\``}`, `- Evidence: \`${JSON.stringify(r.evidence)}\``, '', '```json', JSON.stringify(r.measured, null, 2), '```', '');
  }
}
writeFileSync(join(root, 'ACCEPTANCE_REPORT.md'), `${lines.join('\n')}\n`);
process.stdout.write(`ACCEPTANCE_REPORT.md: ${count('pass')} pass, ${count('fail')} fail, ${count('blocked')} blocked, ${count('not run')} not run\n`);
