// The synthetic city (planning/SPEC/ARKIV_GRAPH.md §8, M7 amendment §3, ADR-0043,
// ADR-0049): deterministic for a seed, labelled synthetic, every parameter, name and
// place from the story config (ADR-0047). The cast (the persona, its buyer agents and
// the cast shops at popularity ranks 1–3) plus generated people and shops under
// sim.<root>; 120 days ending at a fixed UTC midnight; orders, payments or refusals,
// partial refunds, weekly subscriptions; the persona's agents buy only in the last
// week and never from the trap shop; one generated shop re-registers late in the city.

import { castEntries, activeCast, config } from '@graphpay/config';
import { draws, zipf } from './rng.mjs';

const DAY = 86_400;

function toMidnight(end) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(end ?? ''));
  if (!m) throw new Error('city: the end date is a UTC day, YYYY-MM-DD');
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 1000;
}

// A point `km` from `from` on a bearing (degrees), on a sphere of 6,371 km.
export function offset(from, km, bearingDeg) {
  const R = 6371;
  const d = km / R;
  const b = (bearingDeg * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lng1 = (from.lng * Math.PI) / 180;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
  const lng2 = lng1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

export function generateCity({ story, size, end, root = config.root.ens }) {
  const sc = story.syntheticCity;
  const gen = sc.generator;
  if (!gen) throw new Error('city: story syntheticCity.generator is missing');
  const sizeSpec = sc.sizes?.[size];
  if (!sizeSpec) throw new Error(`city: no size "${size}" in the story`);
  const scale = sizeSpec.approxEdges / gen.baseEdges;
  const rnd = draws(sc.seed);
  const endTs = toMidnight(end);
  const startTs = endTs - sc.days * DAY;
  const lastDay = endTs / DAY - 1;
  const simRoot = `${gen.simLabel}.${root}`;
  const cityName = story.city.name.toLowerCase();
  const dataset = `${sc.dataset}-${size}`;
  const cast = activeCast(story);
  const entries = castEntries(cast, root);

  const actors = new Map();
  const add = (a) => {
    if (actors.has(a.ens)) throw new Error(`city: duplicate actor ${a.ens}`);
    actors.set(a.ens, { epoch: 0, verified: true, ...a });
    return actors.get(a.ens);
  };
  const owns = [];

  // The cast.
  const persona = add({ ens: entries.find((e) => e.kind === 'persona').ensName, kind: 'human', cast: true });
  const personaAgents = {};
  for (const a of cast.buyerAgents) {
    const ens = `${a.label}.${persona.ens}`;
    personaAgents[a.key] = add({ ens, kind: 'agent', owner: persona.ens, cast: true });
    owns.push([persona.ens, ens]);
  }
  const point = story.locations.persona;
  const castShops = [...cast.shops].sort((x, y) => y.scenario.orders90d - x.scenario.orders90d);
  const shopAgent = cast.shopAgents.find((a) => a.key === gen.shopAgentKey);
  const shops = [];
  for (const s of castShops) {
    const loc = offset(point, s.scenario.distanceKm, rnd.next() * 360);
    const shop = add({ ens: `${s.label}.${root}`, kind: 'shop', cast: true, category: s.category, city: cityName, refundRate: s.scenario.refundRate90d, priceMicro: s.products[0].priceMicro, storyRole: s.storyRole, lat: loc.lat, lng: loc.lng, area: s.area, displayName: s.displayName });
    shops.push(shop);
  }
  const categories = [...new Set(cast.shops.map((s) => s.category))];

  // Generated shops at the story's neighbourhoods (or around the persona's point).
  const shopCount = Math.max(castShops.length + 1, Math.round(gen.baseShops * scale ** gen.shopExponent)) - castShops.length;
  const hoods = story.locations.neighbourhoods ?? [];
  for (let i = 1; i <= shopCount; i += 1) {
    const hood = hoods.length > 0 ? hoods[(i - 1) % hoods.length] : null;
    const base = hood ? { lat: hood.lat, lng: hood.lng } : point;
    const loc = offset(base, rnd.next() * (hood ? gen.jitterKm : story.locations.searchRadiusKm), rnd.next() * 360);
    const label = `shop-${String(i).padStart(3, '0')}`;
    const lo = gen.refundRate[0];
    const hi = gen.refundRate[1];
    shops.push(add({ ens: `${label}.${simRoot}`, kind: 'shop', category: categories[i % categories.length], city: cityName, refundRate: lo + rnd.next() * (hi - lo), priceMicro: null, lat: loc.lat, lng: loc.lng, area: hood?.area ?? null, displayName: `Synthetic shop ${i}` }));
  }
  for (const shop of shops) {
    const ens = `${shopAgent.label}.${shop.ens}`;
    add({ ens, kind: 'agent', owner: shop.ens, cast: shop.cast });
    owns.push([shop.ens, ens]);
  }

  // Generated people, each with a payer agent and some with an errands agent.
  const humanCount = Math.round(gen.baseHumans * scale ** gen.humanExponent);
  const buyers = [];
  for (let i = 1; i <= humanCount; i += 1) {
    const human = add({ ens: `person-${String(i).padStart(3, '0')}.${simRoot}`, kind: 'human' });
    for (const label of [gen.payerLabel, ...(rnd.chance(gen.errandsShare) ? [gen.errandsLabel] : [])]) {
      const ens = `${label}.${human.ens}`;
      buyers.push(add({ ens, kind: 'agent', owner: human.ens }));
      owns.push([human.ens, ens]);
    }
  }

  // The re-registered shop: a generated one in the middle of the ranking.
  const reShop = shops[castShops.length + Math.floor(shopCount / 2)];
  const reTs = endTs - sc.reRegisteredShop.daysBeforeEnd * DAY;
  const epochOf = (ens, ts) => (reShop && ens === reShop.ens && ts >= reTs ? sc.reRegisteredShop.epoch : 0);

  const events = [];
  let seq = 0;
  const ref = (kind) => `sim:${dataset}:${kind}:${String((seq += 1)).padStart(6, '0')}`;
  const push = (kind, from, to, amountMicro, ts) => {
    const fa = actors.get(from);
    const ta = actors.get(to);
    events.push({ ref: ref(kind), kind, from: { ens: from, epoch: epochOf(from, ts), kind: fa.kind }, to: { ens: to, epoch: epochOf(to, ts), kind: ta.kind }, amountMicro: BigInt(amountMicro), ts });
  };
  for (const [owner, agent] of owns) push('owns', owner, agent, 0, startTs + 60);
  if (reShop) push('owns', reShop.ens, `${shopAgent.label}.${reShop.ens}`, 0, reTs + 60);

  const amount = () => Math.max(gen.minAmountMicro, Math.round((gen.medianAmountMicro * Math.exp(gen.amountSigma * rnd.normal())) / 10_000) * 10_000);
  const weights = zipf(shops.length, gen.zipfExponent);

  // Weekly subscriptions.
  const subs = Math.max(1, Math.round(gen.baseSubscriptions * scale));
  let subEdges = 0;
  const plan = [];
  for (let i = 0; i < subs; i += 1) {
    const buyer = buyers[rnd.int(buyers.length)];
    const shop = shops[rnd.weighted(weights)];
    const start = startTs + rnd.int(Math.floor(sc.days / 2)) * DAY + rnd.int(DAY);
    plan.push({ buyer, shop, start });
    subEdges += 2 + 2 * Math.floor((endTs - start) / (7 * DAY));
  }

  // Orders: enough for about the size's edges.
  const ownsEdges = owns.length + 1;
  const orders = Math.max(10, Math.round((sizeSpec.approxEdges - ownsEdges - subEdges) / gen.edgesPerOrder));
  for (let i = 0; i < orders; i += 1) {
    const ts = startTs + rnd.int(sc.days * DAY - 120);
    const buyer = buyers[rnd.int(buyers.length)];
    const shop = shops[rnd.weighted(weights)];
    const price = shop.priceMicro ?? amount();
    push('order', buyer.ens, shop.ens, price, ts);
    if (rnd.chance(gen.failRate)) {
      push('fail', buyer.ens, shop.ens, 0, ts + 30);
      continue;
    }
    push('pay', buyer.ens, shop.ens, price, ts + 30);
    if (rnd.chance(shop.refundRate)) {
      const back = Math.round((price * (0.15 + 0.5 * rnd.next())) / 10_000) * 10_000;
      const at = Math.min(endTs - 60, ts + DAY * (1 + rnd.int(3)));
      push('refund', shop.ens, buyer.ens, back, at);
    }
  }
  for (const { buyer, shop, start } of plan) {
    const price = story.renewal.priceMicro;
    push('subscribe', buyer.ens, shop.ens, price, start);
    push('pay', buyer.ens, shop.ens, price, start + 30);
    for (let t = start + 7 * DAY; t < endTs; t += 7 * DAY) {
      push('renew', buyer.ens, shop.ens, 0, t);
      push('pay', buyer.ens, shop.ens, price, t + 30);
    }
  }

  // The persona's agents buy only in the last week, never from the trap shop.
  const byRole = Object.fromEntries(shops.filter((s) => s.storyRole).map((s) => [s.storyRole, s]));
  for (const [agentKey, role, times] of gen.personaPurchases) {
    const agent = personaAgents[agentKey];
    const shop = byRole[role];
    if (!agent || !shop) throw new Error(`city: persona purchase ${agentKey} → ${role} has no actor`);
    for (let k = 0; k < times; k += 1) {
      const ts = endTs - (1 + rnd.int(sc.personaRecentPurchasesDays - 1)) * DAY + rnd.int(DAY / 2);
      push('order', agent.ens, shop.ens, shop.priceMicro, ts);
      push('pay', agent.ens, shop.ens, shop.priceMicro, ts + 30);
    }
  }

  events.sort((a, b) => a.ts - b.ts || (a.ref < b.ref ? -1 : 1));
  return { size, dataset, end, startTs, endTs, lastDay, root, simRoot, actors, shops, events, reShop: reShop?.ens ?? null, reRegisteredAt: reTs, persona: persona.ens, personaAgents: Object.fromEntries(Object.entries(personaAgents).map(([k, a]) => [k, a.ens])), byRole: Object.fromEntries(Object.entries(byRole).map(([k, s]) => [k, s.ens])) };
}
