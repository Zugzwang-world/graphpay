// The live side of Re-order (lib/reorder.server.ts holds the decisions): the shop's quote over
// the production domain, and the payer agent's buyer, which answers the shop's 402 with one
// signature under its on-chain spending pass. The key is read from the env by role name, never
// leaves this file and is never logged. This is the only file here that imports the SDK.
import { activeCast, config } from '@graphpay/config';
import { createEnsReader, ensPublicClient } from '@graphpay/ens';
import { decodePaymentRequiredHeader, errorNames, graphPayOrderClient, x402Client, x402HTTPClient } from '@graphpay/facilitator';
import { privateKeyToAccount } from 'viem/accounts';
import { isAddressEqual, keccak256, toHex, type Hex } from 'viem';
import { sharedCustomerState } from './customer-state.server.ts';
import { readOrder } from './merchant-actions.server.ts';
import { PASSCODE_HEADER } from './passcode-header.ts';
import { whitechain } from './payments.server.ts';
import { checkoutAddress, siteModel } from './site.server.ts';
import type { PayOutcome, ReorderDeps, ReorderQuote } from './reorder.server.ts';

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
        item: model.order.reorder.sku,
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
      const checkout = checkoutAddress() as `0x${string}`;
      const token = config.whitechain.tokens.usdt;
      const network = `eip155:${w.chain.id}`;
      const orderId = String(quote.terms.orderId ?? '');
      const headers = { 'content-type': 'application/json', [PASSCODE_HEADER]: process.env.DEMO_PASSCODE ?? '' };
      const body = JSON.stringify(quote.terms);
      // One budget for the whole payment, inside the route's 120 s: the paid POST gets what is left (at least 20 s).
      const end = Date.now() + 110_000;
      const post = (extra: Record<string, string>, ms: number) => fetch(quote.payUrl, { method: 'POST', headers: { ...headers, ...extra }, body, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(ms) });
      // 1. The shop's 402 for these terms (nothing is signed yet; a failure here sends nothing).
      let first: Response;
      try {
        first = await post({}, 25_000);
      } catch {
        return { status: 'failed', reason: 'SHOP_UNREACHABLE' };
      }
      if (first.status !== 402) return { status: 'failed', reason: 'SHOP_REFUSED' };
      let accepted: { payTo: string; amount: string } | undefined;
      let required: ReturnType<typeof decodePaymentRequiredHeader>;
      try {
        required = decodePaymentRequiredHeader(first.headers.get('payment-required') ?? '');
        if (required.accepts?.length !== 1) return { status: 'failed', reason: 'BAD_402' };
        accepted = required.accepts[0];
      } catch (error) {
        console.error('reorder 402:', errorNames(error));
        return { status: 'failed', reason: 'BAD_402' };
      }
      // 2. The payee is the shop's ENS address, read here too (the shop checks it as well), and the
      // order in the 402 is the one that was quoted: this id, this parent, this price, a deadline inside the quote.
      try {
        const payee = await Promise.race([
          createEnsReader({ client: (await ensPublicClient({ env: process.env })).client }).resolvePayee(model.merchant.ens),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('ENS read timed out')), 12_000)),
        ]);
        if (!payee.ok || !accepted || !isAddressEqual(payee.payee as `0x${string}`, accepted.payTo as `0x${string}`)) return { status: 'failed', reason: 'PAYEE_MISMATCH' };
      } catch (error) {
        console.error('reorder payee:', errorNames(error));
        return { status: 'failed', reason: 'PAYEE_MISMATCH' };
      }
      // 3. One signature (Permit2 witness, no gas), capped at the story's price; nothing is sent if it cannot be made.
      let signature: Record<string, string>;
      try {
        const wire = (accepted as unknown as { extra?: { order?: Record<string, unknown> } }).extra?.order;
        if (!wire || String(wire.orderId).toLowerCase() !== orderId.toLowerCase() || String(wire.parentOrderId).toLowerCase() !== String(quote.terms.parentOrderId).toLowerCase() || BigInt(String(wire.amountMicro ?? accepted?.amount)) !== price || BigInt(String(wire.deadline)) > BigInt(String(quote.terms.exp))) throw new Error('the 402 order is not the quoted order');
        const scheme = graphPayOrderClient({ account, publicClient: w.publicClient, chainId: w.chain.id, token, permit2: config.whitechain.system.permit2, checkout, payerName: model.payer.ens, mandateHash: keccak256(toHex(`graphpay re-order ${orderId}`)) });
        const client = new x402Client().register(network, scheme).setSpendControls({ allowedAssets: [{ network, asset: token.address, maxAmountPerPayment: String(price) }] });
        signature = new x402HTTPClient(client).encodePaymentSignatureHeader(await client.createPaymentPayload(required));
      } catch (error) {
        console.error('reorder sign:', errorNames(error));
        return { status: 'failed', reason: 'NOT_SIGNED' };
      }
      // 4. Paid retry. From here a signature exists: an unclear answer is 'unknown', never a failure.
      let paid: Response;
      try {
        paid = await post(signature, Math.max(20_000, end - Date.now()));
      } catch {
        return { status: 'unknown', orderId, reason: 'SHOP_UNREACHABLE' };
      }
      const answer = (await paid.json().catch(() => null)) as { status?: unknown; transaction?: unknown; orderId?: unknown; error?: unknown } | null;
      return outcomeOf(paid.status, answer, orderId, String(price));
    },
    now: () => Date.now(),
  };
}

// What the shop's answer to the signed retry means (packages/shop/src/api.mjs): 200 paid; 402 with no
// transaction is refused before anything was sent; a transaction, a 5xx, a 429 or anything unreadable
// may still settle, so it is 'unknown' and the hold stays.
export function outcomeOf(httpStatus: number, answer: { status?: unknown; transaction?: unknown; orderId?: unknown; error?: unknown } | null, orderId: string, amountMicro: string): PayOutcome {
  // An unreadable body is never a clean refusal: the signature may still settle.
  if (answer === null) return { status: 'unknown', orderId, reason: 'UNCLEAR', amountMicro };
  const transaction = typeof answer.transaction === 'string' && /^0x[0-9a-fA-F]{64}$/.test(answer.transaction) ? answer.transaction : undefined;
  if (httpStatus === 200 && answer.status === 'paid') return { status: 'paid', orderId, transaction, amountMicro };
  if (httpStatus === 402 && !transaction && answer.status === 'refused') return { status: 'failed', reason: 'SHOP_REFUSED' };
  if (httpStatus >= 400 && httpStatus < 500 && httpStatus !== 429 && httpStatus !== 402 && !transaction && typeof answer.error === 'string') return { status: 'failed', reason: 'SHOP_REFUSED' };
  return { status: 'unknown', orderId, transaction, reason: 'UNCLEAR', amountMicro };
}
