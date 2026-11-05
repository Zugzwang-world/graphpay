// Presence and handoffs (planning/EVENT_ADDENDUM.md A7, A8; MASTER_PLAN §4 item 2).
// Two optional hooks on LiveHooks, no-ops when absent:
//   presence(phase, { agentEns, ownerEns, role, session })   phase: 'start' | 'renew'
//   handoff(from, to, step, { requestId })                   requestId = the run id
// The log tells us when an agent starts and when a message crosses between two
// agents; this module turns those into hook calls. A hook never blocks or fails
// an agent step: calls are fire and forget, errors are scrubbed into the log.
// Names come from the cast, never typed here (ADR-0047).

import { errorText } from './scrub.mjs';

// The explainer's lanes: Ask → Check → Check back → 402 quote → Pay (addendum D).
export const STEPS = Object.freeze({ ask: 'ask', check: 'check', checkBack: 'check-back', quote: 'quote', pay: 'pay' });

// A renewal well inside the 15 minute presence expiry (A7).
export const PRESENCE_RENEW_MS = 5 * 60_000;

function clip(text, max = 160) {
  const t = String(text);
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

// options: { hooks, cast, log, runId, renewMs, setTimer, clearTimer }. Without
// either hook, `observe` is a no-op and no timer ever starts.
export function createActivity({ hooks, cast, log, runId, renewMs = PRESENCE_RENEW_MS, setTimer = setInterval, clearTimer = clearInterval }) {
  const wantsPresence = typeof hooks?.presence === 'function';
  const wantsHandoff = typeof hooks?.handoff === 'function';
  const started = new Map(); // agent ens -> presence info
  let timer = null;
  let closed = false;

  // Shop-team agents belong to their shop; every buyer-side agent belongs to the persona.
  const shopOf = new Map();
  for (const shop of cast.shops) for (const ens of Object.values(shop.agents)) shopOf.set(ens, shop.ens);
  const buyerAgents = new Set([...Object.values(cast.buyer), ...Object.values(cast.payers).map((p) => p.ens)]);
  const ownerOf = (ens) => shopOf.get(ens) ?? (buyerAgents.has(ens) ? cast.persona.ens : null);

  // Shop names found in the directory but not in the cast still own their agents.
  function ownerFor(ens, role) {
    const known = ownerOf(ens);
    if (known) return known;
    if (['storefront', 'risk', 'dispatch'].includes(role)) {
      const at = ens.indexOf('.');
      return at > 0 ? ens.slice(at + 1) : null;
    }
    return null;
  }

  function call(label, fn) {
    if (closed) return;
    const failed = (error) => {
      if (closed) return;
      log.guard('HOOKS', true, `the ${label} hook failed (${log.scrub(clip(errorText(error)))}); the errand goes on`);
    };
    try {
      const out = fn();
      if (out && typeof out.then === 'function') out.then(undefined, failed);
    } catch (error) {
      failed(error);
    }
  }

  function renewAll() {
    for (const info of started.values()) call('presence', () => hooks.presence('renew', { ...info }));
  }

  function agentStarted(agent, role) {
    if (!wantsPresence || started.has(agent)) return;
    const ownerEns = ownerFor(agent, role);
    if (!ownerEns) return;
    const info = { agentEns: agent, ownerEns, role, session: runId };
    started.set(agent, info);
    call('presence', () => hooks.presence('start', { ...info }));
    if (!timer) {
      timer = setTimer(renewAll, renewMs);
      timer?.unref?.();
    }
  }

  function edge(from, to, step) {
    if (!wantsHandoff || !step || !ownerOf(from) || !ownerOf(to)) return; // the human's own message is not a handoff
    call('handoff', () => hooks.handoff(from, to, step, { requestId: runId }));
  }

  return {
    // Wired into the run log: every event after it is stored (and only then).
    observe(entry, meta = {}) {
      if (entry.type === 'agent.start') agentStarted(entry.agent, entry.role);
      else if (entry.type === 'message') edge(entry.from, entry.to, meta.step);
    },
    // The errand is over: stop renewing; presence lapses by itself in 15 minutes.
    stop() {
      closed = true;
      if (timer) clearTimer(timer);
      timer = null;
    },
    agents: () => [...started.values()],
  };
}
