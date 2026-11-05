// The same actions as AI tools: AI SDK tool definitions and MCP tools from one definition.
// The model proposes, code disposes (ADR-0019): no tool takes a cap, an allowlist or a budget
// as input. A model can only ask to pay less (maxUsdt); every limit is checked in code by the
// buyer or the merchant, and a refusal comes back as { ok: false, code, message }.

import { z } from 'zod';
import { tool } from 'ai';
import { AgentPayError } from './network.mjs';
import { formatUsdt, usdt } from './money.mjs';

const HEX32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const AMOUNT = z.string().regex(/^\d{1,7}(\.\d{1,6})?$/).describe('USDT, as a decimal string such as "4.80"');
const URL_TEXT = z.string().url().max(2048);

// Bigints as strings, so tool results are plain JSON.
export function plain(value) {
  return JSON.parse(JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
}

// URLs out of any text a model will read (an RPC error can quote a keyed URL), before truncating.
export function redact(text) {
  return String(text).replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>)]+/gi, '[url]').slice(0, 300);
}

async function guarded(run) {
  try {
    return plain({ ok: true, ...(await run()) });
  } catch (e) {
    if (e instanceof AgentPayError) return { ok: false, code: e.code, message: redact(e.message), ...(e.details ? plain({ details: e.details }) : {}) };
    // Anything else (RPC, network) reports only its name: its message may carry a keyed URL.
    return { ok: false, code: 'ERROR', name: String(e?.name ?? 'Error').slice(0, 60) };
  }
}

function originGuard(allowedOrigins) {
  return (url) => {
    if (!allowedOrigins) return;
    const origin = new URL(url).origin;
    if (!allowedOrigins.includes(origin)) throw new AgentPayError('ORIGIN_NOT_ALLOWED', `${origin} is not an allowed merchant origin`);
  };
}

const orderSummary = (order) => ({
  orderId: order.orderId,
  merchant: order.merchant.name,
  payTo: order.merchant.address,
  items: order.items.map((i) => ({ sku: i.sku, name: i.name, quantity: i.quantity, unitPrice: formatUsdt(i.unitPriceMicro) })),
  total: formatUsdt(order.totalMicro),
  fulfilment: order.fulfilment,
  deadline: new Date(Number(order.deadline) * 1000).toISOString(),
});

// allowedOrigins: optional list of merchant origins the model may send the agent to.
export function buyerToolDefinitions(buyer, { allowedOrigins } = {}) {
  const origin = originGuard(allowedOrigins);
  return [
    {
      name: 'agentpay_pass_status',
      description: 'The spending pass: the on-chain daily cap, what is spent and left this period, the merchant allowlist and the mandate budget.',
      shape: {},
      run: () => guarded(async () => ({ pass: await buyer.passStatus() })),
    },
    {
      name: 'agentpay_quote',
      description: 'Read the price of a paid URL (its HTTP 402) without paying: the merchant, items, total and whether every spending guard would let it through.',
      shape: { url: URL_TEXT },
      run: ({ url }) =>
        guarded(async () => {
          origin(url);
          const q = await buyer.quote(url);
          if (q.free) return { free: true, httpStatus: q.status };
          let guards = { pass: true };
          try {
            await buyer.check(q.order);
          } catch (e) {
            if (!(e instanceof AgentPayError)) throw e;
            guards = { pass: false, code: e.code, message: e.message };
          }
          return { free: false, order: orderSummary(q.order), guards };
        }),
    },
    {
      name: 'agentpay_pay',
      description: 'Pay a URL that answers HTTP 402: one signature, no gas. Refused in code if it breaks the cap, the allowlist or the budget. maxUsdt can only lower the limit.',
      shape: { url: URL_TEXT, maxUsdt: AMOUNT.optional() },
      run: ({ url, maxUsdt }) =>
        guarded(async () => {
          origin(url);
          const r = await buyer.pay(url, { maxMicro: maxUsdt === undefined ? undefined : usdt(maxUsdt) });
          if (r.status === 'free') return { status: 'free', httpStatus: r.httpStatus };
          if (r.status === 'not_payable') return { status: r.status, orderStatus: r.orderStatus, orderId: r.orderId };
          return { status: r.status, orderId: r.orderId, amount: formatUsdt(r.amountMicro), merchant: r.merchant.name, transaction: r.transaction, reason: r.reason };
        }),
    },
    {
      name: 'agentpay_request_refund',
      description: 'Ask a merchant to refund part or all of a paid order, with a reason. Signed by this payer; the merchant decides.',
      shape: { url: URL_TEXT, orderId: HEX32, amountUsdt: AMOUNT, reason: z.string().min(1).max(280) },
      run: ({ url, orderId, amountUsdt, reason }) =>
        guarded(async () => {
          origin(url);
          return { result: await buyer.requestRefund({ url, orderId, amountMicro: usdt(amountUsdt), reason }) };
        }),
    },
    {
      name: 'agentpay_subscribe',
      description: "Subscribe to a merchant's plan. Checked like a payment: one charge must fit the cap and the allowlist. maxUsdt can only lower the limit per charge.",
      shape: { url: URL_TEXT, maxUsdt: AMOUNT.optional() },
      run: ({ url, maxUsdt }) =>
        guarded(async () => {
          origin(url);
          return { result: await buyer.subscribe({ url, maxMicro: maxUsdt === undefined ? undefined : usdt(maxUsdt) }) };
        }),
    },
    {
      name: 'agentpay_cancel',
      description: 'Cancel a subscription with a signature (gasless).',
      shape: { url: URL_TEXT, subId: HEX32 },
      run: ({ url, subId }) =>
        guarded(async () => {
          origin(url);
          return { result: await buyer.cancel({ url, subId }) };
        }),
    },
  ];
}

// catalog: { [sku]: { name, unitPriceMicro } }: the merchant's own prices; a model cannot set one.
export function merchantToolDefinitions(merchant, { catalog, fulfilmentTypes = ['delivery', 'pickup', 'ride', 'digital', 'service'] } = {}) {
  return [
    {
      name: 'agentpay_quote',
      description: "Quote an order from this merchant's own catalog: items by sku and quantity, fulfilment type and details. Prices come from the catalog, never from the request.",
      shape: {
        items: z.array(z.object({ sku: z.string().min(1).max(64), quantity: z.number().int().min(1).max(10_000) })).min(1).max(50),
        fulfilment: z.object({ type: z.enum(fulfilmentTypes), details: z.record(z.string(), z.union([z.string().max(200), z.number(), z.boolean()])).optional() }),
        payerName: z.string().max(255).optional(),
        payerAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
      },
      run: ({ items, fulfilment, payerName, payerAddress }) =>
        guarded(async () => {
          if (!catalog) throw new AgentPayError('NO_CATALOG', 'this merchant has no catalog for quotes');
          const lines = items.map(({ sku, quantity }) => {
            if (!Object.hasOwn(catalog, sku)) throw new AgentPayError('UNKNOWN_SKU', `no product ${sku}`);
            return { sku, name: catalog[sku].name, quantity, unitPriceMicro: catalog[sku].unitPriceMicro };
          });
          const order = merchant.order({ items: lines, fulfilment: { type: fulfilment.type, details: fulfilment.details ?? {} }, payer: { name: payerName ?? '', address: payerAddress } });
          return { order: orderSummary(order) };
        }),
    },
    {
      name: 'agentpay_accept',
      description: 'Accept a paid order for fulfilment after the risk check. Refuses an order that is not paid or not ours.',
      shape: { orderId: HEX32 },
      run: ({ orderId }) => guarded(async () => ({ result: await merchant.accept(orderId) })),
    },
    {
      name: 'agentpay_refund',
      description: 'Refund part or all of a paid order to its payer, on-chain. Capped in code at what is left to refund and at the merchant refund limit.',
      shape: { orderId: HEX32, amountUsdt: AMOUNT, reasonCode: z.number().int().min(0).max(255).optional() },
      run: ({ orderId, amountUsdt, reasonCode }) =>
        guarded(async () => {
          // A model may refund only under a limit a person set (createMerchant maxRefundMicro).
          if (merchant.limits?.maxRefundMicro === undefined) throw new AgentPayError('NO_REFUND_LIMIT', 'set maxRefundMicro on the merchant before a model may refund');
          return { result: await merchant.refund(orderId, usdt(amountUsdt), { reasonCode }) };
        }),
    },
  ];
}

// AI SDK 7 tools ({ name: tool }) from definitions.
export function aiSdkTools(definitions) {
  return Object.fromEntries(definitions.map((d) => [d.name, tool({ description: d.description, inputSchema: z.object(d.shape), execute: (input) => d.run(input) })]));
}

export const buyerTools = (buyer, options) => aiSdkTools(buyerToolDefinitions(buyer, options));
export const merchantTools = (merchant, options) => aiSdkTools(merchantToolDefinitions(merchant, options));
