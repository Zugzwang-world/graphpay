// The payer's side of the `graphpay-order` x402 flow (planning/SPEC/PAYMENTS_WHITECHAIN.md
// §5–§6): client spend controls checked on every field of the 402 (G5), and the
// rule for reading a settlement answer after a signature (G16).

import { clip } from './scrub.mjs';

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HEX32 = /^0x[0-9a-fA-F]{64}$/;
const ZERO32 = `0x${'0'.repeat(64)}`;

const lower = (v) => (typeof v === 'string' ? v.toLowerCase() : v);

// The default codec: x402 v2 headers carry base64 JSON. Join may pass the
// @x402/core/http codec instead; the payer only needs these four functions.
export const base64JsonCodec = Object.freeze({
  encode(value) {
    return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
  },
  decode(value) {
    if (typeof value !== 'string' || value === '' || value.length > 65_536) return null;
    try {
      return JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
    } catch {
      return null;
    }
  },
  decodePaymentRequired(value) {
    return this.decode(value);
  },
  encodePaymentRequired(value) {
    return this.encode(value);
  },
  encodePaymentSignature(payload) {
    return typeof payload === 'string' ? payload : this.encode(payload);
  },
  decodePaymentResponse(value) {
    return this.decode(value);
  },
});

// Header lookup that ignores case (pitfall 6): a Headers object, a Map or a plain object.
export function header(headers, name) {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') return headers.get(name) ?? headers.get(name.toLowerCase()) ?? undefined;
  const wanted = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() === wanted) return v;
  return undefined;
}

function sameEndpoint(a, b) {
  try {
    const x = new URL(a);
    const y = new URL(b);
    return x.origin === y.origin && x.pathname === y.pathname;
  } catch {
    return false;
  }
}

// A URL on the approved storefront: same origin (no credentials), at or below its path.
export function onStorefront(url, storefront) {
  try {
    const u = new URL(url);
    const s = new URL(storefront);
    if (u.origin !== s.origin || u.username !== '' || u.password !== '') return false;
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname))) return false;
    const base = s.pathname.endsWith('/') ? s.pathname : `${s.pathname}/`;
    return u.pathname === s.pathname || u.pathname.startsWith(base);
  } catch {
    return false;
  }
}

const no = (reason, detail) => ({ ok: false, reason, detail });

// Every field of the 402 that code can check without a network read (G5).
// ctx: { approved, pending, nodes, network, asset, contracts, budgetLeftMicro }.
export function checkPaymentRequired(paymentRequired, ctx) {
  const pr = paymentRequired;
  if (!pr || typeof pr !== 'object' || pr.x402Version !== 2) return no('BAD_402', 'not an x402 v2 payment request');
  if (!Array.isArray(pr.accepts) || pr.accepts.length === 0) return no('BAD_402', 'no accepts entry');
  if (pr.accepts.length > 1) return no('MULTIPLE_ACCEPTS', `${pr.accepts.length} accepts entries; only one is ever signed`);
  const req = pr.accepts[0];
  const { approved, pending } = ctx;
  if (!onStorefront(pending.payUrl, approved.storefront)) return no('RESOURCE_MISMATCH', 'the pay URL is not on the approved storefront');
  if (typeof pr.resource?.url !== 'string' || !sameEndpoint(pr.resource.url, pending.payUrl)) {
    return no('RESOURCE_MISMATCH', 'the 402 resource is not the approved pay URL');
  }
  if (req?.scheme !== 'graphpay-order') return no('SCHEME_NOT_ALLOWED', `scheme ${String(req?.scheme)} is not graphpay-order`);
  if (req.network !== ctx.network) return no('NETWORK_NOT_ALLOWED', `network ${String(req.network)} is not ${ctx.network}`);
  if (!ADDRESS.test(req.asset ?? '') || lower(req.asset) !== lower(ctx.asset)) return no('ASSET_NOT_ALLOWED', 'the asset is not the configured token');
  if (typeof req.amount !== 'string' || !/^\d{1,19}$/.test(req.amount)) return no('BAD_402', 'the amount is not a whole number of micro units');
  const amountMicro = BigInt(req.amount);
  if (amountMicro <= 0n) return no('BAD_402', 'the amount is zero');
  const timeout = Number(req.maxTimeoutSeconds);
  if (!(Number.isInteger(timeout) && timeout > 0 && timeout <= 600)) return no('BAD_402', 'maxTimeoutSeconds is not between 1 and 600');
  if (ctx.now !== undefined && !(/^\d{1,19}$/.test(String(req.extra?.order?.deadline ?? '')) && Number(req.extra.order.deadline) * 1000 > ctx.now)) {
    return no('ORDER_EXPIRED', "the order's deadline is missing or has passed");
  }
  if (amountMicro > approved.maxPriceMicro) return no('OVER_APPROVED_PRICE', 'the amount is above the approved price');
  if (amountMicro > ctx.budgetLeftMicro) return no('OVER_BUDGET', 'the amount is above what is left of the budget');
  if (amountMicro !== pending.priceMicro) return no('AMOUNT_MISMATCH', 'the amount is not the quoted price');
  if (!ADDRESS.test(req.payTo ?? '')) return no('BAD_402', 'payTo is not an address');
  const extra = req.extra ?? {};
  const order = extra.order ?? {};
  if (!ctx.contracts.has(lower(extra.contract))) return no('UNKNOWN_CONTRACT', 'the 402 names a contract that is not in the config');
  if (extra.shopName !== approved.shopEns) return no('SHOP_MISMATCH', 'the 402 is for another shop');
  if (!HEX32.test(order.orderId ?? '') || lower(order.orderId) !== lower(pending.orderId)) return no('ORDER_MISMATCH', 'the order id is not the quoted one');
  if (lower(order.merchant) !== lower(req.payTo)) return no('ORDER_MISMATCH', "the order's merchant is not payTo");
  if (String(order.amountMicro) !== req.amount) return no('ORDER_MISMATCH', "the order's amount is not the 402 amount");
  if (String(order.kind) !== '0' || lower(order.parentOrderId ?? ZERO32) !== ZERO32) return no('ORDER_MISMATCH', 'not a one-off order');
  const nodes = ctx.nodes;
  if (lower(order.shopNode) !== lower(nodes.shop)) return no('ORDER_MISMATCH', "the order's shop node is not the approved shop");
  if (lower(order.payerNode) !== lower(nodes.payer)) return no('ORDER_MISMATCH', "the order's payer node is not this agent");
  if (lower(order.buyerNode) !== lower(nodes.buyer)) return no('ORDER_MISMATCH', "the order's buyer node is not this buyer");
  return { ok: true, requirement: req, amountMicro };
}

// After a signature only three answers are final: a refusal before sending, a
// reverted transaction, or a PaymentFailed the chain recorded. Anything else may
// still move money: unsettled (G16).
export function interpretSettlement(response, codec) {
  if (!response || typeof response.status !== 'number') return { kind: 'unsettled', reason: 'no answer' };
  const settlement = codec.decodePaymentResponse(header(response.headers, 'payment-response'));
  const { status } = response;
  if (status === 200) {
    if (settlement?.success === true && HEX32.test(settlement.transaction ?? '')) return { kind: 'paid', settlement };
    return { kind: 'unsettled', reason: 'HTTP 200 without a receipt' };
  }
  if (status >= 400 && status < 500 && status !== 408) {
    if (settlement && settlement.success === false) {
      const reason = typeof settlement.errorReason === 'string' ? clip(settlement.errorReason, 80) : 'payment failed';
      if (HEX32.test(settlement.transaction ?? '')) return { kind: 'failed', reason, transaction: settlement.transaction };
      return { kind: 'refused', reason };
    }
    if (settlement) return { kind: 'unsettled', reason: `HTTP ${status} with an unclear settlement answer` };
    const body = response.body && typeof response.body === 'object' ? response.body : {};
    const reason = clip([body.reason, body.error, body.refused].find((v) => typeof v === 'string') ?? `HTTP ${status}`, 120);
    return { kind: 'refused', reason };
  }
  return { kind: 'unsettled', reason: `HTTP ${status}` };
}
