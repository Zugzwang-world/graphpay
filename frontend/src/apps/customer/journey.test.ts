import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockAdapter } from '@/demo/mock-adapter';
import { story } from '@/data/story';
import type { DemoEvent } from '@/demo/contract';
import { customerJourneyReducer, initialCustomerJourney } from './journey';

const prompt = story.quickPrompts.find((item) => item.kind === 'ask')!.text;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-06T14:00:00Z'));
});
afterEach(() => vi.useRealTimers());

function journey() {
  const adapter = new MockAdapter();
  let state = initialCustomerJourney;
  const events: DemoEvent[] = [];
  adapter.subscribe((event) => {
    events.push(event);
    state = customerJourneyReducer(state, { kind: 'event', event });
  });
  const send = async () => {
    state = customerJourneyReducer(state, { kind: 'send', text: prompt, at: Date.now() });
    await adapter.sendPrompt(prompt);
  };
  return { adapter, send, get state() { return state; }, events };
}

describe('F5 customer journey presentation', () => {
  it('shows the closed-shop refusal without a quote or shop card', async () => {
    const run = journey();
    await run.send();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(run.state.running).toBe(false);
    expect(run.state.quote).toBeNull();
    expect(run.state.items.some((item) => item.kind === 'shops' && item.choices.some((choice) => choice.shop.ens === story.shop.ens))).toBe(false);
    expect(run.state.items.some((item) => item.kind === 'refused')).toBe(true);
  });

  it('renders the graph, trap rejection, quote sheet and paid receipt from the adapter events', async () => {
    const run = journey();
    await run.adapter.setShopOpen(true);
    await vi.advanceTimersByTimeAsync(500);
    await run.send();
    await vi.advanceTimersByTimeAsync(8_000);
    expect(run.state.sheetOpen).toBe(true);
    expect(run.state.quote?.phase).toBe('quoted');
    expect(run.state.items.some((item) => item.kind === 'graph' && item.shops !== null)).toBe(true);
    expect(run.state.items.some((item) => item.kind === 'shops' && item.choices.some((choice) => choice.verdict === 'rejected' && Boolean(choice.reason)))).toBe(true);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(run.state.quote?.phase).toBe('paid');
    expect(run.state.quote?.links).toHaveLength(1);
    expect(run.state.running).toBe(false);
    expect(run.state.items.some((item) => item.kind === 'quote' && item.phase === 'paid')).toBe(true);
  });

  it('keeps the same quote card during silent re-quote and shows failure if the shop closes before signature', async () => {
    const run = journey();
    await run.adapter.setShopOpen(true);
    await vi.advanceTimersByTimeAsync(500);
    await run.send();
    await vi.advanceTimersByTimeAsync(8_000);
    const quote = run.state.quote?.event;
    expect(quote).toBeDefined();
    const count = run.state.items.filter((item) => item.kind === 'quote').length;
    const revised = { ...quote!, validUntil: quote!.validUntil + 60_000 };
    const afterRequote = customerJourneyReducer(run.state, { kind: 'event', event: revised });
    expect(afterRequote.items.filter((item) => item.kind === 'quote')).toHaveLength(count);
    expect(afterRequote.quote?.event.validUntil).toBe(revised.validUntil);
    await run.adapter.setShopOpen(false);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(run.state.quote?.phase).toBe('failed');
    expect(run.state.quote?.failure).toBeTruthy();
    expect(run.state.running).toBe(false);
  });
});
