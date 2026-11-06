// The buyer side: a customer agent that answers an HTTP 402 with one signature and no gas,
// under a spending pass and a mandate. The model proposes, code disposes (ADR-0019): every
// limit is checked here, in code, before anything is signed, and the contract checks the
// on-chain pass again at settlement.

import { createHash } from 'node:crypto';
import { getAddress, isAddressEqual } from 'viem';
import { checkoutAbi, ORDER_STATUS, SUB_STATUS } from './vendor/index.mjs';
import { UNCERTAIN } from './facilitator.mjs';
import { AgentPayError, assertChain, assertClientChain, whitechainNetwork } from './network.mjs';
import { canonicalJson, nodeOf, ZERO32, ZERO_ADDRESS } from './order.mjs';
import { formatUsdt, toMicro } from './money.mjs';
import { PERIOD_DAYS, readSpendingPass, spentInPeriod } from './pass.mjs';
import { DEFAULT_APPROVAL_MICRO, signCancel, signOrderPayment, signRefundRequest, signSubscription } from './sign.mjs';
import { HEADERS, MAX_TIMEOUT_SECONDS, PAYER_HEADERS, X402_VERSION, decodeHeader, encodeHeader, getHeader, orderOfPaymentRequired } from './wire.mjs';

export const MANDATE_SCHEMA = 'agentpay.mandate/v1';

// The human's intent ("at most 6 USDT, by 20:00"), hashed into every payment it covers.
export function createMandate({ buyer = '', request = '', budgetMicro, deadlineMs, merchants = [], currency = 'USDT' }) {
  const budget = toMicro(budgetMicro, 'budgetMicro');
  if (!Number.isFinite(deadlineMs)) throw new Error('a mandate needs a deadline (ms)');
  if (typeof request !== 'string' || request.length > 2000) throw new Error('the request is at most 2000 characters');
  const fields = { schema: MANDATE_SCHEMA, buyer, currency, budgetMicro: budget, deadline: new Date(deadlineMs).toISOString(), merchants: [...merchants].map(String).sort(), request };
  const hash = `0x${createHash('sha256').update(canonicalJson(fields)).digest('hex')}`;
  return Object.freeze({ buyer, request, currency, budgetMicro: budget, deadlineMs, merchants: Object.freeze([...merchants]), hash });
}

const lowerName = (v) => String(v).toLowerCase();

function merchantAllowed(list, merchant) {
  if (!list || list.length === 0) return true;
  return list.some((entry) => (/^0x[0-9a-fA-F]{40}$/.test(entry) ? isAddressEqual(entry, merchant.address) : lowerName(entry) === lowerName(merchant.name)));
}

// One payment at a time per agent: guards, signature and settlement run as one step, so two
// parallel calls can never both pass the same remaining cap.
function serial() {
  let tail = Promise.resolve();
  return (fn) => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => {});
    return run;
  };
}

// account: a viem local account (the key never leaves it). name: the agent's ENS-style name
// ('' for a human payer, who has no on-chain pass). pass: { capMicro, period, perPaymentMaxMicro?,
// merchants? }. mandate: from createMandate (optional; without one the pass is the mandate).
export function createBuyerAgent({
  account,
  publicClient,
  network = whitechainNetwork(),
  name = '',
  buyerName,
  pass,
  mandate,
  identity,
  reputation,
  approvalMicro = DEFAULT_APPROVAL_MICRO,
  fetch: fetchImpl = globalThis.fetch,
  clock = () => Date.now(),
  onEvent = () => {},
}) {
  if (!account?.address || typeof account.signTypedData !== 'function') throw new Error('createBuyerAgent needs a local account that can sign typed data');
  if (!pass || pass.capMicro === undefined) throw new Error('createBuyerAgent needs a spending pass { capMicro, period }');
  assertClientChain(publicClient, network);
  const period = pass.period ?? 'day';
  if (!PERIOD_DAYS[period]) throw new Error(`pass period must be one of ${Object.keys(PERIOD_DAYS).join(', ')}`);
  const limits = Object.freeze({
    capMicro: toMicro(pass.capMicro, 'pass.capMicro'),
    period,
    perPaymentMaxMicro: pass.perPaymentMaxMicro === undefined ? undefined : toMicro(pass.perPaymentMaxMicro, 'pass.perPaymentMaxMicro'),
    merchants: Object.freeze([...(pass.merchants ?? [])]),
  });
  const node = nodeOf(name);
  const buyerNode = buyerName ? nodeOf(buyerName) : node;
  const address = getAddress(account.address);
  const nowSec = () => Math.floor(clock() / 1000);
  const mandateHash = mandate?.hash ?? createMandate({ buyer: buyerName ?? name, request: 'standing spending pass', budgetMicro: limits.capMicro, deadlineMs: 8_640_000_000_000_000 }).hash;
  const ledger = { mandateSpentMicro: 0n, humanPeriod: new Map(), pendingMicro: 0n };
  const pending = new Map();
  const lock = serial();

  async function passStatus() {
    const t = nowSec();
    if (node === ZERO32) {
      return { human: true, address, period, capMicro: limits.capMicro, spentInPeriodMicro: humanSpent(t), merchants: limits.merchants };
    }
    const onchain = await readSpendingPass({ publicClient, network, node, wallet: address, nowSec: t });
    const spent = await spentInPeriod({ publicClient, network, node, epoch: onchain.epoch, period, nowSec: t });
    return {
      human: false,
      name,
      node,
      address,
      period,
      capMicro: limits.capMicro,
      spentInPeriodMicro: spent,
      remainingInPeriodMicro: limits.capMicro > spent ? limits.capMicro - spent : 0n,
      perPaymentMaxMicro: limits.perPaymentMaxMicro,
      merchants: limits.merchants,
      onchain,
      pendingMicro: ledger.pendingMicro,
      mandate: mandate ? { budgetMicro: mandate.budgetMicro, spentMicro: ledger.mandateSpentMicro, deadlineMs: mandate.deadlineMs } : undefined,
    };
  }

  const periodKey = (t) => BigInt(t) / (86_400n * BigInt(PERIOD_DAYS[period]));
  function humanSpent(t) {
    return ledger.humanPeriod.get(periodKey(t)) ?? 0n;
  }

  // Every guard, in code, before a signature. Throws AgentPayError with the reason.
  async function check(order, { maxMicro } = {}) {
    const t = nowSec();
    const amount = order.totalMicro;
    const refuse = (code, message) => {
      throw new AgentPayError(code, message, { orderId: order.orderId, amountMicro: amount.toString() });
    };
    if (order.payer.node !== node) refuse('NOT_FOR_THIS_PAYER', 'the order was built for another payer');
    if (order.payer.address !== ZERO_ADDRESS && !isAddressEqual(order.payer.address, address)) refuse('NOT_FOR_THIS_PAYER', 'the order binds another wallet');
    if (order.buyer.node !== buyerNode) refuse('NOT_FOR_THIS_BUYER', 'the order names another buyer');
    if (BigInt(order.deadline) <= BigInt(t)) refuse('ORDER_EXPIRED', 'the order deadline has passed');
    // A signature lives until its deadline: never sign one that outlives the scheme's timeout.
    if (BigInt(order.deadline) > BigInt(t) + BigInt(MAX_TIMEOUT_SECONDS) + 60n) refuse('DEADLINE_TOO_FAR', 'the order deadline is further out than the payment timeout');
    await spendGuards(order.merchant, amount, { maxMicro, refuse, t });
    const onchainOrder = await publicClient.readContract({ address: network.checkout, abi: checkoutAbi, functionName: 'orders', args: [order.orderId] });
    const status = ORDER_STATUS[Number(onchainOrder.status ?? onchainOrder[6])];
    return { status };
  }

  // The guards on any charge of `amount` to `merchant` ({ name, node, address }): a payment,
  // or a subscription's charge. The allowlist, the per-payment and caller maximum, the mandate,
  // the identity resolver and the reputation provider, the on-chain pass and its daily cap,
  // and the period cap.
  async function spendGuards(merchant, amount, { maxMicro, refuse, t = nowSec() }) {
    const order = { merchant };
    if (!merchantAllowed(limits.merchants, order.merchant)) refuse('MERCHANT_NOT_ALLOWED', `${order.merchant.name} is not on the pass allowlist`);
    if (limits.perPaymentMaxMicro !== undefined && amount > limits.perPaymentMaxMicro) refuse('OVER_PAYMENT_MAX', `${formatUsdt(amount)} is above the per-payment maximum ${formatUsdt(limits.perPaymentMaxMicro)}`);
    if (maxMicro !== undefined && amount > toMicro(maxMicro, 'maxMicro')) refuse('OVER_CALLER_MAX', `${formatUsdt(amount)} is above the asked maximum ${formatUsdt(maxMicro)}`);
    if (mandate) {
      if (clock() >= mandate.deadlineMs) refuse('MANDATE_EXPIRED', 'the mandate deadline has passed');
      if (!merchantAllowed(mandate.merchants, order.merchant)) refuse('MERCHANT_NOT_IN_MANDATE', `${order.merchant.name} is not in the mandate`);
      if (ledger.mandateSpentMicro + amount > mandate.budgetMicro) refuse('OVER_BUDGET', `${formatUsdt(amount)} would take the mandate over its budget ${formatUsdt(mandate.budgetMicro)}`);
    }
    if (identity?.verifyMerchant) {
      const ok = await identity.verifyMerchant({ name: order.merchant.name, node: order.merchant.node, address: order.merchant.address });
      if (!ok) refuse('MERCHANT_NOT_VERIFIED', `the identity resolver does not vouch for ${order.merchant.name} at its address`);
    }
    if (reputation?.assess) {
      const r = await reputation.assess({ subject: 'merchant', name: order.merchant.name, node: order.merchant.node, address: order.merchant.address });
      if (r?.risk === 'high') refuse('MERCHANT_HIGH_RISK', `${order.merchant.name}: ${(r.reasons ?? ['rated high risk']).join('; ')}`);
    }
    if (node === ZERO32) {
      if (humanSpent(t) + amount > limits.capMicro) refuse('OVER_PERIOD_CAP', `would pass the ${period} cap ${formatUsdt(limits.capMicro)}`);
    } else {
      const p = await readSpendingPass({ publicClient, network, node, wallet: address, nowSec: t });
      if (!p.exists || !isAddressEqual(p.wallet, address) || p.boundNode !== node) refuse('NO_PASS', 'no on-chain spending pass binds this wallet to this agent');
      if (p.revoked) refuse('PASS_REVOKED', 'the spending pass is revoked');
      if (p.expired) refuse('PASS_EXPIRED', 'the spending pass has expired');
      if (p.spentTodayMicro + ledger.pendingMicro + amount > p.dailyCapMicro) refuse('OVER_DAILY_CAP', `would pass the on-chain daily cap ${formatUsdt(p.dailyCapMicro)} (spent ${formatUsdt(p.spentTodayMicro)} today)`);
      const spent = await spentInPeriod({ publicClient, network, node, epoch: p.epoch, period, nowSec: t });
      if (spent + ledger.pendingMicro + amount > limits.capMicro) refuse('OVER_PERIOD_CAP', `would pass the ${period} cap ${formatUsdt(limits.capMicro)} (spent ${formatUsdt(spent)})`);
    }
  }

  function identityHeaders(extra = {}) {
    const h = { ...Object.fromEntries(new Headers(extra)), [PAYER_HEADERS.address]: address };
    if (name) h[PAYER_HEADERS.name] = name;
    if (buyerName) h[PAYER_HEADERS.buyer] = buyerName;
    return h;
  }

  async function readPaymentRequired(response) {
    const fromHeader = decodeHeader(getHeader(response.headers, HEADERS.required));
    if (fromHeader) return fromHeader;
    try {
      return await response.clone().json();
    } catch {
      throw new AgentPayError('BAD_402', 'the 402 carries no payment requirement');
    }
  }

  // GET (or the given request) a priced URL and read its 402 without signing anything.
  async function quote(url, init = {}) {
    const response = await fetchImpl(url, { ...init, headers: identityHeaders(init.headers), redirect: 'error' });
    if (response.status !== 402) return { free: true, status: response.status, response };
    const pr = await readPaymentRequired(response);
    let offered;
    try {
      offered = orderOfPaymentRequired(pr, network);
    } catch (e) {
      throw new AgentPayError('BAD_402', e.message);
    }
    return { free: false, order: offered.order, requirement: offered.requirement, paymentRequired: offered.paymentRequired };
  }

  // Reservations: a signed payment counts against every cap from the moment it is signed
  // until it is paid (then the chain counts it) or definitely refused (then it is released).
  function reserve(e) {
    e.periodKey = periodKey(nowSec());
    ledger.pendingMicro += e.amount;
    if (mandate) ledger.mandateSpentMicro += e.amount;
    if (node === ZERO32) ledger.humanPeriod.set(e.periodKey, (ledger.humanPeriod.get(e.periodKey) ?? 0n) + e.amount);
  }
  function release(e) {
    ledger.pendingMicro -= e.amount;
    if (mandate) ledger.mandateSpentMicro -= e.amount;
    if (node === ZERO32) ledger.humanPeriod.set(e.periodKey, (ledger.humanPeriod.get(e.periodKey) ?? 0n) - e.amount);
  }
  function confirmed(e) {
    ledger.pendingMicro -= e.amount; // agents: now in the contract's spend record; humans: stays in the period ledger
  }

  async function orderStatus(orderId) {
    const o = await publicClient.readContract({ address: network.checkout, abi: checkoutAbi, functionName: 'orders', args: [orderId] });
    return ORDER_STATUS[Number(o.status ?? o[6])];
  }

  const requestKey = (url, init) => `${(init.method ?? 'GET').toUpperCase()} ${url} ${init.body ?? ''}`;

  // Answer a 402 with one signature: guards first, then the Permit2 witness, then the retry.
  // A payment whose outcome is unknown (timeout, 5xx) stays pending: the next pay() of the same
  // request re-sends the same signature for the same order, so it can never be paid twice.
  async function pay(url, init = {}) {
    const { maxMicro, ...requestInit } = init;
    if (requestInit.body !== undefined && typeof requestInit.body !== 'string') throw new Error('pay(): send the body as a string, so the paid retry can repeat it');
    return lock(async () => {
      // Signatures past their deadline (with a minute's grace for clock skew) can never settle now.
      const key = requestKey(url, requestInit);
      for (const [k, e] of pending) {
        // This request's own entry is settled below: paid if the chain has it, else signed again.
        if (k === key || e.order.deadline + 60n > BigInt(nowSec())) continue;
        const settled = ['PAID', 'DELIVERED'].includes(await orderStatus(e.order.orderId));
        pending.delete(k);
        if (settled) confirmed(e); // the chain counts it now; keeping it pending would count it twice
        else release(e);
      }
      let entry = pending.get(key);
      if (entry) {
        const status = await orderStatus(entry.order.orderId);
        if (status === 'PAID' || status === 'DELIVERED') {
          pending.delete(key);
          confirmed(entry);
          return outcome(entry, { status: 'paid', httpStatus: undefined, transaction: entry.transaction, response: undefined });
        }
        if (entry.order.deadline + 60n <= BigInt(nowSec())) {
          // The signature has expired unpaid: Permit2 will never accept it now.
          pending.delete(key);
          release(entry);
          entry = undefined;
        }
      }
      if (!entry) {
        const q = await quote(url, requestInit);
        if (q.free) return { status: 'free', httpStatus: q.status, response: q.response };
        const { order, requirement, paymentRequired } = q;
        await assertChain(publicClient, network);
        const { status } = await check(order, { maxMicro });
        if (status !== 'NONE' && status !== 'CREATED') {
          // Signing again could never pay twice (the Permit2 nonce is the order id), but there is nothing to pay.
          onEvent({ type: 'not_payable', orderId: order.orderId, orderStatus: status });
          return { status: 'not_payable', orderStatus: status, orderId: order.orderId, order };
        }
        const payload = await signOrderPayment({ account, publicClient, network, requirement, payerName: name, mandateHash, approvalMicro, nowSec: nowSec() });
        entry = { order, amount: order.totalMicro, paymentPayload: { x402Version: X402_VERSION, resource: paymentRequired.resource, accepted: requirement, payload, extensions: paymentRequired.extensions } };
        reserve(entry);
        pending.set(key, entry);
        onEvent({ type: 'signed', orderId: order.orderId, amountMicro: entry.amount.toString(), merchant: order.merchant.name });
      }
      let response;
      try {
        const headers = new Headers(requestInit.headers ?? {});
        headers.set(HEADERS.signature, encodeHeader(entry.paymentPayload));
        response = await fetchImpl(url, { ...requestInit, headers: identityHeaders(headers), redirect: 'error' });
      } catch {
        // The merchant may have the signature: the payment may still settle. Keep it pending.
        return outcome(entry, { status: 'unknown', reason: 'merchant_unreachable' });
      }
      const settlement = decodeHeader(getHeader(response.headers, HEADERS.response));
      if (settlement?.transaction) entry.transaction = settlement.transaction;
      if (response.ok && settlement?.success !== false) {
        pending.delete(key);
        confirmed(entry);
        return outcome(entry, { status: 'paid', httpStatus: response.status, response });
      }
      // Whatever the answer says, the chain decides: a paid order is paid.
      const status = await orderStatus(entry.order.orderId).catch(() => 'UNKNOWN');
      if (status === 'PAID' || status === 'DELIVERED') {
        pending.delete(key);
        confirmed(entry);
        return outcome(entry, { status: 'paid', httpStatus: response.status, response });
      }
      const definite = response.status >= 400 && response.status < 500 && response.status !== 429;
      if (definite && status !== 'UNKNOWN') {
        pending.delete(key);
        release(entry);
        return outcome(entry, { status: 'failed', httpStatus: response.status, reason: settlement?.errorReason ?? `http ${response.status}`, response });
      }
      return outcome(entry, { status: 'unknown', httpStatus: response.status, reason: settlement?.errorReason ?? `http ${response.status}`, response });
    });
  }

  function outcome(entry, { status, httpStatus, reason, response, transaction }) {
    const result = {
      status,
      httpStatus,
      orderId: entry.order.orderId,
      amountMicro: entry.amount,
      merchant: entry.order.merchant,
      order: entry.order,
      transaction: transaction ?? entry.transaction ?? undefined,
      reason,
      retry: status === 'unknown' ? 'call pay() again with the same request: it re-sends the same signature' : undefined,
      response,
    };
    onEvent({ type: status, orderId: entry.order.orderId, transaction: result.transaction, reason });
    return result;
  }

  // Ask the merchant for a refund: the request is signed by this payer, so the merchant can
  // check it comes from whoever paid the order. The merchant refunds on-chain itself.
  async function requestRefund({ url, orderId, amountMicro, reason }) {
    if (typeof reason !== 'string' || reason.length === 0 || reason.length > 280) throw new Error('a refund reason is 1 to 280 characters');
    const signed = await signRefundRequest({ account, publicClient, network, orderId, amountMicro: toMicro(amountMicro, 'amountMicro'), reason, nowSec: nowSec() });
    const response = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json', ...identityHeaders() }, body: JSON.stringify(signed), redirect: 'error' });
    const body = await response.json().catch(() => ({}));
    return { ok: response.ok, httpStatus: response.status, ...body };
  }

  // Subscribe to a merchant's plan: read the offer, check it like a payment, sign the terms
  // and a bounded Permit2 allowance, hand them to the merchant (its relayer creates it).
  async function subscribe({ url, maxMicro }) {
    return lock(async () => {
      const offerRes = await fetchImpl(url, { headers: identityHeaders(), redirect: 'error' });
      if (!offerRes.ok) throw new AgentPayError('NO_OFFER', `the plan answered ${offerRes.status}`);
      const offer = await offerRes.json();
      const sub = {
        subId: offer.sub.subId,
        subscriberNode: offer.sub.subscriberNode,
        shopNode: offer.sub.shopNode,
        payerNode: offer.sub.payerNode,
        subscriber: getAddress(offer.sub.subscriber),
        merchant: getAddress(offer.sub.merchant),
        amountMicro: toMicro(offer.sub.amountMicro, 'amountMicro'),
        period: Number(offer.sub.period),
        firstChargeAt: BigInt(offer.sub.firstChargeAt),
      };
      const maxCycles = Number(offer.maxCycles);
      if (!Number.isSafeInteger(maxCycles) || maxCycles < 1 || maxCycles > 520) throw new AgentPayError('BAD_OFFER', 'maxCycles must be 1 to 520');
      if (!isAddressEqual(sub.subscriber, address) || sub.payerNode !== node || sub.subscriberNode !== buyerNode) throw new AgentPayError('NOT_FOR_THIS_PAYER', 'the offer was built for another subscriber');
      if (nodeOf(offer.merchant?.name) !== sub.shopNode || !isAddressEqual(offer.merchant?.address ?? ZERO_ADDRESS, sub.merchant)) throw new AgentPayError('BAD_OFFER', 'the offer names a merchant that does not match its terms');
      const merchant = { name: offer.merchant.name, node: sub.shopNode, address: sub.merchant };
      const refuse = (code, message) => {
        throw new AgentPayError(code, message, { subId: sub.subId, amountMicro: sub.amountMicro.toString() });
      };
      // The first charge is taken when the subscription is created: it passes every guard a payment does.
      await spendGuards(merchant, sub.amountMicro, { maxMicro, refuse });
      // The signature allows every cycle of the plan, so a mandate must cover all of them, in time.
      if (mandate) {
        const plan = sub.amountMicro * BigInt(maxCycles);
        if (ledger.mandateSpentMicro + plan > mandate.budgetMicro) refuse('OVER_BUDGET', `the plan's ${maxCycles} charges (${formatUsdt(plan)}) would take the mandate over its budget ${formatUsdt(mandate.budgetMicro)}`);
        if ((Number(sub.firstChargeAt) + sub.period * (maxCycles - 1)) * 1000 >= mandate.deadlineMs) refuse('MANDATE_EXPIRED', 'the plan would still charge after the mandate deadline');
      }
      const periodSeconds = PERIOD_DAYS[period] * 86_400;
      // At most maxCycles charges ever (the Permit2 allowance is amount × maxCycles).
      const chargesPerPassPeriod = Math.min(maxCycles, Math.max(1, Math.ceil(periodSeconds / sub.period)));
      if (sub.amountMicro * BigInt(chargesPerPassPeriod) > limits.capMicro) throw new AgentPayError('OVER_PERIOD_CAP', `the plan charges more than the ${period} cap`);
      if (node !== ZERO32) {
        const p = await readSpendingPass({ publicClient, network, node, wallet: address, nowSec: nowSec() });
        if (!p.active || !isAddressEqual(p.wallet, address)) throw new AgentPayError('NO_PASS', 'no active on-chain spending pass for this agent');
      }
      const signed = await signSubscription({ account, publicClient, network, sub, maxCycles, approvalMicro, nowSec: nowSec() });
      const body = JSON.stringify({ sub: offer.sub, maxCycles, ...signed }, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
      // The first charge counts from the moment it is signed, as a payment does, and stays counted
      // unless the chain, or a definite refusal, shows it was not taken.
      const charge = { amount: sub.amountMicro };
      reserve(charge);
      let response;
      try {
        response = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json', ...identityHeaders() }, body, redirect: 'error' });
      } catch (error) {
        confirmed(charge); // the merchant may have it: counted, never twice (the chain counts an agent's)
        throw error;
      }
      const result = await response.json().catch(() => ({}));
      if (await chargeTaken(sub.subId, response, result)) confirmed(charge);
      else release(charge);
      return { ok: response.ok, httpStatus: response.status, subId: sub.subId, ...result };
    });
  }

  // Whether a subscription's first charge was taken: the merchant said so, or the chain shows a
  // cycle. When the chain has no subscription, only a definite refusal means it was not; an
  // answer that may still settle (a 5xx, a 429, a pending relayer) counts as taken.
  async function chargeTaken(subId, response, result) {
    if (response.ok && result.charged) return true;
    const onchain = await publicClient.readContract({ address: network.checkout, abi: checkoutAbi, functionName: 'subscription', args: [subId] }).catch(() => null);
    if (!onchain) return true; // the chain could not say: counted, as the safe side
    const status = SUB_STATUS[Number(onchain.status ?? onchain[11])];
    if (status && status !== 'NONE') return BigInt(onchain.cycle ?? onchain[8]) >= 1n;
    if (response.ok) return false;
    const definite = response.status >= 400 && response.status < 500 && response.status !== 429 && !UNCERTAIN.has(result?.error);
    return !(status === 'NONE' && definite);
  }

  // Cancel a subscription with a signature (gasless: the merchant's relayer sends cancelWithSig).
  async function cancel({ url, subId }) {
    const signed = await signCancel({ account, publicClient, network, subId, nowSec: nowSec() });
    const body = JSON.stringify(signed, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
    const response = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json', ...identityHeaders() }, body, redirect: 'error' });
    const result = await response.json().catch(() => ({}));
    return { ok: response.ok, httpStatus: response.status, subId, ...result };
  }

  return Object.freeze({ address, name, node, network, limits, mandateHash, passStatus, quote, pay, requestRefund, subscribe, cancel, check });
}
