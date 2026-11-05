// The merchant side: price any route or product with the graphpay-order 402, check and settle
// through a facilitator, and get paid in USDT. Stateless: the order id binds every term, the
// chain is the record, and a paid retry is re-priced from the merchant's own pricer (never
// from the request). Events: paid, payment.failed, refund.requested, refunded, accepted,
// delivered, subscribed, renewal.charged, cancelled.

import { EventEmitter } from 'node:events';
import { randomBytes } from 'node:crypto';
import { encodeAbiParameters, erc20Abi, getAddress, isAddressEqual, keccak256, recoverTypedDataAddress, stringToHex } from 'viem';
import { ORDER_STATUS, SUB_STATUS, checkoutAbi } from '@graphpay/contracts';
import { AgentPayError, assertChain, explorerTx, whitechainNetwork } from './network.mjs';
import { ZERO32, createOrder, nodeOf } from './order.mjs';
import { formatUsdt, toMicro } from './money.mjs';
import { FacilitatorUnavailable } from './facilitator.mjs';
import { refundRequestDomain, refundRequestTypes } from './sign.mjs';
import { toCsv } from './csv.mjs';
import {
  AGENTPAY_EXTENSION,
  HEADERS,
  PAYER_HEADERS,
  buildPaymentRequired,
  buildRequirement,
  decodeHeader,
  encodeHeader,
  getHeader,
  paymentPayloadSchema,
  sameWireOrder,
  toWireOrder,
} from './wire.mjs';

const HEX32 = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const NO_STORE = { 'cache-control': 'no-store' };
const bigintSafe = (_, v) => (typeof v === 'bigint' ? v.toString() : v);
const LOG_CHUNK = 50_000n;

export function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body, bigintSafe), { status, headers: { 'content-type': 'application/json', ...NO_STORE, ...headers } });
}

const asOrder = (o) =>
  Array.isArray(o)
    ? { termsHash: o[0], buyerNode: o[1], shopNode: o[2], merchant: o[3], amountMicro: o[4], kind: o[5], status: o[6], payer: o[9], refundedMicro: o[10] }
    : o;
const asSub = (s) =>
  Array.isArray(s)
    ? { subscriberNode: s[0], shopNode: s[1], payerNode: s[2], subscriber: s[3], amountMicro: s[4], period: s[5], merchant: s[6], nextChargeAt: s[7], cycle: s[8], retryAt: s[9], failures: s[10], status: s[11] }
    : s;

// The default risk check: allow, unless a ReputationProvider rates the payer high risk.
async function defaultRiskCheck({ reputation, payerName, payerNode, payer }) {
  if (!reputation?.assess || payerNode === ZERO32) return { allow: true };
  const r = await reputation.assess({ subject: 'buyer', name: payerName, node: payerNode, address: payer });
  return r?.risk === 'high' ? { allow: false, reason: `reputation: ${(r.reasons ?? ['high risk']).join('; ')}` } : { allow: true, reputation: r };
}

// name: the merchant's ENS-style name (its node is the shop node on-chain); address: the wallet
// that receives USDT; facilitator: verifies and settles (facilitator.mjs); walletClient: the
// merchant's own key, only for refunds and delivery marks (gas in WBT, a bounded USDT float
// approved to the checkout for refunds). pricer(ctx) → { items, fulfilment } or null (free).
export function createMerchant({
  name,
  address,
  facilitator,
  publicClient,
  walletClient,
  network = whitechainNetwork(),
  riskCheck,
  identity,
  reputation,
  quoteTtlSeconds = 300,
  maxRefundMicro,
  resourceBase,
  clock = () => Date.now(),
  log = () => {},
}) {
  if (!name) throw new Error('createMerchant needs a name');
  if (!address || !ADDRESS.test(address)) throw new Error('createMerchant needs a payout address');
  if (!facilitator?.verify || !facilitator?.settle) throw new Error('createMerchant needs a facilitator with verify and settle');
  const merchant = Object.freeze({ name, node: nodeOf(name), address: getAddress(address) });
  const events = new EventEmitter();
  const nowSec = () => Math.floor(clock() / 1000);
  const ttl = BigInt(quoteTtlSeconds);
  const seenRefundRequests = new Set();
  const read = (functionName, args) => publicClient.readContract({ address: network.checkout, abi: checkoutAbi, functionName, args });
  const emit = (event, payload) => {
    try {
      events.emit(event, payload);
    } catch (e) {
      log(`merchant: a ${event} listener threw (${e?.name ?? 'Error'})`);
    }
  };

  function payerOf(request) {
    const addr = getHeader(request.headers, PAYER_HEADERS.address);
    const payerName = getHeader(request.headers, PAYER_HEADERS.name) ?? '';
    const buyerName = getHeader(request.headers, PAYER_HEADERS.buyer) ?? '';
    return {
      payer: { name: payerName.slice(0, 255), address: addr && ADDRESS.test(addr) ? addr : undefined },
      buyer: buyerName ? { name: buyerName.slice(0, 255) } : undefined,
    };
  }

  // An order of this merchant's, from priced lines.
  function order({ items, fulfilment, payer, buyer, deadline, salt, parentOrderId }) {
    return createOrder({
      merchant,
      buyer,
      payer,
      items,
      fulfilment,
      deadline: deadline ?? BigInt(nowSec()) + ttl,
      salt: salt ?? `0x${randomBytes(32).toString('hex')}`,
      parentOrderId,
    });
  }

  function resourceUrl(request) {
    const u = new URL(request.url);
    return resourceBase ? new URL(u.pathname + u.search, resourceBase).toString() : u.toString();
  }

  // The core: → { paid: true, order, settlement, alreadyPaid } or { response } (402, 403, 502).
  async function charge(request, pricer, extra = {}) {
    const ctx = { request, url: new URL(request.url), ...extra };
    const priced = await pricer(ctx);
    if (!priced) return { free: true };
    const who = payerOf(request);
    const signatureHeader = getHeader(request.headers, HEADERS.signature);

    if (!signatureHeader) {
      const headerSalt = getHeader(request.headers, PAYER_HEADERS.salt);
      const o = order({ ...priced, ...who, salt: headerSalt && HEX32.test(headerSalt) ? headerSalt : undefined });
      const pr = buildPaymentRequired(o, network, { resourceUrl: resourceUrl(request), description: priced.description });
      return { response: jsonResponse(402, pr, { [HEADERS.required]: encodeHeader(pr) }), order: o };
    }

    const paymentPayload = decodeHeader(signatureHeader);
    const parsed = paymentPayloadSchema.safeParse(paymentPayload);
    if (!parsed.success) return { response: jsonResponse(400, { error: 'unreadable payment signature' }) };
    const echoed = parsed.data.extensions?.[AGENTPAY_EXTENSION]?.order;
    const wireDeadline = BigInt(parsed.data.accepted.extra.order.deadline);
    const now = BigInt(nowSec());
    if (!echoed || typeof echoed !== 'object' || !HEX32.test(echoed.salt ?? '') || !HEX32.test(echoed.parentOrderId ?? '')) {
      return { response: jsonResponse(400, { error: 'the payment does not echo its agentpay order' }) };
    }
    if (wireDeadline <= now || wireDeadline > now + ttl + 60n) return { response: jsonResponse(402, { error: 'quote expired, request a new one' }) };
    if (echoed.parentOrderId !== (priced.parentOrderId ?? ZERO32)) return { response: jsonResponse(400, { error: 'the payment names another parent order' }) };
    // Re-price from our own pricer; only the deadline and salt come from the echo.
    let o;
    try {
      o = order({ ...priced, ...who, deadline: wireDeadline, salt: echoed.salt });
    } catch (e) {
      return { response: jsonResponse(400, { error: 'the order could not be rebuilt' }) };
    }
    const requirement = buildRequirement(o, network);
    const accepted = parsed.data.accepted;
    const same =
      sameWireOrder(accepted.extra.order, toWireOrder(o.chain)) &&
      sameWireOrder(parsed.data.payload.order, toWireOrder(o.chain)) &&
      accepted.amount === requirement.amount &&
      isAddressEqual(accepted.payTo, requirement.payTo) &&
      isAddressEqual(accepted.asset, requirement.asset) &&
      isAddressEqual(accepted.extra.contract, requirement.extra.contract) &&
      accepted.network === requirement.network;
    if (!same) {
      const pr = buildPaymentRequired(order({ ...priced, ...who }), network, { resourceUrl: resourceUrl(request), error: 'the signed order is not this route\'s order' });
      return { response: jsonResponse(402, pr, { [HEADERS.required]: encodeHeader(pr) }) };
    }

    const onchain = asOrder(await read('orders', [o.orderId]));
    const status = ORDER_STATUS[Number(onchain.status)];
    if (status === 'PAID' || status === 'DELIVERED') return { paid: true, alreadyPaid: true, order: o, settlement: { success: true, alreadyPaid: true, transaction: '', network: network.caip2 } };

    const payer = parsed.data.payload.payer;
    const payerName = parsed.data.payload.payerName;
    const risk = await (riskCheck ?? defaultRiskCheck)({ order: o, payer, payerName, payerNode: o.payer.node, request, reputation, identity });
    if (!risk?.allow) {
      emit('payment.failed', { order: o, reason: 'risk_refused', detail: risk?.reason });
      return { response: jsonResponse(403, { error: 'refused by the merchant risk check', reason: risk?.reason ?? 'refused' }) };
    }

    let settlement;
    try {
      const verdict = await facilitator.verify(paymentPayload, requirement);
      if (!verdict?.isValid) {
        emit('payment.failed', { order: o, reason: verdict?.invalidReason ?? 'invalid' });
        const pr = buildPaymentRequired(o, network, { resourceUrl: resourceUrl(request), error: verdict?.invalidReason ?? 'invalid payment' });
        return { response: jsonResponse(402, pr, { [HEADERS.required]: encodeHeader(pr), [HEADERS.response]: encodeHeader({ success: false, errorReason: verdict?.invalidReason ?? 'invalid', transaction: '', network: network.caip2 }) }) };
      }
      settlement = await facilitator.settle(paymentPayload, requirement);
    } catch (e) {
      if (e instanceof FacilitatorUnavailable) return { response: jsonResponse(502, { error: 'the facilitator is unavailable; retrying with the same signature is safe' }) };
      throw e;
    }
    if (!settlement?.success) {
      emit('payment.failed', { order: o, reason: settlement?.errorReason ?? 'not_settled', transaction: settlement?.transaction });
      return { response: jsonResponse(402, { error: settlement?.errorReason ?? 'payment failed', transaction: settlement?.transaction || undefined }, { [HEADERS.response]: encodeHeader(settlement ?? { success: false }) }) };
    }
    emit('paid', { order: o, payer, payerName, transaction: settlement.transaction, explorer: settlement.transaction ? explorerTx(network, settlement.transaction) : undefined });
    return { paid: true, order: o, settlement };
  }

  // A Fetch route handler (Next.js App Router, Hono, Bun, Deno, Node 18+).
  function route(pricer, handler) {
    return async (request, routeCtx) => {
      try {
        const result = await charge(request, pricer, { routeCtx });
        if (result.response) return result.response;
        const inner = await handler(request, { ...result, routeCtx });
        const response = inner instanceof Response ? inner : jsonResponse(200, inner ?? { ok: true });
        if (result.settlement) {
          const headers = new Headers(response.headers);
          headers.set(HEADERS.response, encodeHeader(result.settlement));
          headers.set('cache-control', 'no-store');
          return new Response(response.body, { status: response.status, headers });
        }
        return response;
      } catch (e) {
        log(`merchant: ${e?.name ?? 'Error'}`);
        return jsonResponse(500, { error: 'internal error' });
      }
    };
  }

  // Express middleware: a paid request continues to next() with req.agentpay = { order, settlement }.
  function express(pricer) {
    return async (req, res, next) => {
      try {
        const request = await toFetchRequest(req);
        const result = await charge(request, (ctx) => pricer({ ...ctx, req }), { req });
        if (result.response) return sendFetchResponse(res, result.response);
        req.agentpay = result;
        if (result.settlement) res.setHeader(HEADERS.response, encodeHeader(result.settlement));
        return next();
      } catch (e) {
        log(`merchant: ${e?.name ?? 'Error'}`);
        return sendFetchResponse(res, jsonResponse(500, { error: 'internal error' }));
      }
    };
  }

  // A plain node:http listener: handler(req, { order, settlement }) returns a body or a Response.
  function node(pricer, handler) {
    const fetchHandler = route(pricer, (request, result) => handler(request, result));
    return async (req, res) => {
      const response = await fetchHandler(await toFetchRequest(req));
      await sendFetchResponse(res, response);
    };
  }

  // --- after the payment ---------------------------------------------------------------

  async function ownOrder(orderId) {
    if (!HEX32.test(orderId)) throw new AgentPayError('BAD_ORDER_ID', 'an order id is 32-byte hex');
    const o = asOrder(await read('orders', [orderId]));
    if (!isAddressEqual(o.merchant, merchant.address) || o.shopNode !== merchant.node) throw new AgentPayError('NOT_OUR_ORDER', 'this order belongs to another merchant');
    return { ...o, status: ORDER_STATUS[Number(o.status)], amountMicro: BigInt(o.amountMicro), refundedMicro: BigInt(o.refundedMicro) };
  }

  async function sendOwn(functionName, args) {
    if (!walletClient?.account) throw new AgentPayError('NO_MERCHANT_KEY', 'refunds and delivery marks need the merchant wallet client');
    if (!isAddressEqual(walletClient.account.address, merchant.address)) throw new AgentPayError('WRONG_MERCHANT_KEY', 'the wallet client is not the payout wallet');
    await assertChain(publicClient, network);
    const hash = await walletClient.writeContract({ address: network.checkout, abi: checkoutAbi, functionName, args, chain: walletClient.chain, account: walletClient.account });
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
    if (receipt.status !== 'success') throw new AgentPayError('TX_REVERTED', `${functionName} reverted`, { transaction: hash });
    return { transaction: hash, explorer: explorerTx(network, hash), gasUsed: receipt.gasUsed };
  }

  // A partial or full refund, merchant → payer, capped at what is left. reasonCode: 0..255.
  async function refund(orderId, amountMicro, { reasonCode = 1, note } = {}) {
    const o = await ownOrder(orderId);
    if (o.status !== 'PAID' && o.status !== 'DELIVERED') throw new AgentPayError('NOT_REFUNDABLE', `the order is ${o.status}`);
    const amount = toMicro(amountMicro, 'amountMicro');
    if (amount === 0n) throw new AgentPayError('BAD_AMOUNT', 'a refund is above zero');
    const left = o.amountMicro - o.refundedMicro;
    if (amount > left) throw new AgentPayError('OVER_REFUNDABLE', `only ${formatUsdt(left)} is left to refund`);
    if (maxRefundMicro !== undefined && amount > BigInt(maxRefundMicro)) throw new AgentPayError('OVER_REFUND_MAX', `refunds above ${formatUsdt(maxRefundMicro)} need a person`);
    const [balance, allowance] = await Promise.all([
      publicClient.readContract({ address: network.token.address, abi: erc20Abi, functionName: 'balanceOf', args: [merchant.address] }),
      publicClient.readContract({ address: network.token.address, abi: erc20Abi, functionName: 'allowance', args: [merchant.address, network.checkout] }),
    ]);
    if (balance < amount || allowance < amount) throw new AgentPayError('NO_REFUND_FLOAT', 'the payout wallet lacks the balance or the checkout allowance for this refund');
    const sent = await sendOwn('refund', [orderId, amount, Number(reasonCode)]);
    emit('refunded', { orderId, amountMicro: amount, note, ...sent });
    return { orderId, amountMicro: amount, full: amount === left, ...sent };
  }

  async function deliver(orderId) {
    const o = await ownOrder(orderId);
    if (o.status !== 'PAID') throw new AgentPayError('NOT_DELIVERABLE', `the order is ${o.status}`);
    const sent = await sendOwn('markDelivered', [orderId]);
    emit('delivered', { orderId, ...sent });
    return { orderId, ...sent };
  }

  // Accept a paid order for fulfilment, after the risk check.
  async function accept(orderId, context = {}) {
    const o = await ownOrder(orderId);
    if (o.status !== 'PAID') return { accepted: false, orderId, reason: `the order is ${o.status}` };
    const risk = await (riskCheck ?? defaultRiskCheck)({ order: { orderId, ...o }, payer: o.payer, payerName: context.payerName ?? '', payerNode: context.payerNode ?? ZERO32, reputation, identity, context });
    if (!risk?.allow) return { accepted: false, orderId, reason: risk?.reason ?? 'refused by the risk check' };
    emit('accepted', { orderId, amountMicro: o.amountMicro, payer: o.payer });
    return { accepted: true, orderId, amountMicro: o.amountMicro, payer: o.payer };
  }

  // POST endpoint for signed refund requests from payers (buyer.requestRefund). It checks the
  // signer paid the order and emits refund.requested; deciding and refunding stay with the merchant.
  function refundRequests() {
    return async (request) => {
      try {
        const body = await request.json().catch(() => null);
        const r = body?.request;
        if (!r || !HEX32.test(r.orderId ?? '') || !/^\d{1,20}$/.test(r.amountMicro ?? '') || !/^\d{1,20}$/.test(r.deadline ?? '') || typeof r.reason !== 'string' || r.reason.length > 280 || !/^0x[0-9a-fA-F]{130}$/.test(body.signature ?? '')) {
          return jsonResponse(400, { error: 'unreadable refund request' });
        }
        if (BigInt(r.deadline) <= BigInt(nowSec())) return jsonResponse(400, { error: 'the refund request has expired' });
        const message = { orderId: r.orderId, amountMicro: BigInt(r.amountMicro), reason: r.reason, deadline: BigInt(r.deadline) };
        const signer = await recoverTypedDataAddress({ domain: refundRequestDomain(network), types: refundRequestTypes, primaryType: 'RefundRequest', message, signature: body.signature }).catch(() => null);
        let o;
        try {
          o = await ownOrder(r.orderId);
        } catch {
          return jsonResponse(404, { error: 'no such order at this merchant' });
        }
        if (!signer || !isAddressEqual(signer, o.payer)) return jsonResponse(403, { error: 'only the payer of an order may ask for its refund' });
        if (o.status !== 'PAID' && o.status !== 'DELIVERED') return jsonResponse(409, { error: `the order is ${o.status}` });
        const left = o.amountMicro - o.refundedMicro;
        if (message.amountMicro === 0n || message.amountMicro > left) return jsonResponse(409, { error: `at most ${formatUsdt(left)} is refundable` });
        const key = `${r.orderId}:${body.signature.toLowerCase()}`;
        if (seenRefundRequests.has(key)) return jsonResponse(200, { status: 'requested', orderId: r.orderId, duplicate: true });
        if (seenRefundRequests.size > 10_000) seenRefundRequests.clear();
        seenRefundRequests.add(key);
        emit('refund.requested', { orderId: r.orderId, amountMicro: message.amountMicro, reason: r.reason, payer: signer, refundableMicro: left });
        return jsonResponse(202, { status: 'requested', orderId: r.orderId, amountMicro: r.amountMicro });
      } catch (e) {
        log(`merchant: ${e?.name ?? 'Error'}`);
        return jsonResponse(500, { error: 'internal error' });
      }
    };
  }

  // --- subscriptions --------------------------------------------------------------------

  // plan: { id, items, amountMicro, periodSeconds, maxCycles }. GET → the offer for the
  // identified subscriber; POST → the signed subscription, created through the facilitator.
  function subscriptions(plan) {
    const amount = toMicro(plan.amountMicro, 'plan.amountMicro');
    const period = Number(plan.periodSeconds);
    const maxCycles = Number(plan.maxCycles ?? 52);
    if (!Number.isSafeInteger(period) || period < 60) throw new Error('a plan period is at least 60 seconds');
    const planHash = keccak256(stringToHex(String(plan.id)));
    const subIdOf = (s) =>
      keccak256(
        encodeAbiParameters(
          [{ type: 'bytes32' }, { type: 'address' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'address' }, { type: 'bytes32' }, { type: 'uint64' }],
          [s.shopNode, s.merchant, s.subscriberNode, s.payerNode, s.subscriber, planHash, BigInt(s.firstChargeAt)],
        ),
      );
    return async (request) => {
      try {
        if (request.method === 'GET') {
          const who = payerOf(request);
          if (!who.payer.address) return jsonResponse(400, { error: `identify the subscriber with the ${PAYER_HEADERS.address} header` });
          const payerNode = nodeOf(who.payer.name);
          const sub = {
            subscriberNode: who.buyer ? nodeOf(who.buyer.name) : payerNode,
            shopNode: merchant.node,
            payerNode,
            subscriber: getAddress(who.payer.address),
            merchant: merchant.address,
            amountMicro: amount.toString(),
            period,
            firstChargeAt: String(nowSec()),
          };
          sub.subId = subIdOf(sub);
          return jsonResponse(200, { agentpay: 'subscription/v1', plan: { id: plan.id, items: plan.items, amountMicro: amount.toString(), periodSeconds: period }, merchant: { name: merchant.name, address: merchant.address }, maxCycles, sub });
        }
        if (request.method !== 'POST') return jsonResponse(405, { error: 'GET or POST' });
        if (!facilitator.subscribe) return jsonResponse(501, { error: 'this facilitator does not create subscriptions' });
        const body = await request.json().catch(() => null);
        const s = body?.sub;
        if (!s || !HEX32.test(s.subId ?? '') || !ADDRESS.test(s.subscriber ?? '')) return jsonResponse(400, { error: 'unreadable subscription' });
        if (s.shopNode !== merchant.node || !isAddressEqual(s.merchant, merchant.address) || String(s.amountMicro) !== amount.toString() || Number(s.period) !== period) {
          return jsonResponse(400, { error: 'the subscription terms are not this plan' });
        }
        if (Number(body.maxCycles) !== maxCycles || subIdOf(s) !== s.subId) return jsonResponse(400, { error: 'the subscription id does not match its terms' });
        const firstChargeAt = BigInt(s.firstChargeAt);
        if (firstChargeAt > BigInt(nowSec()) + 60n || firstChargeAt < BigInt(nowSec()) - BigInt(quoteTtlSeconds)) return jsonResponse(400, { error: 'the offer has expired, request a new one' });
        const result = await facilitator.subscribe({ sub: s, permitSingle: body.permitSingle, permitSig: body.permitSig, subSig: body.subSig, approvalPermit: body.approvalPermit ?? '0x' });
        if (!result?.success) return jsonResponse(402, { error: result?.errorReason ?? 'not subscribed', transaction: result?.transaction || undefined });
        emit('subscribed', { subId: s.subId, subscriber: s.subscriber, amountMicro: amount, transaction: result.transaction });
        if (result.charged) emit('renewal.charged', { subId: s.subId, orderId: result.chargeOrderId, cycle: 1, amountMicro: amount, transaction: result.transaction });
        return jsonResponse(201, { status: 'subscribed', subId: s.subId, transaction: result.transaction, charged: result.charged });
      } catch (e) {
        if (e instanceof FacilitatorUnavailable) return jsonResponse(502, { error: 'the facilitator is unavailable' });
        log(`merchant: ${e?.name ?? 'Error'}`);
        return jsonResponse(500, { error: 'internal error' });
      }
    };
  }

  // POST { subId, deadline, signature } (buyer.cancel): relayed as cancelWithSig.
  function cancellations() {
    return async (request) => {
      try {
        if (!facilitator.cancelSubscription) return jsonResponse(501, { error: 'this facilitator does not relay cancellations' });
        const body = await request.json().catch(() => null);
        if (!body || !HEX32.test(body.subId ?? '') || !/^\d{1,20}$/.test(String(body.deadline ?? '')) || !/^0x[0-9a-fA-F]{130}$/.test(body.signature ?? '')) return jsonResponse(400, { error: 'unreadable cancellation' });
        const s = asSub(await read('subscription', [body.subId]));
        if (s.shopNode !== merchant.node) return jsonResponse(404, { error: 'no such subscription at this merchant' });
        const result = await facilitator.cancelSubscription({ subId: body.subId, deadline: String(body.deadline), signature: body.signature });
        if (!result?.success) return jsonResponse(409, { error: result?.errorReason ?? 'not cancelled' });
        emit('cancelled', { subId: body.subId, transaction: result.transaction });
        return jsonResponse(200, { status: 'cancelled', subId: body.subId, transaction: result.transaction });
      } catch (e) {
        if (e instanceof FacilitatorUnavailable) return jsonResponse(502, { error: 'the facilitator is unavailable' });
        log(`merchant: ${e?.name ?? 'Error'}`);
        return jsonResponse(500, { error: 'internal error' });
      }
    };
  }

  async function logsOf(eventName, args, fromBlock, toBlock) {
    const out = [];
    for (let start = fromBlock; start <= toBlock; start += LOG_CHUNK) {
      const end = start + LOG_CHUNK - 1n > toBlock ? toBlock : start + LOG_CHUNK - 1n;
      const event = checkoutAbi.find((e) => e.type === 'event' && e.name === eventName);
      out.push(...(await publicClient.getLogs({ address: network.checkout, event, args, fromBlock: start, toBlock: end })));
    }
    return out;
  }

  async function ourSubscriptions(fromBlock, toBlock) {
    const created = await logsOf('SubscriptionCreated', { shopNode: merchant.node }, fromBlock, toBlock);
    return created.map((l) => l.args.subId);
  }

  // Charge every subscription of ours that is due, through the facilitator's renew.
  async function chargeDueRenewals({ fromBlock = network.deployBlock } = {}) {
    if (!facilitator.renew) throw new AgentPayError('NO_RENEW', 'this facilitator does not renew subscriptions');
    const toBlock = await publicClient.getBlockNumber();
    const results = [];
    for (const subId of await ourSubscriptions(fromBlock, toBlock)) {
      const s = asSub(await read('subscription', [subId]));
      const now = BigInt(nowSec());
      if (SUB_STATUS[Number(s.status)] !== 'ACTIVE' || now < BigInt(s.nextChargeAt) || now < BigInt(s.retryAt)) continue;
      const r = await facilitator.renew(subId);
      if (r?.success) emit('renewal.charged', { subId, orderId: r.orderId, cycle: r.cycle, amountMicro: BigInt(r.amount ?? s.amountMicro), transaction: r.transaction });
      else emit('payment.failed', { subId, reason: r?.errorReason ?? 'not_renewed', transaction: r?.transaction });
      results.push({ subId, ...r });
    }
    return results;
  }

  // Poll the chain for renewals of our subscriptions charged by any relayer; emits renewal.charged.
  function watchRenewals({ intervalMs = 5_000, fromBlock } = {}) {
    let next = fromBlock;
    let stopped = false;
    const ours = new Map();
    async function tick() {
      const head = await publicClient.getBlockNumber();
      if (next === undefined) next = head;
      if (head < next) return;
      for (const l of await logsOf('SubscriptionRenewed', undefined, next, head)) {
        const { subId, orderId, cycle, amountMicro } = l.args;
        if (!ours.has(subId)) ours.set(subId, asSub(await read('subscription', [subId])).shopNode === merchant.node);
        if (ours.get(subId)) emit('renewal.charged', { subId, orderId, cycle: Number(cycle), amountMicro, transaction: l.transactionHash });
      }
      next = head + 1n;
    }
    const loop = async () => {
      while (!stopped) {
        try {
          await tick();
        } catch (e) {
          log(`merchant: renewal watch (${e?.name ?? 'Error'})`);
        }
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    };
    loop();
    return { stop: () => (stopped = true), tick };
  }

  // Every order of ours from the chain, as CSV: one row per order with payments and refunds.
  async function exportCsv({ fromBlock = network.deployBlock, toBlock } = {}) {
    const to = toBlock ?? (await publicClient.getBlockNumber());
    const args = { shopNode: merchant.node };
    const [created, settled, refunded] = await Promise.all([
      logsOf('OrderCreated', args, fromBlock, to),
      logsOf('PaymentSettled', args, fromBlock, to),
      logsOf('Refunded', args, fromBlock, to),
    ]);
    const rows = new Map();
    for (const l of created) {
      rows.set(l.args.orderId, {
        order_id: l.args.orderId,
        kind: ['one-off', 'reorder', 'renewal'][Number(l.args.kind)] ?? String(l.args.kind),
        merchant: merchant.name,
        buyer_node: l.args.buyerNode,
        payer_node: l.args.payerNode,
        amount_usdt: formatUsdt(l.args.amountMicro),
        created_block: l.blockNumber,
        status: 'CREATED',
        payer: '',
        paid_tx: '',
        refunded_usdt: '0.00',
        refund_txs: '',
        explorer: '',
      });
    }
    for (const l of settled) {
      const row = rows.get(l.args.orderId);
      if (!row) continue;
      Object.assign(row, { status: 'PAID', payer: l.args.payer, paid_tx: l.transactionHash, paid_day_utc: new Date(Number(l.args.day) * 86_400_000).toISOString().slice(0, 10), explorer: explorerTx(network, l.transactionHash) });
    }
    for (const l of refunded) {
      const row = rows.get(l.args.orderId);
      if (!row) continue;
      row.refunded_usdt = formatUsdt(l.args.totalRefundedMicro);
      row.refund_txs = row.refund_txs ? `${row.refund_txs} ${l.transactionHash}` : l.transactionHash;
      row.status = l.args.full ? 'REFUNDED' : row.status;
    }
    const columns = ['order_id', 'kind', 'merchant', 'status', 'amount_usdt', 'refunded_usdt', 'payer', 'payer_node', 'buyer_node', 'paid_day_utc', 'created_block', 'paid_tx', 'refund_txs', 'explorer'];
    return toCsv(columns, [...rows.values()].sort((a, b) => (a.created_block < b.created_block ? -1 : 1)));
  }

  return Object.freeze({
    ...merchant,
    network,
    on: (event, fn) => (events.on(event, fn), undefined),
    off: (event, fn) => (events.off(event, fn), undefined),
    once: (event, fn) => (events.once(event, fn), undefined),
    order,
    charge,
    route,
    express,
    node,
    refund,
    deliver,
    accept,
    refundRequests,
    subscriptions,
    cancellations,
    chargeDueRenewals,
    watchRenewals,
    exportCsv,
  });
}

// --- node:http and Express glue --------------------------------------------------------

const BODY_LIMIT = 64 * 1024;

export async function toFetchRequest(req) {
  const host = req.headers.host ?? 'localhost';
  const proto = req.headers['x-forwarded-proto'] === 'https' || req.socket?.encrypted ? 'https' : 'http';
  const url = new URL(req.originalUrl ?? req.url, `${proto}://${host}`);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (req.body !== undefined) body = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
    else {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > BODY_LIMIT) throw new AgentPayError('BODY_TOO_LARGE', 'the request body is over 64 KB');
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks);
    }
  }
  return new Request(url, { method: req.method, headers, body });
}

export async function sendFetchResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((v, k) => res.setHeader(k, v));
  res.end(Buffer.from(await response.arrayBuffer()));
}
