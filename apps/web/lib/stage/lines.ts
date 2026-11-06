// The agents' lines on both phones (final website brief §6): fixed templates in code, every value
// taken from the errand's frames (lib/stage/errand.ts) or from the story config through the caller's
// cast. The model's own wording never shows: the three model calls still make the decisions, and the
// lines say what they decided. Each line carries the errand step it belongs to, so a phone shows it
// only once the director has reached that step.

import type { ErrandModel } from './errand.ts';
import { microUsdt, percent, usdt } from './format.ts';
import type { StepKey } from './scenes.ts';

export interface CastAgent {
  label: string;
  ens: string;
}

export interface LineCast {
  timeZone: string;
  persona: { name: string; ens: string };
  // By role: concierge, scout, analyst, payer (buyer side); storefront, risk, dispatch (shop side).
  agents: Record<string, CastAgent>;
  shops: { ens: string; name: string; storyRole: string }[];
  merchant: { ens: string; name: string };
  order: { item: string; area: string; budgetMicro: string; refundMicro: string; refundReason: string; reorderItem: string };
}

export type CardKind = 'request' | 'shops' | 'ranking' | 'menu' | 'bill' | 'receipt' | 'quote-request' | 'shop-bill' | 'failure';

export interface Line {
  key: string;
  step: StepKey;
  // The agent's role, or 'persona' for the customer’s own message.
  role: string;
  text: string;
  card?: CardKind;
  tone?: 'ok' | 'bad';
}

const name = (cast: LineCast, ens: string | null | undefined): string => (ens ? (cast.shops.find((s) => s.ens === ens)?.name ?? ens) : '');
const label = (cast: LineCast, role: string): string => cast.agents[role]?.label ?? role;

// Plain words for the run's end, by the server's own sentence or refusal code.
export function endSentence(m: ErrandModel): string | null {
  const end = m.end;
  if (!end || end.status === 'paid') return null;
  if (end.status === 'failed') {
    const why = end.reason ?? '';
    if (/busy/i.test(why)) return 'Another errand is running. Try again in a minute.';
    if (/out of time/i.test(why)) return 'The errand ran out of time before it paid. Nothing was paid. Try again in a minute.';
    return 'The errand stopped before it paid. Nothing was paid. Try again in a minute.';
  }
  const reason = end.reason ?? '';
  if (/ENS_PAUSED/.test(reason)) return 'Refused: the payer is paused on ENS. Nothing was paid.';
  if (/REVOKED|EXPIRED/.test(reason)) return 'Refused: the payer’s pass is revoked. Nothing was paid.';
  if (/CAP_EXCEEDED|OVER_DAILY_CAP/.test(reason)) return 'Refused: over today’s pass. Nothing was paid.';
  if (/SHOP_NOT_ELIGIBLE/.test(reason)) return 'Refused: no shop passed the checks. Nothing was paid.';
  if (/BUDGET|DEADLINE|PRICE/.test(reason)) return 'Refused: no shop fits the budget and the hour. Nothing was paid.';
  if (end.status === 'unsettled') return 'The payment did not settle. Nothing was paid. Try again in a minute.';
  return 'No purchase this time. Nothing was paid.';
}

export function customerErrandLines(m: ErrandModel, cast: LineCast): Line[] {
  const out: Line[] = [];
  const add = (l: Line) => out.push(l);
  if (m.request) add({ key: 'ask', step: 'ask', role: 'persona', text: m.request, card: 'request' });
  if (m.arrived.team !== undefined) {
    add({
      key: 'team',
      step: 'team',
      role: 'concierge',
      text: `On it. ${label(cast, 'scout')}: find ${cast.order.item} near ${cast.order.area}. ${label(cast, 'analyst')}: check their records. ${label(cast, 'payer')}: stand by.`,
    });
  }
  if (m.arrived.shops !== undefined) {
    add({ key: 'shops', step: 'shops', role: 'scout', text: `${m.offers.length || m.directory.length} shops near ${cast.order.area}.`, card: 'shops' });
  }
  if (m.arrived.best !== undefined && m.best) {
    const board = (ens: string) => m.graph?.boards.find((b) => b.ens === ens);
    const best = board(m.best);
    const trap = m.ranking.find((r) => !r.eligible);
    const trapBoard = trap ? board(trap.ens) : undefined;
    const first = best ? `${name(cast, m.best)}: ${best.orders ?? ''} orders, ${percent(best.refundRate)} refunds, ${percent(best.onTimeRate, 0)} on time.` : `${name(cast, m.best)} is the best eligible shop.`;
    const second = trap && trapBoard ? ` ${name(cast, trap.ens)}: ${percent(trapBoard.refundRate)} refunds, rejected.` : '';
    add({ key: 'best', step: 'best', role: 'analyst', text: first + second, card: 'ranking' });
  }
  if (m.arrived.order !== undefined && m.order) {
    add({
      key: 'order',
      step: 'order',
      role: 'concierge',
      text: `Order ${m.order.quantity} × ${cast.order.item} from ${name(cast, m.order.shop)}, at most ${microUsdt(cast.order.budgetMicro)} USDT, within the hour.`,
      card: 'menu',
    });
  }
  if (m.arrived.vet !== undefined) add({ key: 'vet', step: 'vet', role: 'payer', text: `Asking ${name(cast, m.order?.shop ?? m.best)} for the bill.` });
  if (m.arrived.quote !== undefined && m.quote) {
    add({ key: 'quote', step: 'quote', role: 'payer', text: `Bill: ${usdt(m.quote.priceUsdt)} USDT, inside today’s pass. Signing once.`, card: 'bill' });
  }
  if (m.arrived.paid !== undefined && m.paid) {
    add({ key: 'paid', step: 'paid', role: 'payer', text: `Paid ${usdt(m.paid.amountUsdt)}.`, card: 'receipt', tone: 'ok' });
  }
  return out;
}

export function merchantErrandLines(m: ErrandModel, cast: LineCast): Line[] {
  const out: Line[] = [];
  const add = (l: Line) => out.push(l);
  const payer = cast.agents.payer?.ens ?? m.risk.buyer ?? '';
  // Only the errand that reaches this shop rings its phone.
  const ours = (m.order?.shop ?? m.best) === cast.merchant.ens;
  if (!ours) return out;
  if (m.arrived.order !== undefined) add({ key: 'm-quote', step: 'order', role: 'storefront', text: `Quote request: ${m.order?.quantity ?? 1} × ${cast.order.item}.`, card: 'quote-request' });
  if (m.arrived.vet !== undefined) add({ key: 'm-vet', step: 'vet', role: 'storefront', text: `New buyer: ${m.risk.buyer ?? payer}. Check them?` });
  if (m.arrived.verdict !== undefined) {
    const approved = m.risk.approved === true;
    const verdict = approved ? 'Approved' : 'Declined';
    const graph = m.risk.paidOrders !== null ? `Graph: ${m.risk.paidOrders} paid orders, ${m.risk.disputes ?? 0} disputes.` : '';
    const ens = m.risk.owner ? ` ENS: owned by ${m.risk.owner}, ${m.risk.ensStatus ?? ''}.` : '';
    add({ key: 'm-risk', step: 'verdict', role: 'risk', text: `${graph}${ens} ${verdict}.`.trim(), tone: approved ? 'ok' : 'bad' });
    const price = m.quote?.priceUsdt ?? m.offers.find((o) => o.shop === cast.merchant.ens)?.priceUsdt ?? null;
    if (approved && price) add({ key: 'm-bill', step: 'verdict', role: 'storefront', text: `Sending the bill: ${usdt(price)} USDT.` });
  }
  if (m.arrived.paid !== undefined && m.paid) {
    add({ key: 'm-paid', step: 'paid', role: 'storefront', text: `Received ${usdt(m.paid.amountUsdt)} from ${payer}.`, card: 'shop-bill', tone: 'ok' });
  }
  return out;
}

// Right after the payment settles, the shop's dispatch agent marks the order dispatched on chain.
export const dispatchLines = {
  sending: () => 'Marking the order dispatched on Whitechain.',
  shopDone: () => 'Dispatched. Marked on Whitechain.',
  customerDone: (cast: LineCast) => `${cast.merchant.name} dispatched the order.`,
};

// Scene 5 and 6 lines, in the same style.
export const refundLines = {
  ask: (cast: LineCast) => `Refund ${microUsdt(cast.order.refundMicro)}: ${cast.order.refundReason}.`,
  photo: () => 'Photo attached.',
  sent: (cast: LineCast) => `Asked ${cast.merchant.name} for ${microUsdt(cast.order.refundMicro)} back.`,
  refunded: (amountMicro: string) => `Refunded ${microUsdt(amountMicro)}.`,
  declined: () => 'The shop declined the refund.',
  shopRequest: (cast: LineCast, amountMicro: string) => `Refund request: ${microUsdt(amountMicro)}, ${cast.order.refundReason}.`,
  // The shop's risk agent accepts on its own once the request lands: what it checked, then its answer.
  riskAccept: (amountMicro: string, paidUsdt: string | null, photo: boolean) => `${photo ? 'Photo on Swarm. ' : ''}${microUsdt(amountMicro)} of ${paidUsdt ? usdt(paidUsdt) : 'the order'}, on a dispatched order. Accept.`,
  shopRefunded: (cast: LineCast, amountMicro: string) => `Refunded ${microUsdt(amountMicro)} to ${cast.agents.payer?.ens ?? ''}.`,
  shopDeclined: () => 'Declined. The note is on Arkiv.',
};

export const pauseLines = {
  renewed: (item: string, priceMicro: string) => `${item} renewed: ${microUsdt(priceMicro)}.`,
  pausing: (cast: LineCast) => `Pausing ${cast.agents.payer?.label ?? 'the payer'} on ENS.`,
  paused: (cast: LineCast, resumesAt: string) => `${cast.agents.payer?.label ?? 'Payer'} paused.${resumesAt ? ` Resumes by itself at ${resumesAt}.` : ''}`,
  trying: (cast: LineCast) => `Trying ${cast.order.reorderItem} while paused.`,
  refused: () => 'Refused: the payer is paused on ENS. Nothing was sent.',
  shopRefused: (cast: LineCast) => `Payment from ${cast.agents.payer?.ens ?? ''} refused: payer paused. Nothing received.`,
};
