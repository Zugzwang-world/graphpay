// Code's own reads of the graph, through the same MCP tools the agents use.
// The ranking comes from code's fixed GraphQL query, never a model-written one
// (G2: a model query can alias `refundRate: fails`; G15: or pick another window).
// The buyer's standing for a shop's risk step comes from `ask(buyer_risk)`.

import { toMicro } from './money.mjs';
import { errorText } from './scrub.mjs';
import { talliesFromNodes } from './scoring.mjs';

// Against the SDL of planning/SPEC/ARKIV_GRAPH.md §5 ("one call ranks every shop").
export const RANKING_QUERY = `query GraphPayRanking($category: String!, $city: String!) {
  nodes(kind: "shop", category: $category, city: $city, limit: 50) {
    ens
    verified
    status
    reputation(window: D90) {
      orders
      refundRate
      onTimeRate
      source
      synthetic
    }
  }
}`;

// → { ok: true, tallies, explainId, calls } or { ok: false, reason, detail }.
export async function readRanking(mcp, { category, city, query = RANKING_QUERY }) {
  let answer;
  try {
    answer = await mcp.call('graphql', { query, variables: { category, city: city.toLowerCase() } });
  } catch (error) {
    return { ok: false, reason: 'GRAPH_READ_FAILED', detail: errorText(error) };
  }
  return rankingFromAnswer(answer);
}

// The tallies of a ranking query's answer: parsed (code's `mcp.call`), or as the MCP tool gave it
// (W4: code runs the query through the analyst's traced tool). Also → `answer`, the parsed JSON.
export function rankingFromAnswer(raw) {
  const answer = mcpJson(raw);
  if (Array.isArray(answer?.errors) && answer.errors.length > 0) {
    return { ok: false, reason: 'GRAPH_READ_FAILED', detail: String(answer.errors[0]?.message ?? 'graphql error').slice(0, 300) };
  }
  if (raw?.isError) return { ok: false, reason: 'GRAPH_READ_FAILED', detail: 'the graph answered an error' };
  const nodes = answer?.data?.nodes;
  if (!Array.isArray(nodes)) return { ok: false, reason: 'GRAPH_READ_FAILED', detail: 'the answer has no nodes' };
  const arkiv = answer.extensions?.arkiv ?? {};
  return { ok: true, tallies: talliesFromNodes(nodes), explainId: arkiv.explainId ?? null, calls: arkiv.calls ?? null, answer };
}

const COLUMNS = ['ens', 'status', 'orders', 'cancellations', 'disputes', 'daily_cap_usdt', 'spend_today_usdt', 'principal', 'principal_verified'];

// The `ask(buyer_risk)` table: a TSV header and rows, then `explain=<id> calls=<n>`.
export function parseBuyerRisk(text, ens) {
  if (typeof text !== 'string') return null;
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '' && !l.startsWith('explain='));
  if (lines.length < 2) return null;
  const head = lines[0].split('\t').map((h) => h.trim());
  if (!COLUMNS.every((c) => head.includes(c))) return null;
  for (const line of lines.slice(1)) {
    const cells = line.split('\t');
    const row = Object.fromEntries(head.map((h, i) => [h, (cells[i] ?? '').trim()]));
    if (row.ens !== ens) continue;
    const int = (v) => (/^\d{1,12}$/.test(v) ? Number(v) : null);
    const orders = int(row.orders);
    const cancellations = int(row.cancellations);
    const disputes = int(row.disputes);
    let dailyCapMicro;
    let spendTodayMicro;
    try {
      dailyCapMicro = toMicro(row.daily_cap_usdt);
      spendTodayMicro = toMicro(row.spend_today_usdt);
    } catch {
      return null;
    }
    if (orders === null || cancellations === null || disputes === null) return null;
    return {
      ens,
      status: row.status.toUpperCase(),
      orders,
      cancellations,
      disputes,
      dailyCapMicro,
      spendTodayMicro,
      principal: { ens: row.principal, verifiedOwner: row.principal_verified === 'true' },
    };
  }
  return null;
}

export async function readBuyerStanding(mcp, ens) {
  let answer;
  try {
    answer = await mcp.call('ask', { intent: 'buyer_risk', ens: [ens], window: 'D90', verify: false });
  } catch (error) {
    return { ok: false, reason: 'GRAPH_READ_FAILED', detail: errorText(error) };
  }
  const standing = parseBuyerRisk(answer?.text, ens);
  if (!standing) return { ok: false, reason: 'GRAPH_READ_FAILED', detail: `no readable standing for ${ens}` };
  const explain = /explain=([0-9a-f]+)/.exec(answer.text);
  return { ok: true, standing, explainId: explain ? explain[1] : null };
}

// An MCP tool's answer as JSON: the hosted server's `{ content: [{ type: 'text', text }] }`, or
// the mocks' plain object. Null when it is neither.
export function mcpJson(output) {
  if (Array.isArray(output?.content)) {
    const text = output.content.filter((c) => c?.type === 'text').map((c) => c.text).join('\n');
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  return output && typeof output === 'object' ? output : null;
}

// What the model reads of a graph answer (W4: shorter tool replies). The run log keeps the
// whole answer for the screens and the explainer (the entity keys behind every read, about
// 17,000 characters on production); the model needs the data, the errors, and the explain id
// and read count that `explain` takes.
function arkivOf(answer) {
  const a = answer?.extensions?.arkiv ?? {};
  return { explainId: a.explainId ?? null, calls: a.calls ?? null };
}
export const MODEL_VIEW = Object.freeze({
  graphql: (answer) => ({
    data: answer.data ?? null,
    ...(Array.isArray(answer.errors) && answer.errors.length ? { errors: answer.errors.slice(0, 3).map((e) => String(e?.message ?? e).slice(0, 300)) } : {}),
    extensions: { arkiv: arkivOf(answer) },
  }),
  explain: (trace) => ({
    calls: trace.calls ?? null,
    reads: Array.isArray(trace.queries) ? trace.queries.length : null,
    entities: Array.isArray(trace.entityKeys) ? trace.entityKeys.length : null,
    blockNumber: trace.blockNumber ?? null,
    note: trace.note ?? null,
    shown: 'the full trace is on the human’s screen',
  }),
});

// The model's view of one MCP answer: the short view when the answer reads as JSON, otherwise the
// tool's own conversion (text as it came).
function modelOutputOf(name, t) {
  const view = MODEL_VIEW[name];
  if (!view) return t.toModelOutput;
  return async (arg) => {
    const answer = mcpJson(arg?.output);
    if (answer && !arg?.output?.isError) return { type: 'json', value: view(answer) };
    return t.toModelOutput ? t.toModelOutput(arg) : { type: 'json', value: arg?.output ?? null };
  };
}

// The MCP tools the model sees, traced into the run log. `onResult` lets the
// analyst's phase remember the explain id of its own `graphql` answer. The log
// gets each whole answer; the model reads the short view (MODEL_VIEW).
export function tracedMcpTools(tools, log, agent, { only, executed, onResult } = {}) {
  const out = {};
  for (const [name, t] of Object.entries(tools ?? {})) {
    if (only && !only.includes(name)) continue;
    if (typeof t?.execute !== 'function') continue;
    out[name] = {
      ...t,
      toModelOutput: modelOutputOf(name, t),
      execute: async (input, options) => {
        executed?.add(options?.toolCallId);
        log.toolCall(agent, name, input);
        try {
          const output = await t.execute(input, options);
          log.toolResult(agent, name, output);
          onResult?.(name, output);
          return output;
        } catch (error) {
          const message = log.scrub(errorText(error));
          log.toolResult(agent, name, null, message);
          throw new Error(message);
        }
      },
    };
  }
  return out;
}
