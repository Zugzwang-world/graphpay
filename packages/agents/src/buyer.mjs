// The buyer team (planning/SPEC/AGENTS.md §2, §4): the concierge delegates to its
// sub-agents, which are its tools (`scout`, `analyst`, `pay_shop`). The SDK runs
// the tool calls of one step concurrently, so scout and analyst run in parallel
// with no hand-written Promise.all. Shared state is code-owned (RunState).

import { z } from 'zod';
import { askModel, callTool, endAgent, runAgent, runCodeAgent } from './agents.mjs';
import { NeedProposal } from './contracts.mjs';
import { MODEL_VIEW, rankingFromAnswer, RANKING_QUERY, readRanking, tracedMcpTools } from './graph.mjs';
import { adoptNeed } from './mandate.mjs';
import { displayUsdt, fromMicro, microFrom, toMicro } from './money.mjs';
import { createPayer, knownContracts } from './payer.mjs';
import { rankShops, volumeReference } from './scoring.mjs';
import { bestFit, payGuard, whyNoFit } from './state.mjs';
import { clip, errorText } from './scrub.mjs';
import { promptFor } from './prompts.mjs';
import { STEPS } from './activity.mjs';
import { tracedTool } from './tools.mjs';

const MCP_TOOLS = ['schema', 'ask', 'graphql', 'explain'];

const GUARD_OF = {
  PHASE_NOT_READY: 'G12',
  ONE_PAYMENT_PER_ERRAND: 'G10',
  SHOP_NOT_ELIGIBLE: 'G2',
  NO_OFFER: 'G3',
  OVER_BUDGET: 'G3',
  MISSES_DEADLINE: 'G3',
};

const ceilDiv = (a, b) => (a + b - 1n) / b;
// The pay guard's refusals that say an eligible shop does not fit the limits (not a veto).
const FITS = new Set(['NO_OFFER', 'OVER_BUDGET', 'MISSES_DEADLINE']);

// What the concierge reads of its team's reports (W4: shorter tool replies): what it chooses
// on. The run log, the phones and the explainer keep the whole reports.
const offerView = (o) => ({ shop: o.shop, priceUsdt: o.priceUsdt, etaMinutes: o.etaMinutes, distanceKm: o.distanceKm });
export function scoutView(out) {
  if (!Array.isArray(out?.offers)) return out;
  return { offers: out.offers.map(offerView), synthetic: true, ...(out.scoutNote ? { scoutNote: out.scoutNote } : {}) };
}
export function analystView(out) {
  if (!Array.isArray(out?.ranking)) return out;
  const notes = out.analystView?.notes;
  return {
    ranking: out.ranking.map((r) => ({ ens: r.ens, score: Number(r.score.toFixed(3)), eligible: r.eligible, reasons: r.reasons })),
    explainId: out.explainId ?? null,
    analystView: { recommendation: out.analystView?.recommendation ?? null, ...(typeof notes === 'string' ? { notes: notes.slice(0, 300) } : {}) },
    synthetic: true,
  };
}

// The offer of one catalog for the need, priced by code: per piece
// (`unitPriceMicro`) or per pack (`priceMicro` for `quantity`), rounded up.
export function offerFor(shopEns, catalog, need) {
  const items = Array.isArray(catalog?.items) ? catalog.items : [];
  const words = (s) => String(s ?? '').toLowerCase().trim();
  for (const entry of items) {
    if (words(entry.item ?? entry.name) !== words(need.item)) continue;
    if (Number.isSafeInteger(entry.stock) && entry.stock < need.quantity) continue;
    let price;
    try {
      price =
        entry.unitPriceMicro !== undefined
          ? microFrom(entry.unitPriceMicro) * BigInt(need.quantity)
          : ceilDiv(microFrom(entry.priceMicro) * BigInt(need.quantity), BigInt(entry.quantity));
    } catch {
      continue;
    }
    if (!Number.isSafeInteger(entry.etaMinutes) || entry.etaMinutes < 0) continue;
    return {
      shop: shopEns,
      sku: String(entry.sku ?? `${words(need.item).replace(/\s+/g, '-')}-${need.quantity}`),
      item: need.item,
      quantity: need.quantity,
      priceUsdt: fromMicro(price),
      etaMinutes: entry.etaMinutes,
      distanceKm: Number.isFinite(entry.distanceKm) ? entry.distanceKm : 0,
    };
  }
  return null;
}

export async function runBuyerTeam(ctx) {
  const { cast, state, log, models, meter, hooks, mcp, sdl, clock, signal } = ctx;
  const names = cast.buyer;
  const payer = cast.payers[ctx.payerKey];
  if (!payer) throw new Error(`no paying agent "${ctx.payerKey}" in the story cast`);
  const persona = cast.persona.ens;
  const volumeRef = volumeReference(cast);
  const common = { models, log, meter, signal };
  // `steps: 'model'` is the original flow, where the models make every call (the bad-play tests).
  const byModel = ctx.steps === 'model';
  const retryMs = ctx.retryMs ?? 1000;
  const pause = (ms) => (ms > 0 ? new Promise((ok) => setTimeout(ok, ms)) : Promise.resolve());
  // A read that throws is tried once more, a moment later (an Arkiv rate limit).
  const retryOnce = async (fn) => {
    try {
      return await fn();
    } catch {
      await pause(retryMs);
      return fn();
    }
  };

  async function scoutPhase(proposal) {
    const adopted = adoptNeed(state, proposal, log, names.concierge);
    if (!adopted.ok) return { ok: false, reason: adopted.reason, detail: adopted.detail };
    const need = adopted.need;
    log.message(names.concierge, names.scout, `find ${need.quantity} × ${need.item} in ${need.city}`, STEPS.ask);
    const executed = new Set();
    const tools = {
      directory_list: tracedTool(log, names.scout, 'directory_list', {
        description: 'List the shops that sell a category in a city (Arkiv directory, current epoch).',
        inputSchema: z.object({ category: z.string().max(40), city: z.string().max(60) }),
        executed,
        // Code searches for the adopted need, whatever the model typed.
        execute: async () => {
          const found = await hooks.directory({ category: need.category, city: need.city });
          const shops = (Array.isArray(found) ? found : []).filter((n) => typeof n === 'string' && n.endsWith(`.${cast.root}`)).slice(0, 50);
          state.directory = new Set([...(state.directory ?? []), ...shops]);
          return { shops, synthetic: true };
        },
      }),
      catalog_read: tracedTool(log, names.scout, 'catalog_read', {
        description: "Read one shop's catalog and its offer for the requested item and quantity.",
        inputSchema: z.object({ shopEns: z.string().max(255) }),
        executed,
        execute: async ({ shopEns }) => {
          if (!state.directory?.has(shopEns)) return { offers: [], refused: 'NOT_IN_DIRECTORY', synthetic: true };
          const offer = offerFor(shopEns, await hooks.catalog(shopEns), need);
          if (offer) state.offers.set(shopEns, offer);
          return { offers: offer ? [offer] : [], synthetic: true };
        },
      }),
    };
    // W4: listing the shops and reading their catalogs is routine: code does it through the
    // scout's own traced tools (the same events); `steps: 'model'` keeps the model doing it.
    const run = byModel
      ? await runAgent({ role: 'scout', ens: names.scout, task: { need }, tools, executed, ...common })
      : await runCodeAgent({
          role: 'scout',
          ens: names.scout,
          task: { need },
          log,
          meter,
          run: async () => {
            const listed = await retryOnce(() => callTool(tools.directory_list, { category: need.category, city: need.city }, signal));
            await Promise.allSettled(listed.shops.map((shopEns) => callTool(tools.catalog_read, { shopEns }, signal)));
            return { offers: [...state.offers.values()] };
          },
        });
    // G13: the offers are the ones the tools returned; the model's list is only compared.
    const told = new Map((run.output?.offers ?? []).map((o) => [o.shop, o]));
    for (const [shop, offer] of state.offers) {
      const m = told.get(shop);
      if (m && toMicro(m.priceUsdt) !== toMicro(offer.priceUsdt)) {
        log.guard('G13', true, `the scout said ${m.priceUsdt} for ${shop}; the catalog says ${offer.priceUsdt}: code keeps the catalog`);
      }
    }
    state.scoutDone = true;
    const offers = [...state.offers.values()];
    log.message(names.scout, names.concierge, `${offers.length} offers (SYNTHETIC)`, STEPS.check);
    return { offers, synthetic: true, ...(run.error ? { scoutNote: run.error } : {}) };
  }

  async function analystPhase(proposal) {
    const adopted = adoptNeed(state, proposal, log, names.concierge);
    if (!adopted.ok) return { ok: false, reason: adopted.reason, detail: adopted.detail };
    const need = adopted.need;
    log.message(names.concierge, names.analyst, `rank shops for ${need.item} in ${need.city} by trust`, STEPS.ask);
    if (!byModel) return analystByCode(need);
    adoptRanking(await readRanking(mcp, { category: need.category, city: need.city }));
    const executed = new Set();
    let modelExplainId = null;
    const tools = tracedMcpTools(await mcp.tools(), log, names.analyst, {
      only: MCP_TOOLS,
      executed,
      onResult: (name, output) => {
        if (name === 'graphql') modelExplainId = output?.extensions?.arkiv?.explainId ?? modelExplainId;
      },
    });
    const run = await runAgent({ role: 'analyst', ens: names.analyst, task: { need, window: 'D90' }, tools, executed, sdl, ...common });
    const { codeTop } = compareAnalyst(run.output);
    state.analystDone = true;
    log.message(names.analyst, names.concierge, codeTop ? `best eligible: ${codeTop}` : 'no eligible shop', STEPS.check);
    return {
      ranking: state.ranking,
      explainId: state.explainId,
      analystExplainId: modelExplainId,
      analystView: run.output ? { recommendation: run.output.recommendation, notes: run.output.notes } : { error: run.error },
      synthetic: true,
    };
  }

  // Code's ranking from code's own 90-day query (G2, G15), with its G2 line.
  function adoptRanking(read) {
    if (read.ok) {
      state.tallies = read.tallies;
      state.ranking = rankShops(read.tallies, volumeRef);
      state.explainId = read.explainId;
      const line = state.ranking.map((r) => `${r.ens} ${r.score.toFixed(3)}${r.eligible ? '' : ` excluded (${r.reasons.join('; ')})`}`).join(' > ');
      log.guard('G2', true, `ranking recomputed in code from its own 90-day query (explain ${read.explainId ?? 'none'}): ${line}`);
    } else {
      state.ranking = [];
      log.guard('G2', false, `${read.reason}: ${read.detail}; no shop is eligible`);
    }
  }

  // W4: the analyst's reads are routine. Code runs its fixed ranking query through the analyst's
  // own graphql tool (the one graph read, and the call the screens show) and explains it; the
  // model then judges the shops from that data, in one call. Code's ranking stands either way.
  async function analystByCode(need) {
    const task = { need, window: 'D90' };
    log.agentStart(names.analyst, 'analyst', task);
    const startedAt = meter?.timing ? meter.now() : null;
    let tools = null;
    try {
      tools = tracedMcpTools(await mcp.tools(), log, names.analyst, { only: ['graphql', 'explain'] });
    } catch {
      tools = null; // the read below fails closed: no shop is eligible, and the analyst still ends
    }
    const variables = { category: need.category, city: need.city.toLowerCase() };
    const query = async () => {
      try {
        if (!tools?.graphql) throw new Error('the graph tools are not available');
        return rankingFromAnswer(await callTool(tools.graphql, { query: RANKING_QUERY, variables }, signal));
      } catch (error) {
        return { ok: false, reason: 'GRAPH_READ_FAILED', detail: errorText(error) };
      }
    };
    let read = await query();
    if (!read.ok) {
      await pause(retryMs);
      read = await query();
    }
    adoptRanking(read);
    if (read.ok && read.explainId && tools?.explain) await callTool(tools.explain, { explainId: read.explainId }, signal).catch(() => null);
    const graph = read.ok ? { ...MODEL_VIEW.graphql(read.answer), shown: 'the full answer and its reads are on the human’s screen' } : { error: read.reason };
    const asked = await askModel({ role: 'analyst', ens: names.analyst, task: { ...task, graph }, models, log, meter, signal, prompt: promptFor('analyst-data') });
    const out = compareAnalyst(asked.output);
    endAgent({ ens: names.analyst, role: 'analyst', log, meter, startedAt, ...asked });
    state.analystDone = true;
    log.message(names.analyst, names.concierge, out.codeTop ? `best eligible: ${out.codeTop}` : 'no eligible shop', STEPS.check);
    return {
      ranking: state.ranking,
      explainId: state.explainId,
      analystExplainId: state.explainId,
      analystView: asked.output ? { recommendation: asked.output.recommendation, notes: asked.output.notes } : { error: asked.error },
      synthetic: true,
    };
  }

  // The model's ranking is a proposal: where it disagrees with code's, code's wins (a red G2 line).
  function compareAnalyst(output) {
    const codeTop = state.ranking.find((r) => r.eligible)?.ens ?? null;
    const modelEligible = new Set((output?.ranking ?? []).filter((r) => r.eligible).map((r) => r.ens));
    const widened = state.ranking.filter((r) => !r.eligible && modelEligible.has(r.ens)).map((r) => r.ens);
    if (widened.length || (output?.recommendation && output.recommendation !== codeTop)) {
      log.guard('G2', false, `the analyst's model ranked differently (recommended ${output?.recommendation ?? 'none'}${widened.length ? `; called ${widened.join(', ')} eligible` : ''}); code's ranking stands`);
    }
    return { codeTop };
  }

  async function payPhase(shopEns) {
    const guard = payGuard(state, shopEns, clock()); // synchronous: the first thing this call does
    if (!guard.ok) {
      log.guard(GUARD_OF[guard.reason] ?? 'G10', false, `${guard.reason}: ${guard.detail}`);
      return { status: 'refused', shop: shopEns, reason: guard.reason, detail: guard.detail };
    }
    try {
      log.guard('G2', true, `${shopEns} is eligible in code's ranking (score ${guard.ranked.score.toFixed(3)}) and its offer fits the budget and deadline`);
      const need = state.need;
      const approved = Object.freeze({
        shopEns,
        storefront: await hooks.storefrontUrl(shopEns),
        item: need.item,
        quantity: need.quantity,
        maxPriceMicro: guard.priceMicro,
        deadlineIso: state.mandate.deadlineIso,
        agents: cast.shopAgentNames(shopEns),
      });
      log.message(names.concierge, payer.ens, `pay ${shopEns}: ${need.quantity} × ${need.item}, at most ${displayUsdt(guard.priceMicro)} USDT`, STEPS.pay);
      const executed = new Set();
      // The shop's client; an in-process gateway (createShopGateway) shares this errand's log and models.
      const team = { log, models, meter, sdl, clock, signal, codec: hooks.x402, steps: ctx.steps, retryMs: ctx.retryMs };
      const p = createPayer({
        approved,
        state,
        shopClient: await hooks.shopClient(shopEns, team),
        hooks,
        codec: hooks.x402,
        clock,
        log,
        agent: payer.ens,
        payerEns: payer.ens,
        buyerEns: persona,
        wallet: await hooks.payerWallet(payer.key),
        dryRun: ctx.dryRun === true,
        contracts: hooks.contracts ? knownContracts(hooks.contracts) : undefined,
        executed,
      });
      const task = { order: { shop: shopEns, item: need.item, quantity: need.quantity, maxPriceUsdt: displayUsdt(guard.priceMicro), deadlineIso: approved.deadlineIso } };
      // W4: quoting and paying the approved order is routine (the tools take no input): code calls
      // get_quote, then pay_order, as the payer (the same events); `steps: 'model'` keeps the model.
      const run = byModel
        ? await runAgent({ role: 'payer', ens: payer.ens, task, tools: p.tools, executed, ...common })
        : await runCodeAgent({
            role: 'payer',
            ens: payer.ens,
            task,
            log,
            meter,
            run: async () => {
              const q = signal?.aborted ? null : await callTool(p.tools.get_quote, {}, signal);
              if (q?.ok && !signal?.aborted) await callTool(p.tools.pay_order, {}, signal);
              if (signal?.aborted && !state.payment) {
                state.payment = { shopEns, status: 'refused', reason: 'STOPPED', detail: 'the run was stopped before paying; nothing was signed' };
                state.refusals.push({ reason: 'STOPPED', detail: state.payment.detail, agent: payer.ens });
              }
              const o = state.payment ?? { status: 'refused', reason: 'NO_QUOTE', detail: 'the shop did not quote' };
              return { status: o.status === 'no-purchase' ? 'refused' : o.status, reason: clip(String(o.reason ?? o.detail ?? 'settled')), receiptTransaction: o.receipt?.transaction ?? null };
            },
          });
      if (!state.payment) {
        state.payment = { shopEns, status: 'no-purchase', reason: 'PAYER_DID_NOT_PAY', detail: run.error ?? 'the payer never called pay_order' };
        state.refusals.push({ reason: 'PAYER_DID_NOT_PAY', detail: state.payment.detail, agent: payer.ens });
        log.guard('G4', false, `PAYER_DID_NOT_PAY: ${state.payment.detail}; the reservation stays, so this errand pays no one`);
      }
      if (run.output && run.output.status !== state.payment.status) {
        log.guard('G13', true, `the payer said ${run.output.status}; the tools say ${state.payment.status}: code keeps the tools`);
      }
    } catch (error) {
      if (!state.payment) {
        const detail = log.scrub(clip(errorText(error)));
        state.payment = { shopEns, status: 'refused', reason: 'HOOK_FAILED', detail };
        state.refusals.push({ reason: 'HOOK_FAILED', detail, agent: names.concierge });
        log.guard('G4', false, `HOOK_FAILED: ${detail}; the errand's one payment slot is used`);
      }
    }
    const out = state.payment;
    log.message(payer.ens, names.concierge, `${out.status}${out.reason ? ` (${out.reason})` : ''}`, STEPS.pay);
    if (out.status === 'paid') {
      return { status: 'paid', shop: shopEns, amountUsdt: displayUsdt(out.priceMicro), transaction: out.receipt.transaction, explorerUrl: out.receipt.explorerUrl, orderId: out.orderId, arrivesAt: out.arrivesAt, synthetic: true };
    }
    return { status: out.status, shop: shopEns, reason: out.reason, detail: out.detail };
  }

  const executed = new Set();
  const tools = {
    scout: tracedTool(log, names.concierge, 'scout', {
      description: 'Your scout: finds the shops that sell the item in the city and their offers. Call it in the same step as analyst.',
      inputSchema: z.object({ need: NeedProposal }),
      executed,
      modelView: scoutView,
      execute: async ({ need }) => scoutPhase(need),
    }),
    analyst: tracedTool(log, names.concierge, 'analyst', {
      description: 'Your analyst: ranks the shops by trust from the GraphPay graph (90 days). Call it in the same step as scout.',
      inputSchema: z.object({ need: NeedProposal }),
      executed,
      modelView: analystView,
      execute: async ({ need }) => analystPhase(need),
    }),
    pay_shop: tracedTool(log, names.concierge, 'pay_shop', {
      description: 'Pay the chosen shop through your payer, once. The guard checks eligibility, budget and deadline in code.',
      inputSchema: z.object({ shopEns: z.string().max(255) }),
      executed,
      execute: async ({ shopEns }) => payPhase(shopEns),
    }),
  };
  const task = {
    request: ctx.request,
    buyer: persona,
    now: ctx.nowIso,
    timezone: ctx.timezoneLabel,
    // Code read these from the request (G1): the model copies them, no date arithmetic.
    limits: { budgetUsdt: state.mandate.budgetUsdt, deadlineIso: state.mandate.deadlineIso },
    defaults: { food: { quantity: cast.food.quantity, item: cast.food.item } },
  };
  if (byModel) return runAgent({ role: 'concierge', ens: names.concierge, task, tools, executed, ...common });
  return conciergeByCode(task, tools);

  // W4: delegating and paying are routine: code asks the scout and the analyst at once, through
  // the concierge's own tools (the same events), and pays through pay_shop. The model's part is
  // the choice, in one call, on the offers and code's ranking (the analyst model's own opinion
  // stays out of it, so a careless or lying analyst cannot steer the choice). A choice that names no shop of the ranking (or no answer) falls to
  // code's best eligible offer within the limits, so an errand never stops after planning while
  // a shop fits; a ranked shop the guard refuses (the trap) ends the errand, as before.
  async function conciergeByCode(task, tools) {
    log.agentStart(names.concierge, 'concierge', task);
    const startedAt = meter?.timing ? meter.now() : null;
    if (!state.codeNeed) {
      state.refusals.push({ reason: 'NEED_NOT_SUPPORTED', detail: 'the request names no need this team serves', agent: names.concierge });
      log.guard('G1', false, 'NEED_NOT_SUPPORTED: the request names no need this team serves; no shop is asked');
      const output = { summary: 'This team buys only the story’s item; nothing was asked or paid (SYNTHETIC).', chosenShop: null };
      endAgent({ ens: names.concierge, role: 'concierge', log, meter, startedAt, output });
      return { output, error: null, usageTokens: 0 };
    }
    const { need: kind, item, quantity, budgetUsdt, deadlineIso, city } = state.codeNeed;
    const need = { need: kind, item, quantity, budgetUsdt, deadlineIso, city };
    const report = (name) => callTool(tools[name], { need }, signal).catch(() => null);
    const [scoutOut, analystOut] = await Promise.all([report('scout'), report('analyst')]);
    const asked = await askModel({
      role: 'concierge',
      ens: names.concierge,
      task: { request: task.request, buyer: task.buyer, now: task.now, timezone: task.timezone, limits: task.limits, offers: scoutView(scoutOut)?.offers ?? [], ranking: analystView(analystOut)?.ranking ?? [] },
      models,
      log,
      meter,
      signal,
      prompt: promptFor('concierge-choose'),
    });
    const end = (extra = {}) => {
      // A failed model leaves its answer null (the result's modelChoice and narrative stay the
      // model's); the failure is `modelError`, not `error`, because code carried the step.
      endAgent({ ens: names.concierge, role: 'concierge', log, meter, startedAt, output: asked.output, usageTokens: asked.usageTokens, settings: asked.settings, calls: asked.calls, modelError: asked.output ? null : asked.error, ...extra });
      return { output: asked.output, error: asked.output ? null : asked.error, usageTokens: asked.usageTokens };
    };
    const stopped = () => {
      if (!signal?.aborted) return false;
      state.refusals.push({ reason: 'STOPPED', detail: 'the run was stopped before paying; nothing was paid', agent: names.concierge });
      log.guard('ERRAND', false, 'STOPPED: the run was stopped before paying; nothing was paid');
      return true;
    };
    if (stopped()) return end();
    // The model's name for a shop, matched to the ranking without regard to case or spaces.
    const named = typeof asked.output?.chosenShop === 'string' ? asked.output.chosenShop.trim().toLowerCase() : '';
    let shop = (state.ranking ?? []).find((r) => r.ens.toLowerCase() === named)?.ens ?? null;
    const noFit = () => {
      const missing = [!state.scoutDone && 'the scout', !state.analystDone && 'the analyst'].filter(Boolean);
      if (missing.length) {
        state.refusals.push({ reason: 'PHASE_NOT_READY', detail: `${missing.join(' and ')} did not report`, agent: names.concierge });
        log.guard('G12', false, `PHASE_NOT_READY: ${missing.join(' and ')} did not report; no purchase`);
        return;
      }
      const why = whyNoFit(state, clock());
      state.refusals.push({ ...why, agent: names.concierge });
      log.guard(GUARD_OF[why.reason] ?? 'G3', false, `${why.reason}: ${why.detail}; no eligible shop has an offer within the budget and the deadline (${state.offers.size} offers): no purchase`);
    };
    if (!shop) {
      const best = bestFit(state, clock());
      const said = named ? `"${clip(asked.output.chosenShop, 80)}", which is not in the ranking` : 'no shop';
      if (best) {
        log.guard('G2', true, `the concierge named ${said}${asked.error ? ` (${asked.error})` : ''}; code's best eligible offer within the limits is ${best}: paying it`);
        shop = best;
      } else {
        noFit();
        return end();
      }
    }
    let paid = await callTool(tools.pay_shop, { shopEns: shop }, signal).catch(() => null);
    // An eligible shop that does not fit the limits is the model's slip, not a veto: code pays its
    // best fitting offer instead. The trap (SHOP_NOT_ELIGIBLE) and every other refusal end the errand.
    if (paid?.status === 'refused' && FITS.has(paid.reason) && !state.paying && !state.payment && !signal?.aborted) {
      const best = bestFit(state, clock());
      if (best && best !== shop) {
        log.guard('G2', true, `${shop} does not fit the limits (${paid.reason}); code's best eligible offer within the limits is ${best}: paying it`);
        paid = await callTool(tools.pay_shop, { shopEns: best }, signal).catch(() => null);
      }
    }
    return end();
  }
}
