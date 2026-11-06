/**
 * The domain reducer: snapshot + events → the state both phones render
 * (DESIGN_INSTRUCTIONS.md 11). A status changes when its event arrives, never
 * when a button is pressed. The same reducer works for a live adapter.
 */
import type { AgentState, DemoEvent, DemoSnapshot, Order, Renewal } from './contract';
import { add } from '@/lib/money';
import { passState } from './rules';

export interface DomainState {
  ready: boolean;
  snapshot: DemoSnapshot | null;
}

export const initialDomain: DomainState = { ready: false, snapshot: null };

export type DomainAction = { type: 'snapshot'; snapshot: DemoSnapshot } | { type: 'event'; event: DemoEvent } | { type: 'tick'; now: number };

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const next = list.slice();
  next[i] = item;
  return next;
}

function mapAgent(s: DemoSnapshot, ens: string, fn: (a: AgentState) => AgentState): DemoSnapshot {
  return { ...s, agents: s.agents.map((a) => (a.ref.ens === ens ? refreshPass(fn(a), s.now) : a)) };
}

function refreshPass(a: AgentState, now: number): AgentState {
  return a.pass ? { ...a, pass: { ...a.pass, state: passState(a.pass, a.status, now) } } : a;
}

/** An order moving to paid adds its total to its agent's pass usage. */
function applyOrder(s: DemoSnapshot, order: Order): DemoSnapshot {
  const prev = s.orders.find((o) => o.id === order.id);
  const newlyPaid = order.status !== 'ordered' && (!prev || prev.status === 'ordered');
  let next: DemoSnapshot = { ...s, orders: upsert(s.orders, order) };
  if (newlyPaid) {
    next = mapAgent(next, order.buyer.ens, (a) => (a.pass ? { ...a, pass: { ...a.pass, used: add(a.pass.used, order.total) } } : a));
  }
  return next;
}

function applyRenewal(s: DemoSnapshot, r: Renewal): DemoSnapshot {
  return { ...s, renewals: upsert(s.renewals, r) };
}

export function applyEvent(s: DemoSnapshot, e: DemoEvent): DemoSnapshot {
  switch (e.type) {
    case 'order.updated':
      return applyOrder(s, e.order);
    case 'renewal.created':
    case 'renewal.charged':
    case 'renewal.cancelled':
      return applyRenewal(s, e.renewal);
    case 'agent.permission':
      return mapAgent(s, e.agent.ens, (a) => ({
        ...a,
        status: e.change === 'paused' ? 'paused' : e.change === 'revoked' ? 'revoked' : 'active',
      }));
    case 'agent.cap.changed':
      return mapAgent(s, e.agent.ens, (a) => (a.pass ? { ...a, pass: { ...a.pass, cap: e.cap } } : a));
    case 'agent.pass.period':
      return mapAgent(s, e.agent.ens, (a) => (a.pass ? { ...a, pass: { ...a.pass, used: e.used, expiresAt: e.expiresAt } } : a));
    case 'cap.change.refused':
      return mapAgent(s, e.agent.ens, (a) => ({
        ...a,
        refusedAttempts: [
          ...a.refusedAttempts,
          { id: `ra-${a.refusedAttempts.length}-cap`, kind: 'cap_change', reason: 'cap_change', attempted: e.attempted, at: s.now, links: e.links },
        ],
      }));
    case 'payment.refused':
      if (!e.agent || !s.agents.some((a) => a.ref.ens === e.agent?.ens)) return s;
      return mapAgent(s, e.agent.ens, (a) => ({
        ...a,
        refusedAttempts: [
          ...a.refusedAttempts,
          { id: `ra-${a.refusedAttempts.length}-pay`, kind: 'payment', reason: e.reason, attempted: e.attempted, at: s.now, links: e.links },
        ],
      }));
    case 'shop.status':
      return { ...s, shop: { ...s.shop, open: e.open } };
    default:
      return s;
  }
}

export function domainReducer(state: DomainState, action: DomainAction): DomainState {
  switch (action.type) {
    case 'snapshot':
      return { ready: true, snapshot: action.snapshot };
    case 'tick':
      if (!state.snapshot) return state;
      return { ...state, snapshot: { ...state.snapshot, now: action.now, agents: state.snapshot.agents.map((a) => refreshPass(a, action.now)) } };
    case 'event':
      if (!state.snapshot) return state;
      return { ...state, snapshot: applyEvent({ ...state.snapshot, now: Date.now() }, action.event) };
  }
}
