// The website's own server routes (WEBSITE_SPEC.md §7) with their gates. The
// passcode list is acceptance F2's route table: each one answers 401 without the
// passcode and sends nothing. `waitingFor` names the milestone whose code a route
// calls; the route answers 503 "not live yet" until that code is wired in.

export type Gate = 'passcode' | 'rate limit' | 'open';

export interface SiteRoute {
  method: 'GET' | 'POST';
  path: string;
  gate: Gate;
  does: string;
  signs: string | null;
  waitingFor: string | null;
}

export const SITE_ROUTES: SiteRoute[] = [
  { method: 'POST', path: '/api/agents/run', gate: 'passcode', does: 'start one errand (one at a time) and stream its events (SSE)', signs: 'the payer agent, then the relayer', waitingFor: 'M12 live wiring of the agents (Join)' },
  { method: 'GET', path: '/api/agents/run/:id/events', gate: 'open', does: 'replay a run held by this server (best effort; the POST streams it live)', signs: null, waitingFor: null },
  { method: 'GET', path: '/api/state/customer', gate: 'open', does: "the payer agent's status, cap, spend, last order, subscription", signs: null, waitingFor: null },
  { method: 'POST', path: '/api/customer/reorder', gate: 'passcode', does: 're-order from the same shop', signs: 'the payer agent, then the relayer', waitingFor: "the payer agent's key on this server (the Coordinator sets it in Vercel)" },
  { method: 'POST', path: '/api/customer/refund-request', gate: 'passcode', does: 'record a refund request on Arkiv', signs: 'the recorder (W_SYNC)', waitingFor: "the recorder's key on this server (the Coordinator sets it in Vercel)" },
  { method: 'POST', path: '/api/customer/subscribe', gate: 'passcode', does: 'subscribe to the weekly box (or the demo period)', signs: 'the payer agent, then the relayer', waitingFor: 'M4 checkout' },
  { method: 'POST', path: '/api/customer/unsubscribe', gate: 'passcode', does: 'cancel the subscription', signs: 'the payer agent, then the relayer', waitingFor: 'M4 checkout' },
  { method: 'POST', path: '/api/customer/pause', gate: 'passcode', does: "set the payer agent's ENS status to paused", signs: 'the owner (Sepolia)', waitingFor: 'the owner\'s key on this server (the Coordinator sets it in Vercel)' },
  { method: 'POST', path: '/api/customer/resume', gate: 'passcode', does: "set the payer agent's ENS status back to active", signs: 'the owner (Sepolia)', waitingFor: 'the owner\'s key on this server (the Coordinator sets it in Vercel)' },
  { method: 'POST', path: '/api/customer/kill-disposable', gate: 'passcode', does: 'provision, pay with and unregister a disposable agent', signs: 'the owner, the disposable agent, the relayer', waitingFor: 'M6 ENS kill switch' },
  { method: 'GET', path: '/api/merchant/events', gate: 'open', does: "stream the shop's new edges (SSE, polled from GraphQL)", signs: null, waitingFor: null },
  { method: 'POST', path: '/api/merchant/dispatch', gate: 'passcode', does: 'mark the order delivered', signs: 'the merchant', waitingFor: "the shop's key on this server (the Coordinator sets it in Vercel)" },
  { method: 'POST', path: '/api/merchant/open', gate: 'passcode', does: "list the shop as open on Arkiv (renewed every 5 min while on) or take it off", signs: 'W_DIRECTORY (Arkiv)', waitingFor: 'the W_DIRECTORY key on this server (the Coordinator sets it in Vercel)' },
  { method: 'POST', path: '/api/merchant/refund', gate: 'passcode', does: 'partial or full refund', signs: 'the merchant', waitingFor: "the shop's key on this server (the Coordinator sets it in Vercel)" },
  { method: 'GET', path: '/api/merchant/export.csv', gate: 'open', does: "the accountant's CSV from GraphQL", signs: null, waitingFor: null },
  { method: 'GET', path: '/api/race', gate: 'rate limit', does: 'one side of the race, live and uncached (SSE)', signs: null, waitingFor: null },
  { method: 'GET', path: '/api/map', gate: 'open', does: 'the shop directory, open shops and agents at work, from the graph', signs: null, waitingFor: null },
  { method: 'GET', path: '/api/status', gate: 'open', does: 'block heads, mirror lag, relayer balance, token mode', signs: null, waitingFor: null },
  { method: 'POST', path: '/api/passcode', gate: 'passcode', does: 'check the passcode (signs nothing)', signs: null, waitingFor: null },
];

export const PASSCODE_ROUTES = SITE_ROUTES.filter((r) => r.gate === 'passcode');

export function waitingFor(path: string): string {
  const route = SITE_ROUTES.find((r) => r.path === path);
  if (!route?.waitingFor) throw new Error(`no pending source for ${path}`);
  return route.waitingFor;
}
