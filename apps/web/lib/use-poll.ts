'use client';

// Polling over HTTPS (ADR-0055). Pauses while the tab is hidden or the element it
// feeds is not displayed (the stage hides on phones), backs off after errors.

import { useEffect, useRef, useState, type RefObject } from 'react';

export type PollState<T> =
  | { status: 'loading' }
  | { status: 'ok'; data: T; at: number }
  | { status: 'error'; httpStatus: number | null; body: unknown; at: number };

export function usePoll<T>(url: string | null, intervalMs: number, visibleRef?: RefObject<HTMLElement | null>): PollState<T> {
  const [state, setState] = useState<PollState<T>>({ status: 'loading' });
  const failures = useRef(0);

  useEffect(() => {
    if (!url) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    const visible = () => {
      if (document.visibilityState !== 'visible') return false;
      const el = visibleRef?.current;
      return !el || typeof el.checkVisibility !== 'function' || el.checkVisibility();
    };

    const tick = async () => {
      if (stopped) return;
      if (visible()) {
        try {
          const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
          const body: unknown = await res.json().catch(() => null);
          if (stopped) return;
          if (res.ok) {
            failures.current = 0;
            setState({ status: 'ok', data: body as T, at: Date.now() });
          } else {
            failures.current += 1;
            setState({ status: 'error', httpStatus: res.status, body, at: Date.now() });
          }
        } catch {
          if (stopped) return;
          failures.current += 1;
          setState({ status: 'error', httpStatus: null, body: null, at: Date.now() });
        }
      }
      const backoff = Math.min(intervalMs * 2 ** Math.min(failures.current, 4), 60_000);
      timer = setTimeout(tick, failures.current > 0 ? backoff : intervalMs);
    };

    void tick();
    return () => {
      stopped = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [url, intervalMs, visibleRef]);

  return state;
}

// The milestone a 503 "not live yet" answer is waiting for, if that is what it is.
export function waitingForOf(state: PollState<unknown>): string | null {
  if (state.status !== 'error' || state.httpStatus !== 503) return null;
  const body = state.body as { error?: unknown; waitingFor?: unknown } | null;
  return body?.error === 'not live yet' && typeof body.waitingFor === 'string' ? body.waitingFor : null;
}
