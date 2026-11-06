import type { AgentActivity, AgentRef, DemoEvent, Link, ShopChoice } from '@/demo/contract';
import { agentByEns, story } from '@/data/story';
import { copy, fill } from '@/copy';

type QuoteEvent = Extract<DemoEvent, { type: 'quote.created' }>;
type Phase = 'quoted' | 'signed' | 'paid' | 'failed';

export type ThreadItem =
  | { kind: 'user'; id: number; text: string; at: number }
  | { kind: 'agent'; id: number; agent: AgentRef; text: string; status: AgentActivity; working: boolean; reason?: string; links: Link[]; errandId?: string }
  | { kind: 'graph'; id: number; reads: number; shops: number | null; links: Link[]; errandId?: string }
  | { kind: 'shops'; id: number; choices: ShopChoice[]; errandId?: string }
  | { kind: 'quote'; id: number; orderId: string; shop: string; phase: Phase }
  | { kind: 'refused'; id: number; reason: string; links: Link[]; errandId?: string };

export interface QuoteView { event: QuoteEvent; phase: Phase; links: Link[]; failure?: string }
export interface CustomerJourneyState {
  items: ThreadItem[];
  nextId: number;
  running: boolean;
  lastPrompt: string | null;
  error: { message: string; recoverable: boolean } | null;
  quote: QuoteView | null;
  sheetOpen: boolean;
  selectedOrderId: string | null;
}

export const initialCustomerJourney: CustomerJourneyState = {
  items: [], nextId: 1, running: false, lastPrompt: null, error: null,
  quote: null, sheetOpen: false, selectedOrderId: null,
};

export type JourneyAction =
  | { kind: 'send'; text: string; at: number }
  | { kind: 'retry' }
  | { kind: 'sheet'; open: boolean }
  | { kind: 'selectOrder'; orderId: string | null }
  | { kind: 'localError'; message: string }
  | { kind: 'event'; event: DemoEvent };

function lastAgentIndex(items: ThreadItem[], agent: AgentRef, errandId?: string): number {
  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index];
    if (item?.kind === 'agent' && item.agent.ens === agent.ens && item.errandId === errandId) return index;
  }
  return -1;
}

function updateQuoteItem(items: ThreadItem[], orderId: string, phase: Phase): ThreadItem[] {
  return items.map((item) => item.kind === 'quote' && item.orderId === orderId ? { ...item, phase } : item);
}

/** All C1–C3 thread and quote phases are derived from local send and adapter events. */
export function customerJourneyReducer(state: CustomerJourneyState, action: JourneyAction): CustomerJourneyState {
  if (action.kind === 'send') return {
    ...state, items: [...state.items, { kind: 'user', id: state.nextId, text: action.text, at: action.at }],
    nextId: state.nextId + 1, lastPrompt: action.text, running: true, error: null,
  };
  if (action.kind === 'retry') return { ...state, running: true, error: null };
  if (action.kind === 'sheet') return { ...state, sheetOpen: action.open };
  if (action.kind === 'selectOrder') return { ...state, selectedOrderId: action.orderId, sheetOpen: false };
  if (action.kind === 'localError') return { ...state, running: false, error: { message: action.message, recoverable: true } };

  const event = action.event;
  switch (event.type) {
    case 'agent.status': {
      const index = lastAgentIndex(state.items, event.agent, event.errandId);
      if (event.status === 'thinking') {
        const name = agentByEns(event.agent.ens)?.label ?? event.agent.role;
        const lines = (copy.customer.desk.working as Record<string, readonly string[]>)[event.agent.role] ?? copy.customer.desk.working.default;
        const text = fill(lines[0] ?? '', { agent: name, area: story.shop.area });
        return { ...state, items: [...state.items, { kind: 'agent', id: state.nextId, agent: event.agent, text, status: 'thinking', working: true, links: [], errandId: event.errandId }], nextId: state.nextId + 1 };
      }
      if (index < 0) return state;
      return { ...state, items: state.items.map((item, itemIndex) => itemIndex === index && item.kind === 'agent' ? { ...item, status: event.status, reason: event.reason, links: event.links ?? item.links } : item) };
    }
    case 'agent.message': {
      const index = lastAgentIndex(state.items, event.agent, event.errandId);
      const previous = state.items[index];
      if (previous?.kind === 'agent' && previous.working) {
        return { ...state, items: state.items.map((item, itemIndex) => itemIndex === index && item.kind === 'agent' ? { ...item, text: event.text, working: false } : item) };
      }
      const status = previous?.kind === 'agent' ? previous.status : 'idle';
      return { ...state, items: [...state.items, { kind: 'agent', id: state.nextId, agent: event.agent, text: event.text, status, working: false, links: [], errandId: event.errandId }], nextId: state.nextId + 1 };
    }
    case 'graph.read':
      return { ...state, items: [...state.items, { kind: 'graph', id: state.nextId, reads: event.reads, shops: null, links: event.links, errandId: event.errandId }], nextId: state.nextId + 1 };
    case 'shops.compared':
      return {
        ...state,
        items: [...state.items.map((item) => item.kind === 'graph' && item.errandId === event.errandId ? { ...item, shops: event.choices.length } : item), ...(event.choices.length ? [{ kind: 'shops' as const, id: state.nextId, choices: event.choices, errandId: event.errandId }] : [])],
        nextId: state.nextId + (event.choices.length ? 1 : 0),
      };
    case 'quote.created': {
      const sameOrder = state.quote?.event.orderId === event.orderId;
      return {
        ...state,
        quote: { event, phase: 'quoted', links: [] }, sheetOpen: sameOrder ? state.sheetOpen : true,
        items: sameOrder ? updateQuoteItem(state.items, event.orderId, 'quoted') : [...state.items, { kind: 'quote', id: state.nextId, orderId: event.orderId, shop: event.shop.name, phase: 'quoted' }],
        nextId: state.nextId + (sameOrder ? 0 : 1),
      };
    }
    case 'payment.signed':
      if (state.quote?.event.orderId !== event.orderId) return state;
      return { ...state, quote: { ...state.quote, phase: 'signed' }, items: updateQuoteItem(state.items, event.orderId, 'signed') };
    case 'payment.settled':
      return { ...state, running: false, quote: state.quote?.event.orderId === event.orderId ? { ...state.quote, phase: 'paid', links: event.links } : state.quote, items: updateQuoteItem(state.items, event.orderId, 'paid') };
    case 'payment.refused': {
      const reason = copy.refusal[event.reason];
      const failedQuote = Boolean(event.orderId && state.quote?.event.orderId === event.orderId);
      return {
        ...state, running: false,
        quote: failedQuote && state.quote ? { ...state.quote, phase: 'failed', failure: reason, links: event.links } : state.quote,
        items: [...(failedQuote && event.orderId ? updateQuoteItem(state.items, event.orderId, 'failed') : state.items), { kind: 'refused', id: state.nextId, reason, links: event.links, errandId: event.errandId }],
        nextId: state.nextId + 1,
      };
    }
    case 'error':
      return { ...state, running: false, error: { message: event.message, recoverable: event.recoverable } };
    case 'demo.reset':
      return initialCustomerJourney;
    default:
      return state;
  }
}
