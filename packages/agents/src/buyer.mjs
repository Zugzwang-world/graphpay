// The buyer team (planning/SPEC/AGENTS.md §2, §4): the concierge delegates to its
// sub-agents, which are its tools (`scout`, `analyst`, `pay_shop`). The SDK runs
// the tool calls of one step concurrently, so scout and analyst run in parallel
// with no hand-written Promise.all. Shared state is code-owned (RunState).

import { z } from 'zod';
import { runAgent } from './agents.mjs';
import { NeedProposal } from './contracts.mjs';
import { readRanking, tracedMcpTools } from './graph.mjs';
import { adoptNeed } from './mandate.mjs';
import { displayUsdt, fromMicro, microFrom, toMicro } from './money.mjs';
import { createPayer, knownContracts } from './payer.mjs';
import { rankShops, volumeReference } from './scoring.mjs';
import { payGuard } from './state.mjs';
import { clip, errorText } from './scrub.mjs';
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
    const run = await runAgent({ role: 'scout', ens: names.scout, task: { need }, tools, executed, ...common });
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
    const read = await readRanking(mcp, { category: need.category, city: need.city });
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
    // The model's ranking is a proposal: where it disagrees with code's, code's wins.
    const codeTop = state.ranking.find((r) => r.eligible)?.ens ?? null;
    const modelEligible = new Set((run.output?.ranking ?? []).filter((r) => r.eligible).map((r) => r.ens));
    const widened = state.ranking.filter((r) => !r.eligible && modelEligible.has(r.ens)).map((r) => r.ens);
    if (widened.length || (run.output?.recommendation && run.output.recommendation !== codeTop)) {
      log.guard('G2', false, `the analyst's model ranked differently (recommended ${run.output?.recommendation ?? 'none'}${widened.length ? `; called ${widened.join(', ')} eligible` : ''}); code's ranking stands`);
    }
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
      const team = { log, models, meter, sdl, clock, signal, codec: hooks.x402 };
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
      const run = await runAgent({ role: 'payer', ens: payer.ens, task, tools: p.tools, executed, ...common });
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
  return runAgent({ role: 'concierge', ens: names.concierge, task, tools, executed, ...common });
}
