// The labelled synthetic history of the cast shops (SPEC/INTEGRATION_AND_MIRROR.md §2):
// the scenario's 90 days of orders, with exact refund and late counts, today left
// empty, at a scale (5% on Rabdi). Deterministic: the same parameters always give the
// same events, and the stream is named after them, so a different history is refused
// instead of seeded on top. Every row is labelled synthetic; nothing here is a payment.

import { activeCast, config, story } from '@graphpay/config';
import { keccak256, toHex } from 'viem';
import { DAY_S } from './ids.mjs';
import { DEFAULT_DELIVERY_PROMISE_S } from './map.mjs';

export const HISTORY_DAYS = 90;
export const HISTORY_BATCH = 25;
// The synthetic buyers the history spreads its orders over (names under sim.<root>).
export const HISTORY_BUYERS = 12;
const BUYER_LABEL = 'history-buyer-';

// mulberry32, the story's generator (story.syntheticCity.rng).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(n, rand) {
  const out = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Counts at a scale: the full scenario counts first (orders, then refunds and lates
// from the scenario's rates), each scaled and rounded.
export function historyCounts(shop, scale) {
  const s = shop.scenario;
  const full = {
    orders: s.orders90d,
    refunds: Math.round(s.orders90d * s.refundRate90d),
    late: Math.round(s.orders90d * (1 - s.onTimeRate)),
  };
  const at = (n) => Math.round(n * scale);
  return { orders: at(full.orders), refunds: at(full.refunds), late: at(full.late), full };
}

export const historyBuyers = (root = config.root.ens, n = HISTORY_BUYERS) =>
  Array.from({ length: n }, (_, i) => ({ ens: `${BUYER_LABEL}${i + 1}.sim.${root}`, kind: 'agent', synthetic: true, verified: false }));

export function historyParams({ cast = activeCast(), source = story, scale, endDay, promiseS = DEFAULT_DELIVERY_PROMISE_S }) {
  if (!(scale > 0 && scale <= 1)) throw new Error('history: the scale must be in (0, 1]');
  if (!Number.isInteger(endDay) || endDay <= HISTORY_DAYS) throw new Error('history: endDay is the UTC day the history ends before');
  const shops = cast.shops.map((s) => ({
    label: s.label,
    orders90d: s.scenario.orders90d,
    refundRate90d: s.scenario.refundRate90d,
    onTimeRate: s.scenario.onTimeRate,
    priceMicro: s.scenario.priceFor12Micro,
    etaMinutes: s.scenario.etaMinutes,
  }));
  return { story: source.name, storyVersion: source.storyVersion, seed: source.syntheticCity.seed, days: HISTORY_DAYS, buyers: HISTORY_BUYERS, scale, endDay, promiseS, shops };
}

export function historyStream(params) {
  const hash = keccak256(toHex(JSON.stringify(params))).slice(2, 10);
  return `history:${params.story}:v${params.storyVersion}:x${params.scale}:d${params.endDay}:${hash}`;
}

export const parseHistoryStream = (name) => {
  const m = /^history:([^:]+):v(\d+):x([0-9.]+):d(\d+):([0-9a-f]{8})$/.exec(name);
  return m ? { story: m[1], storyVersion: Number(m[2]), scale: Number(m[3]), endDay: Number(m[4]), hash: m[5] } : null;
};

// The events of the history, in time order, as edge specs for the ledger. Shops and
// buyers are given as ENS names; the caller resolves nodes and epochs.
export function planHistory(params, { root = config.root.ens } = {}) {
  const stream = historyStream(params);
  const tag = stream.slice(-8);
  const buyers = historyBuyers(root, params.buyers);
  const firstDay = params.endDay - (params.days - 1);
  const events = [];
  params.shops.forEach((shop, si) => {
    const rand = mulberry32(params.seed + si + 1);
    const counts = historyCounts({ scenario: { ...shop, priceFor12Micro: shop.priceMicro } }, params.scale);
    const late = new Set(shuffle(counts.orders, rand).slice(0, counts.late));
    const refunded = new Set(shuffle(counts.orders, rand).slice(0, counts.refunds));
    const shopEns = `${shop.label}.${root}`;
    for (let k = 0; k < counts.orders; k += 1) {
      // Even spread over the window's days before today; a time of day from 10:00 to 21:30 IST.
      const day = firstDay + Math.floor((k * (params.days - 1)) / counts.orders);
      const t = day * DAY_S + 16_200 + Math.floor(rand() * 41_400);
      const buyer = buyers[Math.floor(rand() * buyers.length)].ens;
      const order = { shopEns, buyer, k };
      events.push({ ...order, kind: 'order', ts: t, amountMicro: shop.priceMicro });
      events.push({ ...order, kind: 'pay', ts: t + 20, amountMicro: shop.priceMicro });
      const eta = shop.etaMinutes * 60 + Math.floor(rand() * 600);
      const delivered = late.has(k) ? t + 20 + params.promiseS + 600 + Math.floor(rand() * 3000) : t + 20 + Math.min(eta, params.promiseS - 60);
      events.push({ ...order, kind: late.has(k) ? 'late' : 'deliver', ts: delivered, amountMicro: 0 });
      if (refunded.has(k)) events.push({ ...order, kind: 'refund', ts: delivered + 3600 + Math.floor(rand() * 7200), amountMicro: shop.priceMicro });
    }
  });
  // A refund or a late delivery may cross midnight: never into today.
  const endTs = params.endDay * DAY_S;
  for (const e of events) if (e.ts >= endTs) e.ts = endTs - 1;
  events.sort((a, b) => a.ts - b.ts || a.shopEns.localeCompare(b.shopEns) || a.k - b.k);
  return {
    stream,
    buyers,
    events: events.map((e, seq) => ({
      seq,
      ref: `hist:${tag}:${seq}`,
      kind: e.kind,
      // order and pay run buyer → shop; deliver, late and refund shop → buyer (§3).
      fromEns: e.kind === 'order' || e.kind === 'pay' ? e.buyer : e.shopEns,
      toEns: e.kind === 'order' || e.kind === 'pay' ? e.shopEns : e.buyer,
      amountMicro: BigInt(e.amountMicro),
      ts: e.ts,
      day: Math.floor(e.ts / DAY_S),
      orderId: keccak256(toHex(`${stream}:${e.shopEns}:${e.k}`)),
      synthetic: true,
    })),
  };
}

export function historyBatches(events, size = HISTORY_BATCH) {
  const out = [];
  for (let i = 0; i < events.length; i += size) out.push(events.slice(i, i + size));
  return out;
}

// A history stream already on Arkiv: resume it if it is this one, refuse otherwise.
export function historyDecision(existing, paramsFor) {
  if (!existing) return { action: 'write' };
  const parsed = parseHistoryStream(existing.stream);
  if (!parsed) return { action: 'refuse', why: `unrecognised history stream ${existing.stream}` };
  const mine = historyStream(paramsFor(parsed.endDay));
  if (mine !== existing.stream) return { action: 'refuse', why: `a different history is on Arkiv (${existing.stream}); this one would be ${mine}` };
  return { action: 'resume', endDay: parsed.endDay };
}
