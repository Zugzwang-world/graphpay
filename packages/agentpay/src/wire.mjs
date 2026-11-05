// The graphpay-order x402 scheme on the wire (planning/SPEC/PAYMENTS_WHITECHAIN.md §5), kept
// field for field compatible with our facilitator (T1, M3): the same requirement, the same
// payload, x402 v2 field names and headers. AgentPay's order details (items, fulfilment,
// salt) travel in `extensions.agentpay` of the 402 and are echoed by the payer; the
// requirement's `extra` stays exactly the scheme's.

import { z } from 'zod';
import { getAddress, isAddressEqual } from 'viem';
import { orderFromWire, orderToWire } from './order.mjs';

export const SCHEME = 'graphpay-order';
export const X402_VERSION = 2;
export const MAX_TIMEOUT_SECONDS = 600;
export const HEADERS = Object.freeze({ required: 'PAYMENT-REQUIRED', signature: 'PAYMENT-SIGNATURE', response: 'PAYMENT-RESPONSE' });
export const AGENTPAY_EXTENSION = 'agentpay';
// Identity headers a payer sends with its first request, so the order is built for it.
export const PAYER_HEADERS = Object.freeze({ address: 'x-agentpay-payer', name: 'x-agentpay-payer-name', buyer: 'x-agentpay-buyer-name', salt: 'x-agentpay-salt' });
const MAX_HEADER = 65_536;

const hex32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const uintString = (digits) => z.string().regex(new RegExp(`^(0|[1-9][0-9]{0,${digits - 1}})$`));
const u64 = uintString(20).refine((v) => BigInt(v) < 1n << 64n, 'above uint64');
const u256 = uintString(78).refine((v) => BigInt(v) < 1n << 256n, 'above uint256');
const sigHex = z.string().regex(/^0x([0-9a-fA-F]{2}){1,2048}$/);
const bytesHex = z.string().regex(/^0x([0-9a-fA-F]{2}){0,4096}$/);

export const wireOrderSchema = z
  .object({
    orderId: hex32,
    parentOrderId: hex32,
    buyerNode: hex32,
    shopNode: hex32,
    payerNode: hex32,
    merchant: address,
    amountMicro: u64,
    deadline: u64,
    kind: z.enum(['0', '1']),
  })
  .strict();

export const requirementSchema = z
  .object({
    scheme: z.literal(SCHEME),
    network: z.string().max(32),
    asset: address,
    amount: u64,
    payTo: address,
    maxTimeoutSeconds: z.number().int().min(1).max(MAX_TIMEOUT_SECONDS),
    extra: z
      .object({
        contract: address,
        order: wireOrderSchema,
        shopName: z.string().min(1).max(255),
        mandateRequired: z.literal(true),
        quoteKey: hex32.optional(),
      })
      .strict(),
  })
  .strict();

export const payloadSchema = z
  .object({
    order: wireOrderSchema,
    mandateHash: hex32,
    payerName: z.string().max(255),
    payer: address,
    permit: z.object({ token: address, amount: u256, nonce: u256, deadline: u256 }).strict(),
    signature: sigHex,
    approvalPermit: bytesHex,
  })
  .strict();

const extensionsSchema = z.record(z.string(), z.unknown()).optional();

export const paymentRequiredSchema = z.object({
  x402Version: z.literal(X402_VERSION),
  error: z.string().max(512).optional(),
  resource: z.object({ url: z.string().max(2048) }).passthrough(),
  accepts: z.array(requirementSchema).length(1),
  extensions: extensionsSchema,
});

export const paymentPayloadSchema = z.object({
  x402Version: z.literal(X402_VERSION),
  resource: z.object({ url: z.string().max(2048) }).passthrough().optional(),
  accepted: requirementSchema,
  payload: payloadSchema,
  extensions: extensionsSchema,
});

export function toWireOrder(o) {
  return {
    orderId: o.orderId,
    parentOrderId: o.parentOrderId,
    buyerNode: o.buyerNode,
    shopNode: o.shopNode,
    payerNode: o.payerNode,
    merchant: o.merchant,
    amountMicro: String(o.amountMicro),
    deadline: String(o.deadline),
    kind: String(o.kind),
  };
}

// The Order struct as viem encodes it for the contract.
// Hex fields lower case, as viem returns bytes32 reads, so comparisons never depend on case.
export function fromWireOrder(w) {
  return {
    orderId: w.orderId.toLowerCase(),
    parentOrderId: w.parentOrderId.toLowerCase(),
    buyerNode: w.buyerNode.toLowerCase(),
    shopNode: w.shopNode.toLowerCase(),
    payerNode: w.payerNode.toLowerCase(),
    merchant: getAddress(w.merchant),
    amountMicro: BigInt(w.amountMicro),
    deadline: BigInt(w.deadline),
    kind: Number(w.kind),
  };
}

const lower = (v) => String(v).toLowerCase();
export function sameWireOrder(a, b) {
  return Object.keys(wireOrderSchema.shape).every((k) => lower(a[k]) === lower(b[k]));
}

// The one requirement a merchant answers for an order.
export function buildRequirement(order, network, { shopName = order.merchant.name, maxTimeoutSeconds = MAX_TIMEOUT_SECONDS } = {}) {
  return {
    scheme: SCHEME,
    network: network.caip2,
    asset: network.token.address,
    amount: order.totalMicro.toString(),
    payTo: order.merchant.address,
    maxTimeoutSeconds,
    extra: { contract: network.checkout, order: toWireOrder(order.chain), shopName, mandateRequired: true },
  };
}

export function buildPaymentRequired(order, network, { resourceUrl, description, error = 'payment required' } = {}) {
  return {
    x402Version: X402_VERSION,
    error,
    resource: { url: resourceUrl, description: description ?? `${order.items.length} item(s) from ${order.merchant.name}`, mimeType: 'application/json' },
    accepts: [buildRequirement(order, network)],
    extensions: { [AGENTPAY_EXTENSION]: { version: 1, order: orderToWire(order) } },
  };
}

// The order a 402 offers, re-derived from its details and checked against the requirement:
// the id, nodes, merchant, amount, deadline and kind must all be the ones the details imply.
export function orderOfPaymentRequired(paymentRequired, network) {
  const pr = paymentRequiredSchema.parse(paymentRequired);
  const req = pr.accepts[0];
  const details = pr.extensions?.[AGENTPAY_EXTENSION]?.order;
  if (!details) throw new Error('the 402 carries no agentpay order details');
  const order = orderFromWire(details);
  checkRequirementMatchesOrder(req, order, network);
  return { paymentRequired: pr, requirement: req, order };
}

export function checkRequirementMatchesOrder(req, order, network) {
  if (req.network !== network.caip2) throw new Error('the requirement is for another network');
  if (!isAddressEqual(req.asset, network.token.address)) throw new Error('the requirement asks for another token');
  if (!isAddressEqual(req.extra.contract, network.checkout)) throw new Error('the requirement names another checkout contract');
  if (!sameWireOrder(req.extra.order, toWireOrder(order.chain))) throw new Error('the requirement order does not match its details');
  if (BigInt(req.amount) !== order.totalMicro || !isAddressEqual(req.payTo, order.merchant.address)) throw new Error('the amount or payee does not match the order');
}

// x402 v2 headers carry base64 JSON. Lookups ignore case.
export function encodeHeader(value) {
  return Buffer.from(JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v)), 'utf8').toString('base64');
}

export function decodeHeader(value) {
  if (typeof value !== 'string' || value === '' || value.length > MAX_HEADER) return null;
  try {
    return JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

export function getHeader(headers, name) {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') return headers.get(name) ?? undefined;
  const wanted = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() === wanted) return Array.isArray(v) ? v[0] : v;
  return undefined;
}
