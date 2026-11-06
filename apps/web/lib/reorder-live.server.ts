// The live side of Re-order (lib/reorder.server.ts holds the decisions): the shop's quote over
// the production domain, and the payer agent's buyer, which answers the shop's 402 with one
// signature under its on-chain spending pass. The key is read from the env by role name, never
// leaves this file and is never logged. This is the only file here that imports the SDK.
import { createBuyerAgent, whitechainNetwork } from '@graphpay/agentpay';
import { activeCast, config } from '@graphpay/config';
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';
import { sharedCustomerState } from './customer-state.server.ts';
import { readOrder } from './merchant-actions.server.ts';
import { PASSCODE_HEADER } from './passcode-header.ts';
import { whitechain } from './payments.server.ts';
import { checkoutAddress, siteModel } from './site.server.ts';
import type { ReorderDeps, ReorderQuote } from './reorder.server.ts';

const KEY_SHAPE = /^0x[0-9a-fA-F]{64}$/;
const SITE = String(config.site.url).replace(/\/+$/, '');
const SHOP = `${SITE}/api/shop`;

export function payerKeyName(): string {
  const payer = activeCast().buyerAgents.find((a) => a.key === 'payer');
  if (!payer) throw new Error('the story names no payer agent');
  return `${payer.walletRole}_PRIVATE_KEY`;
}

export function payerKeyConfigured(env: Record<string, string | undefined> = process.env): boolean {
  try {
    return KEY_SHAPE.test(env[payerKeyName()] ?? '');
  } catch {
    return false;
  }
}

function payerAccount() {
  const key = process.env[payerKeyName()] ?? '';
  if (!KEY_SHAPE.test(key)) throw new Error('the payer key is not set');
  return privateKeyToAccount(key as Hex);
}

// The shop's own answer, from its production URL (never VERCEL_URL, which needs a login).
async function getJson(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`the shop answered ${response.status}`);
  return (await response.json()) as Record<string, unknown>;
}

export function liveReorderDeps(): ReorderDeps {
  const model = siteModel();
  return {
    lastOrderId: async () => (await sharedCustomerState()).lastOrder?.orderId ?? null,
    readOrder: async (orderId) => {
      const checkout = checkoutAddress();
      if (!checkout) throw new Error('the checkout is not deployed');
      const w = await whitechain();
      return readOrder({ publicClient: w.publicClient, checkout: checkout as `0x${string}` }, orderId);
    },
    quote: async ({ parentOrderId, buyer }): Promise<ReorderQuote> => {
      const params = new URLSearchParams({
        shop: model.merchant.ens,
        item: model.order.sku,
        qty: String(model.order.reorder.quantity),
        buyer,
        payer: model.payer.ens,
        wallet: payerAccount().address,
        parent: parentOrderId,
      });
      const body = await getJson(`${SHOP}/quote?${params}`);
      const terms = body.terms as Record<string, unknown> | undefined;
      const payUrl = body.payUrl;
      // The key signs only for this shop's reorder route on our own domain.
      const wallet = payerAccount().address;
      if (!terms || payUrl !== `${SHOP}/orders/${parentOrderId}/reorder` || String(terms.wallet ?? '').toLowerCase() !== wallet.toLowerCase()) throw new Error('the shop quoted unexpected terms');
      return { buyer, terms, payUrl, priceMicro: String(body.priceMicro), quantity: Number(body.quantity) };
    },
    pay: async (quote) => {
      const w = await whitechain();
      const account = payerAccount();
      const price = BigInt(model.order.reorder.priceMicro);
      const buyer = createBuyerAgent({
        account,
        publicClient: w.publicClient,
        network: whitechainNetwork(),
        name: model.payer.ens,
        buyerName: quote.buyer,
        // A signed retry that hangs is cut off and read as unclear (the hold then stays): never wait past the route's limit.
        fetch: (url: string | URL | Request, init?: RequestInit) => fetch(url, { ...init, signal: AbortSignal.timeout(90_000) }),
        pass: { capMicro: BigInt(model.payer.capMicro ?? '0'), period: 'day', perPaymentMaxMicro: price, merchants: [model.merchant.ens] },
      });
      const headers = { 'content-type': 'application/json', [PASSCODE_HEADER]: process.env.DEMO_PASSCODE ?? '' };
      const result = await buyer.pay(quote.payUrl, { method: 'POST', body: JSON.stringify(quote.terms), headers, maxMicro: price });
      return { status: result.status, orderId: result.orderId, transaction: result.transaction, reason: result.reason, amountMicro: result.amountMicro };
    },
    now: () => Date.now(),
  };
}
