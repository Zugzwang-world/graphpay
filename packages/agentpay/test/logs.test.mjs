// The merchant's log reads (CSV export, renewals) against RPCs that cap eth_getLogs spans, with
// the two refusals measured on Whitechain Sepolia's public RPCs (2026-11-06): Whitechain's own
// (-32602, at most 10,000 blocks) and the public Ankr endpoint (-32062, about 1,000). The client is
// a real viem client over a custom transport, so the errors are wrapped as in production.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPublicClient, custom } from 'viem';
import { createMerchant } from '../index.mjs';
import { LOG_CHUNK, isRangeError } from '../src/merchant.mjs';

const MERCHANT = `0x${'11'.repeat(20)}`;
const facilitator = { verify: async () => ({ isValid: false }), settle: async () => ({ success: false }) };

// head: the chain head; cap: the largest span (inclusive) the RPC answers; refusal: its error.
function cappedRpc({ head, cap, refusal }) {
  const calls = [];
  const client = createPublicClient({
    transport: custom({
      async request({ method, params }) {
        if (method === 'eth_chainId') return '0x752';
        if (method === 'eth_blockNumber') return `0x${head.toString(16)}`;
        if (method !== 'eth_getLogs') throw new Error(`unexpected ${method}`);
        const span = BigInt(params[0].toBlock) - BigInt(params[0].fromBlock) + 1n;
        calls.push({ from: BigInt(params[0].fromBlock), to: BigInt(params[0].toBlock), span, refused: span > cap });
        if (span > cap) throw refusal;
        return [];
      },
    }),
  });
  return { client, calls };
}

const merchantOn = (client, options = {}) => createMerchant({ name: 'test-shop.example.eth', address: MERCHANT, facilitator, publicClient: client, ...options });

// Every block from `from` to `to` was read exactly once per event by an answered call.
function coversOnce(calls, from, to, events) {
  const answered = calls.filter((c) => !c.refused).sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  assert.equal(answered.reduce((n, c) => n + c.span, 0n), (to - from + 1n) * BigInt(events));
  for (let i = 0; i < answered.length; i += events) assert.ok(answered[i].from >= from && answered[i].to <= to);
}

test('no getLogs call spans more than 10,000 blocks by default', async () => {
  const from = 12_313_887n;
  const head = from + 25_000n;
  const { client, calls } = cappedRpc({ head, cap: 10_000n, refusal: { code: -32602, message: 'query exceeds max block range 10000' } });
  await merchantOn(client).exportCsv({ fromBlock: from });
  assert.equal(LOG_CHUNK, 10_000n);
  assert.ok(calls.length > 0 && calls.every((c) => c.span <= 10_000n && !c.refused));
  coversOnce(calls, from, head, 3);
});

test('a lower cap (the public Ankr endpoint) drops the span to a tenth and keeps it', async () => {
  const from = 12_313_887n;
  const head = from + 12_000n;
  const { client, calls } = cappedRpc({ head, cap: 1_001n, refusal: { code: -32062, message: 'Block range is too large' } });
  const merchant = merchantOn(client);
  const csv = await merchant.exportCsv({ fromBlock: from });
  assert.match(csv, /^order_id,/);
  coversOnce(calls, from, head, 3);
  // The three event reads run side by side: at most one refused span each (viem's own transport
  // retries may repeat a call), then the smaller span for good.
  assert.ok(new Set(calls.filter((c) => c.refused).map((c) => `${c.from}-${c.to}`)).size <= 3);
  assert.ok(calls.filter((c) => !c.refused).every((c) => c.span <= 1_000n));
  const before = calls.length;
  await merchant.exportCsv({ fromBlock: from });
  assert.ok(calls.slice(before).every((c) => !c.refused));
});

test('any other RPC error is thrown, not retried', async () => {
  const { client, calls } = cappedRpc({ head: 20_000n, cap: 0n, refusal: { code: -32000, message: 'header not found' } });
  await assert.rejects(merchantOn(client).exportCsv({ fromBlock: 1n }));
  assert.ok(calls.length >= 1 && calls.every((c) => c.span === 10_000n), 'no smaller retry');
});

test('range refusals are recognised through viem wrapping, other errors are not', () => {
  assert.equal(isRangeError({ cause: { code: -32602, details: 'query exceeds max block range 10000' } }), true);
  assert.equal(isRangeError({ shortMessage: 'Block range is too large' }), true);
  assert.equal(isRangeError({ cause: { code: -32602, message: 'invalid argument 0: hex string has odd length' } }), false);
  assert.equal(isRangeError(new Error('fetch failed')), false);
});

test('logChunk is configurable but never below 100 blocks', async () => {
  const { client, calls } = cappedRpc({ head: 5_000n, cap: 10_000n, refusal: { code: -32602, message: 'query exceeds max block range 10000' } });
  await merchantOn(client, { logChunk: 2_000n }).exportCsv({ fromBlock: 1n });
  assert.ok(calls.every((c) => c.span <= 2_000n));
  assert.throws(() => merchantOn(client, { logChunk: 50n }), /at least 100/);
});
