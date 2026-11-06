// The one table behind the booth's middle: what happens on the phones, and which slide of the deck
// shows it. The errand's seven steps and the phones' other events (a refund, pause and resume, the
// shop's Open switch, a renewal) all point here. The deck reads the same rows to draw its strip, so
// the strip and the slide can never disagree: the strip's title is the slide's own title.
//
// `slide` is the deck's slide (1-based, apps/web/public/deck/index.html) and `title` is that slide's
// title (a test keeps them equal). `step` is how far to reveal a slide with steps (null: all of it);
// `from` is the first step at which a slide shared by two rows belongs to this row.

export type DeckKey =
  | 'ask'
  | 'team'
  | 'check'
  | 'check-back'
  | 'quote'
  | 'payment'
  | 'record'
  | 'refund-request'
  | 'refund'
  | 'paused'
  | 'resumed'
  | 'shop-open'
  | 'renewal';

export interface DeckSpot {
  slide: number;
  title: string;
  step: number | null;
  from: number;
  // The errand's step number (1 to 7), for the rows that are one of its seven steps.
  errand?: number;
  // What the strip says next to the title for a row that is not an errand step.
  label: string;
}

export const DECK_MAP: Record<DeckKey, DeckSpot> = {
  ask: { slide: 5, title: 'One message, a whole team', step: null, from: 0, errand: 1, label: 'The ask' },
  team: { slide: 4, title: 'Two desks, two teams', step: null, from: 0, errand: 2, label: 'The team' },
  check: { slide: 7, title: 'The same receipts, as a graph', step: null, from: 0, errand: 3, label: 'The check' },
  'check-back': { slide: 9, title: 'The shop checks the buyer back', step: null, from: 0, errand: 4, label: 'The check back' },
  quote: { slide: 10, title: 'The payment, step by step', step: 2, from: 0, errand: 5, label: 'The 402 quote' },
  payment: { slide: 10, title: 'The payment, step by step', step: null, from: 3, errand: 6, label: 'The payment' },
  record: { slide: 15, title: 'How one payment is written', step: null, from: 0, errand: 7, label: 'The record on Arkiv' },
  'refund-request': { slide: 11, title: 'A refund, with proof', step: 5, from: 0, label: 'Refund requested on the phone' },
  refund: { slide: 11, title: 'A refund, with proof', step: 9, from: 6, label: 'Refunded by the shop' },
  paused: { slide: 14, title: 'Stopped, live', step: 3, from: 0, label: 'Payer paused' },
  // Resume returns the deck to where it was; this row only names the strip's note.
  resumed: { slide: 14, title: 'Stopped, live', step: 3, from: 0, label: 'Payer resumed' },
  'shop-open': { slide: 4, title: 'Two desks, two teams', step: null, from: 0, label: 'The shop’s Open switch' },
  renewal: { slide: 12, title: 'Every way a business gets paid', step: 1, from: 0, label: 'A renewal' },
};

export const ERRAND_KEYS: DeckKey[] = (Object.keys(DECK_MAP) as DeckKey[]).filter((k) => DECK_MAP[k].errand).sort((a, b) => (DECK_MAP[a].errand ?? 0) - (DECK_MAP[b].errand ?? 0));

export function isDeckKey(value: unknown): value is DeckKey {
  return typeof value === 'string' && Object.hasOwn(DECK_MAP, value);
}
