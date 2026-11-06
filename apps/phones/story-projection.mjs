// Our one story config (packages/config/story.json, ADR-0047) projected into the team's
// story shape (frontend/src/data/story.ts), so the phones show the same cast, shops,
// products and prompts as the rest of the site. The build swaps their story.json for
// this projection; no story value is written here. Optional fields (images, avatars)
// pass through when the story sets them and stay null until then.

import { castEntries, config, network } from '../../packages/config/index.mjs';

const amount = (micro) => (Number(micro) / 1e6).toFixed(2);
const percent = (rate) => `${Math.round(rate * 1000) / 10}%`;

// The short zone name of the city's time zone ("IST"), from the platform's own data.
function zoneLabel(timeZone) {
  const part = new Intl.DateTimeFormat('en-IN', { timeZone, timeZoneName: 'short' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName');
  return part?.value ?? timeZone;
}

export function projectStory(story, cfg = config) {
  const root = cfg.root.ens;
  const entries = castEntries(story, root);
  const ensOf = (kind, key) => {
    const entry = entries.find((e) => e.kind === kind && e.key === key);
    if (!entry) throw new Error(`story config: no ENS name for ${kind} ${key}`);
    return entry.ensName;
  };
  const merchant = story.shops.find((s) => s.key === story.order.shop);
  if (!merchant) throw new Error('story config: order.shop is not one of the shops');
  const payer = story.buyerAgents.find((a) => a.key === 'payer');
  if (!payer) throw new Error('story config: the buyer team has no payer agent');
  const merchantEns = ensOf('shop', merchant.key);
  const productOf = (shop, sku) => shop.products.find((p) => p.sku === sku);
  const orderProduct = productOf(merchant, story.order.sku);
  const renewalShop = story.shops.find((s) => s.key === story.renewal.shop) ?? merchant;
  const explorer = (key) => network(key).explorer;

  return {
    about: 'Generated at build time from packages/config/story.json by apps/phones/story-projection.mjs. Do not edit.',
    synthetic: story.synthetic,
    city: { name: story.city.name, timeZone: story.city.timeZone, timeZoneLabel: zoneLabel(story.city.timeZone), currency: story.city.currency },
    customer: { name: story.persona.displayName, ens: ensOf('persona', story.persona.key), avatar: story.persona.avatar ?? null },
    agents: story.buyerAgents.map((a, i) => ({
      role: a.key,
      label: a.displayName,
      ens: ensOf('buyer-agent', a.key),
      main: i === 0,
      pays: a.pays,
      capUsdt: a.capMicro === undefined ? '0.00' : amount(a.capMicro),
      ...(a.does ? { does: a.does } : {}),
      avatar: a.avatar ?? null,
    })),
    shop: {
      name: merchant.displayName,
      ens: merchantEns,
      area: merchant.area ?? '',
      image: merchant.image ?? null,
      agents: story.shopAgents.map((a, i) => ({ role: a.key, label: a.displayName, ens: ensOf('shop-agent', `${merchant.key}/${a.key}`), main: i === 0, avatar: a.avatar ?? null })),
    },
    shops: story.shops.map((s) => {
      const p = productOf(s, story.order.sku) ?? s.products[0];
      return {
        name: s.displayName,
        ens: ensOf('shop', s.key),
        storyRole: s.storyRole,
        priceUsdt: p ? amount(p.priceMicro) : '0.00',
        distanceKm: s.scenario.distanceKm,
        paidOrders: s.scenario.orders90d,
        refundRate: percent(s.scenario.refundRate90d),
        onTimeRate: percent(s.scenario.onTimeRate),
        open: true,
        image: s.image ?? null,
      };
    }),
    products: story.shops.flatMap((s) =>
      s.products.map((p) => ({
        id: p.sku,
        shop: ensOf('shop', s.key),
        name: `${p.name}, ${p.unit}`,
        short: `${p.name} × ${p.quantity}`,
        priceUsdt: amount(p.priceMicro),
        image: p.image ?? null,
        // Read by the live adapter to name an order's items from its amount.
        priceMicro: String(p.priceMicro),
        quantity: p.quantity,
        unitName: p.name,
      })),
    ),
    quickPrompts: orderProduct ? [{ text: story.order.request, kind: 'ask', productId: orderProduct.sku }] : [],
    spendingPass: { capUsdt: amount(payer.capMicro ?? 0), period: 'day', usedTodayUsdt: '0.00', payingRole: payer.key },
    renewal: { productId: story.order.sku, item: story.renewal.item, schedule: story.renewal.schedule.weekday ?? story.renewal.schedule.period, amountUsdt: amount(story.renewal.priceMicro), shop: ensOf('shop', renewalShop.key), priceMicro: String(story.renewal.priceMicro) },
    // The order the stage's agents speak about (final website brief §6): every value of their lines.
    order: {
      item: story.order.item,
      area: story.order.area ?? '',
      sku: story.order.sku,
      quantity: story.order.quantity,
      budgetMicro: String(story.order.budgetMicro),
      refundMicro: String(story.order.refundMicro),
      refundReason: story.order.refundReason,
      reorder: { sku: story.order.reorder.sku, item: story.order.reorder.item, priceMicro: String(story.order.reorder.priceMicro) },
    },
    swarmGateway: cfg.swarm.gateway,
    explorers: {
      whitechain: explorer('whitechain'),
      whitechainLabel: network('whitechain').name,
      ens: explorer('sepolia'),
      ensLabel: network('sepolia').name,
      ensApp: network('sepolia').ensApp ?? null,
      arkiv: explorer('rabdi'),
      arkivLabel: network('rabdi').name,
    },
  };
}
