// The code-owned run state (planning/SPEC/AGENTS.md §4.4) and the pay guard:
// phases (G12), eligibility (G2), budget and deadline (G3), and one payment per
// errand, reserved synchronously before any await (G10). The model decides which
// shop; this guard decides whether.

import { toMicro } from './money.mjs';

export function createRunState({ mandate, codeNeed, requestId }) {
  return {
    mandate,
    codeNeed,
    requestId,
    need: null,
    directory: null, // shop names the directory returned (scout)
    offers: new Map(), // shop name → Quote, from catalog reads (scout)
    tallies: null,
    ranking: null, // code's ranking (analyst phase)
    explainId: null,
    scoutDone: false,
    analystDone: false,
    paying: null, // the reservation: set once, before any await
    payment: null, // the payer's outcome
    spentMicro: 0n,
    reservedMicro: 0n,
    refusals: [],
  };
}

export function refuse(state, reason, detail) {
  const refusal = { reason, detail };
  state.refusals.push(refusal);
  return { ok: false, ...refusal };
}

// Synchronous by design: nothing here awaits, so a check and its reservation
// cannot be split by another tool call of the same step.
export function payGuard(state, shopEns, now) {
  if (!state.scoutDone || !state.analystDone) {
    return refuse(state, 'PHASE_NOT_READY', 'pay_shop waits until the scout and the analyst have both reported');
  }
  if (state.paying || state.payment) {
    return refuse(state, 'ONE_PAYMENT_PER_ERRAND', `this errand already has a payment for ${state.paying?.shopEns ?? state.payment?.shopEns}`);
  }
  if (typeof shopEns !== 'string' || shopEns === '') return refuse(state, 'SHOP_NOT_ELIGIBLE', 'no shop named');
  const ranked = state.ranking?.find((r) => r.ens === shopEns);
  if (!ranked) return refuse(state, 'SHOP_NOT_ELIGIBLE', `${shopEns} is not in code's ranking`);
  if (!ranked.eligible) return refuse(state, 'SHOP_NOT_ELIGIBLE', `${shopEns} is ineligible: ${ranked.reasons.join('; ')}`);
  const offer = state.offers.get(shopEns);
  if (!offer || offer.item !== state.need.item || offer.quantity !== state.need.quantity) {
    return refuse(state, 'NO_OFFER', `the scout found no offer from ${shopEns} for ${state.need.quantity} ${state.need.item}`);
  }
  const price = toMicro(offer.priceUsdt);
  if (price > state.mandate.budgetMicro - state.spentMicro - state.reservedMicro) {
    return refuse(state, 'OVER_BUDGET', `${offer.priceUsdt} is above what is left of the ${state.mandate.budgetUsdt} budget`);
  }
  const arrives = now + offer.etaMinutes * 60_000;
  const deadline = Date.parse(state.mandate.deadlineIso);
  if (!(arrives <= deadline)) return refuse(state, 'MISSES_DEADLINE', `arrives after the deadline ${state.mandate.deadlineIso}`);
  state.paying = { shopEns, priceMicro: price };
  return { ok: true, offer, ranked, priceMicro: price };
}

// Code's own choice (W4, when the concierge names no shop of the ranking): the best-ranked
// eligible shop whose scout offer fits what is left of the budget and the deadline at `now`.
// Pure: it reserves nothing; payGuard still decides.
export function bestFit(state, now) {
  if (!state.scoutDone || !state.analystDone || !state.need) return null;
  const left = state.mandate.budgetMicro - state.spentMicro - state.reservedMicro;
  const deadline = Date.parse(state.mandate.deadlineIso);
  for (const r of state.ranking ?? []) {
    if (!r.eligible) continue;
    const offer = state.offers.get(r.ens);
    if (!offer || offer.item !== state.need.item || offer.quantity !== state.need.quantity) continue;
    if (toMicro(offer.priceUsdt) > left) continue;
    if (!(now + offer.etaMinutes * 60_000 <= deadline)) continue;
    return r.ens;
  }
  return null;
}
