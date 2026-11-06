// The website's own server routes (WEBSITE_SPEC.md §7) with their gates. `visitor`
// routes are open to every visitor while the config's site.publicAccess is true (ADR-0069,
// the founder) and need the passcode when it is closed (GRAPHPAY_PUBLIC_ACCESS=0): then each
// answers 401 without it and sends nothing (acceptance F2 in the gated mode). `waitingFor` names the milestone whose code a route
// calls; the route answers 503 "not live yet" until that code is wired in.

export type Gate = 'visitor' | 'rate limit' | 'open';

export interface SiteRoute {
  method: 'GET' | 'POST';
  path: string;
  gate: Gate;
  does: string;
  signs: string | null;
  waitingFor: string | null;
}

export const SITE_ROUTES: SiteRoute[] = [
  { method: 'POST', path: '/api/agents/run', gate: 'visitor', does: 'start one errand (one at a time) and stream its events (SSE)', signs: 'the payer agent, then the relayer', waitingFor: "the live runner's server settings (Join)" },
  { method: 'GET', path: '/api/agents/run/:id/events', gate: 'open', does: 'replay a run held by this server (best effort; the POST streams it live)', signs: null, waitingFor: null },
  { method: 'GET', path: '/api/state/customer', gate: 'open', does: "the payer agent's status, cap, spend, last order, subscription", signs: null, waitingFor: null },
  { method: 'GET', path: '/api/state/heal', gate: 'open', does: "self-healing: each pausable agent's status and when a paused one resumes, the shop's listing and when a closed one reopens", signs: null, waitingFor: null },
  { method: 'POST', path: '/api/customer/reorder', gate: 'visitor', does: 're-order from the same shop', signs: 'the payer agent, then the relayer', waitingFor: "the payer agent's key on this server (the Coordinator sets it in Vercel)" },
  { method: 'POST', path: '/api/customer/refund-request', gate: 'visitor', does: 'record a refund request on Arkiv', signs: 'the recorder (W_SYNC)', waitingFor: "the recorder's key on this server (the Coordinator sets it in Vercel)" },
  { method: 'POST', path: '/api/customer/subscribe', gate: 'visitor', does: 'subscribe to the weekly box (or the demo period)', signs: 'the payer agent, then the relayer', waitingFor: 'M4 checkout' },
  { method: 'POST', path: '/api/customer/unsubscribe', gate: 'visitor', does: 'cancel the subscription', signs: 'the payer agent, then the relayer', waitingFor: 'M4 checkout' },
  { method: 'POST', path: '/api/customer/pause', gate: 'visitor', does: "set the tapped agent's ENS status to paused ({ agent }: a buyer agent with a spending pass; none named is the payer); the cron resumes it after 2 min", signs: 'the owner (Sepolia)', waitingFor: 'the owner\'s key on this server (the Coordinator sets it in Vercel)' },
  { method: 'POST', path: '/api/customer/resume', gate: 'visitor', does: "set the tapped agent's ENS status back to active ({ agent }, as for pause)", signs: 'the owner (Sepolia)', waitingFor: 'the owner\'s key on this server (the Coordinator sets it in Vercel)' },
  { method: 'POST', path: '/api/customer/kill-disposable', gate: 'visitor', does: 'provision, pay with and unregister a disposable agent', signs: 'the owner, the disposable agent, the relayer', waitingFor: 'M6 ENS kill switch' },
  { method: 'GET', path: '/api/merchant/events', gate: 'open', does: "stream the shop's new edges (SSE, polled from GraphQL)", signs: null, waitingFor: null },
  { method: 'POST', path: '/api/merchant/dispatch', gate: 'visitor', does: 'mark the order delivered', signs: 'the merchant', waitingFor: "the shop's key on this server (the Coordinator sets it in Vercel)" },
  { method: 'POST', path: '/api/merchant/open', gate: 'visitor', does: "list the shop as open on Arkiv (renewed every 5 min while on) or take it off", signs: 'W_DIRECTORY (Arkiv)', waitingFor: 'the W_DIRECTORY key on this server (the Coordinator sets it in Vercel)' },
  { method: 'POST', path: '/api/merchant/refund', gate: 'visitor', does: 'partial or full refund', signs: 'the merchant', waitingFor: "the shop's key on this server (the Coordinator sets it in Vercel)" },
  { method: 'GET', path: '/api/merchant/export.csv', gate: 'open', does: "the accountant's CSV from GraphQL", signs: null, waitingFor: null },
  { method: 'GET', path: '/api/race', gate: 'rate limit', does: 'one side of the race, live and uncached (SSE)', signs: null, waitingFor: null },
  { method: 'GET', path: '/api/map', gate: 'open', does: 'the shop directory, open shops and agents at work, from the graph', signs: null, waitingFor: null },
  { method: 'GET', path: '/api/status', gate: 'open', does: 'block heads, mirror lag, relayer balance, token mode', signs: null, waitingFor: null },
  { method: 'POST', path: '/api/passcode', gate: 'visitor', does: 'check the passcode (signs nothing)', signs: null, waitingFor: null },
];

// The routes behind the passcode when public access is closed.
export const PASSCODE_ROUTES = SITE_ROUTES.filter((r) => r.gate === 'visitor');

export function waitingFor(path: string): string {
  const route = SITE_ROUTES.find((r) => r.path === path);
  if (!route?.waitingFor) throw new Error(`no pending source for ${path}`);
  return route.waitingFor;
}
