// The messages between the stage (/live) and its two phone frames, all same-origin postMessage
// (BACKEND_FOR_FRONTEND.md §3.4, final website brief §5):
//   graphpay.run-frame    the customer’s phone → stage: each errand frame, as it arrived
//   graphpay.phone-event  either phone → stage: what a phone did, with the real answer it got
//   graphpay.scene        stage → both phones: the current scene, beat and errand step (display only)
//   graphpay.relay        stage → the other phone: the frames and events the stage has seen
//   graphpay.hello        a phone → stage, on load: send me what I missed
// The stage never asks a phone to act; the phones never trust a message from another origin.

import type { BeatKey } from './scenes.ts';

export const RUN_FRAME = 'graphpay.run-frame';
export const PHONE_EVENT = 'graphpay.phone-event';
export const SCENE = 'graphpay.scene';
export const RELAY = 'graphpay.relay';
export const HELLO = 'graphpay.hello';

export type PhoneEventKey =
  // scene 4: the shop marks the paid order dispatched on chain
  | 'dispatched'
  // scene 5
  | 'refund-start'
  | 'refund-photo'
  | 'refund-request'
  | 'refund-accepted'
  | 'refund'
  | 'refund-declined'
  // scene 6
  | 'pause-start'
  | 'paused'
  | 'resumed'
  | 'reorder-refused'
  // the shop's own
  | 'shop-open'
  | 'renewal'
  // a merchant stream edge, forwarded by the shop's phone (the stage opens no stream of its own)
  | 'edge';

export const PHONE_EVENT_KEYS: readonly PhoneEventKey[] = ['dispatched', 'refund-start', 'refund-photo', 'refund-request', 'refund-accepted', 'refund', 'refund-declined', 'pause-start', 'paused', 'resumed', 'reorder-refused', 'shop-open', 'renewal', 'edge'];

export interface Chip {
  label: string;
  href: string;
}

export interface PhoneEvent {
  type: typeof PHONE_EVENT;
  key: PhoneEventKey;
  chips: Chip[];
  data?: Record<string, unknown>;
  at: number;
}

export interface SceneMessage {
  type: typeof SCENE;
  scene: number;
  beat: BeatKey;
  // The last errand step shown (index into ERRAND_STEPS, -1 for none) and its run.
  step: number;
  runId: string | null;
}

export interface RelayMessage {
  type: typeof RELAY;
  frames?: { event: string; data: string; at: number }[];
  events?: PhoneEvent[];
  // True when `frames` is the whole run so far (a phone that just loaded).
  replace?: boolean;
}

export const isPhoneEventKey = (v: unknown): v is PhoneEventKey => typeof v === 'string' && (PHONE_EVENT_KEYS as readonly string[]).includes(v);

// Only https:// links and short labels pass from a phone to the stage.
export function safeChips(value: unknown): Chip[] {
  return (Array.isArray(value) ? value : []).flatMap((c: { label?: unknown; href?: unknown }) =>
    typeof c?.label === 'string' && typeof c.href === 'string' && /^https:\/\//.test(c.href) ? [{ label: c.label.slice(0, 60), href: c.href }] : [],
  );
}
