import type { DemoAdapter } from './contract';
import { MockAdapter } from './mock-adapter';

/**
 * Chooses the adapter. Only the mock exists in this baseline; a live adapter
 * is plugged in here later by setting VITE_DEMO_MODE=live (a mode flag, not a
 * secret) without touching any component.
 */
export function createAdapter(): DemoAdapter {
  const mode = import.meta.env.VITE_DEMO_MODE ?? 'mock';
  if (mode !== 'mock') console.warn(`[demo] mode "${mode}" has no adapter yet; using the mock.`);
  const mock = new MockAdapter({ debug: import.meta.env.DEV && new URLSearchParams(location.search).has('debug') });
  if (import.meta.env.DEV) (globalThis as { __demo?: MockAdapter }).__demo = mock;
  return mock;
}

export * from './contract';
export { MockAdapter } from './mock-adapter';
export { DemoProvider, useDemo, useAdapter, useDemoEvents } from './DemoProvider';
