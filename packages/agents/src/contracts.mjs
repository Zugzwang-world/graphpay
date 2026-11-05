// The data contracts of planning/SPEC/AGENTS.md §6 and the structured output of
// each role (§2), as zod schemas. Lengths are capped: model output is untrusted.

import { z } from 'zod';
import { USDT_PATTERN } from './money.mjs';

export const Usdt = z.string().regex(USDT_PATTERN, 'a USDT amount: digits, at most 6 decimals');
const Name = z.string().min(1).max(255);
const Text = z.string().max(2000);
const Hex32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

export const NEEDS = ['food', 'shirt', 'ride'];

export const NeedSpec = z.object({
  need: z.enum(NEEDS),
  item: z.string().min(1).max(80),
  category: z.string().min(1).max(40),
  quantity: z.number().int().positive().max(10_000),
  budgetUsdt: Usdt,
  deadlineIso: z.string().min(1).max(40),
  city: z.string().min(1).max(60),
  buyer: Name,
});

// What the concierge proposes when it calls `scout` or `analyst`; code adopts it (G1).
export const NeedProposal = z.object({
  need: z.enum(NEEDS),
  item: z.string().min(1).max(80),
  quantity: z.number().int().positive().max(10_000),
  budgetUsdt: Usdt,
  deadlineIso: z.string().min(1).max(40),
  city: z.string().min(1).max(60),
});

export const Quote = z.object({
  shop: Name,
  sku: z.string().min(1).max(80),
  item: z.string().min(1).max(80),
  quantity: z.number().int().positive(),
  priceUsdt: Usdt,
  etaMinutes: z.number().int().nonnegative().max(100_000),
  distanceKm: z.number().nonnegative().max(100_000),
});

export const ShopTally = z.object({
  ens: Name,
  refundRate90d: z.number().min(0).max(1),
  onTimeRate90d: z.number().min(0).max(1),
  orders90d: z.number().int().nonnegative(),
  verifiedOwner: z.boolean(),
});

export const AgentStanding = z.object({
  ens: Name,
  principal: z.object({ ens: z.string().max(255), verifiedOwner: z.boolean() }),
  status: z.string().max(40),
  orders: z.number().int().nonnegative(),
  cancellations: z.number().int().nonnegative(),
  disputes: z.number().int().nonnegative(),
  dailyCapUsdt: Usdt,
  spendTodayUsdt: Usdt,
});

export const RankedShop = z.object({
  ens: Name,
  score: z.number(),
  eligible: z.boolean(),
  reasons: z.array(z.string().max(200)).max(20),
});

export const Receipt = z.object({
  success: z.boolean(),
  transaction: z.string().max(200),
  network: z.string().max(60),
  payer: z.string().max(200),
  payTo: z.string().max(200),
  amountUsdt: Usdt,
  asset: z.string().max(200),
  explorerUrl: z.string().max(400),
});

export const Mandate = z.object({
  budgetUsdt: Usdt,
  deadlineIso: z.string().min(1).max(40),
  hash: Hex32,
});

// Structured output per role (§2). The model proposes; code checks every field it uses.
export const OUTPUTS = {
  concierge: z.object({ summary: Text, chosenShop: Name.nullable() }),
  scout: z.object({ offers: z.array(Quote).max(50) }),
  analyst: z.object({ ranking: z.array(RankedShop).max(50), recommendation: Name.nullable(), notes: Text }),
  payer: z.object({
    status: z.enum(['paid', 'refused', 'unsettled', 'failed']),
    reason: Text,
    receiptTransaction: z.string().max(200).nullable(),
  }),
  storefront: z.object({ quoteUsdt: Usdt.nullable(), etaMinutes: z.number().int().nonnegative().nullable(), message: Text }),
  risk: z.object({ decision: z.enum(['approve', 'decline']), reasons: z.array(z.string().max(300)).max(20) }),
  dispatch: z.object({ confirmed: z.boolean(), orderId: z.string().max(80), etaIso: z.string().max(40), message: Text }),
};

export const ROLES = Object.freeze(Object.keys(OUTPUTS));
export { Hex32 };

// What the model is asked to produce: types and required fields only. Native
// structured output rejects or strips bounds and patterns, so code validates the
// reply against OUTPUTS (the strict schemas above) after the call.
const wireQuote = z.object({ shop: z.string(), sku: z.string(), item: z.string(), quantity: z.number(), priceUsdt: z.string(), etaMinutes: z.number(), distanceKm: z.number() });
const wireRanked = z.object({ ens: z.string(), score: z.number(), eligible: z.boolean(), reasons: z.array(z.string()) });
export const WIRE_OUTPUTS = {
  concierge: z.object({ summary: z.string(), chosenShop: z.string().nullable() }),
  scout: z.object({ offers: z.array(wireQuote) }),
  analyst: z.object({ ranking: z.array(wireRanked), recommendation: z.string().nullable(), notes: z.string() }),
  payer: z.object({ status: z.enum(['paid', 'refused', 'unsettled', 'failed']), reason: z.string(), receiptTransaction: z.string().nullable() }),
  storefront: z.object({ quoteUsdt: z.string().nullable(), etaMinutes: z.number().nullable(), message: z.string() }),
  risk: z.object({ decision: z.enum(['approve', 'decline']), reasons: z.array(z.string()) }),
  dispatch: z.object({ confirmed: z.boolean(), orderId: z.string(), etaIso: z.string(), message: z.string() }),
};
