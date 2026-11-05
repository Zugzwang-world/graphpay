// The facilitator's verify and settle for graphpay-order (planning/SPEC/PAYMENTS_WHITECHAIN.md §5).
// The relayer pays gas for every transaction and the contract records payment problems as
// events instead of reverting, so a sloppy facilitator pays to publish garbage. The order of
// defence, cheapest first:
//   1. schema and terms (free);
//   2. the payer's signature, before anything costly; then the ENS gate (agents only);
//   3. on-chain reads that predict the outcome;
//   4. send only if all pass (a predicted policy failure goes on-chain only within the daily
//      recorded-failure quota; NODE_MISMATCH never);
//   5. limits checked at send time and consumed only when everything passed.
// `settle` repeats 1–4, runs one at a time through a queue, and decides from the receipt.

import { isAddressEqual, isHex, keccak256, encodeAbiParameters, namehash, recoverTypedDataAddress, decodeAbiParameters } from 'viem';
import { FAIL_REASON, eip2612Types, permit2Domain, permitWitnessTypes, tokenDomain } from '@graphpay/contracts';
import { SCHEME, X402_VERSION, fromWireOrder, paymentPayloadSchema, requirementSchema, sameOrder } from './wire.mjs';
import { DailyCounter, RateLimiter } from './limits.mjs';

const ZERO32 = `0x${'0'.repeat(64)}`;
const RENEWAL_BIT = 1n << 255n;
const ERC6492_SUFFIX = '6492649264926492649264926492649264926492649264926492649264926492';
const STATUS = ['NONE', 'CREATED', 'PAID', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
const POLICY_REFUSALS = new Set(['AGENT_REVOKED', 'AGENT_EXPIRED', 'SPEND_CAP']);
const ORDER_TUPLE = [
  {
    type: 'tuple',
    components: [
      { name: 'orderId', type: 'bytes32' },
      { name: 'parentOrderId', type: 'bytes32' },
      { name: 'buyerNode', type: 'bytes32' },
      { name: 'shopNode', type: 'bytes32' },
      { name: 'payerNode', type: 'bytes32' },
      { name: 'merchant', type: 'address' },
      { name: 'amountMicro', type: 'uint64' },
      { name: 'deadline', type: 'uint64' },
      { name: 'kind', type: 'uint8' },
    ],
  },
];

export const DEFAULT_LIMITS = Object.freeze({
  maxSettleGas: 450_000n,
  minSendGas: 400_000n,
  gasBudgetDailyWei: 50_000_000_000_000_000n, // 0.05 WBT
  minRelayerBalanceWei: 300_000_000_000_000_000n, // 0.3 WBT
  recordedFailuresPerDay: 20,
  receiptTimeoutMs: 30_000,
  globalPerMinute: 60,
  perPayerPerMinute: 10,
  perPayeePerMinute: 30,
  queueDepth: 20,
  gateTtlMs: 20_000,
  recordsPerPayerPerMinute: 6,
});

// keccak256(abi.encode(Order)): the contract's termsHash.
export function termsHashOf(order) {
  return keccak256(encodeAbiParameters(ORDER_TUPLE, [order]));
}

class Refusal extends Error {
  // record: write it to Arkiv (only once the payer is proven); ctx: what is known so far.
  constructor(reason, { record = false, ctx } = {}) {
    super(reason);
    this.reason = reason;
    this.record = record;
    this.ctx = ctx;
  }
}
const refuse = (reason, options) => {
  throw new Refusal(reason, options);
};

// The contract's policy check, predicted from the chain's state (GraphPayCheckout._checkPolicy).
export function predictPolicy({ payerNode, bound, policy, spentToday, amount, nowSec }) {
  if (payerNode === ZERO32) return bound === ZERO32 ? 'NONE' : 'NODE_MISMATCH';
  if (bound !== payerNode || !isAddressEqual(policy.wallet, policy.payer)) return 'NODE_MISMATCH';
  if (policy.revoked) return 'AGENT_REVOKED';
  if (policy.expiry !== 0n && nowSec >= policy.expiry) return 'AGENT_EXPIRED';
  if (spentToday + amount > policy.dailyCapMicro) return 'SPEND_CAP';
  return 'NONE';
}

// deps: { chainId, token, permit2, checkout, allowedMerchants, chain, ensGate, recorder, limits, clock }
//   chain: the adapter in chain.mjs (real) or a fake (tests); ensGate(name, amountMicro): T2's gate;
//   recorder.refused(record): posts an off-chain refusal record, never throws, never awaited.
export function createGraphPayFacilitator(deps) {
  const limits = { ...DEFAULT_LIMITS, ...deps.limits };
  const clock = deps.clock ?? (() => Date.now());
  const network = `eip155:${deps.chainId}`;
  const merchants = new Set(deps.allowedMerchants.map((a) => a.toLowerCase()));
  const rate = {
    global: new RateLimiter(limits.globalPerMinute, 60_000, clock),
    payer: new RateLimiter(limits.perPayerPerMinute, 60_000, clock),
    payee: new RateLimiter(limits.perPayeePerMinute, 60_000, clock),
    records: new RateLimiter(limits.recordsPerPayerPerMinute, 60_000, clock),
  };
  const recordedFailures = new DailyCounter(clock);
  const gasSpent = new DailyCounter(clock);
  const gateCache = new Map(); // exact spelling and amount -> { at, result }
  let queue = Promise.resolve();
  let queued = 0;

  async function gate(name, amount) {
    const key = `${name}\u0000${amount}`;
    const hit = gateCache.get(key);
    const now = clock();
    if (hit && now - hit.at < limits.gateTtlMs) return hit.result;
    let result;
    try {
      result = await deps.ensGate(name, amount);
    } catch {
      result = { ok: false, reason: 'ENS_READ_FAILED' }; // fail closed
    }
    gateCache.set(key, { at: now, result });
    if (gateCache.size > 1000) gateCache.delete(gateCache.keys().next().value);
    return result;
  }

  // Stages 1–4. Returns the parsed payment and what sending would do ('settle' or 'record').
  async function check(paymentPayload, paymentRequirements) {
    // 1. Schema and terms: free.
    const p = paymentPayloadSchema.safeParse(paymentPayload);
    const r = requirementSchema.safeParse(paymentRequirements);
    if (!p.success || !r.success) refuse('invalid_payload');
    const req = r.data;
    const { payload } = p.data;
    if (JSON.stringify(p.data.accepted) !== JSON.stringify(req)) refuse('requirement_mismatch');
    if (req.scheme !== SCHEME || req.network !== network) refuse('invalid_network');
    if (!isAddressEqual(req.asset, deps.token.address) || !isAddressEqual(payload.permit.token, deps.token.address)) refuse('wrong_asset');
    if (!isAddressEqual(req.extra.contract, deps.checkout)) refuse('wrong_contract');
    if (!merchants.has(req.payTo.toLowerCase())) refuse('unknown_merchant');
    const wire = req.extra.order;
    if (!sameOrder(payload.order, wire) || !isAddressEqual(req.payTo, wire.merchant)) refuse('requirement_mismatch');
    if (req.amount !== wire.amountMicro || payload.permit.amount !== wire.amountMicro) refuse('requirement_mismatch');
    const order = fromWireOrder(wire);
    if (BigInt(order.orderId) & RENEWAL_BIT || order.orderId === ZERO32) refuse('invalid_payload');
    if (BigInt(payload.permit.nonce) !== BigInt(order.orderId) || BigInt(payload.permit.deadline) !== order.deadline) {
      refuse('requirement_mismatch');
    }
    const nowMs = clock();
    if (order.deadline * 1000n <= BigInt(nowMs)) refuse('EXPIRED');
    const agent = order.payerNode !== ZERO32;
    if (agent ? namehash(payload.payerName) !== order.payerNode : payload.payerName !== '') refuse('name_mismatch');

    // 2. The payer's signature, before anything costly.
    const sig = payload.signature;
    if (sig.toLowerCase().endsWith(ERC6492_SUFFIX)) refuse('erc6492_refused');
    const typedData = {
      domain: permit2Domain(deps.chainId, deps.permit2),
      types: permitWitnessTypes,
      primaryType: 'PermitWitnessTransferFrom',
      message: {
        permitted: { token: deps.token.address, amount: order.amountMicro },
        spender: deps.checkout,
        nonce: BigInt(order.orderId),
        deadline: order.deadline,
        witness: { ...order, mandateHash: payload.mandateHash },
      },
    };
    let signer;
    if (sig.length === 132) {
      signer = await recoverTypedDataAddress({ ...typedData, signature: sig }).catch(() => null);
      if (!signer || !isAddressEqual(signer, payload.payer)) refuse('bad_signature');
    } else if (!(await deps.chain.verifyTypedData(payload.payer, typedData, sig))) {
      refuse('bad_signature');
    }
    const ctx = { order, req, payload, payer: payload.payer, amount: order.amountMicro, nowMs };
    if (agent) {
      const verdict = await gate(payload.payerName, order.amountMicro);
      if (!verdict.ok) refuse(verdict.reason ?? 'ENS_READ_FAILED', { record: true, ctx });
      if (verdict.node !== order.payerNode) refuse('ENS_NODE_MISMATCH', { record: true, ctx });
    }

    // 3. On-chain reads that predict the outcome.
    const state = await deps.chain.readState({ order, payer: payload.payer });
    ctx.bound = state.bound;
    const status = STATUS[state.order.status];
    if (status === 'CREATED' && state.order.termsHash !== termsHashOf(order)) refuse('terms_mismatch', { record: true, ctx });
    if (status !== 'NONE' && status !== 'CREATED') refuse(status === 'CANCELLED' ? 'order_cancelled' : 'already_paid', { ctx });
    if (state.nonceUsed) refuse('nonce_used', { record: true, ctx });
    if (state.balance < order.amountMicro) refuse('insufficient_balance', { record: true, ctx });
    if (state.allowance < order.amountMicro && !(await approvalWillApply(payload, order.amountMicro, state, nowMs))) {
      refuse('approval_invalid', { record: true, ctx });
    }
    const predicted = predictPolicy({
      payerNode: order.payerNode,
      bound: state.bound,
      policy: { ...state.policy, payer: payload.payer },
      spentToday: state.spentToday,
      amount: order.amountMicro,
      nowSec: state.nowSec,
    });
    // 4. Send only if all pass. NODE_MISMATCH would write failures against someone else's name.
    if (predicted === 'NODE_MISMATCH') refuse('NODE_MISMATCH', { record: true, ctx });
    if (POLICY_REFUSALS.has(predicted)) {
      if (recordedFailures.value() >= limits.recordedFailuresPerDay) refuse(predicted, { record: true, ctx });
      return { ...ctx, action: 'record', predicted };
    }
    return { ...ctx, action: 'settle', predicted };
  }

  // An included EIP-2612 approval counts only if it will really apply.
  async function approvalWillApply(payload, amount, state, nowMs) {
    if (payload.approvalPermit === '0x') return false;
    try {
      const [value, deadline, signature] = decodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }, { type: 'bytes' }], payload.approvalPermit);
      if (value < amount || deadline * 1000n <= BigInt(nowMs) || !isHex(signature) || signature.length !== 132) return false;
      const owner = await recoverTypedDataAddress({
        domain: tokenDomain(deps.chainId, deps.token),
        types: eip2612Types,
        primaryType: 'Permit',
        message: { owner: payload.payer, spender: deps.permit2, value, nonce: state.tokenNonce, deadline },
        signature,
      });
      return isAddressEqual(owner, payload.payer);
    } catch {
      return false;
    }
  }

  // A refusal record for Arkiv, attributed to the claimed node only when the paying wallet is
  // bound to it; otherwise anyone could plant refusals in another agent's history.
  function record(refusal) {
    const { ctx } = refusal;
    if (!refusal.record || !ctx || !deps.recorder) return;
    if (!rate.records.take(ctx.payer.toLowerCase())) return;
    const attributed = ctx.order.payerNode !== ZERO32 && ctx.bound === ctx.order.payerNode;
    const entry = {
      onchain: false,
      status: 'rejected',
      reason: refusal.reason,
      orderId: ctx.order.orderId,
      payer: ctx.payer,
      payerName: attributed ? ctx.payload.payerName : '',
      payerNode: attributed ? ctx.order.payerNode : ZERO32,
      shopName: ctx.req.extra.shopName,
      amountMicro: String(ctx.amount),
      at: clock(),
    };
    Promise.resolve()
      .then(() => deps.recorder.refused(entry))
      .catch(() => {}); // a recorder outage never blocks or fails a payment decision
  }

  const asVerify = (ctx) => ({ isValid: true, payer: ctx.payer });

  async function verify(paymentPayload, paymentRequirements) {
    try {
      return asVerify(await check(paymentPayload, paymentRequirements));
    } catch (e) {
      if (!(e instanceof Refusal)) throw e;
      record(e);
      return { isValid: false, invalidReason: e.reason, payer: e.ctx?.payer };
    }
  }

  async function settleOne(paymentPayload, paymentRequirements) {
    let ctx;
    try {
      ctx = await check(paymentPayload, paymentRequirements);
      // 5. Limits at send time: checked first, consumed only when everything passed.
      const payerKey = ctx.payer.toLowerCase();
      const payeeKey = ctx.req.payTo.toLowerCase();
      if (!rate.global.peek('all') || !rate.payer.peek(payerKey) || !rate.payee.peek(payeeKey)) refuse('rate_limited', { ctx });
      const args = [ctx.order, ctx.payload.mandateHash, permitOf(ctx), ctx.payer, ctx.payload.signature, ctx.payload.approvalPermit];
      const estimate = await deps.chain.estimateSettle(args);
      if (estimate > limits.maxSettleGas) refuse('gas_cap', { ctx });
      const floor = limits.minSendGas > (estimate * 12n) / 10n ? limits.minSendGas : (estimate * 12n) / 10n;
      const gas = floor < limits.maxSettleGas ? floor : limits.maxSettleGas;
      const gasPrice = await deps.chain.gasPrice();
      const reserve = gas * gasPrice;
      if (gasSpent.value() + reserve > limits.gasBudgetDailyWei) refuse('gas_budget', { ctx });
      const balance = await deps.chain.relayerBalance();
      if (balance - reserve <= limits.minRelayerBalanceWei) refuse('relayer_floor', { ctx });
      rate.global.take('all');
      rate.payer.take(payerKey);
      rate.payee.take(payeeKey);
      if (ctx.action === 'record') recordedFailures.add(1);
      gasSpent.add(reserve);
      const hash = await deps.chain.sendSettle(args, gas);
      const receipt = await deps.chain.waitReceipt(hash, limits.receiptTimeoutMs);
      if (!receipt) return { success: false, errorReason: 'receipt_timeout', transaction: hash, network, payer: ctx.payer };
      gasSpent.add(receipt.fee - reserve); // correct the reservation from the receipt
      const outcome = deps.chain.outcomeOf(receipt, ctx.order.orderId);
      if (outcome.settled) return { success: true, transaction: hash, network, payer: ctx.payer, amount: String(ctx.amount) };
      const reason = outcome.failReason !== undefined ? FAIL_REASON[outcome.failReason] : 'reverted';
      return { success: false, errorReason: reason, transaction: hash, network, payer: ctx.payer };
    } catch (e) {
      if (!(e instanceof Refusal)) throw e;
      e.ctx = e.ctx ?? ctx;
      record(e);
      return { success: false, errorReason: e.reason, transaction: '', network, payer: e.ctx?.payer };
    }
  }

  function permitOf(ctx) {
    return {
      permitted: { token: deps.token.address, amount: ctx.amount },
      nonce: BigInt(ctx.order.orderId),
      deadline: ctx.order.deadline,
    };
  }

  async function settle(paymentPayload, paymentRequirements) {
    if (queued >= limits.queueDepth) return { success: false, errorReason: 'busy', transaction: '', network };
    queued++;
    const run = queue.then(() => settleOne(paymentPayload, paymentRequirements));
    queue = run.catch(() => {}).finally(() => {
      queued--;
    });
    return run;
  }

  return {
    scheme: SCHEME,
    caipFamily: 'eip155:*',
    x402Version: X402_VERSION,
    getExtra: () => ({ contract: deps.checkout }),
    getSigners: () => [deps.chain.relayerAddress],
    verify,
    settle,
    stats: () => ({
      recordedFailuresToday: Number(recordedFailures.value()),
      gasSpentTodayWei: String(gasSpent.value()),
      gasBudgetDailyWei: String(limits.gasBudgetDailyWei),
      minRelayerBalanceWei: String(limits.minRelayerBalanceWei),
      queued,
    }),
  };
}
