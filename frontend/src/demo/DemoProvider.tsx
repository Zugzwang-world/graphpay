import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode } from 'react';
import type { DemoAdapter, DemoEvent, DemoSnapshot } from './contract';
import { domainReducer, initialDomain } from './state';

/**
 * Owns the adapter and the shared domain state. Pages read the snapshot with
 * `useDemo()` and react to raw events with `useDemoEvents()` for their own
 * reducers (for example the chat thread). Components never call the network.
 */

interface DemoContextValue {
  adapter: DemoAdapter;
  snapshot: DemoSnapshot | null;
  ready: boolean;
  /** Increments on every reset, so page state keyed on it starts fresh. */
  generation: number;
  subscribe(listener: (e: DemoEvent) => void): () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ adapter, children }: { adapter: DemoAdapter; children: ReactNode }) {
  const [state, dispatch] = useReducer(domainReducer, initialDomain);
  const generationRef = useRef(0);
  const [, force] = useReducer((n: number) => n + 1, 0);
  const listeners = useRef(new Set<(e: DemoEvent) => void>());

  useEffect(() => {
    let alive = true;
    const load = () =>
      adapter.getSnapshot().then((s) => {
        if (alive) dispatch({ type: 'snapshot', snapshot: s });
      });
    void load();
    const off = adapter.subscribe((event) => {
      if (event.type === 'demo.reset') {
        generationRef.current++;
        force();
        void load();
      } else {
        dispatch({ type: 'event', event });
      }
      for (const l of [...listeners.current]) l(event);
    });
    const tick = setInterval(() => dispatch({ type: 'tick', now: Date.now() }), 30_000);
    return () => {
      alive = false;
      off();
      clearInterval(tick);
    };
  }, [adapter]);

  const subscribe = useRef((l: (e: DemoEvent) => void) => {
    listeners.current.add(l);
    return () => {
      listeners.current.delete(l);
    };
  }).current;

  const value: DemoContextValue = {
    adapter,
    snapshot: state.snapshot,
    ready: state.ready,
    generation: generationRef.current,
    subscribe,
  };

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemo must be used inside <DemoProvider>');
  return ctx;
}

/** The adapter, for calling actions. */
export function useAdapter(): DemoAdapter {
  return useDemo().adapter;
}

/** Listen to raw adapter events. The latest listener is always used. */
export function useDemoEvents(listener: (e: DemoEvent) => void): void {
  const { subscribe } = useDemo();
  const ref = useRef(listener);
  ref.current = listener;
  useEffect(() => subscribe((e) => ref.current(e)), [subscribe]);
}
