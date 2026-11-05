// The payer acts only on the approved order (G4): its two tools take no input
// and close over the approved order; there is no free-form URL or amount.
// `pay_order` is single-flight (G10). Before any signature: every field of the
// 402 (G5), the payee from ENS after the 402 (ADR-0046: PAYEE_MISMATCH,
// PAYEE_UNRESOLVED), the shop's accepts record, and the quote entity on Arkiv
// (M7 amendment §5: QUOTE_MISSING and QUOTE_EXPIRED re-quote once, QUOTE_MISMATCH
// refuses). After a signature an unclear answer keeps the money counted (G16).

import { config } from '@graphpay/config';
import { z } from 'zod';
import { displayUsdt, fromMicro, microFrom } from './money.mjs';
import { clip, errorText } from './scrub.mjs';
import { STEPS } from './activity.mjs';
import { tracedTool } from './tools.mjs';
import { base64JsonCodec, checkPaymentRequired, header, interpretSettlement, onStorefront } from './x402.mjs';

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HEX32 = /^0x[0-9a-fA-F]{64}$/;
const lower = (v) => (typeof v === 'string' ? v.toLowerCase() : v);
const NoInput = z.object({}).strict();

export const PAYMENT_NETWORK = `eip155:${config.networks.whitechain.chainId}`;
export const PAYMENT_ASSET = config.whitechain.tokens.usdt.address;

// Contracts the payer may sign for: every address in the config's Whitechain
// contracts section. An empty section means none (fail closed).
export function knownContracts(addresses = Object.values(config.whitechain.contracts ?? {})) {
  return new Set(addresses.filter((a) => typeof a === 'string' && ADDRESS.test(a)).map((a) => a.toLowerCase()));
}

export function explorerTx(hash) {
  return `${config.networks.whitechain.explorer}/tx/${hash}`;
}

// What a shop (its gateway) answers to a quote request.
const BuyerQuote = z
  .object({
    ok: z.literal(true),
    quote: z.object({
      shop: z.string().max(255),
      item: z.string().max(80),
      quantity: z.number().int().positive(),
      priceMicro: z.union([z.string().regex(/^\d{1,19}$/), z.number().int().nonnegative()]),
      etaMinutes: z.number().int().nonnegative(),
      validUntil: z.number().int().positive(),
      orderId: z.string().regex(HEX32),
    }),
    terms: z.record(z.string(), z.unknown()),
    payUrl: z.string().max(500),
  })
  .passthrough();

const Dispatch = z.object({
  confirmed: z.boolean(),
  orderId: z.string().max(80),
  etaIso: z.string().max(40),
  meetsDeadline: z.boolean(),
  courier: z.string().max(120).optional(),
});

const no = (reason, detail, extra = {}) => ({ ok: false, reason, detail, ...extra });

// The quote entity for this errand (M7 amendment §5): the approved shop's key,
// this agent's name, price = the 402 amount, and at least 60 s left.
async function quoteCheck({ hooks, requestId, approved, payerEns, amountMicro, quoteKey, now }) {
  let quotes;
  let shopKey;
  try {
    [quotes, shopKey] = await Promise.all([hooks.findQuotes(requestId), hooks.shopKey(approved.shopEns)]);
  } catch (error) {
    return no('QUOTE_UNREADABLE', `the quote read failed: ${errorText(error)}`);
  }
  if (!Array.isArray(quotes)) return no('QUOTE_UNREADABLE', 'the quote read returned no list');
  const ours = quotes.filter((q) => q && q.requestId === requestId);
  let entry = quoteKey ? ours.find((q) => lower(q.key) === lower(quoteKey)) : undefined;
  if (!entry) {
    entry = ours
      .filter((q) => lower(q.shopKey) === lower(shopKey) && q.agentEns === payerEns)
      .sort((a, b) => Number(b.validUntil) - Number(a.validUntil))[0];
  }
  if (!entry) return no('QUOTE_MISSING', 'no quote entity for this errand, shop and agent', { requote: true });
  let price;
  try {
    price = microFrom(entry.priceMicro);
  } catch {
    price = -1n;
  }
  if (lower(entry.shopKey) !== lower(shopKey) || entry.agentEns !== payerEns || price !== amountMicro) {
    return no('QUOTE_MISMATCH', 'the quote entity does not match the 402 (shop, agent or price)');
  }
  const validUntil = Number(entry.validUntil);
  if (!(Number.isFinite(validUntil) && validUntil * 1000 - now >= 60_000)) {
    return no('QUOTE_EXPIRED', 'the quote entity has less than 60 s left', { requote: true });
  }
  return { ok: true, entry };
}

// Every check before a signature, in order. Exported for the acceptance suite
// (B9 (b), D10), which runs it in process without signing.
export async function presignCheck({ paymentRequired, approved, pending, payerEns, buyerEns, requestId, hooks, now, budgetLeftMicro, contracts = knownContracts() }) {
  let nodes;
  try {
    const [shop, payer, buyer] = await Promise.all([hooks.nodeOf(approved.shopEns), hooks.nodeOf(payerEns), hooks.nodeOf(buyerEns)]);
    nodes = { shop, payer, buyer };
  } catch (error) {
    return no('NODE_UNREADABLE', `a name could not be hashed: ${errorText(error)}`);
  }
  if (!(now + pending.etaMinutes * 60_000 <= Date.parse(approved.deadlineIso))) return no('MISSES_DEADLINE', 'the delivery would miss the deadline at pay time');
  const sync = checkPaymentRequired(paymentRequired, {
    now,
    approved,
    pending,
    nodes,
    network: PAYMENT_NETWORK,
    asset: PAYMENT_ASSET,
    contracts,
    budgetLeftMicro,
  });
  if (!sync.ok) return sync;
  let accepts;
  try {
    accepts = await hooks.readAccepts(approved.shopEns);
  } catch (error) {
    return no('ACCEPTS_UNREADABLE', `the accepts record of ${approved.shopEns} could not be read: ${errorText(error)}`);
  }
  const listed = Array.isArray(accepts) && accepts.some((a) => a?.network === PAYMENT_NETWORK && lower(a?.asset) === lower(PAYMENT_ASSET));
  if (!listed) return no('ASSET_NOT_ACCEPTED', `${approved.shopEns} does not list this network and token in its accepts record`);
  const quote = await quoteCheck({
    hooks,
    requestId,
    approved,
    payerEns,
    amountMicro: sync.amountMicro,
    quoteKey: sync.requirement.extra?.quoteKey,
    now,
  });
  if (!quote.ok) return quote;
  let payee;
  try {
    payee = await hooks.resolvePayee(approved.shopEns);
  } catch (error) {
    return no('PAYEE_UNRESOLVED', `the ENS read of ${approved.shopEns} failed: ${errorText(error)}`);
  }
  if (typeof payee !== 'string' || !ADDRESS.test(payee)) return no('PAYEE_UNRESOLVED', `${approved.shopEns} has no Whitechain address in ENS`);
  if (lower(payee) !== lower(sync.requirement.payTo)) return no('PAYEE_MISMATCH', `payTo is not the ENS address of ${approved.shopEns}`);
  return { ok: true, requirement: sync.requirement, amountMicro: sync.amountMicro, paymentRequired, quoteEntity: quote.entry };
}

const GUARD_OF = {
  PAY_IN_FLIGHT: 'G10',
  ALREADY_ATTEMPTED: 'G10',
  SHOP_REFUSED: 'G8',
  SIGN_FAILED: 'G5',
};

// The payer's tools for one approved order, and the outcome code keeps (G13).
export function createPayer(ctx) {
  const { approved, state, shopClient, hooks, log, agent, payerEns, buyerEns, wallet } = ctx;
  const codec = ctx.codec ?? base64JsonCodec;
  const clock = ctx.clock ?? Date.now;
  const contracts = ctx.contracts ?? knownContracts();
  let pending = null;
  let inFlight = false;
  let quoting = false;
  let attempted = false;
  const outcome = { status: null, reason: null, detail: null, receipt: null, orderId: null, priceMicro: null, arrivesAt: null, dispatch: null };

  const budgetLeft = () => state.mandate.budgetMicro - state.spentMicro - state.reservedMicro;

  function settle(status, reason, detail, extra = {}) {
    Object.assign(outcome, { status, reason, detail }, extra);
    state.payment = { shopEns: approved.shopEns, ...outcome };
    if (status === 'refused' || status === 'failed') {
      state.refusals.push({ reason, detail, agent });
      log.guard(GUARD_OF[reason] ?? 'G5', false, `${reason}: ${detail}`);
    }
    return outcome;
  }

  async function quote() {
    log.message(payerEns, approved.agents.storefront, `quote ${approved.quantity} × ${approved.item}`, STEPS.quote);
    let res;
    try {
      res = await shopClient.quote({
        shopEns: approved.shopEns,
        item: approved.item,
        quantity: approved.quantity,
        buyer: buyerEns,
        payer: payerEns,
        wallet,
        requestId: state.requestId,
        deadlineIso: approved.deadlineIso,
      });
    } catch (error) {
      return no('QUOTE_FAILED', `the shop did not quote: ${errorText(error)}`);
    }
    if (res?.ok === false) return no('SHOP_REFUSED', clip([].concat(res.reasons ?? res.refused ?? 'refused').join('; ')));
    const parsed = BuyerQuote.safeParse(res);
    if (!parsed.success) return no('BAD_QUOTE', 'the shop answered with an unreadable quote');
    const q = parsed.data.quote;
    let priceMicro;
    try {
      priceMicro = microFrom(q.priceMicro);
    } catch {
      return no('BAD_QUOTE', 'the quoted price is not a valid amount');
    }
    const now = clock();
    if (q.shop !== approved.shopEns) return no('SHOP_MISMATCH', 'the quote is from another shop');
    if (q.item !== approved.item || q.quantity !== approved.quantity) return no('ORDER_MISMATCH', 'the quote is not for the approved item and quantity');
    if (priceMicro > approved.maxPriceMicro) return no('OVER_APPROVED_PRICE', `the quote ${displayUsdt(priceMicro)} is above the approved price`);
    if (priceMicro > budgetLeft()) return no('OVER_BUDGET', `the quote ${displayUsdt(priceMicro)} is above what is left of the budget`);
    if (!(now + q.etaMinutes * 60_000 <= Date.parse(approved.deadlineIso))) return no('MISSES_DEADLINE', 'the quoted delivery misses the deadline');
    if (!(q.validUntil * 1000 > now)) return no('QUOTE_EXPIRED', 'the shop quote has expired');
    if (!onStorefront(parsed.data.payUrl, approved.storefront)) return no('RESOURCE_MISMATCH', 'the pay URL is not on the approved storefront');
    const order = { orderId: q.orderId, priceMicro, etaMinutes: q.etaMinutes, validUntil: q.validUntil, payUrl: parsed.data.payUrl, terms: parsed.data.terms };
    log.message(approved.agents.storefront, payerEns, `quote ${displayUsdt(priceMicro)} USDT, ${q.etaMinutes} min (SYNTHETIC)`, STEPS.quote);
    return { ok: true, order };
  }

  async function challenge(order) {
    log.message(payerEns, approved.agents.storefront, `pay order ${order.orderId}`, STEPS.pay);
    let res;
    try {
      res = await shopClient.pay({ payUrl: order.payUrl, terms: order.terms, requestId: state.requestId });
    } catch (error) {
      return no('NO_402', `the shop did not answer: ${errorText(error)}`);
    }
    if (res?.status !== 402) {
      const why = res?.body && typeof res.body === 'object' ? [res.body.reason, res.body.error].find((v) => typeof v === 'string') : undefined;
      return no(res?.status === 403 ? 'SHOP_REFUSED' : 'NO_402', clip(why ?? `the shop answered HTTP ${res?.status} instead of 402`));
    }
    const fromHeader = codec.decodePaymentRequired(header(res.headers, 'payment-required'));
    const paymentRequired = fromHeader ?? (res.body?.x402Version !== undefined ? res.body : null);
    log.message(approved.agents.storefront, payerEns, '402 payment required', STEPS.quote);
    return presignCheck({
      paymentRequired,
      approved,
      pending: order,
      payerEns,
      buyerEns,
      requestId: state.requestId,
      hooks,
      now: clock(),
      budgetLeftMicro: budgetLeft(),
      contracts,
    });
  }

  async function signAndSend(check, order) {
    const amount = check.amountMicro;
    if (amount > budgetLeft()) {
      attempted = true;
      return settle('refused', 'OVER_BUDGET', 'the amount is above what is left of the budget');
    }
    if (ctx.dryRun) {
      attempted = true;
      log.guard('G5', true, `dry run: every check passed for ${displayUsdt(amount)} USDT, nothing signed`);
      return settle('refused', 'DRY_RUN', 'every check passed; the dry run never signs');
    }
    state.reservedMicro += amount; // synchronous: before the first await
    attempted = true;
    let signature;
    try {
      signature = await hooks.sign({
        paymentRequired: check.paymentRequired,
        requirement: check.requirement,
        mandate: { budgetUsdt: state.mandate.budgetUsdt, deadlineIso: state.mandate.deadlineIso, hash: state.mandate.hash },
        payerEns,
        approved: { shopEns: approved.shopEns, orderId: order.orderId, amountMicro: amount },
      });
    } catch (error) {
      state.reservedMicro -= amount;
      return settle('refused', 'SIGN_FAILED', `nothing was signed or sent: ${errorText(error)}`);
    }
    if (typeof signature !== 'string' || signature === '') {
      state.reservedMicro -= amount;
      return settle('refused', 'SIGN_FAILED', 'the signer returned no signature; nothing was sent');
    }
    log.guard('G5', true, `every check passed before signing: ${displayUsdt(amount)} USDT for order ${order.orderId} to ${approved.shopEns}`);
    log.message(payerEns, approved.agents.storefront, 'payment signature', STEPS.pay);
    let res = null;
    let sendError = null;
    try {
      res = await shopClient.pay({ payUrl: order.payUrl, terms: order.terms, requestId: state.requestId, signature });
    } catch (error) {
      sendError = errorText(error);
    }
    let result;
    try {
      result = sendError ? { kind: 'unsettled', reason: `send error: ${sendError}` } : interpretSettlement(res, codec);
      if (result.kind === 'paid') {
        const st = result.settlement;
        if ((st.network !== undefined && st.network !== PAYMENT_NETWORK) || (st.payer !== undefined && lower(st.payer) !== lower(wallet))) {
          result = { kind: 'unsettled', reason: 'the receipt does not match this payment (network or payer)' };
        }
      }
    } catch (error) {
      result = { kind: 'unsettled', reason: `the settlement answer could not be read: ${clip(errorText(error))}` };
    }
    state.reservedMicro -= amount;
    const base = { orderId: order.orderId, priceMicro: amount };
    if (result.kind === 'paid') {
      state.spentMicro += amount;
      const dispatch = Dispatch.safeParse(res.body?.dispatch);
      const receipt = {
        success: true,
        transaction: result.settlement.transaction,
        network: result.settlement.network ?? PAYMENT_NETWORK,
        payer: result.settlement.payer ?? wallet,
        payTo: check.requirement.payTo,
        amountUsdt: fromMicro(amount),
        asset: check.requirement.asset,
        explorerUrl: explorerTx(result.settlement.transaction),
      };
      log.message(approved.agents.storefront, payerEns, `settled ${result.settlement.transaction}`, STEPS.pay);
      return settle('paid', null, 'settled', {
        ...base,
        receipt,
        dispatch: dispatch.success ? dispatch.data : null,
        arrivesAt: dispatch.success && dispatch.data.confirmed ? dispatch.data.etaIso : null,
      });
    }
    if (result.kind === 'unsettled') {
      state.spentMicro += amount; // it may still move money: counted, never paid again (G16)
      log.guard('G16', true, `unclear settlement (${result.reason}): ${displayUsdt(amount)} USDT stays counted as spent; no second payment in this errand`);
      return settle('unsettled', 'UNSETTLED', result.reason, base);
    }
    if (result.kind === 'failed') return settle('failed', result.reason, `the chain recorded the failure in ${result.transaction}`, base);
    return settle('refused', result.reason, 'refused before sending; nothing moved', base);
  }

  async function payOrder() {
    if (inFlight) return { status: 'refused', reason: 'PAY_IN_FLIGHT', detail: 'pay_order is already running for this order' };
    if (attempted) return { status: 'refused', reason: 'ALREADY_ATTEMPTED', detail: 'this errand already made its one payment attempt' };
    if (quoting) return { status: 'refused', reason: 'QUOTE_IN_FLIGHT', detail: 'get_quote is still running' };
    if (!pending) return { status: 'refused', reason: 'NO_QUOTE', detail: 'call get_quote first' };
    inFlight = true;
    let order = pending; // this payment is for this order only, whatever get_quote does meanwhile
    try {
      for (let round = 0; ; round++) {
        const check = await challenge(order);
        if (check.ok) return await signAndSend(check, order);
        if (check.requote && round === 0) {
          log.guard('G5', true, `${check.reason}: re-quoting once (new quote, new 402)`);
          const again = await quote();
          if (again.ok) {
            order = again.order;
            pending = order;
            continue;
          }
          attempted = true;
          return settle('refused', again.reason, again.detail);
        }
        attempted = true;
        return settle('refused', check.reason, check.detail);
      }
    } finally {
      inFlight = false;
    }
  }

  const view = (o) => {
    if (o.status === 'paid') {
      return {
        status: 'paid',
        amountUsdt: displayUsdt(o.priceMicro),
        transaction: o.receipt.transaction,
        explorerUrl: o.receipt.explorerUrl,
        orderId: o.orderId,
        arrivesAt: o.arrivesAt,
        synthetic: true,
      };
    }
    return { status: o.status, reason: o.reason, detail: o.detail };
  };

  const tools = {
    get_quote: tracedTool(log, agent, 'get_quote', {
      description: 'Ask the approved shop for a binding quote. Takes no input: the shop, item, quantity and maximum price are already fixed.',
      inputSchema: NoInput,
      executed: ctx.executed,
      execute: async () => {
        if (attempted || inFlight || quoting) return { ok: false, reason: 'ALREADY_ATTEMPTED', detail: 'the payment for this order has already started' };
        quoting = true;
        let q;
        try {
          q = await quote();
        } finally {
          quoting = false;
        }
        if (attempted || inFlight) return { ok: false, reason: 'ALREADY_ATTEMPTED', detail: 'the payment for this order has already started' };
        if (q.ok) pending = q.order;
        if (!q.ok) {
          attempted = true;
          settle('refused', q.reason, q.detail);
          return { ok: false, reason: q.reason, detail: q.detail };
        }
        return {
          ok: true,
          shop: approved.shopEns,
          item: approved.item,
          quantity: approved.quantity,
          priceUsdt: displayUsdt(pending.priceMicro),
          etaMinutes: pending.etaMinutes,
          orderId: pending.orderId,
          synthetic: true,
        };
      },
    }),
    pay_order: tracedTool(log, agent, 'pay_order', {
      description: 'Pay the quoted order once. Takes no input: the tool answers the 402 challenge itself and checks every field before signing.',
      inputSchema: NoInput,
      executed: ctx.executed,
      execute: async () => view(await payOrder()),
    }),
  };

  return { tools, outcome };
}
