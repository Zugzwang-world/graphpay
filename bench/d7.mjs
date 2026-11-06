// Acceptance D7 (planning/ACCEPTANCE_TESTS.md; docs/plan/ACCEPTANCE_ADDITIONS.md: calls exact,
// times recorded and not scored, ADR-0042): the live benchmark at size M, read-only. Sized for
// Arkiv's keyless query window (docs/technical/FACTS.md: about 10,000 a window, shared by every
// process on this machine, the mirror included): race mode's questions (Q1, Q2, Q5) once each
// way, Q2's plain side one page at a time and every page at once, and a pause whenever the window
// is under 40%. Writes bench/results/{questions,q2-parallel,http}-<size>.csv and
// bench/BENCHMARK-LIVE-<size>.md. Prints counts only: no answers, names, URLs or keys.
//   node bench/d7.mjs --size M --end 2026-11-06

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { story } from '../packages/config/index.mjs';
import { RACE_QUESTIONS, ask, connectArkiv, createGraphEngine, plainPayRows, score } from '../packages/money-graph/index.mjs';
import { benchParams, benchTruth, generateCity, truthOf } from '../packages/city/index.mjs';
import { loadEnv } from '../scripts/lib/env-loader.mjs';
import { installErrorBoundary } from '../scripts/lib/redact.mjs';

const args = process.argv.slice(2);
const opt = (n, d = null) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const size = opt('size', 'M');
const end = opt('end');
if (!end) throw new Error('d7: --end YYYY-MM-DD (the seeded city\'s end date)');
if (!story.syntheticCity.sizes[size]?.cast) throw new Error(`d7: size ${size} has no pinned cast (ADR-0077)`);

let secrets = new Map();
installErrorBoundary(() => secrets);
({ values: secrets } = loadEnv());
const env = Object.fromEntries(secrets);

const root = new URL('..', import.meta.url);
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const commit = `${git('rev-parse', '--short', 'HEAD')}${git('status', '--porcelain', '--', 'packages', 'bench') ? '-dirty' : ''}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (line) => console.log(`${new Date().toISOString().slice(11, 19)}Z ${line}`);

// The HTTP log: phase, status, time and the ratelimit header of every response, never the URL.
// The header shows whichever window is tighter, so the query window appears once it runs low.
let phase = 'setup';
const http = [];
const window = { remaining: null, limit: null, resetAt: 0 };
const arkiv = await connectArkiv({
  backend: opt('backend', 'rabdi'),
  env,
  log: (e) => {
    if (!e.method) return;
    http.push({ phase, method: e.method, status: e.status, ms: e.ms, ratelimit: e.ratelimit });
    if (e.method === 'arkiv_query' && e.ratelimit) Object.assign(window, { remaining: e.ratelimit.remaining, limit: e.ratelimit.limit, resetAt: Date.now() + e.ratelimit.reset * 1000 });
  },
});
async function roomToRead() {
  if (window.limit === null || window.remaining >= window.limit * 0.4 || Date.now() >= window.resetAt) return;
  log(`pausing ${Math.ceil((window.resetAt - Date.now()) / 1000)} s: ${window.remaining} of ${window.limit} left in the query window`);
  await sleep(window.resetAt - Date.now() + 2_000);
}

const engine = createGraphEngine(arkiv);
const city = generateCity({ story, size, end });
const params = benchParams(city);
const truth = benchTruth(city, truthOf(city), params);
const R = await plainPayRows(arkiv, { size });
const blockFrom = await arkiv.publicClient.getBlockNumber();
log(`size ${size}: ${R} payment and renewal rows on Arkiv, ${truth.payRows} in the generator; commit ${commit}`);
if (R !== truth.payRows) throw new Error(`d7: the plain store holds ${R} payment and renewal rows, the generator ${truth.payRows}`);

// Each ask once, with a pause between asks so the window refills; a failed read is retried once.
async function one(question, mode, inFlight = 1) {
  for (let attempt = 1; ; attempt += 1) {
    await roomToRead();
    phase = `${question}-${mode}-${inFlight}`;
    try {
      const res = await ask(arkiv, { question, mode, params, size, inFlight, engine: mode === 'graph' ? createGraphEngine(arkiv) : engine });
      const s = score(question, mode, res.answer, truth);
      log(`${question} ${mode}${mode === 'plain' ? ` (${inFlight} in flight)` : ''}: ${res.calls} reads, ${(res.bytes / 1024).toFixed(1)} KB, ${s.correct ? 'right' : 'WRONG'} by ${s.truthBasis}`);
      await sleep(15_000);
      return { ...res, ...s };
    } catch (error) {
      if (attempt >= 2) throw error;
      log(`${question} ${mode}: ${error.shortMessage ?? error.message}; once more after the window`);
      window.resetAt = Math.max(window.resetAt, Date.now() + 60_000);
      window.remaining = 0;
    }
  }
}

const results = new Map();
for (const q of RACE_QUESTIONS) for (const mode of ['graph', 'plain']) results.set(`${q}|${mode}`, await one(q, mode));
const parallel = await one('Q2', 'plain', 'all');
const blockTo = await arkiv.publicClient.getBlockNumber();

// ---- CSVs (the same columns as bench/run.mjs) ------------------------------------------

const dir = new URL('./results/', import.meta.url);
mkdirSync(dir, { recursive: true });
const header = `# SYNTHETIC data: dataset ${city.dataset} (size ${size}), Arkiv ${arkiv.backend}, blocks ${blockFrom}-${blockTo}, commit ${commit}, ${new Date().toISOString()}; acceptance D7: race mode's questions once each way (bench/d7.mjs)`;
const cell = (v) => (v === null || v === undefined ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const csv = (name, columns, rows) => writeFileSync(new URL(name, dir), `${[header, columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n')}\n`);
const questionRows = [];
for (const q of RACE_QUESTIONS) {
  for (const mode of ['plain', 'graph']) {
    const r = results.get(`${q}|${mode}`);
    questionRows.push({ question: q, mode, calls: r.calls, queries: r.queries, bytes: r.bytes, median_ms: r.ms, min_ms: r.ms, max_ms: r.ms, runs: 1, correct: r.correct, truth_basis: r.truthBasis, matches_identity_truth: r.matchesIdentityTruth, commit, backend: arkiv.backend, block_from: String(blockFrom), block_to: String(blockTo) });
  }
}
csv(`questions-${size}.csv`, ['question', 'mode', 'calls', 'queries', 'bytes', 'median_ms', 'min_ms', 'max_ms', 'runs', 'correct', 'truth_basis', 'matches_identity_truth', 'commit', 'backend', 'block_from', 'block_to'], questionRows);
const q2 = (mode) => results.get(`Q2|${mode}`);
const parallelRows = [
  { mode: 'plain', in_flight: 1, calls: q2('plain').calls, bytes: q2('plain').bytes, median_ms: q2('plain').ms, runs: 1, correct: q2('plain').correct },
  { mode: 'plain', in_flight: 'all', calls: parallel.calls, bytes: parallel.bytes, median_ms: parallel.ms, runs: 1, correct: parallel.correct },
  { mode: 'graph', in_flight: '', calls: q2('graph').calls, bytes: q2('graph').bytes, median_ms: q2('graph').ms, runs: 1, correct: q2('graph').correct },
];
csv(`q2-parallel-${size}.csv`, ['mode', 'in_flight', 'calls', 'bytes', 'median_ms', 'runs', 'correct'], parallelRows);
csv(
  `http-${size}.csv`,
  ['seq', 'phase', 'method', 'status', 'ms', 'limit', 'remaining', 'reset'],
  http.map((h, i) => ({ seq: i + 1, phase: h.phase, method: h.method, status: h.status, ms: h.ms, limit: h.ratelimit?.limit, remaining: h.ratelimit?.remaining, reset: h.ratelimit?.reset })),
);

// ---- the report ------------------------------------------------------------------------

const pages = Math.ceil(R / 100);
const checks = [
  ['Graph Arkiv Q2 reads', '2', q2('graph').calls, q2('graph').calls === 2],
  [`plain Q2, one page at a time: ceil(R / 100), R = ${R}`, String(pages), q2('plain').calls, q2('plain').calls === pages],
  ['plain Q2, every page at once: that + 1 (the count())', String(pages + 1), parallel.calls, parallel.calls === pages + 1],
  ['Graph Arkiv correct (by identity)', 'yes', q2('graph').correct ? 'yes' : 'no', q2('graph').correct === true],
  ['plain correct (by name)', 'yes', q2('plain').correct && parallel.correct ? 'yes' : 'no', q2('plain').correct === true && parallel.correct === true],
];
const pass = checks.every((c) => c[3]);
const s = (ms) => `${(ms / 1000).toFixed(1)} s`;
const kb = (b) => `${(b / 1024).toFixed(1)} KB`;
const table = (cols, rows) => [`| ${cols.join(' | ')} |`, `|${cols.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const nonOk = http.filter((h) => h.status !== 200).length;
writeFileSync(
  new URL(`../BENCHMARK-LIVE-${size}.md`, dir),
  `# Live benchmark at size ${size}: plain Arkiv against Graph Arkiv (acceptance D7)

**SYNTHETIC DATA.** Dataset \`${city.dataset}\` (size ${size}: ${city.shops.length} shops, ${city.actors.size} actors, ${city.events.length.toLocaleString('en-US')} events), live on Arkiv's ${arkiv.backend} testnet, blocks ${blockFrom} to ${blockTo}, commit \`${commit}\`, run ${new Date().toISOString()}. Generated by \`node bench/d7.mjs --size ${size} --end ${end}\` from the CSVs in \`bench/results/\`.

## In plain words

To rank the city's shops by sales, plain Arkiv code must read every payment and renewal row (${R.toLocaleString('en-US')} of them here) and add them up itself. **Graph Arkiv answers the city-wide top 10 in ${q2('graph').calls} reads against plain's ${q2('plain').calls}** one page at a time (${parallel.calls} with every page at once), and moves ${kb(q2('graph').bytes)} against ${kb(q2('plain').bytes)}. Both are right: Graph Arkiv by identity, plain by name.

A line that is safe to quote: *"On Arkiv's live testnet, with a synthetic city of ${R.toLocaleString('en-US')} payment and renewal rows, the city-wide top 10 takes Graph Arkiv ${q2('graph').calls} reads. Plain Arkiv code must read every row: ${q2('plain').calls} reads one page at a time, ${parallel.calls} with every page requested at once."*

## Acceptance D7 (as amended: calls exact, times recorded but not scored)

${table(['check', 'expected', 'measured', 'result'], checks.map((c) => [c[0], c[1], c[2], c[3] ? 'pass' : 'fail']))}

**D7: ${pass ? 'pass' : 'fail'}.**

## Race mode's three questions, once each way

${table(['Q', 'plain reads', 'plain KB', 'plain time', 'Graph Arkiv reads', 'Graph Arkiv KB', 'Graph Arkiv time', 'plain right by name', 'Graph Arkiv right'], RACE_QUESTIONS.map((q) => {
    const p = results.get(`${q}|plain`);
    const g = results.get(`${q}|graph`);
    return [q, p.calls, kb(p.bytes), s(p.ms), g.calls, kb(g.bytes), s(g.ms), p.correct ? 'yes' : 'no', g.correct ? 'yes' : 'no'];
  }))}

The times were measured once each, on this machine, through Arkiv's keyless endpoint with pauses for its query window; they are not the result (ADR-0042). Reads are.

## Caveats

- Synthetic data, labelled on every row; one run each way, not five, so that the run fits Arkiv's keyless query window (about 10,000 a window, shared with the mirror on the same machine; \`docs/technical/FACTS.md\`). The size S benchmark (\`bench/BENCHMARK-LIVE.md\`) ran every question five times.
- HTTP: ${http.length} responses logged, ${nonOk} not 200 (\`bench/results/http-${size}.csv\`: phase, status, time and the \`ratelimit\` header, never the URL).
- Plain code is best effort, written by hand: \`count()\` wherever a count answers, OR batches inside the 64-leaf budget, projections, a two-ended path search.
`,
);
log(`D7 ${pass ? 'pass' : 'fail'}: Graph Arkiv ${q2('graph').calls} reads, plain ${q2('plain').calls} one page at a time and ${parallel.calls} every page at once (R = ${R}); ${http.length} responses, ${nonOk} not 200`);
