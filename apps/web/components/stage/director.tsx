'use client';

// The director on /live (final website brief §5): it reads the errand's frames from the customer’s phone,
// both phones' events and the merchant stream's edges (forwarded by the shop's phone), queues the
// errand in errand-step order with lib/stage/pace.ts, and enters each scene only when its trigger has
// fired and the scene before it has stayed its least dwell. It tells both phones the scene for
// display and relays to each phone what the other one did. It never asks a phone to act; the arrow
// keys only browse scenes 7 to 10, and Esc only returns the display to scene 0.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { foldAll, type ErrandModel } from '@/lib/stage/errand';
import { advance, restPace, type Pace } from '@/lib/stage/pace';
import { BEATS, BROWSE_BEATS, beatOf, beatIndex, type BeatKey } from '@/lib/stage/scenes';
import { HELLO, PHONE_EVENT, RELAY, RUN_FRAME, SCENE, isPhoneEventKey, safeChips, type PhoneEvent, type SceneMessage } from '@/lib/stage/messages';

export interface Frame {
  event: string;
  data: string;
  at: number;
}

export interface StageEdge {
  kind: string;
  from: string;
  to: string;
  amountMicro: string;
  orderId: string | null;
  ref: string;
  ts: number;
  settlementTx: string | null;
  entityKey: string | null;
  arkivTx: string | null;
  at: number;
}

export interface DirectorState {
  beat: BeatKey;
  scene: number;
  beatAt: number;
  pace: Pace;
  model: ErrandModel;
  frames: Frame[];
  events: PhoneEvent[];
  edges: StageEdge[];
  inFlight: boolean;
}

const DirectorContext = createContext<DirectorState | null>(null);

export function useDirector(): DirectorState {
  const value = useContext(DirectorContext);
  if (!value) throw new Error('useDirector outside the stage');
  return value;
}

const TICK_MS = 200;

export function Director({ customer, merchant, children }: { customer: RefObject<HTMLIFrameElement | null>; merchant: RefObject<HTMLIFrameElement | null>; children: ReactNode }) {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [events, setEvents] = useState<PhoneEvent[]>([]);
  const [edges, setEdges] = useState<StageEdge[]>([]);
  const [pace, setPace] = useState<Pace>(() => restPace(Date.now()));
  // A phone's scene (5, 6) or a browsed one (7 to 10, or back to 0); null follows the errand.
  const [override, setOverride] = useState<{ beat: BeatKey; at: number } | null>(null);
  // A phone's scene waiting for the current one's dwell (kept out of render: only the tick reads it).
  const queued = useRef<BeatKey | null>(null);
  const setQueued = (beat: BeatKey | null, onlyIfEmpty = false) => {
    if (!onlyIfEmpty || queued.current === null) queued.current = beat;
  };
  const model = useMemo(() => foldAll(frames), [frames]);
  const runId = model.runId;
  const inFlight = runId !== null && model.end === null;

  const errandBeat: BeatKey = runId ? pace.beat : 'film';
  const beat: BeatKey = override?.beat ?? errandBeat;
  const beatAtRef = useRef<{ beat: BeatKey; at: number }>({ beat, at: Date.now() });
  if (beatAtRef.current.beat !== beat) beatAtRef.current = { beat, at: Date.now() };
  const beatAt = beatAtRef.current.at;

  // The errand's pace, and a phone's scene once the current one has stayed its dwell.
  const modelRef = useRef(model);
  modelRef.current = model;
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      const m = modelRef.current;
      if (m.runId) setPace((p) => advance(p, m.arrived, m.end !== null, now));
      const q = queued.current;
      if (!q) return;
      const current = beatAtRef.current;
      if (now - current.at < beatOf(current.beat).minDwellMs && !BROWSE_BEATS.includes(current.beat) && current.beat !== 'film') return;
      queued.current = null;
      setOverride({ beat: q, at: now });
    }, TICK_MS);
    return () => clearInterval(t);
  }, []);

  // To both phones: the scene, for display only.
  const sceneMessage = useMemo<SceneMessage>(() => ({ type: SCENE, scene: beatOf(beat).scene, beat, step: pace.shown, runId }), [beat, pace.shown, runId]);
  const send = useCallback((frame: RefObject<HTMLIFrameElement | null>, message: unknown) => {
    frame.current?.contentWindow?.postMessage(message, window.location.origin);
  }, []);
  useEffect(() => {
    send(customer, sceneMessage);
    send(merchant, sceneMessage);
  }, [sceneMessage, send, customer, merchant]);

  const state = useRef({ frames, events, sceneMessage });
  state.current = { frames, events, sceneMessage };

  useEffect(() => {
    const onMessage = (msg: MessageEvent) => {
      if (msg.origin !== window.location.origin) return;
      const fromCustomer = msg.source === customer.current?.contentWindow;
      const fromMerchant = msg.source === merchant.current?.contentWindow;
      if (!fromCustomer && !fromMerchant) return;
      const data = msg.data as { type?: unknown; event?: unknown; data?: unknown; key?: unknown; chips?: unknown; at?: unknown } | null;
      if (data?.type === HELLO) {
        // A phone that just loaded gets the scene and everything the other side did.
        const target = fromCustomer ? customer : merchant;
        send(target, state.current.sceneMessage);
        const own = fromCustomer ? 'customer' : 'merchant';
        send(target, { type: RELAY, replace: true, frames: own === 'merchant' ? state.current.frames : [], events: state.current.events });
        return;
      }
      if (data?.type === RUN_FRAME && fromCustomer && typeof data.event === 'string' && typeof data.data === 'string') {
        const frame: Frame = { event: data.event, data: data.data, at: Date.now() };
        if (frame.event === 'started') {
          // A new errand: the stage follows it from the top.
          setFrames([frame]);
          setPace(restPace(Date.now()));
          setOverride(null);
          setQueued(null);
          setEvents([]);
          send(merchant, { type: RELAY, replace: true, frames: [frame], events: [] });
        } else {
          setFrames((f) => [...f, frame]);
          send(merchant, { type: RELAY, frames: [frame] });
        }
        return;
      }
      if (data?.type === PHONE_EVENT && isPhoneEventKey(data.key)) {
        const event: PhoneEvent = { type: PHONE_EVENT, key: data.key, chips: safeChips(data.chips), data: typeof data.data === 'object' && data.data !== null ? (data.data as Record<string, unknown>) : undefined, at: Date.now() };
        if (event.key === 'edge') {
          const d = event.data ?? {};
          const str = (v: unknown) => (typeof v === 'string' ? v : null);
          const edge: StageEdge = { kind: str(d.kind) ?? '', from: str(d.from) ?? '', to: str(d.to) ?? '', amountMicro: str(d.amountMicro) ?? '0', orderId: str(d.orderId), ref: str(d.ref) ?? '', ts: Number(d.ts) || 0, settlementTx: str(d.settlementTx), entityKey: str(d.entityKey), arkivTx: str(d.arkivTx), at: event.at };
          setEdges((e) => (e.some((x) => x.ref === edge.ref && x.kind === edge.kind) ? e : [...e, edge]));
          return;
        }
        setEvents((list) => [...list, event]);
        send(fromCustomer ? merchant : customer, { type: RELAY, events: [event] });
        // Each phone event moves the middle exactly once: the first of its scene enters it.
        if (event.key === 'refund-start') setQueued('refund', true);
        if (event.key === 'pause-start') setQueued('pause', true);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [customer, merchant, send]);

  // The keys: arrows (or a clicker) browse 7 to 10 and back; Esc returns the display to scene 0.
  const lastDemo = useRef<BeatKey>('film');
  if (!BROWSE_BEATS.includes(beat)) lastDemo.current = beat;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const next = ['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key);
      const back = ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key);
      if (e.key === 'Escape') {
        setOverride({ beat: 'film', at: Date.now() });
        setQueued(null);
        return;
      }
      if (!next && !back) return;
      if (inFlight) return;
      e.preventDefault();
      const i = BROWSE_BEATS.indexOf(beat);
      if (next) {
        const to = i < 0 ? BROWSE_BEATS[0] : BROWSE_BEATS[Math.min(i + 1, BROWSE_BEATS.length - 1)];
        if (to && to !== beat) setOverride({ beat: to, at: Date.now() });
      } else if (i > 0) setOverride({ beat: BROWSE_BEATS[i - 1]!, at: Date.now() });
      else if (i === 0) setOverride({ beat: lastDemo.current, at: Date.now() });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [beat, inFlight]);

  const value = useMemo<DirectorState>(() => ({ beat, scene: beatOf(beat).scene, beatAt, pace, model, frames, events, edges, inFlight }), [beat, beatAt, pace, model, frames, events, edges, inFlight]);
  return <DirectorContext.Provider value={value}>{children}</DirectorContext.Provider>;
}

export const sceneCount = new Set(BEATS.map((b) => b.scene)).size;
export const reached = (current: BeatKey, key: BeatKey) => beatIndex(current) >= beatIndex(key);
