// Scripted mock models for CI (MockLanguageModelV4 from ai/test): one script per
// role reads the task and the tool results so far and answers with the next tool
// calls or the final JSON. `play` swaps in bad play (planning/PROMPTS/10-agents.md
// step 5): a price-only concierge, a lying analyst, an overspending payer, a
// wrong-shop payer, three parallel pay_shop calls, a model that widens the limits.

import { MockLanguageModelV4 } from 'ai/test';
import { rankShops, talliesFromNodes, volumeReference } from '../src/scoring.mjs';

const USAGE = {
  inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

const parse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

// What a script sees: the task, the tool results so far (in order) and the step number.
export function readPrompt(prompt) {
  const view = { task: null, results: [], step: 0, system: '' };
  for (const message of prompt) {
    if (message.role === 'system') view.system = message.content;
    if (message.role === 'user' && view.task === null) {
      const text = message.content.map((p) => (p.type === 'text' ? p.text : '')).join('');
      view.task = parse(text.replace(/^Task \(JSON\): /, ''));
    }
    if (message.role === 'assistant') view.step += 1;
    if (message.role === 'tool') {
      for (const part of message.content) {
        if (part.type !== 'tool-result') continue;
        const o = part.output;
        const output = o.type === 'json' ? o.value : o.type === 'text' ? parse(o.value) : { error: o.value ?? o.reason ?? o.type };
        view.results.push({ toolName: part.toolName, output, step: view.step });
      }
    }
  }
  return view;
}

const calls = (role, step, list) => ({ toolCalls: list.map(([toolName, input], i) => ({ toolCallId: `${role}-${step}-${i}`, toolName, input })) });
const answer = (value) => ({ text: JSON.stringify(value) });
const last = (view, name) => view.results.filter((r) => r.toolName === name).at(-1)?.output;

// "within an hour" or "within 45 minutes" from the task's local now, to the whole minute.
function withinDeadline(task) {
  const m = /within\s+(an?|one|\d+)\s*(hours?|minutes?)/i.exec(task.request);
  if (!m) return null;
  const count = /^\d+$/.test(m[1]) ? Number(m[1]) : 1;
  const minutes = /^h/i.test(m[2]) ? count * 60 : count;
  const zone = String(task.now).slice(19);
  const local = Math.floor((Date.parse(`${String(task.now).slice(0, 19)}Z`) + minutes * 60_000) / 60_000) * 60_000;
  return `${new Date(local).toISOString().slice(0, 19)}${zone}`;
}

function needFrom(task, { widen = false } = {}) {
  // A good model copies the limits code read (task.limits); without them it reads the request.
  const budget = task.limits?.budgetUsdt ?? /(\d+(?:\.\d+)?)\s*USDT/i.exec(task.request)?.[1] ?? '0';
  const hour = /by\s+(\d{1,2})\s*pm/i.exec(task.request)?.[1];
  const day = String(task.now).slice(0, 10);
  const deadline = task.limits?.deadlineIso ?? (hour ? `${day}T${String(Number(hour) + 12).padStart(2, '0')}:00:00${String(task.now).slice(19)}` : (withinDeadline(task) ?? String(task.now)));
  return {
    need: 'food',
    item: task.defaults.food.item,
    quantity: task.defaults.food.quantity,
    budgetUsdt: widen ? String(Number(budget) * 10) : budget,
    deadlineIso: widen ? `${String(Number(day.slice(0, 4)) + 1)}${deadline.slice(4)}` : deadline,
    city: /\bin ([A-Z][A-Za-z]+)/.exec(task.request)?.[1] ?? 'unknown',
  };
}

// W4's choose form: the reports are in the task and the reply is the choice, in one call.
function chooseFrom(task, play) {
  const offers = task.offers ?? [];
  const deadline = Date.parse(task.limits.deadlineIso);
  const now = Date.parse(task.now);
  const fits = (o) => Number(o.priceUsdt) <= Number(task.limits.budgetUsdt) && now + o.etaMinutes * 60_000 <= deadline;
  if (play === 'no-choice') return null;
  if (play === 'unknown-choice') return 'the dosa place near the station';
  if (play === 'price-only') return [...offers].sort((a, b) => Number(a.priceUsdt) - Number(b.priceUsdt))[0]?.shop ?? null;
  if (play === 'trusts-analyst') return task.analyst?.recommendation ?? null;
  return (task.ranking ?? []).find((r) => r.eligible && offers.some((o) => o.shop === r.ens && fits(o)))?.ens ?? null;
}

function conciergeScript(play) {
  return (view) => {
    const { task } = view;
    if (Array.isArray(task.offers)) {
      const shop = chooseFrom(task, play);
      const price = task.offers.find((o) => o.shop === shop)?.priceUsdt;
      return answer({ summary: shop ? `Chose ${shop} for ${price ?? '?'} USDT (MOCK narrative).` : 'No shop fits the request (MOCK).', chosenShop: shop });
    }
    if (view.step === 0) {
      const need = needFrom(task, { widen: play === 'widen-limits' });
      return calls('concierge', 0, [
        ['scout', { need }],
        ['analyst', { need }],
      ]);
    }
    if (view.step === 1) {
      const offers = last(view, 'scout')?.offers ?? [];
      const analyst = last(view, 'analyst') ?? {};
      const budget = Number(needFrom(task).budgetUsdt);
      let shop = null;
      if (play === 'price-only') {
        shop = [...offers].sort((a, b) => Number(a.priceUsdt) - Number(b.priceUsdt))[0]?.shop ?? null;
      } else if (play === 'trusts-analyst') {
        shop = analyst.analystView?.recommendation ?? null;
      } else {
        shop = (analyst.ranking ?? []).find((r) => r.eligible && offers.some((o) => o.shop === r.ens && Number(o.priceUsdt) <= budget))?.ens ?? null;
      }
      if (!shop) return answer({ summary: 'No shop fits the request (MOCK).', chosenShop: null });
      const n = play === 'triple-pay' ? 3 : 1;
      return calls('concierge', 1, Array.from({ length: n }, () => ['pay_shop', { shopEns: shop }]));
    }
    const paid = view.results.filter((r) => r.toolName === 'pay_shop').map((r) => r.output);
    const ok = paid.find((p) => p?.status === 'paid');
    const shop = ok?.shop ?? paid[0]?.shop ?? null;
    return answer({
      summary: ok ? `Chose ${shop} for ${ok.amountUsdt} USDT (MOCK narrative).` : `No purchase: ${paid.map((p) => p?.reason ?? p?.error).join(', ')} (MOCK narrative).`,
      chosenShop: shop,
    });
  };
}

function scoutScript() {
  return (view) => {
    if (view.step === 0) return calls('scout', 0, [['directory_list', { category: view.task.need.category, city: view.task.need.city }]]);
    if (view.step === 1) {
      const shops = last(view, 'directory_list')?.shops ?? [];
      return calls('scout', 1, shops.map((shopEns) => ['catalog_read', { shopEns }]));
    }
    return answer({ offers: view.results.filter((r) => r.toolName === 'catalog_read').flatMap((r) => r.output?.offers ?? []) });
  };
}

const MODEL_QUERY = `query Shops($category: String!, $city: String!) {
  nodes(kind: "shop", category: $category, city: $city) { ens verified status reputation(window: D90) { orders refundRate onTimeRate source synthetic } }
}`;

function analystScript(play, cast) {
  const volumeRef = volumeReference(cast);
  const judge = (nodes) => {
    const ranking = rankShops(talliesFromNodes(nodes), volumeRef);
    if (play === 'lying') {
      const trap = cast.shopByRole('trap').ens;
      const lie = ranking.map((r) => (r.ens === trap ? { ...r, score: 0.999, eligible: true, reasons: [] } : r)).sort((a, b) => b.score - a.score);
      return answer({ ranking: lie, recommendation: trap, notes: 'MOCK lying analyst: calls the cheapest shop safe.' });
    }
    return answer({ ranking, recommendation: ranking.find((r) => r.eligible)?.ens ?? null, notes: 'Ranked by 90-day refunds and on-time rate (MOCK data).' });
  };
  return (view) => {
    // W4's data form: code ran the query; the graph's answer is in the task.
    if (view.task.graph) return judge(view.task.graph.data?.nodes ?? []);
    if (view.step === 0) {
      return calls('analyst', 0, [['graphql', { query: MODEL_QUERY, variables: { category: view.task.need.category, city: view.task.need.city.toLowerCase() } }]]);
    }
    if (view.step === 1) return calls('analyst', 1, [['explain', { explainId: last(view, 'graphql')?.extensions?.arkiv?.explainId ?? 'none' }]]);
    return judge(last(view, 'graphql')?.data?.nodes ?? []);
  };
}

function payerScript(play, cast) {
  return (view) => {
    if (play === 'wrong-shop') {
      const trap = cast.shopByRole('trap').ens;
      if (view.step === 0) return calls('payer', 0, [['get_quote', { shopEns: trap }]]);
      if (view.step === 1) return calls('payer', 1, [['pay_order', { shopEns: trap, amountUsdt: '3.30', url: 'https://example.invalid/pay' }]]);
      return answer({ status: 'paid', reason: 'MOCK wrong-shop payer claims it paid', receiptTransaction: null });
    }
    if (view.step === 0) return calls('payer', 0, [['get_quote', {}]]);
    if (view.step === 1 && play === 'quote-race') return calls('payer', 1, [['pay_order', {}], ['get_quote', {}], ['get_quote', {}]]);
    if (view.step === 1) {
      const n = play === 'overspend' ? 3 : 1;
      return calls('payer', 1, Array.from({ length: n }, () => ['pay_order', {}]));
    }
    const results = view.results.filter((r) => r.toolName === 'pay_order').map((r) => r.output);
    const paid = results.find((r) => r?.status === 'paid');
    const first = paid ?? results[0] ?? {};
    return answer({ status: first.status ?? 'refused', reason: first.reason ?? first.detail ?? 'done', receiptTransaction: paid?.transaction ?? null });
  };
}

function storefrontScript() {
  return (view) => {
    if (view.step === 0) return calls('storefront', 0, [['catalog_quote', { item: view.task.item, quantity: view.task.quantity }]]);
    const q = last(view, 'catalog_quote') ?? {};
    return answer({ quoteUsdt: q.priceUsdt ?? null, etaMinutes: q.etaMinutes ?? null, message: q.ok ? 'Quoted from the catalog (MOCK).' : 'We do not sell that.' });
  };
}

const STANDING_QUERY = `query Standing($ens: String!) { node(ens: $ens) { ens status reputation(window: D90) { orders cancellations disputes } } }`;

function riskScript(play) {
  return (view) => {
    // W4's data form: code read the ENS state and the standing; they are in the task.
    if (view.task.ens) {
      const ok = view.task.ens.status === 'ACTIVE' && play !== 'declines';
      return answer({ decision: ok ? 'approve' : 'decline', reasons: ok ? [] : [play === 'declines' ? 'MOCK: the risk agent says no' : `ENS status ${view.task.ens.status ?? 'unknown'}`] });
    }
    if (view.step === 0) {
      return calls('risk', 0, [
        ['graphql', { query: STANDING_QUERY, variables: { ens: view.task.buyerAgent } }],
        ['ens_check', { name: view.task.buyerAgent }],
      ]);
    }
    const ens = last(view, 'ens_check');
    const ok = ens?.status === 'ACTIVE';
    return answer({ decision: ok ? 'approve' : 'decline', reasons: ok ? [] : [`ENS status ${ens?.status ?? 'unknown'}`] });
  };
}

function dispatchScript() {
  return (view) => {
    if (view.step === 0) return calls('dispatch', 0, [['dispatch_confirm', view.task]]);
    const d = last(view, 'dispatch_confirm') ?? {};
    return answer({ confirmed: d.confirmed === true, orderId: d.orderId ?? view.task.orderId, etaIso: d.etaIso ?? '', message: 'Dispatched (MOCK courier).' });
  };
}

// A step as a V4 generate result. `fault` tests the edges: 'empty' (no text),
// 'max-tokens' (a cut-off reply), 'two-blocks' (the answer twice), 'throw:<text>'.
function toResult(step, fault) {
  if (fault?.startsWith('throw:')) throw new Error(fault.slice(6));
  if (step.toolCalls) {
    return {
      content: step.toolCalls.map((c) => ({ type: 'tool-call', toolCallId: c.toolCallId, toolName: c.toolName, input: JSON.stringify(c.input) })),
      finishReason: { unified: 'tool-calls', raw: 'tool_use' },
      usage: USAGE,
      warnings: [],
    };
  }
  if (fault === 'empty') return { content: [], finishReason: { unified: 'stop', raw: 'end_turn' }, usage: USAGE, warnings: [] };
  if (fault === 'max-tokens') return { content: [{ type: 'text', text: step.text.slice(0, 12) }], finishReason: { unified: 'length', raw: 'max_tokens' }, usage: USAGE, warnings: [] };
  const content = fault === 'two-blocks' ? [{ type: 'text', text: step.text }, { type: 'text', text: step.text }] : [{ type: 'text', text: step.text }];
  return { content, finishReason: { unified: 'stop', raw: 'end_turn' }, usage: USAGE, warnings: [] };
}

// role → MockLanguageModelV4. `play[role]` picks a bad play; `faults[role]` an edge.
export function createScriptedModels({ cast, play = {}, faults = {} }) {
  const scripts = {
    concierge: conciergeScript(play.concierge),
    scout: scoutScript(),
    analyst: analystScript(play.analyst, cast),
    payer: payerScript(play.payer, cast),
    storefront: storefrontScript(),
    risk: riskScript(play.risk),
    dispatch: dispatchScript(),
  };
  const seen = { prompts: {} };
  const factory = (role) => {
    const script = scripts[role];
    if (!script) return null;
    return new MockLanguageModelV4({
      provider: 'mock',
      modelId: `mock-${role}`,
      doGenerate: async (options) => {
        const view = readPrompt(options.prompt);
        (seen.prompts[role] ??= []).push(view.system);
        const step = script(view);
        const fault = faults[role];
        return toResult(step, typeof fault === 'function' ? fault(view) : step.toolCalls ? (fault?.startsWith('throw:') ? fault : undefined) : fault);
      },
    });
  };
  factory.seen = seen;
  return factory;
}
