import assert from 'node:assert/strict';
import { test } from 'node:test';
import { x402Codec } from '../src/stack.mjs';

// The payer sends the sign hook's answer as the PAYMENT-SIGNATURE header value: it must be a
// string (x402HTTPClient's own method answers a headers object, which the payer refused).
test('the x402 codec round-trips a payment signature as a header string', () => {
  const payload = { x402Version: 2, accepted: { scheme: 'graphpay-order', network: 'eip155:1874', amount: '4800000', asset: `0x${'11'.repeat(20)}`, payTo: `0x${'22'.repeat(20)}`, maxTimeoutSeconds: 600, extra: {} }, payload: { order: {} } };
  const header = x402Codec.encodePaymentSignature(payload);
  assert.equal(typeof header, 'string');
  const pr = { x402Version: 2, resource: { url: 'http://127.0.0.1/x' }, accepts: [payload.accepted] };
  assert.deepEqual(x402Codec.decodePaymentRequired(x402Codec.encodePaymentRequired(pr)).accepts[0].amount, '4800000');
});
