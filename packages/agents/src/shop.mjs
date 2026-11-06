// The shop team in front of a shop API (planning/SPEC/AGENTS.md §2, §11): the
// risk agent vets the buyer agent before any quote (G8, G9), the storefront
// agent quotes the catalog price, the dispatch agent confirms delivery from what
// the shop API did on-chain. Orders are shop-scoped and bound to their resource
// URL; quotes expire (G11). The gateway rewrites the 402's resource to the
// agent-facing URL.

import { z } from 'zod';
import { askModel, callTool, endAgent, runAgent, runCodeAgent } from './agents.mjs';
import { parseBuyerRisk, readBuyerStanding, tracedMcpTools } from './graph.mjs';
import { promptFor } from './prompts.mjs';
import { displayUsdt, microFrom, toMicro } from './money.mjs';
import { buyerRiskReasons } from './scoring.mjs';
import { errorText } from './scrub.mjs';
import { STEPS } from './activity.mjs';
import { tracedTool } from './tools.mjs';
import { base64JsonCodec, header } from './x402.mjs';

const HEX32 = /^0x[0-9a-fA-F]{64}$/;
const MCP_TOOLS = ['schema', 'ask', 'graphql', 'explain'];

// What the shop API's free quote must carry (an adapter maps the real API to it).
const SurfaceQuote = z
  .object({
    shop: z.string(),
    item: z.string(),
    quantity: z.number().int().positive(),
    priceMicro: z.union([z.string().regex(/^\d{1,19}$/), z.number().int().nonnegative()]),
    etaMinutes: z.number().int().nonnegative(),
    validUntil: z.number().int().positive(),
    orderId: z.string().regex(HEX32),
    terms: z.record(z.string(), z.unknown()),
    payUrl: z.string().max(500),
  })
  .passthrough();

// The `ask` tool's TSV answer: the hosted MCP server's text content, or the mocks' { text }.
function askText(out) {
  if (Array.isArray(out?.content)) return out.content.filter((c) => c?.type === 'text').map((c) => c.text).join('\n');
  return typeof out?.text === 'string' ? out.text : null;
}

export function createShopGateway(ctx) {
  const { shopEns, surface, mcp, hooks, models, meter, log, sdl, storefront, names, signal } = ctx;
  const codec = ctx.codec ?? base64JsonCodec;
  const clock = ctx.clock ?? Date.now;
  const base = storefront.replace(/\/$/, '');
  const orders = new Map(); // orderId → the quote it was made from (shop-scoped)
  const common = { models, log, meter, signal };
  // W4: the shop's routine steps run in code (the same events); `steps: 'model'` is the original
  // flow, where the models make every call.
  const byModel = ctx.steps === 'model';

  // The risk check in code: ENS and Arkiv must both say active, then the policy.
  // An ENS read error is a refusal, never "active" (G8).
  async function codeRisk(payerEns, amountMicro) {
    const reasons = [];
    let ens = null;
    try {
      ens = await hooks.ensCheck(payerEns);
    } catch (error) {
      reasons.push(`ENS read failed (${errorText(error)}): refused`);
    }
    if (ens && ens.status !== 'ACTIVE') reasons.push(`ENS says ${ens.status}`);
    const read = await readBuyerStanding(mcp, payerEns);
    if (!read.ok) reasons.push(`no readable standing on Arkiv: ${read.detail}`);
    else reasons.push(...buyerRiskReasons(read.standing, amountMicro));
    return reasons;
  }

  // W4: the risk agent's reads are routine. Code reads the buyer agent's ENS state and its
  // standing through the risk agent's own traced tools (once: code's check uses the same
  // answers), then the model judges from them in one call.
  async function vetByCode(req, amountMicro, task, tools) {
    log.agentStart(names.risk, 'risk', task);
    const startedAt = meter?.timing ? meter.now() : null;
    const code = [];
    let ens = null;
    try {
      ens = await callTool(tools.ens_check, { name: req.payer }, signal);
    } catch (error) {
      code.push(`ENS read failed (${errorText(error)}): refused`);
    }
    if (ens && ens.status !== 'ACTIVE') code.push(`ENS says ${ens.status}`);
    let standing = null;
    try {
      standing = parseBuyerRisk(askText(await callTool(tools.ask, { intent: 'buyer_risk', ens: [req.payer], window: 'D90', verify: false }, signal)), req.payer);
    } catch {
      standing = null;
    }
    if (!standing) code.push(`no readable standing on Arkiv: no readable standing for ${req.payer}`);
    else code.push(...buyerRiskReasons(standing, amountMicro));
    const view = {
      ens: ens ? { status: ens.status, registryState: ens.registryState ?? null } : { error: 'the ENS read failed' },
      standing: standing
        ? { status: standing.status, orders: standing.orders, cancellations: standing.cancellations, disputes: standing.disputes, dailyCapUsdt: displayUsdt(standing.dailyCapMicro), spendTodayUsdt: displayUsdt(standing.spendTodayMicro) }
        : { error: 'no readable standing' },
    };
    const asked = await askModel({ role: 'risk', ens: names.risk, task: { ...task, ...view }, models, log, meter, signal, prompt: promptFor('risk-data') });
    endAgent({ ens: names.risk, role: 'risk', log, meter, startedAt, ...asked });
    return { code, run: asked };
  }

  // G9: stricter wins. The decision is code's reasons ∪ the risk agent's.
  async function vet(req, amountMicro) {
    log.message(names.storefront, names.risk, `vet ${req.payer}`, STEPS.checkBack);
    const executed = new Set();
    const tools = {
      ...tracedMcpTools(await mcp.tools(), log, names.risk, { only: byModel ? MCP_TOOLS : ['ask'], executed }),
      ens_check: tracedTool(log, names.risk, 'ens_check', {
        description: "Read an agent's ENS registry state, status and records (Sepolia, ENSv2).",
        inputSchema: z.object({ name: z.string().max(255) }),
        executed,
        execute: async ({ name }) => hooks.ensCheck(name),
      }),
    };
    const task = { buyerAgent: req.payer, buyer: req.buyer, orderUsdt: displayUsdt(amountMicro), shop: shopEns };
    let code;
    let run;
    if (byModel) {
      code = await codeRisk(req.payer, amountMicro);
      run = await runAgent({ role: 'risk', ens: names.risk, task, tools, executed, sdl, ...common });
    } else {
      ({ code, run } = await vetByCode(req, amountMicro, task, tools));
    }
    const model = run.output?.decision === 'decline' ? run.output.reasons.map((r) => `risk agent: ${r}`) : [];
    if (run.output?.decision === 'decline' && model.length === 0) model.push('risk agent: declined');
    const reasons = [...code, ...model];
    log.guard('G9', reasons.length === 0, reasons.length ? `declined ${req.payer}: ${reasons.join('; ')}` : `approved ${req.payer} (code and the risk agent)`);
    log.message(names.risk, names.storefront, reasons.length ? 'decline' : 'approve', STEPS.checkBack);
    return reasons;
  }

  async function quote(req) {
    let bound;
    try {
      bound = SurfaceQuote.parse(await surface.quote({ ...req, shopEns }));
    } catch (error) {
      return { ok: false, refused: 'NO_QUOTE', reasons: [`the shop API did not quote: ${errorText(error)}`] };
    }
    if (bound.shop !== shopEns || bound.item !== req.item || bound.quantity !== req.quantity) {
      return { ok: false, refused: 'NO_QUOTE', reasons: ['the shop API quoted another order'] };
    }
    const amount = microFrom(bound.priceMicro);
    const declined = await vet(req, amount);
    if (declined.length) return { ok: false, refused: 'BUYER_DECLINED', reasons: declined };
    const executed = new Set();
    let toolQuote = null;
    const tools = {
      catalog_quote: tracedTool(log, names.storefront, 'catalog_quote', {
        description: "The shop's binding price for an item and quantity (scales with quantity, rounded up).",
        inputSchema: z.object({ item: z.string().max(80), quantity: z.number().int().positive() }),
        executed,
        execute: async ({ item, quantity }) => {
          if (item.toLowerCase() !== req.item.toLowerCase() || quantity !== req.quantity) {
            return { ok: false, reason: 'the buyer asked for a different item or quantity' };
          }
          toolQuote = bound;
          return { ok: true, shop: shopEns, item: bound.item, quantity: bound.quantity, priceUsdt: displayUsdt(amount), etaMinutes: bound.etaMinutes, synthetic: true };
        },
      }),
    };
    const storeTask = { item: req.item, quantity: req.quantity, buyerAgent: req.payer };
    const run = byModel
      ? await runAgent({ role: 'storefront', ens: names.storefront, task: storeTask, tools, executed, ...common })
      : await runCodeAgent({
          role: 'storefront',
          ens: names.storefront,
          task: storeTask,
          log,
          meter,
          run: async () => {
            const q = await callTool(tools.catalog_quote, { item: req.item, quantity: req.quantity }, signal);
            return q?.ok ? { quoteUsdt: q.priceUsdt, etaMinutes: q.etaMinutes, message: 'Quoted from the catalog (SYNTHETIC).' } : { quoteUsdt: null, etaMinutes: null, message: 'We do not sell that.' };
          },
        });
    if (!toolQuote) return { ok: false, refused: 'NO_QUOTE', reasons: [run.error ?? 'the storefront did not quote'] };
    if (run.output?.quoteUsdt && toMicro(run.output.quoteUsdt) !== amount) {
      log.guard('G13', true, `the storefront said ${run.output.quoteUsdt}; the catalog quote is ${displayUsdt(amount)}: code keeps the catalog`);
    }
    const payUrl = `${base}/orders/${bound.orderId}/pay`;
    orders.set(bound.orderId.toLowerCase(), { bound, payUrl, req });
    return {
      ok: true,
      quote: {
        shop: shopEns,
        item: bound.item,
        quantity: bound.quantity,
        priceMicro: amount.toString(),
        etaMinutes: bound.etaMinutes,
        validUntil: bound.validUntil,
        orderId: bound.orderId,
      },
      terms: bound.terms,
      payUrl,
      synthetic: true,
    };
  }

  function orderOf(payUrl) {
    if (typeof payUrl !== 'string' || !payUrl.startsWith(`${base}/`)) return null;
    const m = /^\/orders\/(0x[0-9a-fA-F]{64})\/pay$/.exec(payUrl.slice(base.length));
    const entry = m ? orders.get(m[1].toLowerCase()) : undefined;
    return entry && entry.payUrl === payUrl ? entry : null;
  }

  function rewriteResource(res, payUrl) {
    const value = header(res.headers, 'payment-required');
    const pr = codec.decodePaymentRequired(value);
    if (!pr || typeof codec.encodePaymentRequired !== 'function') return res;
    const fixed = { ...pr, resource: { ...(pr.resource ?? {}), url: payUrl } };
    const headers = Object.fromEntries(Object.entries(res.headers ?? {}).filter(([k]) => k.toLowerCase() !== 'payment-required'));
    return { ...res, headers: { ...headers, 'PAYMENT-REQUIRED': codec.encodePaymentRequired(fixed) }, body: fixed };
  }

  async function dispatch(entry, res) {
    const executed = new Set();
    let confirmation = null;
    const { bound, req } = entry;
    const tools = {
      dispatch_confirm: tracedTool(log, names.dispatch, 'dispatch_confirm', {
        description: 'Confirm delivery of a settled order, from what the shop API did on-chain.',
        inputSchema: z.object({ item: z.string().max(80), quantity: z.number().int().positive(), deadlineIso: z.string().max(40), orderId: z.string().max(80) }),
        executed,
        execute: async ({ orderId }) => {
          if (orderId.toLowerCase() !== bound.orderId.toLowerCase()) return { confirmed: false, reason: 'not this order' };
          const status = await surface.orderStatus(bound.orderId);
          const confirmed = status?.status === 'PAID' || status?.status === 'DELIVERED';
          const eta = clock() + bound.etaMinutes * 60_000;
          confirmation = {
            confirmed,
            orderId: bound.orderId,
            etaIso: new Date(eta).toISOString(),
            meetsDeadline: eta <= Date.parse(req.deadlineIso),
            courier: 'SYNTHETIC courier',
          };
          return confirmation;
        },
      }),
    };
    const task = { item: bound.item, quantity: bound.quantity, deadlineIso: req.deadlineIso, orderId: bound.orderId };
    if (byModel) await runAgent({ role: 'dispatch', ens: names.dispatch, task, tools, executed, ...common });
    else {
      await runCodeAgent({
        role: 'dispatch',
        ens: names.dispatch,
        task,
        log,
        meter,
        run: async () => {
          const c = await callTool(tools.dispatch_confirm, task, signal);
          return { confirmed: c?.confirmed === true, orderId: String(c?.orderId ?? bound.orderId), etaIso: String(c?.etaIso ?? ''), message: c?.confirmed ? 'Delivery confirmed (SYNTHETIC courier).' : 'Not confirmed: the shop API has no payment for this order.' };
        },
      });
    }
    if (confirmation) log.message(names.dispatch, req.payer, `dispatched ${bound.orderId}, arrives ${confirmation.etaIso}`, STEPS.pay);
    return { ...res, body: { ...(res.body && typeof res.body === 'object' ? res.body : {}), dispatch: confirmation } };
  }

  async function pay({ payUrl, terms, requestId, signature }) {
    const entry = orderOf(payUrl);
    if (!entry) return { status: 404, headers: {}, body: { reason: 'UNKNOWN_ORDER' } };
    const { bound, req } = entry;
    if (!(bound.validUntil * 1000 > clock())) return { status: 410, headers: {}, body: { reason: 'QUOTE_EXPIRED' } };
    if (JSON.stringify(terms) !== JSON.stringify(bound.terms)) return { status: 409, headers: {}, body: { reason: 'TERMS_MISMATCH' } };
    if (!signature) {
      // Before any 402, the code part of the risk step runs again (G8).
      const again = await codeRisk(req.payer, microFrom(bound.priceMicro));
      if (again.length) {
        log.guard('G8', false, `refused ${req.payer} before the 402: ${again.join('; ')}`);
        return { status: 403, headers: {}, body: { reason: 'BUYER_DECLINED', detail: again.join('; ') } };
      }
      const res = await surface.pay({ payUrl: bound.payUrl, terms: bound.terms, requestId });
      return res?.status === 402 ? rewriteResource(res, entry.payUrl) : res;
    }
    const res = await surface.pay({ payUrl: bound.payUrl, terms: bound.terms, requestId, signature });
    if (res?.status === 200) return dispatch(entry, res);
    return res;
  }

  return { quote, pay };
}
