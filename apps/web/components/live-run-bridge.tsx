'use client';

// The run bridge on /live: the customer phone (its own page in an iframe) posts each
// frame of its errand stream here, and the explainer replays it from the shared run
// state, exactly as T5's own customer screen feeds it. Only same-origin messages from
// the phone pages are read; nothing here calls the network.

import { useEffect, useRef } from 'react';
import type { RunResult, RunStarted, TraceEvent } from '@/lib/contracts';
import { useSite } from './site-context';

// The message the phone posts (apps/phones/src/live-adapter.ts).
export const RUN_FRAME = 'graphpay.run-frame';

export function LiveRunBridge() {
  const { setRun, sound } = useSite();
  // Kept across re-renders (sound settings change `sound`), so a run in progress is never lost.
  const current = useRef<string | null>(null);
  useEffect(() => {
    const onMessage = (msg: MessageEvent) => {
      if (msg.origin !== window.location.origin) return;
      const frame = msg.data as { type?: unknown; event?: unknown; data?: unknown } | null;
      if (frame?.type !== RUN_FRAME || typeof frame.event !== 'string' || typeof frame.data !== 'string') return;
      try {
        if (frame.event === 'started') {
          const id = (JSON.parse(frame.data) as RunStarted).runId;
          current.current = id;
          setRun(() => ({ runId: id, events: [], result: null, startedAt: Date.now() }));
        } else if (frame.event === 'trace') {
          const trace = JSON.parse(frame.data) as TraceEvent;
          setRun((prev) => (prev.runId === current.current ? { ...prev, events: [...prev.events, trace] } : prev));
        } else if (frame.event === 'result') {
          const result = JSON.parse(frame.data) as RunResult;
          setRun((prev) => (prev.runId === current.current ? { ...prev, result } : prev));
          if (result.status === 'paid') sound('settled');
        }
      } catch {
        // a frame that is not JSON is skipped
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [setRun, sound]);
  return null;
}
