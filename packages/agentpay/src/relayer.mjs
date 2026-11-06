// The reference relayer: a small facilitator for tests and small deployments. It holds the
// relayer key, pays the gas, and cannot redirect a payment (payee, amount and order are in the
// payer's signed witness). The contract records payment problems as events instead of
// reverting, so a careless relayer pays gas to publish garbage; this one checks everything it
// can for free, then predicts the outcome from the chain, and sends only what will settle.
//
// Anti-drain limits, all checked before a send: a relayer balance floor, a per-order cap, an
// hourly cap on count and on value, a per-payer rate, a gas ceiling per transaction, and one
// transaction at a time.

import { decodeAbiParameters, decodeEventLog, erc20Abi, isAddressEqual, parseAbi, recoverAddress, recoverTypedDataAddress } from 'viem';
import { namehash, normalize } from 'viem/ens';
import { FAIL_REASON, ORDER_STATUS, RENEWAL_BIT, SUB_STATUS, cancelTypes, checkoutAbi, checkoutDomain, eip2612Types, permit2Domain, permitWitnessTypes, tokenDomain } from './vendor/index.mjs';
import { assertChain, assertClientChain, assertWriteChain, whitechainNetwork } from './network.mjs';
import { ZERO32 } from './order.mjs';
import { permit2Abi } from './sign.mjs';
import { SCHEME, X402_VERSION, fromWireOrder, paymentPayloadSchema, requirementSchema, sameWireOrder } from './wire.mjs';

export const RELAYER_DEFAULTS = Object.freeze({
  minRelayerBalanceWei: 100_000_000_000_000_000n, // 0.1 WBT: refuse to send below it
  maxOrderMicro: 10_000_000n, // 10.00 USDT per order or charge
  maxSettlesPerHour: 30,
  maxMicroPerHour: 50_000_000n, // 50.00 USDT an hour through this relayer
  perPayerPerMinute: 10,
  maxSettleGas: 450_000n, // heaviest real settle 312,024 (planning/SPEC/PAYMENTS_WHITECHAIN.md §1)
  minSendGas: 400_000n,
  maxSubscribeGas: 600_000n, // createSubscription 437,794
  maxRenewGas: 300_000n, // renew 201,555
  maxCancelGas: 120_000n, // cancelWithSig 44,582
  receiptTimeoutMs: 30_000,
  inFlightHoldMs: 600_000, // an unconfirmed send blocks a resend of its order for 10 minutes
});

const noncesAbi = parseAbi(['function nonces(address owner) view returns (uint256)']);
const SIG65 = /^0x[0-9a-fA-F]{130}$/;
const POLICY_REASONS = new Set(['AGENT_REVOKED', 'AGENT_EXPIRED', 'SPEND_CAP', 'NODE_MISMATCH']);

// A transaction that may have been sent: its outcome is unknown, so it is never retried as new.
class Pending extends Error {
  constructor(hash, cause) {
    super('pending');
    this.hash = hash;
    this.cause = cause ?? 'Error';
  }
}

class Refusal extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}
const refuse = (reason) => {
  throw new Refusal(reason);
};

// A sliding window of (time, value) entries.
function windowCounter(spanMs) {
  const entries = [];
  const prune = (now) => {
    while (entries.length && entries[0].at <= now - spanMs) entries.shift();
  };
  return {
    count(now) {
      prune(now);
      return entries.length;
    },
    sum(now) {
      prune(now);
      return entries.reduce((s, e) => s + e.value, 0n);
    },
    add(now, value = 0n) {
      entries.push({ at: now, value });
    },
  };
}

function serial() {
  let tail = Promise.resolve();
  return (fn) => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => {});
    return run;
  };
}

// The contract's policy check, predicted from chain state (GraphPayCheckout's policy rules,
// planning/SPEC/PAYMENTS_WHITECHAIN.md §3.5).
export function predictPolicy({ payerNode, boundNode, policy, payer, spentToday, amount, nowSec }) {
  if (payerNode === ZERO32) return boundNode === ZERO32 ? 'NONE' : 'NODE_MISMATCH';
  if (boundNode !== payerNode || !isAddressEqual(policy.wallet, payer)) return 'NODE_MISMATCH';
  if (policy.revoked) return 'AGENT_REVOKED';
  if (policy.expiry !== 0n && BigInt(nowSec) >= policy.expiry) return 'AGENT_EXPIRED';
  if (spentToday + amount > policy.dailyCapMicro) return 'SPEND_CAP';
  return 'NONE';
}

const asPolicy = (p) =>
  Array.isArray(p)
    ? { epoch: Number(p[0]), wallet: p[1], revoked: p[2], dailyCapMicro: BigInt(p[3]), expiry: BigInt(p[4]) }
    : { epoch: Number(p.epoch), wallet: p.wallet, revoked: p.revoked, dailyCapMicro: BigInt(p.dailyCapMicro), expiry: BigInt(p.expiry) };

// The anti-drain limits are always on: a developer may loosen or tighten one with a finite number
// (or bigint) above zero, but an unknown name, undefined, NaN, Infinity, zero or a negative value
// is refused rather than switching a limit off.
export function resolveLimits(overrides = {}) {
  const L = { ...RELAYER_DEFAULTS };
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (!Object.hasOwn(RELAYER_DEFAULTS, key)) throw new Error(`createReferenceRelayer: unknown limit "${key}"`);
    const ok = typeof value === 'bigint' ? value > 0n : typeof value === 'number' && Number.isFinite(value) && value > 0;
    if (!ok) throw new Error(`createReferenceRelayer: limit "${key}" must be a finite number above zero (the limits cannot be switched off)`);
    L[key] = typeof RELAYER_DEFAULTS[key] === 'bigint' ? BigInt(value) : Number(value);
  }
  return L;
}

// walletClient: a viem wallet client whose account holds the checkout's relayer role (gas only,
// never USDT). allowedMerchants: the payees this relayer will pay gas for. identity: an optional
// IdentityResolver whose verifyPayer({ name, node, address }) must vouch for a named payer.
export function createReferenceRelayer({ walletClient, publicClient, network = whitechainNetwork(), allowedMerchants, identity, limits = {}, clock = () => Date.now(), log = () => {} }) {
  if (!walletClient?.account?.address) throw new Error('createReferenceRelayer needs a wallet client with an account');
  if (!Array.isArray(allowedMerchants) || allowedMerchants.length === 0) throw new Error('createReferenceRelayer needs a merchant allowlist');
  assertClientChain(publicClient, network);
  assertClientChain(walletClient, network);
  const L = resolveLimits(limits);
  const relayer = walletClient.account.address;
  const hourly = windowCounter(3_600_000);
  const perPayer = new Map();
  const inFlight = new Map();
  const queue = serial();
  const stats = { verified: 0, refused: 0, settled: 0, failedOnChain: 0, gasUsed: 0n };
  const nowSec = () => Math.floor(clock() / 1000);
  const merchantOk = (a) => allowedMerchants.some((m) => isAddressEqual(m, a));
  const read = (functionName, args, address = network.checkout, abi = checkoutAbi) => publicClient.readContract({ address, abi, functionName, args });

  // Stages 1 to 3: free checks, the signature, then on-chain reads that predict the outcome.
  async function check(paymentPayload, requirements) {
    const parsed = paymentPayloadSchema.safeParse(paymentPayload);
    const req = requirementSchema.safeParse(requirements);
    if (!parsed.success || !req.success) refuse('invalid_payload');
    const { accepted, payload } = parsed.data;
    const r = req.data;
    if (parsed.data.x402Version !== X402_VERSION || r.scheme !== SCHEME) refuse('unsupported_scheme');
    if (r.network !== network.caip2 || accepted.network !== r.network) refuse('wrong_network');
    if (!isAddressEqual(r.asset, network.token.address) || !isAddressEqual(payload.permit.token, network.token.address)) refuse('wrong_asset');
    if (network.neverUse.some((a) => isAddressEqual(a, r.asset))) refuse('wrong_asset');
    if (!isAddressEqual(r.extra.contract, network.checkout)) refuse('wrong_contract');
    if (!sameWireOrder(payload.order, r.extra.order) || !sameWireOrder(accepted.extra.order, r.extra.order)) refuse('order_mismatch');
    const order = fromWireOrder(r.extra.order);
    if (!merchantOk(r.payTo) || !isAddressEqual(r.payTo, order.merchant)) refuse('merchant_not_allowed');
    const amount = BigInt(r.amount);
    if (amount !== order.amountMicro || BigInt(payload.permit.amount) !== amount || BigInt(accepted.amount) !== amount) refuse('amount_mismatch');
    if (amount === 0n) refuse('amount_mismatch');
    if (BigInt(payload.permit.nonce) !== BigInt(order.orderId) || BigInt(payload.permit.deadline) !== order.deadline) refuse('permit_mismatch');
    if ((BigInt(order.orderId) & RENEWAL_BIT) !== 0n) refuse('bad_order_id');
    if ((order.kind === 0) !== (order.parentOrderId === ZERO32)) refuse('bad_parent');
    if (order.deadline <= BigInt(nowSec())) refuse('expired');
    if (order.payerNode === ZERO32 ? payload.payerName !== '' : namehash(normalize(payload.payerName)) !== order.payerNode) refuse('name_mismatch');

    // The payer's signature, locally, before any RPC. Only plain 65-byte ECDSA here.
    if (!SIG65.test(payload.signature)) refuse('unsupported_signature');
    const signer = await recoverTypedDataAddress({
      domain: permit2Domain(network.chainId, network.permit2),
      types: permitWitnessTypes,
      primaryType: 'PermitWitnessTransferFrom',
      message: {
        permitted: { token: network.token.address, amount },
        spender: network.checkout,
        nonce: BigInt(order.orderId),
        deadline: order.deadline,
        witness: { ...order, mandateHash: payload.mandateHash },
      },
      signature: payload.signature,
    }).catch(() => null);
    if (!signer || !isAddressEqual(signer, payload.payer)) refuse('bad_signature');
    const payer = payload.payer;

    if (identity?.verifyPayer && order.payerNode !== ZERO32) {
      const ok = await identity.verifyPayer({ name: payload.payerName, node: order.payerNode, address: payer });
      if (!ok) refuse('identity_refused');
    }

    // On-chain reads that predict the outcome.
    const [onchain, bitmap, balance, allowance, boundNode, policyRaw, spentToday] = await Promise.all([
      read('orders', [order.orderId]),
      read('nonceBitmap', [payer, BigInt(order.orderId) >> 8n], network.permit2, permit2Abi),
      read('balanceOf', [payer], network.token.address, erc20Abi),
      read('allowance', [payer, network.permit2], network.token.address, erc20Abi),
      read('nodeOfWallet', [payer]),
      order.payerNode === ZERO32 ? Promise.resolve(null) : read('policies', [order.payerNode]),
      order.payerNode === ZERO32 ? Promise.resolve(0n) : read('spentToday', [order.payerNode]),
    ]);
    const status = ORDER_STATUS[Number(onchain.status ?? onchain[6])];
    if (status === 'CREATED') {
      const terms = await read('termsHash', [order]);
      if (terms !== (onchain.termsHash ?? onchain[0])) refuse('terms_mismatch');
    } else if (status !== 'NONE') refuse(status === 'PAID' || status === 'DELIVERED' ? 'already_paid' : 'order_not_payable');
    if (((bitmap >> (BigInt(order.orderId) & 0xffn)) & 1n) === 1n) refuse('nonce_used');
    if (order.kind === 1) {
      // A re-order's parent must be paid (or settled and refunded) and share buyer and shop.
      const parent = await read('orders', [order.parentOrderId]);
      const pStatus = ORDER_STATUS[Number(parent.status ?? parent[6])];
      if (!['PAID', 'DELIVERED', 'REFUNDED'].includes(pStatus) || (parent.buyerNode ?? parent[1]) !== order.buyerNode || (parent.shopNode ?? parent[2]) !== order.shopNode) refuse('bad_parent');
    }
    if (balance < amount) refuse('insufficient_balance');
    if (allowance < amount) {
      if (payload.approvalPermit === '0x') refuse('no_allowance');
      let value, deadline, sig;
      try {
        [value, deadline, sig] = decodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }, { type: 'bytes' }], payload.approvalPermit);
      } catch {
        refuse('bad_approval');
      }
      if (value < amount || deadline <= BigInt(nowSec()) || !SIG65.test(sig)) refuse('bad_approval');
      const nonce = await read('nonces', [payer], network.token.address, noncesAbi);
      const approver = await recoverTypedDataAddress({
        domain: tokenDomain(network.chainId, network.token),
        types: eip2612Types,
        primaryType: 'Permit',
        message: { owner: payer, spender: network.permit2, value, nonce, deadline },
        signature: sig,
      }).catch(() => null);
      if (!approver || !isAddressEqual(approver, payer)) refuse('bad_approval');
    }
    const policy = policyRaw ? asPolicy(policyRaw) : null;
    const predicted = predictPolicy({ payerNode: order.payerNode, boundNode, policy, payer, spentToday: BigInt(spentToday), amount, nowSec: nowSec() });
    if (POLICY_REASONS.has(predicted)) refuse(predicted);
    return { order, amount, payer, payload };
  }

  function perPayerCounter(payer) {
    const key = payer.toLowerCase();
    if (perPayer.size > 1_000) for (const [k, c] of perPayer) if (c.count(clock()) === 0) perPayer.delete(k);
    if (!perPayer.has(key)) perPayer.set(key, windowCounter(60_000));
    return perPayer.get(key);
  }

  // Stage 5: the limits, at send time.
  async function checkLimits(amount, payer) {
    const now = clock();
    if (amount > L.maxOrderMicro) refuse('over_order_cap');
    if (hourly.count(now) >= L.maxSettlesPerHour) refuse('hourly_count_cap');
    if (hourly.sum(now) + amount > L.maxMicroPerHour) refuse('hourly_value_cap');
    if (payer && perPayerCounter(payer).count(now) >= L.perPayerPerMinute) refuse('rate_limited');
    const balance = await publicClient.getBalance({ address: relayer });
    if (balance <= L.minRelayerBalanceWei) refuse('relayer_balance_low');
  }

  function consume(amount, payer) {
    const now = clock();
    hourly.add(now, amount);
    if (payer) perPayerCounter(payer).add(now);
  }

  // Sends and waits for the receipt. A send that may have reached the chain is never reported
  // as a plain failure: a receipt timeout throws Pending with the hash, so nobody retries it
  // as a new order (the payer would pay twice).
  async function send(functionName, args, maxGas) {
    await assertWriteChain(publicClient, walletClient, network);
    const estimate = await publicClient.estimateContractGas({ address: network.checkout, abi: checkoutAbi, functionName, args, account: walletClient.account });
    if (estimate > maxGas) refuse('gas_too_high');
    const floor = functionName === 'settleOrder' ? L.minSendGas : 0n;
    let gas = (estimate * 12n) / 10n;
    if (gas < floor) gas = floor;
    if (gas > maxGas) gas = maxGas;
    let hash;
    try {
      hash = await walletClient.writeContract({ address: network.checkout, abi: checkoutAbi, functionName, args, gas, chain: walletClient.chain, account: walletClient.account });
    } catch (e) {
      throw new Pending('', e?.name);
    }
    let receipt;
    try {
      receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: L.receiptTimeoutMs });
    } catch (e) {
      throw new Pending(hash, e?.name);
    }
    return { hash, receipt, events: decodeReceipt(receipt) };
  }

  function decodeReceipt(receipt) {
    stats.gasUsed += receipt.gasUsed;
    const events = [];
    for (const lg of receipt.logs) {
      if (!isAddressEqual(lg.address, network.checkout)) continue;
      try {
        events.push(decodeEventLog({ abi: checkoutAbi, data: lg.data, topics: lg.topics }));
      } catch {
        // not one of ours
      }
    }
    return events;
  }

  function settlementOf(order, payer, amount, hash, events) {
    const same = (ev) => String(ev.args.orderId).toLowerCase() === order.orderId;
    const settled = events.find((ev) => ev.eventName === 'PaymentSettled' && same(ev));
    const failed = events.find((ev) => ev.eventName === 'PaymentFailed' && same(ev));
    if (settled) {
      stats.settled++;
      return { success: true, payer, transaction: hash, network: network.caip2, amount: amount.toString() };
    }
    stats.failedOnChain++;
    return { success: false, errorReason: failed ? FAIL_REASON[Number(failed.args.reason)] : 'not_settled', payer, transaction: hash, network: network.caip2 };
  }

  async function verify(paymentPayload, requirements) {
    try {
      const { payer } = await check(paymentPayload, requirements);
      stats.verified++;
      return { isValid: true, payer };
    } catch (e) {
      if (!(e instanceof Refusal)) throw e;
      stats.refused++;
      return { isValid: false, invalidReason: e.reason };
    }
  }

  function settle(paymentPayload, requirements) {
    return queue(async () => {
      // An earlier send of this order that has not confirmed yet: report it, never send again.
      const orderId = String(paymentPayload?.payload?.order?.orderId ?? '').toLowerCase();
      for (const [id, e] of inFlight) if (clock() - e.at >= L.inFlightHoldMs) inFlight.delete(id);
      const earlier = inFlight.get(orderId);
      if (earlier) {
        const receipt = earlier.hash ? await publicClient.getTransactionReceipt({ hash: earlier.hash }).catch(() => null) : null;
        // A write that failed before it had a hash is held a minute only (it most likely never left).
        const hold = earlier.hash ? L.inFlightHoldMs : 60_000;
        if (!receipt && clock() - earlier.at < hold) return { success: false, errorReason: 'in_flight', transaction: earlier.hash, network: network.caip2 };
        inFlight.delete(orderId);
        if (receipt) return settlementOf(earlier.order, earlier.payer, earlier.amount, earlier.hash, decodeReceipt(receipt));
      }
      let checked;
      try {
        checked = await check(paymentPayload, requirements);
        await checkLimits(checked.amount, checked.payer);
      } catch (e) {
        if (!(e instanceof Refusal)) throw e;
        stats.refused++;
        return { success: false, errorReason: e.reason, transaction: '', network: network.caip2 };
      }
      const { order, payload, payer, amount } = checked;
      const permit = { permitted: { token: network.token.address, amount }, nonce: BigInt(order.orderId), deadline: order.deadline };
      consume(amount, payer);
      try {
        const sent = await send('settleOrder', [order, payload.mandateHash, permit, payer, payload.signature, payload.approvalPermit], L.maxSettleGas);
        return settlementOf(order, payer, amount, sent.hash, sent.events);
      } catch (e) {
        if (e instanceof Refusal) return { success: false, errorReason: e.reason, transaction: '', network: network.caip2 };
        if (e instanceof Pending) {
          inFlight.set(order.orderId, { hash: e.hash, at: clock(), order, payer, amount });
          log(`relayer: settle pending (${e.cause})`); // never the message: it can quote the RPC URL
          return { success: false, errorReason: 'pending', transaction: e.hash, network: network.caip2 };
        }
        throw e;
      }
    });
  }

  // Subscriptions: the subscriber's signed terms and Permit2 allowance (sign.mjs), created by
  // this relayer; the first charge is taken when it is due.
  function subscribe({ sub, permitSingle, permitSig, subSig, approvalPermit }) {
    return queue(async () => {
      try {
        const s = {
          subId: sub.subId,
          subscriberNode: sub.subscriberNode,
          shopNode: sub.shopNode,
          payerNode: sub.payerNode,
          subscriber: sub.subscriber,
          merchant: sub.merchant,
          amountMicro: BigInt(sub.amountMicro),
          period: Number(sub.period),
          firstChargeAt: BigInt(sub.firstChargeAt),
        };
        const ps = {
          details: {
            token: permitSingle.details.token,
            amount: BigInt(permitSingle.details.amount),
            expiration: Number(permitSingle.details.expiration),
            nonce: Number(permitSingle.details.nonce),
          },
          spender: permitSingle.spender,
          sigDeadline: BigInt(permitSingle.sigDeadline),
        };
        if (!merchantOk(s.merchant)) refuse('merchant_not_allowed');
        if (!isAddressEqual(ps.details.token, network.token.address) || !isAddressEqual(ps.spender, network.checkout)) refuse('wrong_asset');
        if (s.amountMicro === 0n || s.period < 60) refuse('bad_terms');
        if (ps.sigDeadline <= BigInt(nowSec())) refuse('expired');
        if (!SIG65.test(permitSig) || !SIG65.test(subSig)) refuse('unsupported_signature');
        const digest = await read('subscribeDigest', [s, ps]);
        const signer = await recoverAddress({ hash: digest, signature: subSig }).catch(() => null);
        if (!signer || !isAddressEqual(signer, s.subscriber)) refuse('bad_signature');
        const existing = await read('subscription', [s.subId]);
        if (Number(existing.status ?? existing[11]) !== 0) refuse('subscription_exists');
        const [boundNode, policyRaw, spentToday] = await Promise.all([
          read('nodeOfWallet', [s.subscriber]),
          s.payerNode === ZERO32 ? null : read('policies', [s.payerNode]),
          s.payerNode === ZERO32 ? 0n : read('spentToday', [s.payerNode]),
        ]);
        const due = s.firstChargeAt <= BigInt(nowSec()) ? s.amountMicro : 0n;
        const predicted = predictPolicy({ payerNode: s.payerNode, boundNode, policy: policyRaw ? asPolicy(policyRaw) : null, payer: s.subscriber, spentToday: BigInt(spentToday), amount: due, nowSec: nowSec() });
        if (POLICY_REASONS.has(predicted)) refuse(predicted);
        await checkLimits(s.amountMicro, s.subscriber);
        consume(s.amountMicro, s.subscriber);
        const sent = await send('createSubscription', [s, ps, permitSig, subSig, approvalPermit ?? '0x'], L.maxSubscribeGas);
        const created = sent.events.find((ev) => ev.eventName === 'SubscriptionCreated');
        const charged = sent.events.find((ev) => ev.eventName === 'PaymentSettled');
        return { success: Boolean(created), subId: s.subId, transaction: sent.hash, charged: Boolean(charged), chargeOrderId: charged?.args.orderId, network: network.caip2 };
      } catch (e) {
        if (e instanceof Refusal) return { success: false, errorReason: e.reason, transaction: '', network: network.caip2 };
        if (e instanceof Pending) return { success: false, errorReason: 'pending', transaction: e.hash, network: network.caip2 };
        log(`relayer: subscribe failed (${e?.name ?? 'Error'})`);
        return { success: false, errorReason: 'error', transaction: '', network: network.caip2 };
      }
    });
  }

  function renew(subId) {
    return queue(async () => {
      try {
        const s = await read('subscription', [subId]);
        const sub = Array.isArray(s)
          ? { payerNode: s[2], subscriber: s[3], amountMicro: s[4], merchant: s[6], nextChargeAt: s[7], retryAt: s[9], status: s[11] }
          : s;
        if (SUB_STATUS[Number(sub.status)] !== 'ACTIVE') refuse('not_active');
        if (!merchantOk(sub.merchant)) refuse('merchant_not_allowed');
        const now = BigInt(nowSec());
        if (now < BigInt(sub.nextChargeAt) || now < BigInt(sub.retryAt)) refuse('not_due');
        await checkLimits(BigInt(sub.amountMicro), sub.subscriber);
        consume(BigInt(sub.amountMicro), sub.subscriber);
        const sent = await send('renew', [subId], L.maxRenewGas);
        const renewed = sent.events.find((ev) => ev.eventName === 'SubscriptionRenewed');
        const failed = sent.events.find((ev) => ev.eventName === 'RenewalFailed');
        if (renewed) return { success: true, subId, orderId: renewed.args.orderId, cycle: Number(renewed.args.cycle), amount: String(renewed.args.amountMicro), transaction: sent.hash, network: network.caip2 };
        return { success: false, subId, errorReason: failed ? FAIL_REASON[Number(failed.args.reason)] : 'not_renewed', transaction: sent.hash, network: network.caip2 };
      } catch (e) {
        if (e instanceof Refusal) return { success: false, subId, errorReason: e.reason, transaction: '', network: network.caip2 };
        if (e instanceof Pending) return { success: false, subId, errorReason: 'pending', transaction: e.hash, network: network.caip2 };
        log(`relayer: renew failed (${e?.name ?? 'Error'})`);
        return { success: false, subId, errorReason: 'error', transaction: '', network: network.caip2 };
      }
    });
  }

  function cancelSubscription({ subId, deadline, signature }) {
    return queue(async () => {
      try {
        if (BigInt(deadline) <= BigInt(nowSec())) refuse('expired');
        if (!SIG65.test(signature)) refuse('unsupported_signature');
        const s = await read('subscription', [subId]);
        const subscriber = Array.isArray(s) ? s[3] : s.subscriber;
        const status = SUB_STATUS[Number(Array.isArray(s) ? s[11] : s.status)];
        if (status !== 'ACTIVE' && status !== 'LAPSED') refuse('not_active');
        const signer = await recoverTypedDataAddress({ domain: checkoutDomain(network.chainId, network.checkout), types: cancelTypes, primaryType: 'Cancel', message: { subId, deadline: BigInt(deadline) }, signature }).catch(() => null);
        if (!signer || !isAddressEqual(signer, subscriber)) refuse('bad_signature');
        await checkLimits(0n, subscriber);
        consume(0n, subscriber);
        const sent = await send('cancelWithSig', [subId, BigInt(deadline), signature], L.maxCancelGas);
        const cancelled = sent.events.find((ev) => ev.eventName === 'SubscriptionCancelled');
        return { success: Boolean(cancelled), subId, transaction: sent.hash, network: network.caip2 };
      } catch (e) {
        if (e instanceof Refusal) return { success: false, subId, errorReason: e.reason, transaction: '', network: network.caip2 };
        if (e instanceof Pending) return { success: false, subId, errorReason: 'pending', transaction: e.hash, network: network.caip2 };
        log(`relayer: cancel failed (${e?.name ?? 'Error'})`);
        return { success: false, subId, errorReason: 'error', transaction: '', network: network.caip2 };
      }
    });
  }

  return Object.freeze({
    kind: 'reference',
    address: relayer,
    limits: Object.freeze(L),
    supported: () => ({ kinds: [{ x402Version: X402_VERSION, scheme: SCHEME, network: network.caip2 }], signers: { [network.caip2]: [relayer] } }),
    verify,
    settle,
    subscribe,
    renew,
    cancelSubscription,
    stats: () => ({ ...stats, gasUsed: stats.gasUsed.toString() }),
  });
}
