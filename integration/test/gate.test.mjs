import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPayerGate } from '../src/gate.mjs';

// Test-only name, node and wallet; the reads are faked (no network).
const NAME = 'agent.example.eth';
const NODE = `0x${'0b'.repeat(32)}`;
const WALLET = `0x${'0c'.repeat(20)}`;
const ZERO = `0x${'00'.repeat(20)}`;
const reads = {
  walk: async (name) => (name === NAME ? { ok: true, name, node: NODE, epoch: 0, expiry: 9_999_999_999n, resolver: WALLET } : { ok: false, reason: 'ENS_NOT_FOUND' }),
  text: async (_name, _node, key) => ({ value: key.endsWith('status') ? 'active' : '6000000', resolver: WALLET }),
};
const chain = (policy, spent = 0n) => ({
  readContract: async ({ functionName }) => (functionName === 'policies' ? policy : spent),
});

test('the payer gate reads the checkout policy and spend; a refusal signs nothing', async () => {
  const policy = { epoch: 0, wallet: WALLET, revoked: false, dailyCapMicro: 6_000_000n, expiry: 0n };
  let signed = 0;
  const sign = async () => {
    signed += 1;
    return 'signature';
  };
  const ok = createPayerGate({ ens: {}, whitechain: chain(policy), reads });
  assert.equal(await ok.gatedSign(sign)({ payerEns: NAME, requirement: { amount: '4800000' } }), 'signature');
  const spent = createPayerGate({ ens: {}, whitechain: chain(policy, 2_000_000n), reads });
  await assert.rejects(spent.gatedSign(sign)({ payerEns: NAME, requirement: { amount: '4800000' } }), { code: 'GATE_REFUSED', reason: 'CAP_EXCEEDED' });
  const revoked = createPayerGate({ ens: {}, whitechain: chain({ ...policy, revoked: true }), reads });
  await assert.rejects(revoked.gatedSign(sign)({ payerEns: NAME, requirement: { amount: '400000' } }), { reason: 'ENS_NO_POLICY' });
  const unbound = createPayerGate({ ens: {}, whitechain: chain({ ...policy, wallet: ZERO }), reads });
  await assert.rejects(unbound.gatedSign(sign)({ payerEns: NAME, requirement: { amount: '400000' } }), { reason: 'ENS_NO_POLICY' });
  await assert.rejects(ok.gatedSign(sign)({ payerEns: 'other.example.eth', requirement: { amount: '400000' } }), { reason: 'ENS_NOT_FOUND' });
  assert.equal(signed, 1);
});
