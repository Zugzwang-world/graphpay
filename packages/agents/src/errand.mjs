// One errand, end to end: the mandate from the human's words (G1; no mandate, no
// agent runs), the buyer team, and the result built from tool data, never from
// model prose (G13). Returns the run log of planning/SPEC/AGENTS.md §9.

import { createHash, randomBytes } from 'node:crypto';
import { createActivity } from './activity.mjs';
import { runBuyerTeam } from './buyer.mjs';
import { teamCast } from './cast.mjs';
import { parseMandate, needFromRequest, zoneOffsetMinutes } from './mandate.mjs';
import { createMeter, createModelFactory, resolveAgentMode } from './models.mjs';
import { fromMicro } from './money.mjs';
import { createRunLog, RUN_SCHEMA } from './runlog.mjs';
import { createScrubber, errorText } from './scrub.mjs';
import { createRunState } from './state.mjs';
import { usageOf } from './usage.mjs';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

function zoneLabel(timeZone, now) {
  const offset = zoneOffsetMinutes(now, timeZone);
  const abs = Math.abs(offset);
  return `${timeZone} (UTC${offset < 0 ? '-' : '+'}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')})`;
}

function localIso(now, timeZone) {
  const offset = zoneOffsetMinutes(now, timeZone);
  const local = new Date(now + offset * 60_000).toISOString().slice(0, 19);
  const abs = Math.abs(offset);
  return `${local}${offset < 0 ? '-' : '+'}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

function castView(cast, payer) {
  return {
    story: cast.key,
    root: cast.root,
    persona: cast.persona.ens,
    buyer: { ...cast.buyer, paysAs: payer.ens },
    shops: cast.shops.map((s) => ({ ens: s.ens, displayName: s.displayName, storyRole: s.storyRole, agents: s.agents })),
  };
}

function modelLabel(mode, models) {
  if (mode === 'mock') return 'mock';
  const seen = new Set();
  let preset = '';
  for (const role of ['concierge', 'scout', 'analyst', 'payer', 'storefront', 'risk', 'dispatch']) {
    const { settings } = models(role);
    preset = settings.preset;
    seen.add(`${settings.model} @ ${settings.effort}`);
  }
  return `${preset}: ${[...seen].join(', ')}`;
}

// G13: the status, price, receipt and delivery plan come from what the tools did.
function buildResult(state, concierge) {
  const p = state.payment;
  let status = 'no-purchase';
  if (p?.status === 'paid') status = 'paid';
  else if (p?.status === 'unsettled') status = 'unsettled';
  else if (p || state.refusals.length > 0) status = 'refused';
  return {
    status,
    chosenShop: state.paying?.shopEns ?? null,
    priceUsdt: p?.priceMicro != null ? fromMicro(p.priceMicro) : null,
    receipt: p?.receipt ?? null,
    orderId: p?.orderId ?? null,
    arrivesAt: p?.arrivesAt ?? null,
    ranking: state.ranking ?? [],
    explainId: state.explainId,
    refusals: state.refusals,
    narrative: concierge?.output?.summary ?? null,
    modelChoice: concierge?.output?.chosenShop ?? null,
    mandate: state.mandate ? { budgetUsdt: state.mandate.budgetUsdt, deadlineIso: state.mandate.deadlineIso, hash: state.mandate.hash } : null,
    synthetic: true,
  };
}

// options: { request, now, clock, env, mode, models, mockModels, buyer, hooks, mcp,
// runId, label, onEvent, secrets, cast, signal }. Hooks and mcp are the live
// services behind interfaces (index.d.ts); mocks/ has a full set.
export async function runErrand(options = {}) {
  const env = options.env ?? process.env;
  const asked = options.mode ?? resolveAgentMode(env); // an AGENT_MODE typo throws here, before anything runs
  const mode = asked === 'anthropic' ? 'live' : asked; // the old name of live
  const cast = options.cast ?? teamCast();
  const models = options.models ?? createModelFactory({ mode, env, mocks: options.mockModels });
  const payerKey = options.buyer ?? 'payer';
  const payer = cast.payers[payerKey];
  if (!payer) throw new Error(`E2E_BUYER "${payerKey}" is not a paying agent of the story cast`);
  const now = options.now ?? Date.now();
  const clock = options.clock ?? (options.now !== undefined ? () => now : Date.now);
  const request = options.request ?? cast.order.request;
  const runId = options.runId ?? (mode === 'mock' ? `mock-${sha256(`${request}|${now}`).slice(0, 16)}` : `run-${randomBytes(8).toString('hex')}`);
  const requestId = `0x${sha256(runId)}`;
  const scrub = createScrubber([...Object.entries(env).filter(([k]) => /(?:_PRIVATE_KEY|_API_KEY|_ACCESS_KEY|_TOKEN|_SECRET|_PASSCODE|_RPC_URL)$/.test(k)).map(([, v]) => v), ...(options.secrets ?? [])]);
  let activity = null; // presence and handoff hooks: no-ops unless the hooks define them
  const log = createRunLog({ scrub, onEvent: options.onEvent, observe: (entry, meta) => activity?.observe(entry, meta) });
  activity = createActivity({ hooks: options.hooks, cast, log, runId, renewMs: options.presenceRenewMs, setTimer: options.setTimer, clearTimer: options.clearTimer });
  // Per-call seconds only on live runs, so two mock runs still give byte-identical run logs.
  const meter = createMeter({ timing: options.timing ?? mode !== 'mock' });
  const started = performance.now();
  const label = options.label ?? `${cast.key} story errand (SYNTHETIC)`;
  let state = null;
  let concierge = null;
  let fatal = null;

  log.message(cast.persona.ens, cast.buyer.concierge, request);
  const parsed = parseMandate(request, { now, timeZone: cast.city.timeZone, currency: cast.city.currency, buyer: cast.persona.ens });
  if (!parsed.ok) {
    log.guard('G1', false, `${parsed.reason}: ${parsed.detail}; no agent runs`);
    state = createRunState({ mandate: null, codeNeed: null, requestId });
    state.refusals.push({ reason: parsed.reason, detail: parsed.detail });
  } else {
    const { mandate } = parsed;
    log.guard('G1', true, `mandate from the human's words: at most ${mandate.budgetUsdt} USDT, by ${mandate.deadlineIso} (hash ${mandate.hash})`);
    state = createRunState({ mandate, codeNeed: needFromRequest(request, mandate, cast), requestId });
    let sdl = '';
    try {
      sdl = String((await options.mcp.call('schema', {}))?.sdl ?? '');
    } catch (error) {
      log.guard('G2', true, `the schema tool failed (${errorText(error)}); the analyst works without the SDL`);
    }
    try {
      concierge = await runBuyerTeam({
        cast,
        state,
        log,
        models,
        meter,
        hooks: options.hooks,
        mcp: options.mcp,
        sdl,
        clock,
        signal: options.signal,
        payerKey,
        dryRun: options.dryRun === true,
        request,
        nowIso: localIso(now, cast.city.timeZone),
        timezoneLabel: zoneLabel(cast.city.timeZone, now),
      });
    } catch (error) {
      fatal = log.scrub(errorText(error));
      log.guard('ERRAND', false, `the errand stopped: ${fatal}`);
    }
  }
  activity.stop();
  const result = buildResult(state, concierge);
  if (fatal) result.error = fatal;
  const runLog = {
    schema: RUN_SCHEMA,
    label,
    runId,
    mode,
    model: modelLabel(mode, models),
    synthetic: true,
    cast: castView(cast, payer),
    request,
    edges: log.edges,
    events: log.events,
    result: JSON.parse(JSON.stringify(result, (_, v) => (typeof v === 'bigint' ? v.toString() : v))),
    usageTokens: meter.tokens,
    apiCostUsd: Number(meter.costUsd.toFixed(6)),
  };
  const metrics = { seconds: (performance.now() - started) / 1000, calls: meter.calls, tokens: meter.tokens, apiCostUsd: meter.costUsd, byRole: meter.byRole, usage: usageOf(log.events) };
  return { runLog, metrics, state };
}
