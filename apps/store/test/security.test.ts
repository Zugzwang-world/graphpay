// The merchant routes' security logic that has no browser or chain in it: the passcode guard,
// the one-at-a-time signing queue, the failure mapping and the chain-order CSV parser.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chainOrdersFrom, parseCsv } from '../lib/csv.ts';
import { failure, requirePasscode, serially } from '../lib/gate.ts';

const PASS = 'p'.repeat(26);
const req = (headers: Record<string, string> = {}) => new Request('https://store.test/api/merchant/refund', { method: 'POST', headers });

test('signing is off without a configured passcode of at least 24 characters, and a wrong or missing one is refused', async () => {
  assert.equal(requirePasscode(req({ 'x-demo-passcode': PASS }), '')?.status, 503);
  assert.equal(requirePasscode(req({ 'x-demo-passcode': PASS }), 'short')?.status, 503);
  assert.equal(requirePasscode(req(), PASS)?.status, 401);
  assert.equal(requirePasscode(req({ 'x-demo-passcode': `${PASS}x` }), PASS)?.status, 401);
  assert.equal(requirePasscode(req({ 'x-demo-passcode': 'p'.repeat(513) }), PASS)?.status, 401);
  assert.equal(requirePasscode(req({ 'x-demo-passcode': PASS }), PASS), null);
  const refused = requirePasscode(req(), PASS);
  assert.equal(refused?.headers.get('cache-control'), 'no-store');
});

test('signing runs one at a time, in order, and a failure does not jam the queue', async () => {
  const order: string[] = [];
  const slow = serially(async () => {
    order.push('a start');
    await new Promise((r) => setTimeout(r, 25));
    order.push('a end');
    throw new Error('boom');
  });
  const next = serially(async () => {
    order.push('b');
    return 'ok';
  });
  await assert.rejects(slow, /boom/);
  assert.equal(await next, 'ok');
  assert.deepEqual(order, ['a start', 'a end', 'b']);
});

test('a refusal with a code is a 409 with only the code; anything else is a 502 with a fixed line (no message, no URL)', async () => {
  const quiet = console.error;
  console.error = () => undefined;
  try {
    const refusal = failure(Object.assign(new Error('the order is REFUNDED at https://rpc.example/key'), { code: 'NOT_REFUNDABLE' }), 'could not refund');
    assert.equal(refusal.status, 409);
    assert.deepEqual(await refusal.json(), { error: 'NOT_REFUNDABLE' });
    const outage = failure(new Error('request to https://rpc.example/secret-key failed'), 'could not refund');
    assert.equal(outage.status, 502);
    const text = JSON.stringify(await outage.json());
    assert.equal(text, JSON.stringify({ error: 'could not refund' }));
    assert.equal(outage.headers.get('cache-control'), 'no-store');
  } finally {
    console.error = quiet;
  }
});

test('the CSV parser handles quotes, doubled quotes, CRLF and a trailing newline', () => {
  assert.deepEqual(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n'), [['a', 'b'], ['x, y', 'say "hi"']]);
  assert.deepEqual(parseCsv('a,b\n1,2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv(''), []);
});

test('the chain orders keep exact amounts and a refund left of an order is amount less refunded', () => {
  const csv = ['order_id,kind,merchant,status,amount_usdt,refunded_usdt,payer,paid_day_utc,paid_tx,explorer', '0xaa,one-off,shop,PAID,4.80,0.80,0x11,2026-11-05,0xbb,https://x/tx/0xbb'].join('\n');
  const [row] = chainOrdersFrom(csv);
  assert.equal(row?.amountMicro, 4_800_000n);
  assert.equal(row?.refundedMicro, 800_000n);
  assert.equal((row?.amountMicro ?? 0n) - (row?.refundedMicro ?? 0n), 4_000_000n);
  assert.equal(row?.status, 'PAID');
});
