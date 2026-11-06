// The shops and their synthetic catalogs, from the story config only (ADR-0047): names, products,
// prices, ETAs and distances are story inputs, labelled synthetic, never measurements. A price is
// always computed here from the catalog, never taken from a request.

import { config, story } from '@graphpay/config';

// [{ key, ensName, displayName, products, scenario }] for every shop of the story.
export function storyShops(source = story, root = config.root.ens) {
  return source.shops.map((s) => ({
    key: s.key,
    ensName: `${s.label}.${root}`,
    displayName: s.displayName,
    walletRole: s.walletRole,
    products: s.products,
    scenario: s.scenario ?? {},
  }));
}

const ceilDiv = (a, b) => (a + b - 1n) / b;

// A product is priced per pack (`priceMicro` for `quantity` pieces); an order names pieces.
export function priceOf(product, quantity) {
  return ceilDiv(BigInt(product.priceMicro) * BigInt(quantity), BigInt(product.quantity));
}

// The item by its sku, its name or its short name (exact spelling). The short name is what the agents
// and the quote call the item, so a shop can show a longer name on its menu.
export function productOf(shop, item) {
  return shop.products.find((p) => p.sku === item || p.name === item || (p.short !== undefined && p.short === item)) ?? null;
}

export function catalogOf(shop) {
  return {
    shop: shop.ensName,
    displayName: shop.displayName,
    items: shop.products.map((p) => {
      const unit = BigInt(p.priceMicro) % BigInt(p.quantity) === 0n ? Number(BigInt(p.priceMicro) / BigInt(p.quantity)) : undefined;
      return {
        sku: p.sku,
        item: p.short ?? p.name,
        name: p.name,
        unit: p.unit,
        quantity: p.quantity,
        priceMicro: p.priceMicro,
        ...(unit !== undefined ? { unitPriceMicro: unit } : {}),
        stock: p.stock ?? null,
        etaMinutes: shop.scenario.etaMinutes ?? null,
        distanceKm: shop.scenario.distanceKm ?? null,
      };
    }),
    synthetic: true,
    label: 'synthetic demo catalog (story config)',
  };
}
