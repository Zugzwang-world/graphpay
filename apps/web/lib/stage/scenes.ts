// The one scene table of the stage (final website brief §5): eleven scenes, numbered 0 to 10, that
// the middle, the customer’s phone and the shop's phone show together. Each row is one beat: its scene,
// what fires it, how long it stays at least, and what each pane shows. The director on /live reads
// this table; both phones read the same beat keys from the `graphpay.scene` message. The errand's
// own steps (scenes 1 to 4) are in ERRAND_STEPS, in errand-step order, each pointing at its beat.
//
// Plain data on purpose: it is imported by the Next.js stage and by the phones' Vite build.

export type BeatKey =
  | 'film'
  | 'teams'
  | 'plain'
  | 'queries'
  | 'graph'
  | 'check-back'
  | 'x402'
  | 'refund'
  | 'pause'
  | 'arkiv'
  | 'ens'
  | 'whitechain'
  | 'close';

export type Trigger = 'load' | 'errand' | 'phone' | 'key';

export interface Beat {
  key: BeatKey;
  scene: number;
  title: string;
  trigger: Trigger;
  // What fires the beat, in the brief's words.
  firedBy: string;
  // The least time the beat stays before the next scene may start.
  minDwellMs: number;
  panes: { customer: string; middle: string; merchant: string };
}

export const BEATS: readonly Beat[] = [
  {
    key: 'film',
    scene: 0,
    title: 'Opening film',
    trigger: 'load',
    firedBy: 'page load; it loops until the request bubble is tapped',
    minDwellMs: 0,
    panes: { customer: 'the desk at rest, the request as one floating bubble', middle: 'the figurine film', merchant: 'the team idle, the shop open, today’s earnings' },
  },
  {
    key: 'teams',
    scene: 1,
    title: 'Two teams',
    trigger: 'errand',
    firedBy: '`started`, then the concierge’s messages to the scout and the analyst',
    minDwellMs: 9_000,
    panes: { customer: 'the sent message; the concierge speaks; Find turns green', middle: 'the ENS tree, each node waking with its agent', merchant: 'the team, idle' },
  },
  {
    key: 'plain',
    scene: 2,
    title: 'Finding the best shop',
    trigger: 'errand',
    firedBy: 'the scout’s `directory_list` and `catalog_read` results',
    minDwellMs: 11_000,
    panes: { customer: 'three shop cards with storefront photos from Swarm', middle: 'the receipts as a plain table, read page by page', merchant: 'unchanged' },
  },
  {
    key: 'queries',
    scene: 2,
    title: 'Finding the best shop',
    trigger: 'errand',
    firedBy: 'the analyst’s `graphql` result',
    minDwellMs: 13_000,
    panes: { customer: 'each card gains its scoreboard', middle: 'plain Arkiv beside GraphPay: this run’s query and reads', merchant: 'unchanged' },
  },
  {
    key: 'graph',
    scene: 2,
    title: 'Finding the best shop',
    trigger: 'errand',
    firedBy: 'the analyst’s “best eligible” message',
    minDwellMs: 13_000,
    panes: { customer: 'the ranking, the trap in red, the chosen menu', middle: 'the same receipts as a graph of ENS names', merchant: 'the storefront wakes; the quote request arrives' },
  },
  {
    key: 'check-back',
    scene: 3,
    title: 'The shop checks the buyer back',
    trigger: 'errand',
    firedBy: 'the risk agent’s `ens_check` and `ask` results, guard G9, the verdict',
    minDwellMs: 12_000,
    panes: { customer: 'the payer asks for the bill and waits', middle: '“Who is this buyer?”: Arkiv and ENS answer', merchant: 'storefront to risk, the numbers, the verdict' },
  },
  {
    key: 'x402',
    scene: 4,
    title: 'The bill and the payment',
    trigger: 'errand',
    firedBy: '`get_quote`, the 402, G5, the signature, “settled”, `pay_order`, `result`; then the shop marks the order dispatched on chain',
    minDwellMs: 16_000,
    panes: { customer: 'the bill, one signature, the receipt: paid and dispatched', middle: 'the x402 sequence, lane by lane, then dispatched', merchant: 'the bill received; dispatched on Whitechain' },
  },
  {
    key: 'refund',
    scene: 5,
    title: 'The refund, with a photo on Swarm',
    trigger: 'phone',
    firedBy: 'Refund on the customer’s phone, once the order is dispatched; the shop accepts by itself',
    minDwellMs: 20_000,
    panes: { customer: 'the refund card, the photo on Swarm, refunded', middle: 'photo, request, acceptance, money back, scoreboard', merchant: 'the request with its photo; the risk agent accepts; refunded' },
  },
  {
    key: 'pause',
    scene: 6,
    title: 'The renewal and the off switch',
    trigger: 'phone',
    firedBy: 'the payer’s switch on the customer’s phone',
    minDwellMs: 20_000,
    panes: { customer: 'the last renewal, Paused, the next payment refused', middle: 'the payer’s ENS card, then the refused attempt', merchant: 'the payment refused, nothing received' },
  },
  {
    key: 'arkiv',
    scene: 7,
    title: 'What we proved: Arkiv',
    trigger: 'key',
    firedBy: 'the arrow key',
    minDwellMs: 18_000,
    panes: { customer: 'the payer’s scoreboard', middle: 'one payment written, two lab meters (speed and data), the arkiv-graph card', merchant: 'the shop’s scoreboard' },
  },
  {
    key: 'ens',
    scene: 8,
    title: 'What we proved: ENS',
    trigger: 'key',
    firedBy: 'the arrow key',
    minDwellMs: 18_000,
    panes: { customer: 'each agent with its name and switch', middle: 'names, owners and off switches, each with its proof', merchant: 'each agent with its name' },
  },
  {
    key: 'whitechain',
    scene: 9,
    title: 'What we proved: Whitechain',
    trigger: 'key',
    firedBy: 'the arrow key',
    minDwellMs: 18_000,
    panes: { customer: 'a plain payment history', middle: 'what people see, what runs underneath, the agentpay card', merchant: 'received, refunded, renewals, the export' },
  },
  {
    key: 'close',
    scene: 10,
    title: 'Close',
    trigger: 'key',
    firedBy: 'the arrow key',
    minDwellMs: 18_000,
    panes: { customer: 'this run, replayed fast', middle: 'decide fast, pay safely, can be stopped', merchant: 'this run, replayed fast' },
  },
];

// The errand's steps in errand-step order (never lane order): the director shows each one only
// after the one before it, so it cannot jump past the check back or the quote. `gapMs` is the
// least time after the step before it; a step that starts a new beat also waits for that beat's
// dwell. `verify` has no frame of its own: it plays between the signature and the settlement.
export type StepKey =
  | 'ask'
  | 'team'
  | 'shops'
  | 'graphql'
  | 'best'
  | 'order'
  | 'vet'
  | 'checks'
  | 'verdict'
  | 'quote'
  | 'bill402'
  | 'sign'
  | 'verify'
  | 'settled'
  | 'dispatch'
  | 'paid';

export interface ErrandStep {
  key: StepKey;
  beat: BeatKey;
  gapMs: number;
}

export const ERRAND_STEPS: readonly ErrandStep[] = [
  { key: 'ask', beat: 'teams', gapMs: 0 },
  { key: 'team', beat: 'teams', gapMs: 2_400 },
  { key: 'shops', beat: 'plain', gapMs: 0 },
  { key: 'graphql', beat: 'queries', gapMs: 0 },
  { key: 'best', beat: 'graph', gapMs: 0 },
  { key: 'order', beat: 'graph', gapMs: 4_500 },
  { key: 'vet', beat: 'check-back', gapMs: 0 },
  { key: 'checks', beat: 'check-back', gapMs: 3_200 },
  { key: 'verdict', beat: 'check-back', gapMs: 3_200 },
  { key: 'quote', beat: 'x402', gapMs: 0 },
  { key: 'bill402', beat: 'x402', gapMs: 2_200 },
  { key: 'sign', beat: 'x402', gapMs: 2_200 },
  { key: 'verify', beat: 'x402', gapMs: 1_800 },
  { key: 'settled', beat: 'x402', gapMs: 1_800 },
  { key: 'dispatch', beat: 'x402', gapMs: 1_600 },
  { key: 'paid', beat: 'x402', gapMs: 1_400 },
];

export const BROWSE_BEATS: readonly BeatKey[] = ['arkiv', 'ens', 'whitechain', 'close'];

export function beatOf(key: BeatKey): Beat {
  const beat = BEATS.find((b) => b.key === key);
  if (!beat) throw new Error(`no beat ${key}`);
  return beat;
}

export function isBeatKey(value: unknown): value is BeatKey {
  return typeof value === 'string' && BEATS.some((b) => b.key === value);
}

export function isStepKey(value: unknown): value is StepKey {
  return typeof value === 'string' && ERRAND_STEPS.some((s) => s.key === value);
}

export const stepIndex = (key: StepKey): number => ERRAND_STEPS.findIndex((s) => s.key === key);

// The beat order: a beat is "reached" when the stage is at it or past it.
export const beatIndex = (key: BeatKey): number => BEATS.findIndex((b) => b.key === key);
