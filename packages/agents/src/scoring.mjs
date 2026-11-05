// Scoring and policy (planning/SPEC/AGENTS.md §7). The ranking is computed here,
// from tallies that code's own query read (G2, G15), never typed in or taken
// from a model.

export const SHOP_POLICY = Object.freeze({
  weights: Object.freeze({ refunds: 0.4, onTime: 0.3, volume: 0.2, verified: 0.1 }),
  maxRefundRate: 0.1,
  minOnTimeRate: 0.8,
  window: 'D90',
});

export const BUYER_POLICY = Object.freeze({ maxCancelRate: 0.15, maxDisputes: 5 });

// The volume term's reference: the busiest cast shop's 90-day orders in the story
// (4,812 in the test story). A smaller history on Rabdi shrinks the term; the
// reference stays (planning/ACCEPTANCE_TESTS.md E2).
export function volumeReference(cast) {
  const orders = cast.shops.map((s) => Number(s.scenario?.orders90d)).filter((n) => Number.isFinite(n) && n > 1);
  if (orders.length === 0) throw new Error('the story cast has no shop with 90-day orders above 1');
  return Math.max(...orders);
}

const pct = (rate) => `${(rate * 100).toFixed(1)}%`;

export function scoreShop(tally, volumeRef) {
  const w = SHOP_POLICY.weights;
  const volume = tally.orders90d > 1 ? Math.min(1, Math.log(tally.orders90d) / Math.log(volumeRef)) : 0;
  return w.refunds * (1 - tally.refundRate90d) + w.onTime * tally.onTimeRate90d + w.volume * volume + w.verified * (tally.verifiedOwner ? 1 : 0);
}

export function eligibilityReasons(tally) {
  const reasons = [];
  if (tally.refundRate90d > SHOP_POLICY.maxRefundRate) {
    reasons.push(`refund rate ${pct(tally.refundRate90d)} is above ${pct(SHOP_POLICY.maxRefundRate)} (90 days)`);
  }
  if (tally.onTimeRate90d < SHOP_POLICY.minOnTimeRate) {
    reasons.push(`on-time rate ${pct(tally.onTimeRate90d)} is below ${pct(SHOP_POLICY.minOnTimeRate)} (90 days)`);
  }
  if (tally.unreliable) reasons.push(tally.unreliable);
  return reasons;
}

// Eligible shops first by score, then ineligible ones by score, each with its reasons.
export function rankShops(tallies, volumeRef) {
  const ranked = tallies.map((t) => {
    const reasons = eligibilityReasons(t);
    return { ens: t.ens, score: scoreShop(t, volumeRef), eligible: reasons.length === 0, reasons };
  });
  return ranked.sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score || (a.ens < b.ens ? -1 : 1));
}

const RATE = /^(?:0(?:\.\d{1,8})?|1(?:\.0{1,8})?)$/;

function rate(value) {
  if (typeof value === 'number' && value >= 0 && value <= 1) return value;
  if (typeof value === 'string' && RATE.test(value)) return Number(value);
  return null;
}

function count(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d{1,15}$/.test(value)) return Number(value);
  return null;
}

// Tallies from the answer of code's fixed ranking query (graph.mjs). A shop whose
// 90-day reputation is missing, truncated, mismatched or not active is kept, but
// marked unreliable, so it ranks ineligible with that reason: fail closed.
export function talliesFromNodes(nodes) {
  const out = [];
  for (const node of nodes ?? []) {
    if (typeof node?.ens !== 'string' || node.ens === '') continue;
    const r = node.reputation ?? {};
    const tally = {
      ens: node.ens,
      refundRate90d: rate(r.refundRate),
      onTimeRate90d: rate(r.onTimeRate),
      orders90d: count(r.orders),
      verifiedOwner: node.verified === true,
      synthetic: r.synthetic === true || node.synthetic === true,
      source: typeof r.source === 'string' ? r.source : null,
      unreliable: null,
    };
    if (tally.refundRate90d === null || tally.onTimeRate90d === null || tally.orders90d === null) {
      tally.unreliable = 'no readable 90-day reputation';
      tally.refundRate90d ??= 1;
      tally.onTimeRate90d ??= 0;
      tally.orders90d ??= 0;
    } else if (tally.source !== 'TALLY' && tally.source !== 'RAW_VERIFIED') {
      tally.unreliable = `reputation source is ${tally.source ?? 'missing'}`;
    } else if (typeof node.status === 'string' && node.status !== '' && node.status !== 'active') {
      tally.unreliable = `shop status is ${node.status}`;
    }
    out.push(tally);
  }
  return out;
}

// The buyer side, for a shop's risk step: an empty list approves. Money compares as bigints.
export function buyerRiskReasons(standing, amountMicro) {
  const reasons = [];
  if (standing.status !== 'ACTIVE') reasons.push(`buyer agent status is ${standing.status}, not ACTIVE`);
  if (standing.orders > 0 && standing.cancellations / standing.orders > BUYER_POLICY.maxCancelRate) {
    reasons.push(`cancel rate ${pct(standing.cancellations / standing.orders)} is above ${pct(BUYER_POLICY.maxCancelRate)}`);
  }
  if (standing.disputes > BUYER_POLICY.maxDisputes) reasons.push(`${standing.disputes} disputes exceed ${BUYER_POLICY.maxDisputes}`);
  if (standing.spendTodayMicro + amountMicro > standing.dailyCapMicro) reasons.push('spend today plus this order passes the daily cap');
  return reasons;
}
