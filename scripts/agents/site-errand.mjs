// node scripts/agents/site-errand.mjs [--request TEXT] [--frames FILE]
// One live errand through the production site's own POST /api/agents/run (config site.url, no
// redirect followed), on the site's live preset, as a visitor: public access (ADR-0069), so no
// passcode or key is sent or read. It may pay (the payer agent, within its daily pass).
// Prints the result and the tokens and seconds per agent and per model call, read from the
// agents' end events (W4: before-and-after numbers), and writes that summary to
// docs/sessions/w4-agents/runs/<time>-<status>.json; --frames also keeps every frame with its
// arrival time (outside the repo, for a closer look).

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { usageOf, usageTable } from '../../packages/agents/index.mjs';
import { config, story } from '../../packages/config/index.mjs';

const USAGE = 'usage: node scripts/agents/site-errand.mjs [--request TEXT] [--frames FILE]';

export function parseSiteArgs(argv) {
  const out = { request: story.order.request, frames: null };
  for (let i = 0; i < argv.length; i += 2) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (value === undefined) throw new Error(USAGE);
    if (flag === '--request' && value.trim() !== '' && value.length <= 400) out.request = value;
    else if (flag === '--frames' && !value.startsWith('-')) out.frames = value;
    else throw new Error(USAGE);
  }
  return out;
}

// The server-sent frames of one errand, each with its arrival time in seconds from the POST.
export async function readErrand(res, t0, onFrame = () => {}) {
  const frames = [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const event = frame.match(/^event: (.+)$/m)?.[1];
      const data = frame.match(/^data: (.+)$/m)?.[1];
      if (!event || !data) continue;
      const f = { at: Math.round((performance.now() - t0) / 100) / 10, event, data: JSON.parse(data) };
      frames.push(f);
      onFrame(f);
    }
  }
  return frames;
}

export function summarize(frames, { request, startedAt, seconds }) {
  const trace = frames.filter((f) => f.event === 'trace').map((f) => f.data);
  const result = frames.find((f) => f.event === 'result')?.data ?? null;
  const failed = frames.find((f) => f.event === 'failed')?.data ?? null;
  const usage = usageOf(trace);
  // When each agent started and ended, as the stream saw it (the errand's critical path).
  const timeline = frames
    .filter((f) => f.event === 'trace' && (f.data.type === 'agent.start' || f.data.type === 'agent.end'))
    .map((f) => ({ at: f.at, type: f.data.type, role: f.data.role }));
  return {
    site: config.site.url,
    runId: frames.find((f) => f.event === 'started')?.data?.runId ?? null,
    startedAt,
    request,
    seconds,
    result: result && {
      status: result.status,
      chosenShop: result.chosenShop,
      priceUsdt: result.priceUsdt,
      orderId: result.orderId,
      transaction: result.receipt?.transaction ?? null,
      explorerUrl: result.receipt?.explorerUrl ?? null,
      refusals: result.refusals,
      deadlineIso: result.mandate?.deadlineIso ?? null,
      error: result.error ?? null,
    },
    failed: failed?.error ?? null,
    events: trace.length,
    usage,
    timeline,
    synthetic: true,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = parseSiteArgs(process.argv.slice(2));
  const site = String(config.site.url).replace(/\/+$/, '');
  const say = (line) => process.stdout.write(`${new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' })} ${line}\n`);
  const startedAt = new Date().toISOString();
  const t0 = performance.now();
  const res = await fetch(`${site}/api/agents/run`, { method: 'POST', redirect: 'error', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ request: args.request }) });
  if (res.status !== 200) {
    say(`the run route answered ${res.status}: ${JSON.stringify(await res.json().catch(() => null))}`);
    process.exit(1);
  }
  const frames = await readErrand(res, t0, (f) => {
    if (f.event === 'started') say(`started ${f.data.runId}`);
    else if (f.event === 'trace' && f.data.type === 'agent.end') say(`${f.at} s  ${f.data.role} reported${f.data.error ? `: ${String(f.data.error).slice(0, 160)}` : ''}`);
    else if (f.event === 'trace' && f.data.type === 'guard' && !f.data.ok) say(`${f.at} s  guard ${f.data.guard} refused: ${String(f.data.detail).slice(0, 160)}`);
    else if (f.event === 'result') say(`${f.at} s  result ${f.data.status}, ${f.data.chosenShop ?? 'no shop'}, ${f.data.receipt?.explorerUrl ?? 'no receipt'}`);
    else if (f.event === 'failed') say(`${f.at} s  failed: ${f.data.error}`);
  });
  const seconds = Math.round((performance.now() - t0) / 100) / 10;
  const summary = summarize(frames, { request: args.request, startedAt, seconds });
  process.stdout.write(`\n${usageTable(summary.usage)}\n\n${seconds} s on the stream; $${summary.usage.total.usd.toFixed(4)} by the agents' own call costs\n`);
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'sessions', 'w4-agents', 'runs');
  mkdirSync(dir, { recursive: true });
  const name = `${startedAt.replace(/[:.]/g, '-')}-${summary.result?.status ?? 'failed'}.json`;
  writeFileSync(join(dir, name), `${JSON.stringify(summary, null, 2)}\n`);
  if (args.frames) writeFileSync(args.frames, `${JSON.stringify(frames)}\n`);
  say(`summary: docs/sessions/w4-agents/runs/${name}`);
}
