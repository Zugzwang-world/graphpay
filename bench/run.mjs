// The live benchmark (planning/SPEC/BENCHMARK.md §3; M7 amendment §8: reads, not
// speed). Read-only: plain Arkiv against Graph Arkiv over the seeded city, through one
// metered connection. A warm-up, then 5 interleaved runs of Q1–Q6 both ways and 11
// interleaved rounds of Q2 (plain one page at a time, 4, 8, 16 and every page in
// flight; Graph Arkiv). Writes bench/results/*.csv and bench/BENCHMARK-LIVE.md.
//   node bench/run.mjs --size S --end <YYYY-MM-DD> [--runs 5] [--rounds 11] [--backend rabdi]
// Prints counts only: no answers, names, URLs or keys.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { story } from '../packages/config/index.mjs';
import { QUESTIONS, ask, connectArkiv, createGraphEngine, plainPayRows, score } from '../packages/money-graph/index.mjs';
import { benchParams, benchTruth, generateCity, truthOf } from '../packages/city/index.mjs';
import { loadEnv } from '../scripts/lib/env-loader.mjs';
import { installErrorBoundary } from '../scripts/lib/redact.mjs';
import { report } from './report.mjs';

const args = process.argv.slice(2);
const opt = (n, d = null) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const size = opt('size', 'S');
const end = opt('end');
const runs = Number(opt('runs', 5));
const rounds = Number(opt('rounds', 11));
if (!end) throw new Error('bench: --end YYYY-MM-DD (the seeded city\'s end date)');
if (size !== 'S') throw new Error('bench: only size S is seeded (ADR-0049); M waits for the locked story');

let secrets = new Map();
installErrorBoundary(() => secrets);
({ values: secrets } = loadEnv());
const env = Object.fromEntries(secrets);

const root = new URL('..', import.meta.url);
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const commit = `${git('rev-parse', '--short', 'HEAD')}${git('status', '--porcelain', '--', 'packages', 'bench') ? '-dirty' : ''}`;

// The HTTP log: status, time and the ratelimit header of every response, never the URL.
let phase = 'setup';
const http = [];
const arkiv = await connectArkiv({ backend: opt('backend', 'rabdi'), env, log: (e) => e.method && http.push({ phase, method: e.method, status: e.status, ms: e.ms, ratelimit: e.ratelimit }) });
const engine = createGraphEngine(arkiv);
const city = generateCity({ story, size, end });
const params = benchParams(city);
const truth = benchTruth(city, truthOf(city), params);
const R = await plainPayRows(arkiv, { size });
const blockFrom = await arkiv.publicClient.getBlockNumber();
console.log(JSON.stringify({ size, backend: arkiv.backend, commit, payRows: R, truthPayRows: truth.payRows }));
if (R !== truth.payRows) throw new Error(`bench: the plain store holds ${R} payment and renewal rows, the generator ${truth.payRows}`);

const one = (question, mode, inFlight = 1) => ask(arkiv, { question, mode, params, size, inFlight, engine });
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

// Warm-up: every question both ways once, untimed (a cold Rabdi call takes about 1 s).
phase = 'warmup';
for (const q of QUESTIONS) for (const mode of ['plain', 'graph']) await one(q, mode);
await one('Q2', 'plain', 'all');

// Q1–Q6: 5 runs, interleaved; the order of the two modes alternates per run.
phase = 'questions';
const results = new Map();
for (let r = 0; r < runs; r += 1) {
  for (const q of QUESTIONS) {
    for (const mode of r % 2 ? ['graph', 'plain'] : ['plain', 'graph']) {
      const res = await one(q, mode);
      const k = `${q}|${mode}`;
      if (!results.has(k)) results.set(k, []);
      results.get(k).push({ ...res, ...score(q, mode, res.answer, truth) });
    }
  }
}

// Q2 at its fastest: 11 rounds, the modes rotating so drift hits each alike.
phase = 'q2';
const MODES = [['plain', 1], ['plain', 4], ['plain', 8], ['plain', 16], ['plain', 'all'], ['graph', 1]];
const q2 = new Map(MODES.map(([m, f]) => [`${m}|${f}`, { mode: m, inFlight: f, runs: [], http: [] }]));
for (let r = 0; r < rounds; r += 1) {
  for (let i = 0; i < MODES.length; i += 1) {
    const [mode, inFlight] = MODES[(i + r) % MODES.length];
    const from = http.length;
    const res = await one('Q2', mode, inFlight);
    const slot = q2.get(`${mode}|${inFlight}`);
    slot.runs.push({ ...res, ...score('Q2', mode, res.answer, truth) });
    slot.http.push(...http.slice(from));
  }
}
const blockTo = await arkiv.publicClient.getBlockNumber();

// ---- CSVs ------------------------------------------------------------------------------

const dir = new URL('./results/', import.meta.url);
mkdirSync(dir, { recursive: true });
const header = `# SYNTHETIC data: dataset ${city.dataset} (size ${size}), Arkiv ${arkiv.backend}, blocks ${blockFrom}-${blockTo}, commit ${commit}, ${new Date().toISOString()}`;
const cell = (v) => (v === null || v === undefined ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const csv = (name, columns, rows) => writeFileSync(new URL(name, dir), `${[header, columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n')}\n`);
const same = (xs) => xs.every((x) => x === xs[0]);
const all = (rs, k) => rs.every((x) => x[k] === true);

const questionRows = [];
for (const q of QUESTIONS) {
  for (const mode of ['plain', 'graph']) {
    const rs = results.get(`${q}|${mode}`);
    const calls = rs.map((x) => x.calls);
    questionRows.push({
      question: q,
      mode,
      calls: same(calls) ? calls[0] : calls.join('/'),
      queries: rs[0].queries,
      bytes: median(rs.map((x) => x.bytes)),
      median_ms: median(rs.map((x) => x.ms)),
      min_ms: Math.min(...rs.map((x) => x.ms)),
      max_ms: Math.max(...rs.map((x) => x.ms)),
      runs: rs.length,
      correct: all(rs, 'correct'),
      truth_basis: rs[0].truthBasis,
      matches_identity_truth: all(rs, 'matchesIdentityTruth'),
      commit,
      backend: arkiv.backend,
      block_from: String(blockFrom),
      block_to: String(blockTo),
    });
  }
}
csv(`questions-${size}.csv`, ['question', 'mode', 'calls', 'queries', 'bytes', 'median_ms', 'min_ms', 'max_ms', 'runs', 'correct', 'truth_basis', 'matches_identity_truth', 'commit', 'backend', 'block_from', 'block_to'], questionRows);

const parallelRows = [...q2.values()].map((s) => {
  const calls = s.runs.map((x) => x.calls);
  const remaining = s.http.map((h) => h.ratelimit?.remaining).filter((x) => Number.isInteger(x));
  return {
    mode: s.mode,
    in_flight: s.mode === 'graph' ? '' : s.inFlight,
    calls: same(calls) ? calls[0] : calls.join('/'),
    bytes: median(s.runs.map((x) => x.bytes)),
    median_ms: median(s.runs.map((x) => x.ms)),
    runs: s.runs.length,
    correct: all(s.runs, 'correct'),
    http_requests: s.http.length,
    non_200: s.http.filter((h) => h.status !== 200).length,
    n_429: s.http.filter((h) => h.status === 429).length,
    lowest_remaining: remaining.length ? Math.min(...remaining) : '',
  };
});
csv(`q2-parallel-${size}.csv`, ['mode', 'in_flight', 'calls', 'bytes', 'median_ms', 'runs', 'correct', 'http_requests', 'non_200', 'n_429', 'lowest_remaining'], parallelRows);

// Writes from the seeding manifests (a store seeded in two runs adds both).
const manifests = new URL('../docs/sessions/arkiv/city/', import.meta.url);
const writeRows = ['graph', 'plain', 'directory'].map((store) => {
  const files = [`seed-${size}-${store}-run1.json`, `seed-${size}-${store}.json`].filter((f) => existsSync(new URL(f, manifests)));
  const ms = files.map((f) => JSON.parse(readFileSync(new URL(f, manifests), 'utf8')));
  const add = (k) => ms.reduce((a, m) => a + Number(m[k] ?? 0), 0);
  return { store, transactions: add('transactions'), creates: add('creates'), patches: add('patches'), gas: ms.reduce((a, m) => a + BigInt(m.gas ?? 0), 0n).toString(), tglm: add('tglm').toFixed(6), minutes: add('minutes').toFixed(1) };
});
csv(`writes-${size}.csv`, ['store', 'transactions', 'creates', 'patches', 'gas', 'tglm', 'minutes'], writeRows);

csv(
  `http-${size}.csv`,
  ['seq', 'phase', 'method', 'status', 'ms', 'limit', 'remaining', 'reset'],
  http.map((h, i) => ({ seq: i + 1, phase: h.phase, method: h.method, status: h.status, ms: h.ms, limit: h.ratelimit?.limit, remaining: h.ratelimit?.remaining, reset: h.ratelimit?.reset })),
);

const summary = {
  size,
  dataset: city.dataset,
  backend: arkiv.backend,
  commit,
  blockFrom: String(blockFrom),
  blockTo: String(blockTo),
  payRows: R,
  q4Empty: truth.Q4.identity.length === 0,
  date: new Date().toISOString(),
  http: { responses: http.length, non200: http.filter((h) => h.status !== 200).length, n429: http.filter((h) => h.status === 429).length, lowestRemaining: Math.min(...http.map((h) => h.ratelimit?.remaining).filter(Number.isInteger)) },
};
writeFileSync(new URL('../BENCHMARK-LIVE.md', dir), report({ summary, questionRows, parallelRows, writeRows }));
console.log(JSON.stringify({ ...summary, questions: questionRows.map((r) => `${r.question} ${r.mode} ${r.calls} calls ${r.correct ? 'correct' : 'WRONG'}`), q2: parallelRows.map((r) => `${r.mode}${r.in_flight ? `@${r.in_flight}` : ''} ${r.calls} calls`) }, null, 2));
