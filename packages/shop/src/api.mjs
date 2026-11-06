// The shop's 402 API (planning/SPEC/PAYMENTS_WHITECHAIN.md §6) as a Fetch-API handler, so it runs
// in a local Node server and in Next.js route handlers on Vercel (M4):
//   GET  …/catalog?shop=                     synthetic, labelled
//   GET  …/quote?shop&item&qty&buyer&payer&wallet[&parent]   free; writes nothing
//   POST …/orders/:id/pay                    X-Demo-Passcode; body = the quote's terms
//   POST …/orders/:parentId/reorder          the same, for a re-order of a paid order
// Without PAYMENT-SIGNATURE a pay call answers 402 with exactly one `accepts` entry (after writing
// the quote to Arkiv when it carries a requestId, M7 amendment §5); with it, the facilitator
// verifies and settles. alreadyPaid comes from the chain; a facilitator outage is a 502 (a retry
// is safe: the order id is the Permit2 nonce, so it can never be paid twice).

import { createHash, timingSafeEqual } from 'node:crypto';
import { isAddress, isAddressEqual } from 'viem';
import { decodePaymentSignatureHeader, encodePaymentRequiredHeader, encodePaymentResponseHeader } from '@x402/core/http';
import { errorNames, json, readJson, MAX_TIMEOUT_SECONDS, RateLimiter, SCHEME, X402_VERSION, toWireOrder, termsHashOf } from '@graphpay/facilitator';
import { catalogOf } from './catalog.mjs';
import { TermsError, ZERO32, ZERO_ADDRESS, buildOrder, rebuildOrder } from './orders.mjs';

export const PASSCODE_HEADER = 'x-demo-passcode';
const MIN_PASSCODE_LENGTH = 24;
const PAYEE_TTL_MS = 20_000;
const BODY_LIMIT = 8 * 1024;
const STATUS = ['NONE', 'CREATED', 'PAID', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
const HEX32 = /^0x[0-9a-fA-F]{64}$/;
// The facilitator could not decide (no receipt yet, or a send still in flight): the agent must
// treat it as unsettled, never as a final refusal.
const UNSETTLED = new Set(['receipt_timeout', 'in_flight']);
// Per instance: the pay route makes the relayer and W_DIRECTORY spend, so it is bounded even
// behind the passcode.
const PAY_PER_MINUTE = 120;
const QUOTE_WRITES_PER_MINUTE = 30;

const digest = (v) => createHash('sha256').update(v, 'utf8').digest();

// deps:
//   shops (storyShops), merchants (shop key -> payout address), chainId, token, checkout;
//   baseUrl: the agent-facing absolute URL of this API (x402 resource.url), never VERCEL_URL;
//   passcode: DEMO_PASSCODE; facilitator: { verify, settle } (HTTPFacilitatorClient);
//   orders: { readOrder } (chain.mjs); resolvePayee(shopName) -> { ok, payee } (T2's createEnsReader, ADR-0046);
//   createQuote({ requestId, shopName, agentEns, priceMicro, validUntil }) -> { entityKey } (optional);
//   deliver(shopKey, orderId) -> 'delivered'|'pending'|'not_configured' (optional);
//   ready(): start-up checks; log(line): one redacted line; clock(): ms.
export function shopHandler(deps) {
  const { shops, merchants, chainId, token, checkout, facilitator, orders, resolvePayee } = deps;
  const ttlSeconds = deps.quoteTtlSeconds ?? MAX_TIMEOUT_SECONDS;
  const clock = deps.clock ?? (() => Date.now());
  const log = deps.log ?? console.error;
  const ready = deps.ready ?? (async () => {});
  const network = `eip155:${chainId}`;
  const base = deps.baseUrl.replace(/\/+$/, '');
  const payees = new Map(); // exact spelling -> { at, value }
  const payLimit = new RateLimiter(PAY_PER_MINUTE, 60_000, clock);
  const quoteLimit = new RateLimiter(QUOTE_WRITES_PER_MINUTE, 60_000, clock);

  const nowSec = () => Math.floor(clock() / 1000);
  const ctx = () => ({ shops, merchants, nowSec: nowSec(), ttlSeconds });

  function passcodeRefusal(request) {
    const given = request.headers.get(PASSCODE_HEADER) ?? '';
    const expected = deps.passcode ?? '';
    if (expected.length < MIN_PASSCODE_LENGTH) return json(503, { error: 'spending is off: no passcode is configured' });
    if (given === '' || given.length > 512 || !timingSafeEqual(digest(given), digest(expected))) return json(401, { error: 'passcode required' });
    return null;
  }

  // The payee comes from ENS (ADR-0046): our configured payout address must be what the shop's
  // name resolves to, or no 402 is offered. An answer is cached 20 s by the exact spelling,
  // stamped first; a failed read is not (T2's reader keeps its own cache).
  async function payeeHolds(shop, merchant) {
    const now = clock();
    let hit = payees.get(shop.ensName);
    if (!hit || now - hit.at >= PAYEE_TTL_MS) {
      let value = null;
      try {
        // T2's reader answers { ok: true, payee } or { ok: false, reason }; a bare address also works.
        const r = await resolvePayee(shop.ensName);
        value = typeof r === 'string' ? r : r?.ok === true ? r.payee : null;
      } catch {
        value = null;
      }
      hit = { at: now, value };
      if (value) payees.set(shop.ensName, hit);
    }
    if (!hit.value) {
      log(`shop: payee unresolved for ${shop.key}`);
      return false;
    }
    if (!isAddressEqual(hit.value, merchant)) {
      log(`shop: payee mismatch for ${shop.key}`);
      return false;
    }
    return true;
  }

  const payUrlOf = (terms) =>
    terms.parentOrderId === ZERO32 ? `${base}/orders/${terms.orderId}/pay` : `${base}/orders/${terms.parentOrderId}/reorder`;

  function requirementOf(order, shop, quoteKey) {
    return {
      scheme: SCHEME,
      network,
      asset: token.address,
      amount: String(order.amountMicro),
      payTo: order.merchant,
      maxTimeoutSeconds: MAX_TIMEOUT_SECONDS,
      extra: {
        contract: checkout,
        order: toWireOrder(order),
        shopName: shop.ensName,
        mandateRequired: true,
        ...(quoteKey ? { quoteKey } : {}),
      },
    };
  }

  function quoteOf({ shop, product, terms, order }) {
    return {
      shop: shop.ensName,
      item: product.name,
      sku: product.sku,
      quantity: terms.quantity,
      priceMicro: terms.priceMicro,
      etaMinutes: shop.scenario.etaMinutes ?? null,
      validUntil: terms.exp,
      orderId: terms.orderId,
      terms,
      order: toWireOrder(order),
      payUrl: payUrlOf(terms),
      asset: token.address,
      network,
      synthetic: true,
    };
  }

  async function quote(url) {
    const q = url.searchParams;
    const built = buildOrder(
      {
        shop: q.get('shop') ?? '',
        item: q.get('item') ?? '',
        quantity: q.get('qty') ?? q.get('quantity'),
        buyer: q.get('buyer') ?? '',
        payer: q.get('payer') ?? '',
        wallet: q.get('wallet') ?? '',
        parentOrderId: q.get('parent') ?? undefined,
      },
      ctx(),
    );
    return json(200, quoteOf(built));
  }

  const settlementHeader = (s) => ({ 'PAYMENT-RESPONSE': encodePaymentResponseHeader(s) });

  async function pay(request, pathId, kind) {
    const refusal = passcodeRefusal(request);
    if (refusal) return refusal;
    if (!payLimit.take('all')) return json(429, { error: 'rate limited' });
    const body = await readJson(request, BODY_LIMIT);
    if (body.error) return json(body.error, { error: 'bad request' });
    const built = rebuildOrder(body.value, ctx());
    const { shop, terms, order, requestId } = built;
    if (kind === 'pay' && (terms.parentOrderId !== ZERO32 || pathId !== terms.orderId)) return json(400, { error: 'this is not the order in the path' });
    if (kind === 'reorder' && (terms.parentOrderId === ZERO32 || pathId !== terms.parentOrderId)) return json(400, { error: 'this is not a re-order of the order in the path' });

    try {
      await ready();
    } catch {
      return json(503, { error: 'starting' });
    }
    if (!(await payeeHolds(shop, order.merchant))) return json(503, { error: 'payee check failed' });

    // The chain is the record.
    const state = await orders.readOrder(order.orderId);
    const status = STATUS[state.status];
    if (status === 'PAID' || status === 'DELIVERED' || status === 'REFUNDED') {
      return json(200, { status: 'paid', alreadyPaid: true, orderId: order.orderId, chainStatus: status });
    }
    if (status === 'CANCELLED') return json(409, { error: 'order cancelled' });
    if (status === 'CREATED' && state.termsHash !== termsHashOf(order)) return json(409, { error: 'order id taken by other terms' });
    if (kind === 'reorder') {
      const parent = await orders.readOrder(order.parentOrderId);
      const ps = STATUS[parent.status];
      if (!['PAID', 'DELIVERED', 'REFUNDED'].includes(ps) || parent.buyerNode !== order.buyerNode || parent.shopNode !== order.shopNode) {
        return json(409, { error: 'the parent order is not a paid order of this buyer at this shop' });
      }
    }

    const signature = request.headers.get('payment-signature');
    if (!signature) {
      let quoteKey;
      if (requestId && terms.payer !== '' && deps.createQuote) {
        if (!quoteLimit.take('all')) return json(429, { error: 'rate limited' });
        try {
          const written = await deps.createQuote({ requestId, shopName: shop.ensName, agentEns: terms.payer, priceMicro: order.amountMicro, validUntil: terms.exp });
          quoteKey = written.entityKey;
        } catch (e) {
          log(`shop: quote write failed (${errorNames(e)})`);
          return json(503, { error: 'quote write failed' });
        }
      }
      const paymentRequired = {
        x402Version: X402_VERSION,
        error: 'payment required',
        resource: { url: payUrlOf(terms), description: `${shop.displayName}: ${terms.quantity} × ${built.product.name} (synthetic demo shop)`, mimeType: 'application/json' },
        accepts: [requirementOf(order, shop, quoteKey)],
      };
      return json(402, paymentRequired, { 'PAYMENT-REQUIRED': encodePaymentRequiredHeader(paymentRequired) });
    }

    let paymentPayload;
    try {
      paymentPayload = decodePaymentSignatureHeader(signature);
    } catch {
      return json(400, { error: 'bad PAYMENT-SIGNATURE' });
    }
    // The quote key is informational and set only on the 402 step; carry it over so the
    // requirement equals what the payer accepted.
    // The quote names the paying wallet (it is hashed into the order id): no other may pay it.
    const signer = paymentPayload?.payload?.payer;
    if (terms.wallet !== ZERO_ADDRESS && (typeof signer !== 'string' || !isAddress(signer, { strict: false }) || !isAddressEqual(signer, terms.wallet))) {
      return json(400, { error: 'the payment is not from the quoted wallet' });
    }
    const echoedKey = paymentPayload?.accepted?.extra?.quoteKey;
    const requirement = requirementOf(order, shop, typeof echoedKey === 'string' && HEX32.test(echoedKey) ? echoedKey : undefined);

    let verdict;
    try {
      verdict = await facilitator.verify(paymentPayload, requirement);
    } catch (e) {
      log(`shop: facilitator verify unavailable (${errorNames(e)})`);
      return json(502, { error: 'facilitator verify unavailable; retry is safe' }); // nothing can have been sent
    }
    if (!verdict.isValid) {
      const s = { success: false, errorReason: verdict.invalidReason ?? 'invalid', transaction: '', network, payer: verdict.payer };
      return json(402, { status: 'refused', reason: s.errorReason, orderId: order.orderId }, settlementHeader(s));
    }
    let settled;
    try {
      settled = await facilitator.settle(paymentPayload, requirement);
    } catch (e) {
      log(`shop: facilitator settle unavailable (${errorNames(e)})`);
      // Only the facilitator's own refusals before any send (a full queue, a rate limit) are safe to
      // retry. Any other failure may come after the relayer broadcast (a send error, a timeout past
      // the function's limit): the payment is unknown, and the payer keeps it unsettled (G16).
      if (e?.name === 'SettleError' && (e.errorReason === 'busy' || e.errorReason === 'rate_limited')) {
        return json(502, { error: 'facilitator busy; retry is safe', reason: e.errorReason });
      }
      return json(504, { status: 'pending', reason: 'settle_unknown', orderId: order.orderId });
    }
    if (settled.success) {
      let delivery = 'not_configured';
      if (deps.deliver) {
        delivery = await deps.deliver(shop.key, order.orderId).catch((e) => {
          log(`shop: markDelivered failed (${errorNames(e)})`);
          return 'pending';
        });
      }
      return json(200, { status: 'paid', orderId: order.orderId, transaction: settled.transaction, delivery }, settlementHeader(settled));
    }
    if (UNSETTLED.has(settled.errorReason)) {
      return json(settled.errorReason === 'in_flight' ? 503 : 504, { status: 'pending', reason: settled.errorReason, orderId: order.orderId, transaction: settled.transaction }, settlementHeader(settled));
    }
    const status402 = settled.transaction ? 'failed' : 'refused';
    return json(402, { status: status402, reason: settled.errorReason, orderId: order.orderId, transaction: settled.transaction || undefined }, settlementHeader(settled));
  }

  return async function handle(request) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, '');
      if (request.method === 'GET' && path.endsWith('/catalog')) {
        const shop = shops.find((s) => s.ensName === url.searchParams.get('shop') || s.key === url.searchParams.get('shop'));
        return shop ? json(200, catalogOf(shop)) : json(404, { error: 'unknown shop' });
      }
      if (request.method === 'GET' && path.endsWith('/quote')) return await quote(url);
      const m = /\/orders\/(0x[0-9a-fA-F]{64})\/(pay|reorder)$/.exec(path);
      if (request.method === 'POST' && m) return await pay(request, m[1].toLowerCase(), m[2]);
      return json(404, { error: 'not found' });
    } catch (e) {
      if (e instanceof TermsError) return json(e.status, { error: e.reason });
      log(`shop: ${errorNames(e)}`); // never the message: viem's quotes the RPC URL
      return json(500, { error: 'internal error' });
    }
  };
}
