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

import { isAddressEqual, keccak256, encodeAbiParameters, hashTypedData, namehash, recoverAddress, decodeAbiParameters } from 'viem';
import { FAIL_REASON, eip2612Types, permit2Domain, permitWitnessTypes, tokenDomain } from '@graphpay/contracts';
import { SCHEME, X402_VERSION, fromWireOrder, paymentPayloadSchema, requirementSchema, sameOrder } from './wire.mjs';
import { DailyCounter, RateLimiter } from './limits.mjs';

const ZERO32 = `0x${'0'.repeat(64)}`;
const RENEWAL_BIT = 1n << 255n;
const ERC6492_SUFFIX = '6492649264926492649264926492649264926492649264926492649264926492';
const ERC8010_SUFFIX = '8010801080108010801080108010801080108010801080108010801080108010';
const SECP256K1_HALF_N = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0n;
const INFLIGHT_MS = 10 * 60_000; // a sent order's hash is kept this long (the longest quote)
const UNKNOWN_SEND_MS = 60_000; // a send that errored may still have been broadcast
const RECORD_DEDUPE_MS = 15 * 60_000;
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
  gateTtlMs: 20_000, // T2's gate's own cache (createEnsGate ttlMs); the pipeline keeps none
  failuresPerPayerPerDay: 3,
  recordsPerPayerPerMinute: 6,
  recordsPerMinute: 30,
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

// A wallet without code, as Permit2's SignatureVerification reads it: exactly 65 bytes with v 27 or
// 28, recovered by ecrecover. (Permit2 also takes EIP-2098's 64 bytes; our client never signs them,
// so they are refused here, which is safe.) viem's own helpers are more lenient (v 0 or 1, ERC-6492,
// ERC-8010 unwrapping), so they are not the rule. Returns the signer or null.
async function eoaSigner(hash, sig, { lowS = false } = {}) {
  if (!/^0x[0-9a-f]{130}$/.test(sig)) return null;
  const v = Number.parseInt(sig.slice(130), 16);
  if (v !== 27 && v !== 28) return null;
  if (lowS && BigInt(`0x${sig.slice(66, 130)}`) > SECP256K1_HALF_N) return null;
  return recoverAddress({ hash, signature: sig }).catch(() => null);
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
  rate.recordsAll = new RateLimiter(limits.recordsPerMinute, 60_000, clock);
  const recordedFailures = new DailyCounter(clock);
  const recordedOrders = new Map(); // order id -> day: a deliberate on-chain failure at most once per order
  const gasSpent = new DailyCounter(clock);
  const inflight = new Map(); // order id -> { hash | null, at }: sent, not yet decided
  const recent = new Map(); // record key -> at: one refusal record per order, payer and reason
  const failedOrders = new Map(); // order id -> day: sent, failed on-chain, never sent again that day
  const payerFailures = new Map(); // payer -> { day, count } of unexpected on-chain failures
  let queue = Promise.resolve();
  let queued = 0;

  // No cache here: T2's gate caches its ENS reads (and the watcher can invalidate them), while the
  // cap check must see every payment of the day. A throw is a read failure, never cached.
  async function gate(name, amount) {
    try {
      return await deps.ensGate(name, amount);
    } catch {
      return { ok: false, reason: 'ENS_READ_FAILED' }; // fail closed
    }
  }

  const dayOf = () => Math.floor(clock() / 86_400_000);
  const failuresOf = (payer) => {
    const f = payerFailures.get(payer.toLowerCase());
    return f && f.day === dayOf() ? f.count : 0;
  };

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
    if (BigInt(order.orderId) & RENEWAL_BIT || order.orderId === ZERO32 || order.amountMicro === 0n) refuse('invalid_payload');
    if (BigInt(payload.permit.nonce) !== BigInt(order.orderId) || BigInt(payload.permit.deadline) !== order.deadline) {
      refuse('requirement_mismatch');
    }
    const nowMs = clock();
    // The transaction must land before the deadline, or the contract records EXPIRED.
    if (order.deadline * 1000n <= BigInt(nowMs + limits.receiptTimeoutMs)) refuse('EXPIRED');
    const agent = order.payerNode !== ZERO32;
    if (agent ? namehash(payload.payerName) !== order.payerNode : payload.payerName !== '') refuse('name_mismatch');

    // 2. The payer's signature, before anything costly, by Permit2's rule: a wallet without code is
    // checked by ecrecover; a wallet with code (a contract, or an EOA with an EIP-7702 delegation)
    // is asked isValidSignature with the bytes as they are, never unwrapped.
    const sig = payload.signature.toLowerCase();
    if (sig.endsWith(ERC6492_SUFFIX)) refuse('erc6492_refused');
    if (sig.endsWith(ERC8010_SUFFIX)) refuse('erc8010_refused');
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
    const digest = hashTypedData(typedData);
    const local = await eoaSigner(digest, sig);
    const code = await deps.chain.getCode(payload.payer);
    const hasCode = typeof code === 'string' && code !== '0x';
    const valid = hasCode ? await deps.chain.isValidSignature(payload.payer, digest, sig) : Boolean(local && isAddressEqual(local, payload.payer));
    if (!valid) refuse('bad_signature');
    const ctx = { order, req, payload, payer: payload.payer, amount: order.amountMicro, nowMs, hasCode };
    // An order that already failed on-chain today is not sent again (its Permit2 nonce stays
    // unused, so every check would pass again), and a payer with repeated unexpected failures
    // is stopped for the day: neither may drain the relayer's gas budget.
    if (failedOrders.get(order.orderId) === dayOf()) refuse('order_failed', { ctx });
    if (failuresOf(payload.payer) >= limits.failuresPerPayerPerDay) refuse('payer_failures', { ctx });
    let gateEpoch;
    if (agent) {
      const verdict = await gate(payload.payerName, order.amountMicro);
      if (Number.isInteger(verdict.epoch)) ctx.epoch = gateEpoch = verdict.epoch;
      // Our own read failure is no verdict on the agent: refused, never recorded.
      if (!verdict.ok) refuse(verdict.reason ?? 'ENS_READ_FAILED', { record: verdict.reason !== undefined && verdict.reason !== 'ENS_READ_FAILED', ctx });
      if (String(verdict.node).toLowerCase() !== order.payerNode) refuse('ENS_NODE_MISMATCH', { record: true, ctx });
    }

    // 3. On-chain reads that predict the outcome.
    const state = await deps.chain.readState({ order, payer: payload.payer });
    ctx.bound = state.bound.toLowerCase();
    ctx.epoch ??= state.policy.epoch;
    // The name's ENS epoch must be the policy's (a killed and re-registered name is a new agent).
    if (agent && gateEpoch !== undefined && gateEpoch !== state.policy.epoch) refuse('ENS_EPOCH_MISMATCH', { record: true, ctx });
    const status = STATUS[state.order.status];
    if (status === 'CREATED' && state.order.termsHash !== termsHashOf(order)) refuse('terms_mismatch', { ctx });
    if (status !== 'NONE' && status !== 'CREATED') refuse(status === 'CANCELLED' ? 'order_cancelled' : 'already_paid', { ctx });
    if (state.nonceUsed) refuse('nonce_used', { record: true, ctx });
    if (state.balance < order.amountMicro) refuse('insufficient_balance', { record: true, ctx });
    if (state.allowance < order.amountMicro && !(await approvalWillApply(payload, order.amountMicro, state, nowMs, hasCode))) {
      refuse('approval_invalid', { record: true, ctx });
    }
    const predicted = predictPolicy({
      payerNode: order.payerNode,
      bound: ctx.bound,
      policy: { ...state.policy, payer: payload.payer },
      spentToday: state.spentToday,
      amount: order.amountMicro,
      nowSec: state.nowSec,
    });
    // 4. Send only if all pass. NODE_MISMATCH would write failures against someone else's name.
    if (predicted === 'NODE_MISMATCH') refuse('NODE_MISMATCH', { record: true, ctx });
    if (POLICY_REFUSALS.has(predicted)) {
      if (recordedFailures.value() >= limits.recordedFailuresPerDay || recordedOrders.get(order.orderId) === dayOf()) refuse(predicted, { record: true, ctx });
      return { ...ctx, action: 'record', predicted };
    }
    return { ...ctx, action: 'settle', predicted };
  }

  // An included EIP-2612 approval counts only if it will really apply: 65 bytes, v 27 or 28 and a
  // low s (the token's ECDSA check), from a wallet without code, against the token's current nonce.
  async function approvalWillApply(payload, amount, state, nowMs, hasCode) {
    if (payload.approvalPermit === '0x' || hasCode) return false;
    try {
      const [value, deadline, signature] = decodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }, { type: 'bytes' }], payload.approvalPermit);
      if (value < amount || deadline * 1000n <= BigInt(nowMs + limits.receiptTimeoutMs)) return false;
      const hash = hashTypedData({
        domain: tokenDomain(deps.chainId, deps.token),
        types: eip2612Types,
        primaryType: 'Permit',
        message: { owner: payload.payer, spender: deps.permit2, value, nonce: state.tokenNonce, deadline },
      });
      const owner = await eoaSigner(hash, signature.toLowerCase(), { lowS: true });
      return Boolean(owner && isAddressEqual(owner, payload.payer));
    } catch {
      return false;
    }
  }

  // A refusal record for Arkiv, attributed to the claimed node only when the paying wallet is
  // bound to it; otherwise anyone could plant refusals in another agent's history.
  // A refusal before the chain reads (the ENS gate) looks the binding up here, off the decision path.
  function record(refusal) {
    const { ctx } = refusal;
    if (!refusal.record || !ctx || !deps.recorder) return;
    const key = `${ctx.order.orderId}:${ctx.payer.toLowerCase()}:${refusal.reason}`;
    const now = clock();
    if (now - (recent.get(key) ?? -Infinity) < RECORD_DEDUPE_MS) return; // a replayed payload adds nothing
    if (!rate.records.take(ctx.payer.toLowerCase()) || !rate.recordsAll.take('all')) return;
    recent.set(key, now);
    if (recent.size > 2000) for (const [k, at] of recent) if (now - at >= RECORD_DEDUPE_MS || recent.size > 2000) recent.delete(k);
    Promise.resolve()
      .then(async () => {
        const bound = ctx.bound ?? String(await deps.chain.nodeOfWallet(ctx.payer)).toLowerCase();
        await deps.recorder.refused(entryOf(refusal, ctx, bound));
      })
      .catch(() => {}); // a recorder outage never blocks or fails a payment decision
  }

  function entryOf(refusal, ctx, bound) {
    const attributed = ctx.order.payerNode !== ZERO32 && bound === ctx.order.payerNode;
    return {
      onchain: false,
      status: 'rejected',
      reason: refusal.reason,
      orderId: ctx.order.orderId,
      payer: ctx.payer,
      payerName: attributed ? ctx.payload.payerName : '',
      payerNode: attributed ? ctx.order.payerNode : ZERO32,
      ...(attributed && Number.isInteger(ctx.epoch) ? { payerEpoch: ctx.epoch } : {}),
      shopName: ctx.req.extra.shopName,
      amountMicro: String(ctx.amount),
      at: ctx.nowMs,
    };
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
      // An order sent and not yet decided (a receipt timeout, or a send that errored and may have
      // been broadcast): wait on that transaction, never send a second one.
      const prior = inflight.get(ctx.order.orderId);
      if (prior && clock() - prior.at < (prior.hash ? INFLIGHT_MS : UNKNOWN_SEND_MS)) {
        if (!prior.hash) return { success: false, errorReason: 'in_flight', transaction: '', network, payer: ctx.payer };
        return await decide(ctx, prior.hash, prior.reserve);
      }
      // 5. Limits at send time: checked first, consumed only when everything passed.
      const payerKey = ctx.payer.toLowerCase();
      const payeeKey = ctx.req.payTo.toLowerCase();
      if (!rate.global.peek('all') || !rate.payer.peek(payerKey) || !rate.payee.peek(payeeKey)) refuse('rate_limited', { ctx });
      // eth_chainId before every send (CLAUDE.md): the start-up check alone is cached.
      if (deps.chain.chainOk && !(await deps.chain.chainOk().catch(() => false))) refuse('wrong_chain', { ctx });
      const args = [ctx.order, ctx.payload.mandateHash, permitOf(ctx), ctx.payer, ctx.payload.signature, ctx.payload.approvalPermit];
      // A revert here (a re-order whose parent is not paid, terms changed under us) is no verdict
      // on the payer: refuse without a record.
      const estimate = await deps.chain.estimateSettle(args).catch(() => refuse('simulation_failed', { ctx }));
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
      if (ctx.action === 'record') {
        recordedFailures.add(1);
        keep(recordedOrders, ctx.order.orderId, dayOf());
      }
      gasSpent.add(reserve);
      keep(inflight, ctx.order.orderId, { hash: null, at: clock(), reserve });
      // The signed transaction's hash is kept before the broadcast: if the send call errors after the
      // node took it, a retry waits on that hash instead of sending a second transaction.
      const hash = await deps.chain.sendSettle(args, gas, { onSigned: (signed) => keep(inflight, ctx.order.orderId, { hash: signed, at: clock(), reserve }) });
      keep(inflight, ctx.order.orderId, { hash, at: clock(), reserve });
      return await decide(ctx, hash, reserve);
    } catch (e) {
      if (!(e instanceof Refusal)) throw e;
      e.ctx = e.ctx ?? ctx;
      record(e);
      return { success: false, errorReason: e.reason, transaction: '', network, payer: e.ctx?.payer };
    }
  }

  // The verdict comes from the receipt; without one the payment is undecided and stays in flight.
  async function decide(ctx, hash, reserve) {
    const receipt = await deps.chain.waitReceipt(hash, limits.receiptTimeoutMs);
    if (!receipt) return { success: false, errorReason: 'receipt_timeout', transaction: hash, network, payer: ctx.payer };
    inflight.delete(ctx.order.orderId);
    gasSpent.add(receipt.fee - reserve); // correct the reservation from the receipt
    const outcome = deps.chain.outcomeOf(receipt, ctx.order.orderId);
    if (outcome.settled) return { success: true, transaction: hash, network, payer: ctx.payer, amount: String(ctx.amount) };
    // Decided and failed: never send this order again today. A failure we did not send on purpose
    // also counts against the daily quota and the payer's own failure cap.
    keep(failedOrders, ctx.order.orderId, dayOf());
    if (ctx.action !== 'record') {
      recordedFailures.add(1);
      keep(payerFailures, ctx.payer.toLowerCase(), { day: dayOf(), count: failuresOf(ctx.payer) + 1 });
    }
    const reason = outcome.failReason !== undefined ? FAIL_REASON[outcome.failReason] : 'reverted';
    return { success: false, errorReason: reason, transaction: hash, network, payer: ctx.payer };
  }

  // Bounded per-instance maps: the oldest entry goes first.
  function keep(map, key, value) {
    map.delete(key);
    map.set(key, value);
    if (map.size > 1000) map.delete(map.keys().next().value);
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
