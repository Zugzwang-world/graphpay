// The buyer side of the kit, for a browser (viem only). Three steps, each usable on its own:
//   getQuote   ask the shop's order route; it answers 402 with the exact order it would settle
//   payQuote   sign that order (one signature, no gas) and send it back with PAYMENT-SIGNATURE
//   graphpayCheckout   both, with `approve(quote)` as the person's chance to say no
// Nothing is signed until the quote has been checked against what the app configured (chain,
// token, checkout) and against itself (amount, payee, deadline), so a shop cannot slip in a
// different token, payee or amount than the one shown.
import { createPublicClient, createWalletClient, custom, getAddress, isAddressEqual } from 'viem';
import { namehash } from 'viem/ens';
import { ZERO32, assertChain, intentHash, signOrderPayment } from './sign.mjs';

export const HEADERS = Object.freeze({ required: 'PAYMENT-REQUIRED', signature: 'PAYMENT-SIGNATURE', response: 'PAYMENT-RESPONSE' });
export const PAYER_HEADER = 'x-agentpay-payer';
export const PASSCODE_HEADER = 'x-demo-passcode';
const SCHEME = 'graphpay-order';
const X402_VERSION = 2;
const MAX_QUOTE_LIFETIME_S = 15 * 60;
const RENEWAL_BIT = 1n << 255n;

// x402 v2 headers carry base64 JSON (UTF-8 safe, no Node Buffer).
export function encodeHeader(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function decodeHeader(value) {
  if (typeof value !== 'string' || value === '' || value.length > 65_536) return null;
  try {
    const binary = atob(value);
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
}

export class CheckoutError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CheckoutError';
    this.code = code;
  }
}

// What the app tells the kit to expect, from its own config (never from the shop's answer):
// network = { chainId, caip2, explorer, checkout, permit2, token: { address, symbol, eip712 } },
// and optionally expect = { payTo, maxAmountMicro } to pin the payee and the largest amount.
function checkQuote(paymentRequired, network, nowSec, { parent, expect } = {}) {
  try {
    return checkQuoteUnsafe(paymentRequired, network, nowSec, { parent, expect });
  } catch (error) {
    if (error instanceof CheckoutError) throw error;
    // A malformed answer (missing fields, bad hex) is a refusal, never a crash or a signature.
    throw new CheckoutError('QUOTE_REFUSED', "the shop's quote was refused: it is malformed");
  }
}

function checkQuoteUnsafe(paymentRequired, network, nowSec, { parent, expect }) {
  const fail = (why) => {
    throw new CheckoutError('QUOTE_REFUSED', `the shop's quote was refused: ${why}`);
  };
  if (paymentRequired?.x402Version !== X402_VERSION || !Array.isArray(paymentRequired.accepts) || paymentRequired.accepts.length !== 1) fail('not exactly one x402 v2 option');
  const req = paymentRequired.accepts[0];
  const order = req?.extra?.order;
  if (req.scheme !== SCHEME) fail('another payment scheme');
  if (req.network !== network.caip2) fail('another network');
  if (!isAddressEqual(req.asset, network.token.address)) fail('another token');
  if (!isAddressEqual(req.extra.contract, network.checkout)) fail('another checkout contract');
  if (!order) fail('no order');
  for (const key of ['orderId', 'parentOrderId', 'buyerNode', 'shopNode', 'payerNode']) if (!/^0x[0-9a-fA-F]{64}$/.test(order[key] ?? '')) fail(`${key} is not 32 bytes`);
  if (order.payerNode.toLowerCase() !== ZERO32 || order.buyerNode.toLowerCase() !== ZERO32) fail('the order names an agent or a buyer; a person pays as themselves');
  if (order.shopNode.toLowerCase() !== namehash(req.extra.shopName)) fail('the shop name and the shop in the order disagree');
  if (order.parentOrderId.toLowerCase() !== (parent ? parent.toLowerCase() : ZERO32)) fail('the order names another parent order');
  if (String(order.kind) !== (parent ? '1' : '0')) fail('the order is not the kind that was asked for');
  if (expect?.payTo && !isAddressEqual(req.payTo, expect.payTo)) fail('the payee is not the one this page expects');
  if (expect?.maxAmountMicro !== undefined && BigInt(req.amount) > BigInt(expect.maxAmountMicro)) fail('the amount is above what this page allows');
  if (BigInt(order.orderId) === 0n || (BigInt(order.orderId) & RENEWAL_BIT) !== 0n) fail('not a one-off or re-order id');
  if (!/^[1-9][0-9]{0,19}$/.test(String(req.amount)) || String(req.amount) !== String(order.amountMicro)) fail('the amount and the order disagree');
  if (!isAddressEqual(req.payTo, order.merchant)) fail('the payee and the order disagree');
  const deadline = BigInt(order.deadline);
  if (deadline <= BigInt(nowSec) || deadline > BigInt(nowSec) + BigInt(MAX_QUOTE_LIFETIME_S)) fail('the quote has no sensible deadline');
  return { requirement: req, order };
}

const trim = (url) => String(url).replace(/\/+$/, '');

function summaryOf(paymentRequired, item, qty) {
  return `${qty} x ${item} (${paymentRequired.resource?.description ?? ''})`;
}

// Asks the shop for a quote: { paymentRequired, requirement, order, amountMicro, shopName, deadline, summary }.
export async function getQuote({ shopUrl, item, qty = 1, parent, payer, network, expect, fetch: fetchImpl = globalThis.fetch, nowSec = Math.floor(Date.now() / 1000) }) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(payer ?? '')) throw new CheckoutError('NO_PAYER', 'connect a wallet first');
  const query = new URLSearchParams({ item, qty: String(qty) });
  if (parent) query.set('parent', parent);
  // A quote costs nothing and needs no passcode: only the paid retry does.
  const response = await fetchImpl(`${trim(shopUrl)}/order?${query}`, { headers: { [PAYER_HEADER]: getAddress(payer) }, cache: 'no-store' });
  if (response.status !== 402) {
    const body = await response.json().catch(() => null);
    throw new CheckoutError('NO_QUOTE', body?.error ?? `the shop answered ${response.status}, not a quote`);
  }
  const paymentRequired = decodeHeader(response.headers.get(HEADERS.required)) ?? (await response.json().catch(() => null));
  const { requirement, order } = checkQuote(paymentRequired, network, nowSec, { parent, expect });
  return { paymentRequired, requirement, order, amountMicro: BigInt(requirement.amount), shopName: requirement.extra.shopName, deadline: Number(order.deadline), summary: summaryOf(paymentRequired, item, qty), item, qty, parent };
}

// Signs the quote with `account` ({ address, signTypedData }) and sends it back. A payment that
// cannot be confirmed (a timeout, a 5xx) is `unknown`: calling again with the same `signed`
// re-sends the same signature for the same order, which can never pay twice.
export async function payQuote({ shopUrl, quote, account, publicClient, network, passcode, signed, approvalMicro, fetch: fetchImpl = globalThis.fetch, nowSec = Math.floor(Date.now() / 1000) }) {
  const entry =
    signed ??
    (await (async () => {
      const payload = await signOrderPayment({
        account,
        publicClient,
        network,
        requirement: quote.requirement,
        mandateHash: intentHash({ shopName: quote.shopName, summary: quote.summary, amountMicro: quote.amountMicro, deadline: quote.deadline }),
        // A person approves exactly this order's amount (a later order asks again, gaslessly).
        approvalMicro: approvalMicro ?? quote.amountMicro,
        nowSec,
      });
      return { x402Version: X402_VERSION, resource: quote.paymentRequired.resource, accepted: quote.requirement, payload, extensions: quote.paymentRequired.extensions };
    })());
  const query = new URLSearchParams({ item: quote.item, qty: String(quote.qty) });
  if (quote.parent) query.set('parent', quote.parent);
  const headers = { [PAYER_HEADER]: getAddress(account.address), [HEADERS.signature]: encodeHeader(entry) };
  if (passcode) headers[PASSCODE_HEADER] = passcode;
  let response;
  try {
    response = await fetchImpl(`${trim(shopUrl)}/order?${query}`, { headers, cache: 'no-store' });
  } catch {
    return { status: 'unknown', orderId: quote.order.orderId, signed: entry, reason: 'the shop did not answer' };
  }
  const settlement = decodeHeader(response.headers.get(HEADERS.response));
  const body = await response.json().catch(() => null);
  if (response.ok) {
    const claimed = settlement?.transaction || body?.transaction || null;
    // Only a real transaction hash becomes a link (the shop's answer is text, not a URL).
    const transaction = typeof claimed === 'string' && /^0x[0-9a-fA-F]{64}$/.test(claimed) ? claimed.toLowerCase() : null;
    return { status: 'paid', orderId: body?.orderId ?? quote.order.orderId, alreadyPaid: Boolean(body?.alreadyPaid), transaction, explorer: transaction ? `${trim(network.explorer)}/tx/${transaction}` : null, amountMicro: quote.amountMicro };
  }
  if (response.status >= 500) return { status: 'unknown', orderId: quote.order.orderId, signed: entry, reason: 'the payment may still settle; try again' };
  const reason = settlement?.errorReason ?? body?.reason ?? body?.error ?? `HTTP ${response.status}`;
  return { status: 'failed', orderId: quote.order.orderId, reason: String(reason), transaction: settlement?.transaction || null };
}

// One call: quote, the person's yes, one signature, the receipt.
export async function graphpayCheckout({ shopUrl, item, qty = 1, parent, wallet, publicClient, network, passcode, approve, expect, fetch: fetchImpl }) {
  const quote = await getQuote({ shopUrl, item, qty, parent, payer: wallet.address, network, expect, fetch: fetchImpl });
  if (approve && !(await approve(quote))) return { status: 'declined', orderId: quote.order.orderId };
  return payQuote({ shopUrl, quote, account: wallet, publicClient, network, passcode, fetch: fetchImpl });
}

// Connects a browser wallet (an EIP-1193 provider such as window.ethereum) on the network:
// returns { address, signTypedData, publicClient } once the wallet reports the right chain.
// `rpcUrl` is a public endpoint to offer the wallet when it does not know the chain yet.
export async function connectWallet(ethereum, network, { rpcUrl, chainName, nativeSymbol } = {}) {
  const [address] = await ethereum.request({ method: 'eth_requestAccounts' });
  if (!address) throw new CheckoutError('NO_ACCOUNT', 'the wallet gave no account');
  const chainIdHex = `0x${network.chainId.toString(16)}`;
  const current = Number.parseInt(await ethereum.request({ method: 'eth_chainId' }), 16);
  if (current !== network.chainId) {
    try {
      await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] });
    } catch (error) {
      if (error?.code !== 4902 || !rpcUrl) throw new CheckoutError('WRONG_CHAIN', `switch the wallet to chain ${network.chainId}`);
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{ chainId: chainIdHex, chainName: chainName ?? `Chain ${network.chainId}`, rpcUrls: [rpcUrl], nativeCurrency: { name: nativeSymbol ?? 'WBT', symbol: nativeSymbol ?? 'WBT', decimals: 18 }, blockExplorerUrls: [network.explorer] }],
      });
    }
  }
  const publicClient = createPublicClient({ transport: custom(ethereum) });
  await assertChain(publicClient, network);
  const walletClient = createWalletClient({ account: getAddress(address), transport: custom(ethereum) });
  return {
    address: getAddress(address),
    publicClient,
    signTypedData: (typedData) => walletClient.signTypedData({ ...typedData, account: getAddress(address) }),
  };
}
