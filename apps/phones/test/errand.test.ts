import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { castEntries, config, story as ourStory } from '../../../packages/config/index.mjs';
import { projectStory } from '../story-projection.mjs';
import { ErrandMapper, readFrames, refusalOf } from '../src/errand.ts';

const story = projectStory(ourStory);
const txLink = (tx: string) => ({ label: 'tx', url: `https://explorer.example/tx/${tx}` });
// A real paid errand recorded on Nov 5 (the runner's own trace, docs/sessions/integration/runs).
const run = JSON.parse(readFileSync(new URL('../../../docs/sessions/integration/runs/run-a8d00695846884f3/run.json', import.meta.url), 'utf8')).agents;

function replay(events: unknown[], result: unknown) {
  const m = new ErrandMapper(story, txLink);
  const out = [...m.map('started', JSON.stringify({ runId: 'run-1' }))];
  for (const e of events) out.push(...m.map('trace', JSON.stringify(e)));
  out.push(...m.map('result', JSON.stringify(result)), ...m.end());
  return out;
}

test('a recorded paid errand: shops compared with the trap rejected, a quote, signed, settled with its transaction', () => {
  const out = replay(run.events, run.result);
  const types = out.map((e) => e.type);
  const compared = out.find((e) => e.type === 'shops.compared');
  assert.ok(compared && compared.type === 'shops.compared');
  const trap = castEntries(ourStory, config.root.ens).find((e) => e.kind === 'shop' && e.storyRole === 'trap')!.ensName;
  assert.equal(compared.choices.find((c) => c.shop.ens === trap)?.verdict, 'rejected');
  assert.match(compared.choices.find((c) => c.shop.ens === trap)?.reason ?? '', /refund rate/);
  assert.equal(compared.choices.filter((c) => c.verdict === 'chosen').length, 1);
  const quote = out.find((e) => e.type === 'quote.created');
  assert.ok(quote && quote.type === 'quote.created');
  assert.ok(types.indexOf('quote.created') < types.indexOf('payment.signed'));
  assert.ok(types.indexOf('payment.signed') < types.indexOf('payment.settled'));
  const settled = out.filter((e) => e.type === 'payment.settled');
  assert.equal(settled.length, 1, 'settled once, from the tool and never again from the result');
  assert.equal(settled[0]?.type === 'payment.settled' && settled[0].links[0]?.url, `https://explorer.example/tx/${run.result.receipt.transaction}`);
  assert.equal(settled[0]?.type === 'payment.settled' && settled[0].total.amount, '4.80');
  assert.ok(!types.includes('error'), 'no error after a paid result');
  assert.ok(out.some((e) => e.type === 'agent.status' && e.status === 'thinking'));
});

test('a refused errand ends with the refusal; a failed one with a retryable error; a cut stream says so', () => {
  const m = new ErrandMapper(story, txLink);
  m.map('started', JSON.stringify({ runId: 'r' }));
  const refused = m.map('result', JSON.stringify({ status: 'refused', refusals: [{ reason: 'SIGN_FAILED', detail: 'refused: CAP_EXCEEDED (cap 6, spent 6)' }], narrative: null }));
  assert.equal(refused.at(-1)?.type === 'payment.refused' && refused.at(-1)?.reason, 'cap');
  assert.deepEqual(m.end(), []);
  const f = new ErrandMapper(story, txLink);
  assert.equal(f.map('failed', JSON.stringify({ error: 'the errand ran out of time' }))[0]?.type, 'error');
  const cut = new ErrandMapper(story, txLink);
  const dropped = cut.end()[0];
  assert.equal(dropped?.type, 'error');
  // a dropped stream never offers a second errand: the run may have paid
  assert.equal(dropped?.type === 'error' && dropped.retry, undefined);
  const back = new ErrandMapper(story, txLink);
  back.map('started', JSON.stringify({ runId: 'r2' }));
  assert.equal(back.runId, 'r2');
  assert.equal(back.finished, false);
  const paid = back.recovered('0xabc', { amount: '4.80', currency: 'USDT' }, '0xdef');
  assert.equal(paid.at(-1)?.type, 'payment.settled');
  assert.equal(back.finished, true);
  assert.deepEqual(back.end(), []);
  assert.equal(refusalOf('ENS_PAUSED: the agent is paused'), 'paused');
  assert.equal(refusalOf('something else'), null);
});

test('frames are read across chunk boundaries, comments skipped', async () => {
  const enc = new TextEncoder();
  const chunks = ['event: started\ndata: {"runId":"a"}\n\n: keep-alive\n\nevent: tr', 'ace\ndata: {"seq":1}\n\n'];
  const body = new ReadableStream<Uint8Array>({ start(c) { for (const x of chunks) c.enqueue(enc.encode(x)); c.close(); } });
  const seen: string[] = [];
  await readFrames(body, (e, d) => seen.push(`${e}:${d}`));
  assert.deepEqual(seen, ['started:{"runId":"a"}', 'trace:{"seq":1}']);
});

test('a frame whose handler throws is skipped and the stream goes on to its result', async () => {
  const enc = new TextEncoder();
  const text = 'event: trace\ndata: {"seq":1}\n\nevent: result\ndata: {"status":"paid"}\n\n';
  const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(enc.encode(text)); c.close(); } });
  const seen: string[] = [];
  const quiet = console.error;
  console.error = () => {};
  try {
    await readFrames(body, (e) => {
      if (e === 'trace') throw new Error('boom');
      seen.push(e);
    });
  } finally {
    console.error = quiet;
  }
  assert.deepEqual(seen, ['result']);
});
