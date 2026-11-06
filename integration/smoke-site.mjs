// node integration/smoke-site.mjs     (the live runner's smoke test on the production domain)
// One errand through the site's own POST /api/agents/run (config site.url, the passcode from
// .env, no redirect followed), on the runner's live preset: the story's request, streamed back
// as server-sent events until its result. It may pay (the payer agent, within its policy cap).
// Writes docs/sessions/integration/hosted/site-<time>.json: the run id, seconds, the event
// counts, the result's status, shop and receipt. The API cost is in the server's log line.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, story } from '@graphpay/config';
import { PASSCODE_HEADER } from '@graphpay/shop';
import { loadEnv } from '../scripts/lib/env-loader.mjs';
import { installErrorBoundary, redactor } from '../scripts/lib/redact.mjs';

const here = dirname(fileURLToPath(import.meta.url));
let values = new Map();
installErrorBoundary(() => values);
values = loadEnv().values;
const env = { ...Object.fromEntries(values), ...process.env };
const redact = redactor(values);
const say = (l) => process.stdout.write(`${new Date().toISOString().slice(11, 19)} ${redact(l)}\n`);
if (!env.DEMO_PASSCODE) throw new Error('DEMO_PASSCODE is not in .env');

const SITE = String(config.site.url).replace(/\/+$/, '');
const out = { site: SITE, startedAt: new Date().toISOString(), request: story.order.request, events: {}, frames: 0 };
const t0 = Date.now();
const res = await fetch(`${SITE}/api/agents/run`, { method: 'POST', redirect: 'error', headers: { 'content-type': 'application/json', [PASSCODE_HEADER]: env.DEMO_PASSCODE }, body: JSON.stringify({ request: story.order.request }) });
out.status = res.status;
if (res.status !== 200) {
  out.body = await res.json().catch(() => null);
  say(`run route answered ${res.status}: ${JSON.stringify(out.body)}`);
} else {
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
      out.frames += 1;
      const d = JSON.parse(data);
      if (event === 'started') {
        out.runId = d.runId;
        say(`started ${d.runId}`);
      } else if (event === 'trace') {
        out.events[d.type] = (out.events[d.type] ?? 0) + 1;
        if (d.type === 'guard') say(`guard ${d.guard} ${d.ok ? 'ok' : 'REFUSED'}: ${String(d.detail).slice(0, 140)}`);
      } else if (event === 'result') {
        out.result = { status: d.status, chosenShop: d.chosenShop, priceUsdt: d.priceUsdt, orderId: d.orderId, receipt: d.receipt ? { transaction: d.receipt.transaction, explorerUrl: d.receipt.explorerUrl, amountUsdt: d.receipt.amountUsdt } : null, refusals: d.refusals, error: d.error ?? null };
        say(`result: ${d.status}, ${d.chosenShop ?? 'no shop'}, ${d.receipt?.explorerUrl ?? 'no receipt'}`);
      } else if (event === 'failed') {
        out.failed = d.error;
        say(`failed: ${d.error}`);
      }
    }
  }
}
out.seconds = Math.round((Date.now() - t0) / 100) / 10;
out.endedAt = new Date().toISOString();
const dir = join(here, '..', 'docs', 'sessions', 'integration', 'hosted');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, `site-${out.startedAt.replace(/[:.]/g, '-')}.json`), `${redact(JSON.stringify(out, null, 2))}\n`);
say(`${out.seconds} s, ${out.frames} frames, events ${JSON.stringify(out.events)}`);
