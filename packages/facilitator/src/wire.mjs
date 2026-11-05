// The graphpay-order scheme on the wire (planning/SPEC/PAYMENTS_WHITECHAIN.md §5): the shop's
// requirement, the payer's payload and the order with its numbers as decimal strings. Every
// field is parsed with a length cap before anything else reads it.

import { z } from 'zod';

export const SCHEME = 'graphpay-order';
export const X402_VERSION = 2;
export const MAX_TIMEOUT_SECONDS = 600;

const hex32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const uintString = (digits) => z.string().regex(new RegExp(`^(0|[1-9][0-9]{0,${digits - 1}})$`));
const u64 = uintString(20).refine((v) => BigInt(v) < 1n << 64n, 'above uint64');
const u256 = uintString(78).refine((v) => BigInt(v) < 1n << 256n, 'above uint256');
// 65-byte ECDSA up to a generous ERC-1271 blob; never unbounded.
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
    payerName: z.string().max(255), // '' for a human payer
    payer: address,
    permit: z.object({ token: address, amount: u256, nonce: u256, deadline: u256 }).strict(),
    signature: sigHex,
    approvalPermit: bytesHex,
  })
  .strict();

export const paymentPayloadSchema = z.object({
  x402Version: z.literal(X402_VERSION),
  resource: z.object({ url: z.string().max(2048) }).passthrough().optional(),
  accepted: requirementSchema,
  payload: payloadSchema,
  extensions: z.record(z.string(), z.unknown()).optional(),
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

// The Order struct as viem encodes it for the contract; 32-byte fields in lower case, as the
// chain returns them, so string comparisons with chain reads hold.
export function fromWireOrder(w) {
  return {
    orderId: w.orderId.toLowerCase(),
    parentOrderId: w.parentOrderId.toLowerCase(),
    buyerNode: w.buyerNode.toLowerCase(),
    shopNode: w.shopNode.toLowerCase(),
    payerNode: w.payerNode.toLowerCase(),
    merchant: w.merchant,
    amountMicro: BigInt(w.amountMicro),
    deadline: BigInt(w.deadline),
    kind: Number(w.kind),
  };
}

const lower = (v) => String(v).toLowerCase();

// The payload's order is the requirement's, field for field (addresses and hex in any case).
export function sameOrder(a, b) {
  return Object.keys(wireOrderSchema.shape).every((k) => lower(a[k]) === lower(b[k]));
}
