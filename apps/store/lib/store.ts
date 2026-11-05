// The store's one shop, built with @graphpay/checkout-kit. Everything story-specific (the
// shop, its items and prices) comes from the story config; the payout address and the
// secrets come from this project's environment. The lines between the graphpay markers are
// the kit integration the "How it's built" page shows and a test counts.
import { activeCast, config } from '@graphpay/config';
import { createPublicClient, createWalletClient, defineChain, fallback, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const cast = activeCast();
const seller = cast.shops.find((s) => s.key === (cast.order as { shop?: string }).shop);
if (!seller) throw new Error('store: the story names no shop for the demo order');

export const shopEns = `${seller.label}.${config.root.ens}`;
export const shopName = seller.displayName;
export const catalog = seller.products.map((p) => ({ sku: p.sku, name: p.name, unit: p.unit, unitPriceMicro: p.priceMicro }));
// `next build` imports every route to read its settings; it serves no request, so it gets
// placeholders. At run time a missing payout address or passcode stops the shop (fail closed).
const building = process.env.NEXT_PHASE === 'phase-production-build';
export const merchant = (process.env.MERCHANT_ADDRESS ?? (building ? `0x${'0'.repeat(40)}` : '')) as `0x${string}`;
if (!/^0x[0-9a-fA-F]{40}$/.test(merchant)) throw new Error('store: MERCHANT_ADDRESS (the payout address) is not set');
// The same minimum as the signing routes: a short passcode would pay but not sign.
const configured = process.env.DEMO_PASSCODE;
if (configured !== undefined && configured.length < 24) throw new Error('store: DEMO_PASSCODE must be at least 24 characters');
const passcode = configured ?? (building ? 'a placeholder that is never served' : undefined);
const net = config.networks.whitechain;
// The chain is named on both clients, so a send is checked against it, not only the read before it.
const chain = defineChain({ id: net.chainId, name: net.name, nativeCurrency: { name: net.nativeSymbol, symbol: net.nativeSymbol, decimals: 18 }, rpcUrls: { default: { http: net.publicRpcs.map((r) => r.url) } } });
const transport = fallback(net.publicRpcs.map((r) => http(r.url)));
export const publicClient = createPublicClient({ chain, transport });
// Only for dispatch and refunds: the shop's own key, server-side, behind the passcode.
const shopKey = process.env[`${seller.walletRole}_PRIVATE_KEY`];
const walletClient = shopKey ? createWalletClient({ account: privateKeyToAccount(shopKey as `0x${string}`), chain, transport }) : undefined;
const facilitatorUrl = process.env.FACILITATOR_URL ?? `${config.site.url}/api/facilitator`;

// graphpay:begin
import { createGraphPayShop } from '@graphpay/checkout-kit';

export const shop = createGraphPayShop({
  shopEns, merchant, catalog, publicClient, walletClient, // your shop's name, payout address, items
  facilitatorUrl, facilitatorToken: process.env.FACILITATOR_AUTH_TOKEN,
  passcode, // the relayer pays gas: gate who may pay
});
// graphpay:end
