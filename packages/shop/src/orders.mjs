// Stateless orders (planning/SPEC/PAYMENTS_WHITECHAIN.md §6): the order id is a hash of the quote's
// terms with the top bit cleared (renewal ids carry it, §3.6), so the shop keeps no database and
// the chain is the record. A body's terms are rebuilt from the catalog and must hash to its id.

import { encodeAbiParameters, getAddress, isAddress, keccak256, namehash } from 'viem';
import { normalize } from 'viem/ens';
import { z } from 'zod';
import { priceOf, productOf } from './catalog.mjs';

export const ZERO32 = `0x${'0'.repeat(64)}`;
export const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;
const TOP_BIT_CLEAR = (1n << 255n) - 1n;
export const MAX_QUANTITY = 10_000;
const CLOCK_SLACK_SECONDS = 30;

const hex32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const ensName = z.string().min(3).max(255);

// The terms a quote returns and a pay call echoes, plus the optional errand id (M7 amendment §5).
export const termsSchema = z
  .object({
    orderId: hex32,
    shop: ensName,
    item: z.string().min(1).max(64),
    quantity: z.number().int().min(1).max(MAX_QUANTITY),
    priceMicro: z.string().regex(/^[1-9][0-9]{0,18}$/),
    exp: z.number().int().positive(),
    buyer: ensName,
    payer: z.union([ensName, z.literal('')]),
    wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    parentOrderId: hex32,
    requestId: hex32.optional(),
  })
  .strict();

// An ENS name exactly as ENSIP-15 normalises it, or null.
export function normalName(name) {
  try {
    return typeof name === 'string' && name !== '' && normalize(name) === name ? name : null;
  } catch {
    return null;
  }
}

export function orderIdOf({ shopNode, buyerNode, payerNode, wallet, sku, quantity, exp, parentOrderId }) {
  const h = keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'address' }, { type: 'string' }, { type: 'uint32' }, { type: 'uint64' }, { type: 'bytes32' }],
      [shopNode, buyerNode, payerNode, wallet, sku, quantity, BigInt(exp), parentOrderId],
    ),
  );
  return `0x${(BigInt(h) & TOP_BIT_CLEAR).toString(16).padStart(64, '0')}`;
}

class TermsError extends Error {
  constructor(status, reason) {
    super(reason);
    this.status = status;
    this.reason = reason;
  }
}
const bad = (status, reason) => {
  throw new TermsError(status, reason);
};
export { TermsError };

// Builds the quote's terms and the contract's Order from a request: { shop, item, quantity,
// buyer, payer, wallet, parentOrderId }. `exp` is now + ttl, or the echoed one checked against it.
// shops: from storyShops; merchants: shop key -> payout address; nowSec: the shop's clock.
export function buildOrder(input, { shops, merchants, nowSec, ttlSeconds, exp: echoed }) {
  const shop = shops.find((s) => s.ensName === input.shop || s.key === input.shop);
  if (!shop) bad(404, 'unknown shop');
  const merchant = merchants[shop.key];
  if (!merchant || !isAddress(merchant)) bad(503, 'shop not configured');
  const product = productOf(shop, input.item);
  if (!product) bad(404, 'unknown item');
  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) bad(400, 'bad quantity');
  const buyer = normalName(input.buyer);
  if (!buyer) bad(400, 'buyer must be a normalised ENS name');
  const payer = input.payer === '' || input.payer === undefined ? '' : normalName(input.payer);
  if (payer === null) bad(400, 'payer must be a normalised ENS name, or empty for a human payer');
  const walletIn = input.wallet ?? '';
  if (walletIn !== '' && !isAddress(walletIn, { strict: false })) bad(400, 'bad wallet');
  if (payer === '' && (walletIn === '' || BigInt(walletIn) === 0n)) bad(400, 'a human payer must give a wallet address');
  const wallet = walletIn === '' ? ZERO_ADDRESS : getAddress(walletIn);
  const parentOrderId = (input.parentOrderId ?? ZERO32).toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(parentOrderId)) bad(400, 'bad parent order id');

  // Quotes expire; an echoed exp is clamped to now + ttl (plus a little slack for another
  // instance's clock), so a forged later one no longer hashes.
  const exp = echoed === undefined ? nowSec + ttlSeconds : Math.min(echoed, nowSec + ttlSeconds + CLOCK_SLACK_SECONDS);
  if (exp <= nowSec) bad(410, 'quote expired');

  const amountMicro = priceOf(product, quantity);
  const shopNode = namehash(shop.ensName);
  const buyerNode = namehash(buyer);
  const payerNode = payer === '' ? ZERO32 : namehash(payer);
  const orderId = orderIdOf({ shopNode, buyerNode, payerNode, wallet, sku: product.sku, quantity, exp, parentOrderId });
  const terms = {
    orderId,
    shop: shop.ensName,
    item: product.sku,
    quantity,
    priceMicro: String(amountMicro),
    exp,
    buyer,
    payer,
    wallet,
    parentOrderId,
  };
  const order = {
    orderId,
    parentOrderId,
    buyerNode,
    shopNode,
    payerNode,
    merchant: getAddress(merchant),
    amountMicro,
    deadline: BigInt(exp),
    kind: parentOrderId === ZERO32 ? 0 : 1,
  };
  return { shop, product, terms, order };
}

// The body's terms, rebuilt from the catalog: the id must match and the price must still hold.
export function rebuildOrder(body, ctx) {
  const parsed = termsSchema.safeParse(body);
  if (!parsed.success) bad(400, 'bad terms');
  const t = parsed.data;
  const built = buildOrder(t, { ...ctx, exp: t.exp });
  if (built.terms.orderId !== t.orderId.toLowerCase()) bad(400, 'the terms do not match the order id');
  if (built.terms.priceMicro !== t.priceMicro) bad(409, 'the price has changed: ask for a new quote');
  return { ...built, requestId: t.requestId?.toLowerCase() };
}
