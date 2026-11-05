// pnpm agents:errand [--runs N] [--buyer KEY] [--out DIR]
// Runs the story's errand on the mock services (planning/PROMPTS/10-agents.md
// step 6). AGENT_MODE picks the models: mock (the default; no key is read and
// nothing is paid for), anthropic (the story config's active preset, or
// AGENT_PRESET), or auto. An unknown AGENT_MODE is refused before anything runs.
// Prints one row per errand for the preset calibration table in
// docs/thinking-partner/OPEN.md (seconds and API cost, ADR-0048) and writes each
// run log to --out when given. The key is loaded from .env, never printed, and
// every error is redacted.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveAgentMode, runErrand } from '../../packages/agents/index.mjs';
import { createMockWorld } from '../../packages/agents/mocks/index.mjs';
import { loadEnv } from '../lib/env-loader.mjs';
import { installErrorBoundary, redactor } from '../lib/redact.mjs';

const USAGE = 'usage: pnpm agents:errand [--runs N] [--buyer KEY] [--out DIR]';

export function parseErrandArgs(argv) {
  const out = { runs: 1, buyer: undefined, outDir: undefined };
  for (let i = 0; i < argv.length; i += 2) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (value === undefined) throw new Error(USAGE);
    if (flag === '--runs' && /^[1-9]$|^10$/.test(value)) out.runs = Number(value);
    else if (flag === '--buyer' && /^[a-z][a-z0-9-]{0,31}$/.test(value)) out.buyer = value;
    else if (flag === '--out' && !value.startsWith('-')) out.outDir = value;
    else throw new Error(USAGE);
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  let values = new Map();
  installErrorBoundary(() => values);
  const args = parseErrandArgs(process.argv.slice(2));
  const raw = process.env.AGENT_MODE ?? '';
  resolveAgentMode({ AGENT_MODE: raw }); // a typo throws here, before any file is read
  const env = { ...process.env };
  if (raw === 'anthropic' || raw === 'auto') {
    try {
      ({ values } = loadEnv());
      if (values.get('ANTHROPIC_API_KEY')) env.ANTHROPIC_API_KEY = values.get('ANTHROPIC_API_KEY');
    } catch (error) {
      if (raw === 'anthropic') throw error;
    }
  }
  const mode = resolveAgentMode({ AGENT_MODE: raw, ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY });
  if (mode === 'anthropic' && !env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set in .env');
  const redact = redactor(values);
  const ist = () => new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  const rows = [];
  let model = '-';
  for (let n = 1; n <= args.runs; n += 1) {
    const world = createMockWorld();
    const started = ist();
    const { runLog, metrics } = await runErrand({
      mode,
      env,
      buyer: args.buyer,
      hooks: world.hooks,
      mcp: world.mcp,
      mockModels: world.mockModels,
      label: `${world.cast.key} story errand on mock services (SYNTHETIC)`,
    });
    const r = runLog.result;
    model = runLog.model;
    const roleOf = (ens) => world.cast.shopByEns(ens)?.storyRole ?? (ens ? 'not in the cast' : 'none');
    const ended = runLog.events.filter((e) => e.type === 'agent.end');
    const noAnswer = ended.filter((e) => e.error).map((e) => `${e.role}: ${e.error}`);
    rows.push({
      started,
      n,
      status: r.status,
      chosen: roleOf(r.chosenShop),
      modelChoice: roleOf(r.modelChoice),
      refusals: r.refusals.map((x) => x.reason).join(', ') || '-',
      seconds: metrics.seconds.toFixed(1),
      calls: metrics.calls,
      tokens: metrics.tokens,
      cost: metrics.apiCostUsd.toFixed(4),
      noAnswer: noAnswer.length ? redact(noAnswer.join('; ')).slice(0, 200) : '-',
    });
    if (args.outDir) {
      mkdirSync(args.outDir, { recursive: true });
      const file = join(args.outDir, `${runLog.runId}.json`);
      writeFileSync(file, `${redact(JSON.stringify(runLog, null, 2))}\n`);
    }
    console.log(`run ${n}/${args.runs}: ${r.status}, chose the ${roleOf(r.chosenShop)} shop, ${metrics.seconds.toFixed(1)} s, ${metrics.tokens} tokens, $${metrics.apiCostUsd.toFixed(4)}`);
  }
  console.log(`\nmode ${mode}; ${model}`);
  const columns = ['started', 'n', 'status', 'chosen', 'modelChoice', 'refusals', 'seconds', 'calls', 'tokens', 'cost', 'noAnswer'];
  console.log(`| ${columns.join(' | ')} |`);
  console.log(`|${columns.map(() => '---').join('|')}|`);
  for (const row of rows) console.log(`| ${columns.map((c) => row[c]).join(' | ')} |`);
}
