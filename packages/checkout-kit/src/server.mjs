// The shop side of the kit. `createGraphPayShop` turns a catalog and a payout address into two
// Fetch route handlers over @graphpay/agentpay's merchant (the 402 flow, settled by our
// facilitator): `catalog` lists what is for sale, `order` is one route that answers 402 with the
// quote when it is not paid yet and settles the payment when it carries a PAYMENT-SIGNATURE.
// Prices come from the catalog only, never from the request. Re-orders are the same route with
// `?parent=<a paid order of this shop by this payer>`.
import { createHash, timingSafeEqual } from 'node:crypto';
import { createMerchant, decodeHeader, httpFacilitator, whitechainNetwork } from '@graphpay/agentpay';
import { checkoutAbi } from '@graphpay/contracts';

export const MAX_QUANTITY = 20;
const SKU = /^[a-z0-9][a-z0-9-]{0,62}$/;
const HEX32 = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const PASSCODE_HEADER = 'x-demo-passcode';
const PAYER_HEADER = 'x-agentpay-payer';
const PAID = new Set([2, 3]); // PAID, DELIVERED (ORDER_STATUS in @graphpay/contracts)

// A re-order's parent was refused for a reason the buyer may be told; anything else is not.
export class ParentError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ParentError';
  }
}

export class CatalogError extends Error {
  constructor(message) {
    super(`checkout-kit: ${message}`);
    this.name = 'CatalogError';
  }
}

function checkedCatalog(catalog) {
  if (!Array.isArray(catalog) || catalog.length === 0) throw new CatalogError('the catalog needs at least one item');
  const seen = new Set();
  return catalog.map((item) => {
    if (!SKU.test(item?.sku ?? '')) throw new CatalogError(`sku ${JSON.stringify(item?.sku)} is not lower-case letters, digits and dashes`);
    if (seen.has(item.sku)) throw new CatalogError(`sku ${item.sku} is listed twice`);
    seen.add(item.sku);
    if (typeof item.name !== 'string' || item.name === '' || item.name.length > 120) throw new CatalogError(`${item.sku} needs a name of 1 to 120 characters`);
    const price = BigInt(item.unitPriceMicro);
    // The largest order (MAX_QUANTITY of the dearest item) must stay a uint64 amount.
    if (price <= 0n || price * BigInt(MAX_QUANTITY) >= 1n << 64n) throw new CatalogError(`${item.sku}: unitPriceMicro must be a positive integer of 6-decimal units, small enough that ${MAX_QUANTITY} of them fit a uint64`);
    return Object.freeze({ sku: item.sku, name: item.name, unit: item.unit ?? null, unitPriceMicro: price });
  });
}

const sameSecret = (a, b) => {
  const digest = (v) => createHash('sha256').update(String(v), 'utf8').digest();
  return timingSafeEqual(digest(a), digest(b));
};

// config: { shopEns, merchant, catalog, facilitatorUrl, facilitatorToken, publicClient,
//   token?, passcode?, walletClient?, resourceBase?, network?, riskCheck? }
//   shopEns     the shop's name (its namehash is the shop node on-chain)
//   merchant    the address that receives the USDT
//   catalog     [{ sku, name, unit?, unitPriceMicro }]
//   token       { address, name, version, symbol? } to override the configured test USDT
//   passcode    a payment needs the same value in `X-Demo-Passcode` (the relayer pays gas); required unless `open: true`
//   walletClient  the shop's own key, only for refunds and delivery marks through `merchant`
//   log           (line) => void, one redacted line per failure
//   facilitator   { verify, settle } to use instead of our hosted one (tests, a local relayer)
export function createGraphPayShop({ shopEns, merchant, catalog, facilitatorUrl, facilitatorToken, facilitator, publicClient, token, passcode, walletClient, resourceBase, network, riskCheck, log, open = false }) {
  // The relayer pays gas for every payment, so a deployment either gates who may pay (a
  // passcode) or says out loud that it is open: never open by forgetting a variable.
  if (!passcode && open !== true) throw new CatalogError('set `passcode` (the relayer pays gas for every payment), or `open: true` to accept payments from anyone');
  const items = checkedCatalog(catalog);
  const bySku = new Map(items.map((i) => [i.sku, i]));
  const net =
    network ??
    whitechainNetwork(token ? { token: { address: token.address, symbol: token.symbol ?? 'USDT', decimals: 6, eip712: { name: token.name, version: token.version } } } : {});
  const authorize = passcode ? async (request) => sameSecret(request.headers.get(PASSCODE_HEADER) ?? '', passcode) : undefined;
  const api = createMerchant({
    name: shopEns,
    address: merchant,
    facilitator: facilitator ?? httpFacilitator({ url: facilitatorUrl, authToken: facilitatorToken }),
    publicClient,
    walletClient,
    network: net,
    authorize,
    riskCheck,
    resourceBase,
    log,
  });

  // A re-order's parent must be a paid order of this shop, by this payer. Checked before the
  // merchant route runs (a pricer that throws is a 500 there), and remembered for the pricer.
  const checkedParents = new WeakMap();
  async function parentOf(request, parent) {
    if (checkedParents.has(request)) return checkedParents.get(request);
    const checked = await readParent(request, parent);
    checkedParents.set(request, checked);
    return checked;
  }
  async function readParent(request, parent) {
    if (!HEX32.test(parent)) throw new ParentError('parent is a 32-byte order id');
    const payer = request.headers.get(PAYER_HEADER) ?? '';
    const o = await publicClient.readContract({ address: net.checkout, abi: checkoutAbi, functionName: 'orders', args: [parent] });
    // The payer who signs is the payer the parent names (not only the one the header claims).
    const signed = request.headers.get('payment-signature');
    if (signed) {
      const signer = decodeHeader(signed)?.payload?.payer;
      if (typeof signer !== 'string' || signer.toLowerCase() !== payer.toLowerCase()) throw new ParentError('the signature is not from the payer named in the request');
    }
    const status = Number(Array.isArray(o) ? o[6] : o.status);
    const orderPayer = String(Array.isArray(o) ? o[9] : o.payer).toLowerCase();
    const orderMerchant = String(Array.isArray(o) ? o[3] : o.merchant).toLowerCase();
    if (!PAID.has(status) || orderPayer !== payer.toLowerCase() || orderMerchant !== merchant.toLowerCase()) throw new ParentError('parent is not a paid order of this shop by this payer');
    return parent.toLowerCase();
  }

  // Prices from the catalog only: the request chooses a sku and a quantity, never a price.
  async function pricer({ request, url }) {
    const item = bySku.get(url.searchParams.get('item') ?? '');
    const qty = Number(url.searchParams.get('qty') ?? '1');
    if (!item || !Number.isInteger(qty) || qty < 1 || qty > MAX_QUANTITY) return null;
    const priced = { items: [{ sku: item.sku, name: item.name, quantity: qty, unitPriceMicro: item.unitPriceMicro }], fulfilment: { type: 'delivery' } };
    const parent = url.searchParams.get('parent');
    return parent ? { ...priced, parentOrderId: await parentOf(request, parent) } : priced;
  }

  const route = api.route(pricer, (_request, { order, alreadyPaid, settlement }) => ({
    status: 'paid',
    orderId: order.orderId,
    alreadyPaid: Boolean(alreadyPaid),
    transaction: settlement?.transaction || null,
    network: net.caip2,
  }));

  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

  // An unknown item or quantity is a 404, not a free order (a pricer that returns null is free in the merchant).
  async function order(request, ctx) {
    const url = new URL(request.url);
    const item = bySku.get(url.searchParams.get('item') ?? '');
    const qty = Number(url.searchParams.get('qty') ?? '1');
    if (!item) return json(404, { error: 'no such item', items: items.map((i) => i.sku) });
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QUANTITY) return json(400, { error: `qty is a whole number from 1 to ${MAX_QUANTITY}` });
    // Every order names its payer: it is part of the order id, so two people never share one.
    if (!ADDRESS.test(request.headers.get(PAYER_HEADER) ?? '')) return json(400, { error: `name the payer wallet with the ${PAYER_HEADER} header` });
    const parent = url.searchParams.get('parent');
    if (parent) {
      try {
        await parentOf(request, parent);
      } catch (error) {
        // Only the buyer's own mistakes are explained; a chain error can carry an RPC URL.
        if (error instanceof ParentError) return json(400, { error: error.message });
        log?.(`checkout-kit: parent check failed (${error?.name ?? 'Error'})`);
        return json(502, { error: 'could not check the parent order; try again' });
      }
    }
    return route(request, ctx);
  }

  function catalogRoute() {
    return json(200, { shop: shopEns, token: net.token.symbol, network: net.caip2, items: items.map((i) => ({ ...i, unitPriceMicro: String(i.unitPriceMicro) })) });
  }

  return Object.freeze({
    shopEns,
    merchant: api,
    network: net,
    catalog: catalogRoute,
    // One route is the quote (402) and the payment: x402 retries the same URL with a signature.
    order,
    quote: order,
    pay: order,
    reorder: order,
  });
}

// The network facts a browser needs to check a quote and sign, as plain JSON (no bigint):
// pass this from a server component to `connectWallet` and `getQuote`.
export function networkForClient(network) {
  return {
    chainId: network.chainId,
    caip2: network.caip2,
    name: network.name,
    nativeSymbol: network.nativeSymbol,
    explorer: network.explorer,
    checkout: network.checkout,
    permit2: network.permit2,
    token: { address: network.token.address, symbol: network.token.symbol, decimals: network.token.decimals, eip712: { name: network.token.eip712.name, version: network.token.eip712.version } },
  };
}
