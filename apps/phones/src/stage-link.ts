// The phone's side of the stage link (apps/web/lib/stage/messages.ts): what this phone posts to the
// stage on /live, and the scene and relayed data the stage sends back. A phone opened on its own (no
// stage around it) posts nothing and paces itself.

import { useEffect, useState } from 'react';
import { HELLO, PHONE_EVENT, RELAY, RUN_FRAME, SCENE, isPhoneEventKey, type Chip, type PhoneEvent, type PhoneEventKey, type RelayMessage, type SceneMessage } from '../../web/lib/stage/messages.ts';
import { isBeatKey } from '../../web/lib/stage/scenes.ts';

export const embedded = typeof window !== 'undefined' && window.parent !== window;

function post(message: unknown): void {
  if (embedded) window.parent.postMessage(message, window.location.origin);
}

export function postFrame(event: string, data: string): void {
  post({ type: RUN_FRAME, event, data });
}

export function postEvent(key: PhoneEventKey, chips: Chip[] = [], data?: Record<string, unknown>): void {
  post({ type: PHONE_EVENT, key, chips, data, at: Date.now() } satisfies PhoneEvent);
}

export interface Frame {
  event: string;
  data: string;
  at: number;
}

export interface StageView {
  scene: SceneMessage | null;
  // Frames and events relayed from the other side of the stage.
  frames: Frame[];
  events: PhoneEvent[];
}

const sameOrigin = (msg: MessageEvent) => msg.origin === window.location.origin && msg.source === window.parent;

export function useStage(app: 'customer' | 'merchant'): StageView {
  const [view, setView] = useState<StageView>({ scene: null, frames: [], events: [] });
  useEffect(() => {
    if (!embedded) return;
    const onMessage = (msg: MessageEvent) => {
      if (!sameOrigin(msg)) return;
      const data = msg.data as { type?: unknown } | null;
      if (data?.type === SCENE) {
        const s = data as SceneMessage;
        if (typeof s.scene === 'number' && isBeatKey(s.beat) && typeof s.step === 'number') setView((v) => ({ ...v, scene: { type: SCENE, scene: s.scene, beat: s.beat, step: s.step, runId: typeof s.runId === 'string' ? s.runId : null } }));
      } else if (data?.type === RELAY) {
        const r = data as RelayMessage;
        const frames = Array.isArray(r.frames) ? r.frames.filter((f) => typeof f?.event === 'string' && typeof f.data === 'string' && typeof f.at === 'number') : [];
        const events = Array.isArray(r.events) ? r.events.filter((e) => isPhoneEventKey(e?.key)) : [];
        setView((v) => ({ ...v, frames: r.replace ? frames : [...v.frames, ...frames], events: r.replace ? events : [...v.events, ...events] }));
      }
    };
    window.addEventListener('message', onMessage);
    post({ type: HELLO, app });
    return () => window.removeEventListener('message', onMessage);
  }, [app]);
  return view;
}

// A clock that ticks, for ages ("12 s ago") and the phone's own pacing.
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
