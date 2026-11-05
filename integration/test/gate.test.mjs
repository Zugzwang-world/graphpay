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
const chain = (policy, spent = 0n, { id = 1874, fail = false } = {}) => {
  const calls = { policies: 0 };
  return {
    calls,
    getChainId: async () => id,
    readContract: async ({ functionName }) => {
      if (fail) throw new Error('rpc down');
      if (functionName === 'policies') calls.policies += 1;
      return functionName === 'policies' ? policy : spent;
    },
  };
};

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

test('the payer gate refuses a missing amount, a failed read, a zero cap and the wrong chain, signing nothing; one policy read a call', async () => {
  const policy = { epoch: 0, wallet: WALLET, revoked: false, dailyCapMicro: 6_000_000n, expiry: 0n };
  let signed = 0;
  const sign = async () => {
    signed += 1;
    return 'signature';
  };
  const wc = chain(policy);
  const g = createPayerGate({ ens: {}, whitechain: wc, reads });
  await assert.rejects(g.gatedSign(sign)({ payerEns: NAME, requirement: {} }), { reason: 'AMOUNT_INVALID' });
  await g.gatedSign(sign)({ payerEns: NAME, requirement: { amount: '400000' } });
  assert.equal(wc.calls.policies, 1);
  await assert.rejects(createPayerGate({ ens: {}, whitechain: chain(policy, 0n, { fail: true }), reads }).gatedSign(sign)({ payerEns: NAME, requirement: { amount: '400000' } }), { reason: 'ENS_READ_FAILED' });
  await assert.rejects(createPayerGate({ ens: {}, whitechain: chain({ ...policy, dailyCapMicro: 0n }), reads }).gatedSign(sign)({ payerEns: NAME, requirement: { amount: '400000' } }), { reason: 'CAP_EXCEEDED' });
  await assert.rejects(createPayerGate({ ens: {}, whitechain: chain(policy, 0n, { id: 1 }), reads }).gatedSign(sign)({ payerEns: NAME, requirement: { amount: '400000' } }), { reason: 'ENS_READ_FAILED' });
  assert.equal(signed, 1);
});
