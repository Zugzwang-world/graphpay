// Every refusal path of the five-stage pipeline (planning/PROMPTS/03-facilitator-shop.md), offline:
// real signatures from throw-away keys, a fake chain that counts sends. A forged or doomed
// payment must never reach sendSettle.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeAbiParameters, keccak256, namehash, toHex } from 'viem';
import { eip2612Types, tokenDomain } from '@graphpay/contracts';
import {
  AGENT_NAME,
  AGENT_NODE,
  CHAIN_ID,
  MERCHANT,
  PERMIT2,
  T0,
  TOKEN,
  ZERO32,
  fakeChain,
  makeFacilitator,
  makeOrder,
  newAccount,
  requirementFor,
  signedPayment,
  termsHashOf,
} from './helpers.mjs';
import { predictPolicy } from '../src/pipeline.mjs';

const other = (label) => `0x${keccak256(toHex(label)).slice(-40)}`;

// A recorder that keeps what it was sent.
function memoryRecorder() {
  const records = [];
  return { records, refused: async (r) => records.push(r) };
}
const settled = () => new Promise((r) => setImmediate(r)); // the recorder is fired, not awaited

// Applies fn to a copy of the requirement and keeps `accepted` equal to it, so only the field
// under test differs.
function bent({ paymentPayload, requirement }, fn) {
  const req = structuredClone(requirement);
  fn(req, paymentPayload);
  return { paymentPayload: { ...paymentPayload, accepted: req }, requirement: req };
}

async function setup({ order = makeOrder(), limits, gate, sign = {} } = {}) {
  const account = newAccount();
  const chain = fakeChain(account);
  const recorder = memoryRecorder();
  const f = makeFacilitator({ chain, recorder, limits, gate });
  const signed = await signedPayment(account, order, sign);
  return { account, chain, recorder, f, order, ...signed };
}

// Send-time refusals: verify does not estimate gas or read the relayer, so only settle refuses.
async function expectSettleRefused(f, chain, { paymentPayload, requirement }, reason) {
  assert.equal((await f.verify(paymentPayload, requirement)).isValid, true);
  const s = await f.settle(paymentPayload, requirement);
  assert.equal(s.success, false);
  assert.equal(s.errorReason, reason);
  assert.equal(s.transaction, '');
  assert.equal(chain.sends, 0, 'nothing was sent');
}

async function expectRefused(f, chain, { paymentPayload, requirement }, reason) {
  const v = await f.verify(paymentPayload, requirement);
  assert.equal(v.isValid, false, `verify should refuse with ${reason}`);
  assert.equal(v.invalidReason, reason);
  const s = await f.settle(paymentPayload, requirement);
  assert.equal(s.success, false);
  assert.equal(s.errorReason, reason);
  assert.equal(s.transaction, '');
  assert.equal(chain.sends, 0, 'nothing was sent');
}

test('a good agent payment verifies and settles once, from the receipt', async () => {
  const { f, chain, paymentPayload, requirement, account } = await setup();
  const v = await f.verify(paymentPayload, requirement);
  assert.deepEqual(v, { isValid: true, payer: account.address });
  const s = await f.settle(paymentPayload, requirement);
  assert.equal(s.success, true);
  assert.equal(s.network, `eip155:${CHAIN_ID}`);
  assert.equal(s.amount, '4800000');
  assert.match(s.transaction, /^0x[0-9a-f]{64}$/);
  assert.equal(chain.sends, 1);
});

test('a human payer (node 0, unbound wallet) skips the ENS gate and settles', async () => {
  let gateCalls = 0;
  const order = makeOrder({ payerNode: ZERO32 });
  const { f, chain, paymentPayload, requirement } = await setup({ order, gate: async () => (gateCalls++, { ok: false }), sign: { payerName: '' } });
  chain.state.bound = ZERO32;
  const s = await f.settle(paymentPayload, requirement);
  assert.equal(s.success, true);
  assert.equal(gateCalls, 0);
});

// ---------------------------------------------------------------- stage 1: schema and terms

test('garbage is refused for free, and never recorded', async () => {
  const { f, chain, recorder } = await setup();
  for (const [p, r] of [
    [null, null],
    ['nope', {}],
    [{ x402Version: 2 }, { scheme: 'graphpay-order' }],
    [{ x402Version: 1, payload: {} }, {}],
  ]) {
    assert.equal((await f.verify(p, r)).invalidReason, 'invalid_payload');
    assert.equal((await f.settle(p, r)).errorReason, 'invalid_payload');
  }
  await settled();
  assert.equal(chain.sends, 0);
  assert.equal(recorder.records.length, 0);
});

test('over-long fields are refused by the schema', async () => {
  const s = await setup();
  const long = structuredClone(s.paymentPayload);
  long.payload.payerName = 'a'.repeat(256);
  await expectRefused(s.f, s.chain, { paymentPayload: long, requirement: s.requirement }, 'invalid_payload');
  const blob = structuredClone(s.paymentPayload);
  blob.payload.signature = `0x${'ab'.repeat(2049)}`;
  await expectRefused(s.f, s.chain, { paymentPayload: blob, requirement: s.requirement }, 'invalid_payload');
});

test('the wrong token is refused, in the requirement or in the permit', async () => {
  const s = await setup();
  await expectRefused(s.f, s.chain, bent(s, (r) => (r.asset = other('USDT.e'))), 'wrong_asset');
  const pp = structuredClone(s.paymentPayload);
  pp.payload.permit.token = other('USDT.e');
  await expectRefused(s.f, s.chain, { paymentPayload: pp, requirement: s.requirement }, 'wrong_asset');
});

test('another network is refused', async () => {
  const s = await setup();
  await expectRefused(s.f, s.chain, bent(s, (r) => (r.network = 'eip155:1')), 'invalid_network');
});

test('a contract that is not ours is refused', async () => {
  const s = await setup();
  await expectRefused(s.f, s.chain, bent(s, (r) => (r.extra.contract = other('their checkout'))), 'wrong_contract');
});

test('a merchant off the allow-list is refused', async () => {
  const s = await setup();
  const stranger = other('stranger');
  await expectRefused(
    s.f,
    s.chain,
    bent(s, (r, p) => {
      r.payTo = stranger;
      r.extra.order.merchant = stranger;
      p.payload.order = structuredClone(r.extra.order);
    }),
    'unknown_merchant',
  );
});

test('payload and requirement must agree', async () => {
  const s = await setup();
  // `accepted` is not the requirement the shop sent.
  const drift = structuredClone(s.paymentPayload);
  drift.accepted.maxTimeoutSeconds = 599;
  await expectRefused(s.f, s.chain, { paymentPayload: drift, requirement: s.requirement }, 'requirement_mismatch');
  // The payload's order is not the requirement's.
  const order = structuredClone(s.paymentPayload);
  order.payload.order.buyerNode = namehash('someone-else.graphpay.eth');
  await expectRefused(s.f, s.chain, { paymentPayload: order, requirement: s.requirement }, 'requirement_mismatch');
  // amount != order.amountMicro.
  await expectRefused(s.f, s.chain, bent(s, (r) => (r.amount = '1')), 'requirement_mismatch');
  // permit amount != order amount.
  const permit = structuredClone(s.paymentPayload);
  permit.payload.permit.amount = '1';
  await expectRefused(s.f, s.chain, { paymentPayload: permit, requirement: s.requirement }, 'requirement_mismatch');
  // permit nonce != order id.
  const nonce = structuredClone(s.paymentPayload);
  nonce.payload.permit.nonce = '7';
  await expectRefused(s.f, s.chain, { paymentPayload: nonce, requirement: s.requirement }, 'requirement_mismatch');
});

test('payTo must be the order merchant even when both are allowed', async () => {
  const account = newAccount();
  const chain = fakeChain(account);
  const second = other('second merchant');
  const { createGraphPayFacilitator } = await import('../src/pipeline.mjs');
  const { CHECKOUT } = await import('./helpers.mjs');
  const f = createGraphPayFacilitator({
    chainId: CHAIN_ID,
    token: TOKEN,
    permit2: PERMIT2,
    checkout: CHECKOUT,
    allowedMerchants: [MERCHANT, second],
    chain,
    ensGate: async () => ({ ok: true, node: AGENT_NODE, epoch: 0 }),
    clock: () => T0,
  });
  const s = await signedPayment(account, makeOrder());
  await expectRefused(f, chain, bent(s, (r) => (r.payTo = second)), 'requirement_mismatch');
});

test('a renewal-bit or zero order id, an expired deadline and a wrong name are refused', async () => {
  const renewalId = `0x8${'0'.repeat(62)}1`;
  const r = await setup({ order: { ...makeOrder(), orderId: renewalId } });
  await expectRefused(r.f, r.chain, r, 'invalid_payload');
  const z = await setup({ order: { ...makeOrder(), orderId: ZERO32 } });
  await expectRefused(z.f, z.chain, z, 'invalid_payload');
  const e = await setup({ order: { ...makeOrder(), deadline: BigInt(T0 / 1000) } });
  await expectRefused(e.f, e.chain, e, 'EXPIRED');
  const n = await setup({ sign: { payerName: 'other.example.graphpay.eth' } });
  await expectRefused(n.f, n.chain, n, 'name_mismatch');
  const h = await setup({ order: makeOrder({ payerNode: ZERO32 }), sign: { payerName: AGENT_NAME } });
  await expectRefused(h.f, h.chain, h, 'name_mismatch');
});

// ---------------------------------------------------------------- stage 2: the payer's signature

test('a signature by someone else is refused before any chain read', async () => {
  const s = await setup();
  let reads = 0;
  s.chain.readState = async () => (reads++, structuredClone(s.chain.state));
  const forger = newAccount();
  const forged = await signedPayment(forger, s.order);
  forged.paymentPayload.payload.payer = s.account.address; // claims the victim's wallet
  await expectRefused(s.f, s.chain, forged, 'bad_signature');
  const flipped = structuredClone(s.paymentPayload);
  const sig = flipped.payload.signature;
  flipped.payload.signature = `${sig.slice(0, 10)}${sig[10] === '0' ? '1' : '0'}${sig.slice(11)}`;
  await expectRefused(s.f, s.chain, { paymentPayload: flipped, requirement: s.requirement }, 'bad_signature');
  assert.equal(reads, 0);
  await settled();
  assert.equal(s.recorder.records.length, 0, 'an unproven payer gets no record');
});

test('an ERC-6492 wrapped signature is refused without a call', async () => {
  const s = await setup();
  let calls = 0;
  s.chain.verifyTypedData = async () => (calls++, true);
  const wrapped = structuredClone(s.paymentPayload);
  wrapped.payload.signature = `0x${'00'.repeat(96)}${'6492'.repeat(16)}`;
  await expectRefused(s.f, s.chain, { paymentPayload: wrapped, requirement: s.requirement }, 'erc6492_refused');
  assert.equal(calls, 0);
});

test('a non-65-byte signature goes to ERC-1271 and is refused when the wallet says no', async () => {
  const s = await setup();
  const seen = [];
  s.chain.verifyTypedData = async (address) => (seen.push(address), false);
  const contractSig = structuredClone(s.paymentPayload);
  contractSig.payload.signature = `0x${'11'.repeat(80)}`;
  await expectRefused(s.f, s.chain, { paymentPayload: contractSig, requirement: s.requirement }, 'bad_signature');
  assert.equal(seen[0], s.account.address);
});

test('the ENS gate runs after the signature, fails closed and is cached 20 s by exact spelling', async () => {
  let calls = 0;
  let verdict = { ok: true, node: AGENT_NODE, epoch: 3 };
  let clock = T0;
  const account = newAccount();
  const chain = fakeChain(account);
  const recorder = memoryRecorder();
  const f = makeFacilitator({ chain, recorder, gate: async () => (calls++, verdict), clock: () => clock });
  const s = await signedPayment(account, makeOrder());
  await f.verify(s.paymentPayload, s.requirement);
  await f.verify(s.paymentPayload, s.requirement);
  assert.equal(calls, 1, 'cached');
  clock += 20_000;
  verdict = { ok: false, reason: 'CAP_EXCEEDED', node: AGENT_NODE, epoch: 3 };
  const v = await f.verify(s.paymentPayload, s.requirement);
  assert.equal(calls, 2, 'expired after 20 s');
  assert.equal(v.invalidReason, 'CAP_EXCEEDED');
  await settled();
  assert.equal(recorder.records.at(-1).reason, 'CAP_EXCEEDED');
  assert.equal(recorder.records.at(-1).payerEpoch, 3, 'the epoch comes from the gate');

  const thrower = makeFacilitator({ chain, recorder, gate: async () => { throw new Error('rpc down'); } });
  assert.equal((await thrower.verify(s.paymentPayload, s.requirement)).invalidReason, 'ENS_READ_FAILED');
  const elsewhere = makeFacilitator({ chain, recorder, gate: async () => ({ ok: true, node: namehash('x.graphpay.eth'), epoch: 0 }) });
  assert.equal((await elsewhere.verify(s.paymentPayload, s.requirement)).invalidReason, 'ENS_NODE_MISMATCH');
  assert.equal(chain.sends, 0);
});

// ---------------------------------------------------------------- stage 3: on-chain predictions

test('a used Permit2 nonce is never sent', async () => {
  const s = await setup();
  s.chain.state.nonceUsed = true;
  await expectRefused(s.f, s.chain, s, 'nonce_used');
});

test('an empty balance is never sent', async () => {
  const s = await setup();
  s.chain.state.balance = 0n;
  await expectRefused(s.f, s.chain, s, 'insufficient_balance');
});

test('an order already paid, cancelled or with other terms is refused', async () => {
  const s = await setup();
  s.chain.state.order = { status: 2, termsHash: termsHashOf(s.order) };
  await expectRefused(s.f, s.chain, s, 'already_paid');
  s.chain.state.order = { status: 3, termsHash: termsHashOf(s.order) };
  await expectRefused(s.f, s.chain, s, 'already_paid');
  s.chain.state.order = { status: 4, termsHash: termsHashOf(s.order) };
  await expectRefused(s.f, s.chain, s, 'order_cancelled');
  s.chain.state.order = { status: 1, termsHash: keccak256(toHex('other terms')) };
  await expectRefused(s.f, s.chain, s, 'terms_mismatch');
  s.chain.state.order = { status: 1, termsHash: termsHashOf(s.order) }; // a retry of a failed attempt
  assert.equal((await s.f.settle(s.paymentPayload, s.requirement)).success, true);
});

// An EIP-2612 approval of Permit2 signed by hand, for the cases the client never produces.
async function approval(account, { value, deadline, nonce = 0n }) {
  const signature = await account.signTypedData({
    domain: tokenDomain(CHAIN_ID, TOKEN),
    types: eip2612Types,
    primaryType: 'Permit',
    message: { owner: account.address, spender: PERMIT2, value, nonce, deadline },
  });
  return encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }, { type: 'bytes' }], [value, deadline, signature]);
}

test('an approval that will not apply is never sent', async () => {
  const s = await setup();
  assert.notEqual(s.paymentPayload.payload.approvalPermit, '0x', 'the client signed an approval');
  // Signed against token nonce 0, but the chain is at 1 (used or front-run).
  s.chain.state.tokenNonce = 1n;
  await expectRefused(s.f, s.chain, s, 'approval_invalid');
  s.chain.state.tokenNonce = 0n;
  const withApproval = async (approvalPermit) => {
    const p = structuredClone(s.paymentPayload);
    p.payload.approvalPermit = approvalPermit;
    return { paymentPayload: p, requirement: s.requirement };
  };
  const future = BigInt(T0 / 1000 + 3600);
  await expectRefused(s.f, s.chain, await withApproval(await approval(s.account, { value: 1n, deadline: future })), 'approval_invalid');
  await expectRefused(s.f, s.chain, await withApproval(await approval(s.account, { value: 50_000_000n, deadline: BigInt(T0 / 1000) })), 'approval_invalid');
  await expectRefused(s.f, s.chain, await withApproval(await approval(newAccount(), { value: 50_000_000n, deadline: future })), 'approval_invalid');
  await expectRefused(s.f, s.chain, await withApproval('0x123'), 'invalid_payload');
  await expectRefused(s.f, s.chain, await withApproval('0x1234'), 'approval_invalid');
  await expectRefused(s.f, s.chain, await withApproval(`0x${'00'.repeat(96)}`), 'approval_invalid');
  await expectRefused(s.f, s.chain, await withApproval('0x'), 'approval_invalid');
  // With the allowance already in place, no approval is needed.
  s.chain.state.allowance = 50_000_000n;
  assert.equal((await s.f.settle((await withApproval('0x')).paymentPayload, s.requirement)).success, true);
});

test('the client signs a bounded approval only while the allowance is short', async () => {
  const account = newAccount();
  const short = await signedPayment(account, makeOrder(), { allowance: 0n });
  assert.notEqual(short.paymentPayload.payload.approvalPermit, '0x');
  const enough = await signedPayment(account, makeOrder(), { allowance: 4_800_000n });
  assert.equal(enough.paymentPayload.payload.approvalPermit, '0x');
});

test('predictPolicy follows the contract, check by check', () => {
  const wallet = other('wallet');
  const base = { payerNode: AGENT_NODE, bound: AGENT_NODE, policy: { wallet, payer: wallet, revoked: false, expiry: 0n, dailyCapMicro: 6_000_000n }, spentToday: 0n, amount: 4_800_000n, nowSec: 100n };
  assert.equal(predictPolicy(base), 'NONE');
  assert.equal(predictPolicy({ ...base, payerNode: ZERO32, bound: ZERO32 }), 'NONE');
  assert.equal(predictPolicy({ ...base, payerNode: ZERO32 }), 'NODE_MISMATCH');
  assert.equal(predictPolicy({ ...base, bound: ZERO32 }), 'NODE_MISMATCH');
  assert.equal(predictPolicy({ ...base, policy: { ...base.policy, payer: other('x') } }), 'NODE_MISMATCH');
  assert.equal(predictPolicy({ ...base, policy: { ...base.policy, revoked: true, expiry: 1n } }), 'AGENT_REVOKED');
  assert.equal(predictPolicy({ ...base, policy: { ...base.policy, expiry: 100n } }), 'AGENT_EXPIRED');
  assert.equal(predictPolicy({ ...base, policy: { ...base.policy, expiry: 101n } }), 'NONE');
  assert.equal(predictPolicy({ ...base, spentToday: 1_200_001n }), 'SPEND_CAP');
  assert.equal(predictPolicy({ ...base, spentToday: 1_200_000n }), 'NONE');
});

// ---------------------------------------------------------------- stage 4: send only if all pass

test('a predicted cap, revocation or expiry is refused off-chain once the daily quota is used', async () => {
  for (const [bend, reason] of [
    [(st) => (st.policy.revoked = true), 'AGENT_REVOKED'],
    [(st) => (st.policy.expiry = st.nowSec), 'AGENT_EXPIRED'],
    [(st) => (st.spentToday = 2_000_000n), 'SPEND_CAP'],
  ]) {
    const s = await setup({ limits: { recordedFailuresPerDay: 0 } });
    bend(s.chain.state);
    await expectRefused(s.f, s.chain, s, reason);
    await settled();
    const rec = s.recorder.records.at(-1);
    assert.equal(rec.reason, reason);
    assert.equal(rec.payerNode, AGENT_NODE, 'attributed: the wallet is bound to the node');
    assert.equal(rec.payerName, AGENT_NAME);
  }
});

test('within the quota a predicted failure is sent on purpose and settle reports it from the receipt', async () => {
  const account = newAccount();
  const chain = fakeChain(account);
  const f = makeFacilitator({ chain, limits: { recordedFailuresPerDay: 1 } });
  chain.state.policy.revoked = true;
  chain.outcome = { settled: false, failReason: 1 };
  const first = await signedPayment(account, makeOrder({ salt: 1 }));
  assert.equal((await f.verify(first.paymentPayload, first.requirement)).isValid, true);
  const s1 = await f.settle(first.paymentPayload, first.requirement);
  assert.equal(s1.success, false);
  assert.equal(s1.errorReason, 'AGENT_REVOKED');
  assert.match(s1.transaction, /^0x/);
  assert.equal(chain.sends, 1);
  const second = await signedPayment(account, makeOrder({ salt: 2 }));
  const s2 = await f.settle(second.paymentPayload, second.requirement);
  assert.equal(s2.errorReason, 'AGENT_REVOKED');
  assert.equal(s2.transaction, '');
  assert.equal(chain.sends, 1, 'the quota is spent: refused off-chain');
});

test('NODE_MISMATCH is never sent, whatever the quota, and is not attributed to the claimed node', async () => {
  for (const bend of [
    (st) => (st.bound = namehash('someone.graphpay.eth')),
    (st) => (st.policy.wallet = other('the real wallet')),
  ]) {
    const s = await setup({ limits: { recordedFailuresPerDay: 20 } });
    bend(s.chain.state);
    await expectRefused(s.f, s.chain, s, 'NODE_MISMATCH');
    await settled();
    const rec = s.recorder.records.at(-1);
    if (s.chain.state.bound === AGENT_NODE) {
      assert.equal(rec.payerNode, AGENT_NODE); // bound, but the policy names another wallet
    } else {
      assert.equal(rec.payerNode, ZERO32);
      assert.equal(rec.payerName, '');
      assert.equal(rec.payerEpoch, undefined);
    }
    assert.equal(rec.payer, s.account.address);
  }
  // A human order from a bound wallet.
  const h = await setup({ order: makeOrder({ payerNode: ZERO32 }), sign: { payerName: '' } });
  await expectRefused(h.f, h.chain, h, 'NODE_MISMATCH');
});

// ---------------------------------------------------------------- stage 5: limits at send time

test('refusals burn no limits', async () => {
  const account = newAccount();
  const chain = fakeChain(account);
  const f = makeFacilitator({ chain, limits: { perPayerPerMinute: 1, globalPerMinute: 1, perPayeePerMinute: 1, recordedFailuresPerDay: 0 } });
  chain.state.nonceUsed = true;
  const doomed = await signedPayment(account, makeOrder({ salt: 1 }));
  for (let i = 0; i < 3; i++) await f.settle(doomed.paymentPayload, doomed.requirement);
  chain.state.nonceUsed = false;
  chain.estimate = 500_000n;
  await f.settle(doomed.paymentPayload, doomed.requirement); // gas_cap: checked, not consumed
  chain.estimate = 330_000n;
  const good = await signedPayment(account, makeOrder({ salt: 2 }));
  assert.equal((await f.settle(good.paymentPayload, good.requirement)).success, true);
  const next = await signedPayment(account, makeOrder({ salt: 3 }));
  assert.equal((await f.settle(next.paymentPayload, next.requirement)).errorReason, 'rate_limited');
  assert.equal(chain.sends, 1);
});

test('per-payer and per-payee rate limits apply to sends', async () => {
  const account = newAccount();
  const chain = fakeChain(account);
  let clock = T0;
  const f = makeFacilitator({ chain, limits: { perPayerPerMinute: 2 }, clock: () => clock });
  for (let salt = 1; salt <= 2; salt++) {
    const s = await signedPayment(account, makeOrder({ salt }));
    assert.equal((await f.settle(s.paymentPayload, s.requirement)).success, true);
  }
  const third = await signedPayment(account, makeOrder({ salt: 3 }));
  assert.equal((await f.settle(third.paymentPayload, third.requirement)).errorReason, 'rate_limited');
  clock += 60_001;
  assert.equal((await f.settle(third.paymentPayload, third.requirement)).success, true, 'the window moved on');

  // Two payers, one merchant: human orders, so both wallets pass the policy check.
  const humans = fakeChain(account);
  humans.state.bound = ZERO32;
  const shared = makeFacilitator({ chain: humans, limits: { perPayeePerMinute: 1 } });
  const first = await signedPayment(newAccount(), makeOrder({ payerNode: ZERO32, salt: 11 }), { payerName: '' });
  assert.equal((await shared.settle(first.paymentPayload, first.requirement)).success, true);
  const second = await signedPayment(newAccount(), makeOrder({ payerNode: ZERO32, salt: 12 }), { payerName: '' });
  assert.equal((await shared.settle(second.paymentPayload, second.requirement)).errorReason, 'rate_limited');
});

test('the gas estimate is capped and the send gas is min(cap, max(1.2 x estimate, 400k))', async () => {
  const s = await setup();
  const gases = [];
  s.chain.sendSettle = async (_args, gas) => (gases.push(gas), `0x${'b'.repeat(64)}`);
  s.chain.estimate = 450_001n;
  await expectSettleRefused(s.f, s.chain, s, 'gas_cap');
  for (const [estimate, want] of [
    [312_000n, 400_000n],
    [370_000n, 444_000n],
    [440_000n, 450_000n],
  ]) {
    s.chain.estimate = estimate;
    const p = await signedPayment(s.account, makeOrder({ salt: Number(estimate) }));
    assert.equal((await s.f.settle(p.paymentPayload, p.requirement)).success, true);
    assert.equal(gases.at(-1), want);
  }
});

test('a reverting estimate is refused without a send or a record', async () => {
  const s = await setup();
  s.chain.estimateSettle = async () => {
    throw new Error('execution reverted: BadInput("parent")');
  };
  const v = await s.f.verify(s.paymentPayload, s.requirement);
  assert.equal(v.isValid, true, 'verify does not simulate');
  const r = await s.f.settle(s.paymentPayload, s.requirement);
  assert.equal(r.errorReason, 'simulation_failed');
  assert.equal(s.chain.sends, 0);
  await settled();
  assert.equal(s.recorder.records.length, 0);
});

test('the daily gas budget is reserved before sending and corrected from the receipt', async () => {
  const account = newAccount();
  const chain = fakeChain(account);
  const price = chain.price;
  const f = makeFacilitator({ chain, limits: { gasBudgetDailyWei: 600_000n * price } });
  const a = await signedPayment(account, makeOrder({ salt: 1 }));
  assert.equal((await f.settle(a.paymentPayload, a.requirement)).success, true);
  assert.equal(f.stats().gasSpentTodayWei, String(chain.receipt.fee), 'corrected to the real fee');
  const b = await signedPayment(account, makeOrder({ salt: 2 }));
  assert.equal((await f.settle(b.paymentPayload, b.requirement)).errorReason, 'gas_budget');
  assert.equal(chain.sends, 1);
});

test('the relayer balance floor stops sends', async () => {
  const s = await setup();
  s.chain.balance = 300_000_000_000_000_000n + 400_000n * s.chain.price; // exactly at the floor after the reserve
  await expectSettleRefused(s.f, s.chain, s, 'relayer_floor');
});

test('a receipt timeout is neither success nor a chain failure', async () => {
  const s = await setup();
  s.chain.waitReceipt = async () => null;
  const r = await s.f.settle(s.paymentPayload, s.requirement);
  assert.equal(r.success, false);
  assert.equal(r.errorReason, 'receipt_timeout');
  assert.match(r.transaction, /^0x/);
});

test('a reverted receipt and an on-chain failure both report success false with the hash', async () => {
  const s = await setup();
  s.chain.outcome = { settled: false };
  const reverted = await s.f.settle(s.paymentPayload, s.requirement);
  assert.equal(reverted.errorReason, 'reverted');
  s.chain.outcome = { settled: false, failReason: 3 };
  const p = await signedPayment(s.account, makeOrder({ salt: 9 }));
  const failed = await s.f.settle(p.paymentPayload, p.requirement);
  assert.equal(failed.errorReason, 'TRANSFER_FAILED');
  assert.match(failed.transaction, /^0x/);
});

test('settle runs one at a time, and a full queue answers busy', async () => {
  const account = newAccount();
  const chain = fakeChain(account);
  let inFlight = 0;
  let most = 0;
  let release;
  const gate = new Promise((r) => (release = r));
  chain.waitReceipt = async () => {
    inFlight++;
    most = Math.max(most, inFlight);
    await gate;
    inFlight--;
    return chain.receipt;
  };
  const f = makeFacilitator({ chain, limits: { queueDepth: 2 } });
  const pays = await Promise.all([1, 2, 3].map((salt) => signedPayment(account, makeOrder({ salt }))));
  const runs = pays.map((p) => f.settle(p.paymentPayload, p.requirement));
  const third = await runs[2];
  assert.equal(third.errorReason, 'busy');
  release();
  const [a, b] = await Promise.all(runs.slice(0, 2));
  assert.equal(a.success && b.success, true);
  assert.equal(most, 1);
  assert.equal(f.stats().queued, 0);
});

// ---------------------------------------------------------------- refusal records

test('a recorder outage never blocks or fails a decision', async () => {
  const account = newAccount();
  const chain = fakeChain(account);
  chain.state.nonceUsed = true;
  const f = makeFacilitator({ chain, recorder: { refused: () => { throw new Error('down'); } } });
  const s = await signedPayment(account, makeOrder());
  assert.equal((await f.verify(s.paymentPayload, s.requirement)).invalidReason, 'nonce_used');
  const hanging = makeFacilitator({ chain, recorder: { refused: () => new Promise(() => {}) } });
  assert.equal((await hanging.settle(s.paymentPayload, s.requirement)).errorReason, 'nonce_used');
});

test('records are rate-limited per payer', async () => {
  const s = await setup({ limits: { recordsPerPayerPerMinute: 2 } });
  s.chain.state.balance = 0n;
  for (let i = 0; i < 5; i++) await s.f.verify(s.paymentPayload, s.requirement);
  await settled();
  assert.equal(s.recorder.records.length, 2);
  const rec = s.recorder.records[0];
  assert.deepEqual(Object.keys(rec).sort(), ['amountMicro', 'at', 'onchain', 'orderId', 'payer', 'payerEpoch', 'payerName', 'payerNode', 'reason', 'shopName', 'status'].sort());
  assert.equal(rec.onchain, false);
  assert.equal(rec.status, 'rejected');
  assert.equal(rec.amountMicro, '4800000');
  assert.equal(rec.at, T0);
});

test('hex fields in either case are the same order', async () => {
  const s = await setup();
  const upper = bent(s, (r, p) => {
    for (const k of ['orderId', 'buyerNode', 'shopNode', 'payerNode']) r.extra.order[k] = `0x${r.extra.order[k].slice(2).toUpperCase()}`;
    p.payload.order = structuredClone(r.extra.order);
  });
  assert.equal((await s.f.settle(upper.paymentPayload, upper.requirement)).success, true);
});

export { requirementFor };
