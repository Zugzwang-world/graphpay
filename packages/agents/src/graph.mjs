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
  if (Array.isArray(answer?.errors) && answer.errors.length > 0) {
    return { ok: false, reason: 'GRAPH_READ_FAILED', detail: String(answer.errors[0]?.message ?? 'graphql error').slice(0, 300) };
  }
  const nodes = answer?.data?.nodes;
  if (!Array.isArray(nodes)) return { ok: false, reason: 'GRAPH_READ_FAILED', detail: 'the answer has no nodes' };
  const arkiv = answer.extensions?.arkiv ?? {};
  return { ok: true, tallies: talliesFromNodes(nodes), explainId: arkiv.explainId ?? null, calls: arkiv.calls ?? null };
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

// The MCP tools the model sees, traced into the run log. `onResult` lets the
// analyst's phase remember the explain id of its own `graphql` answer.
export function tracedMcpTools(tools, log, agent, { only, executed, onResult } = {}) {
  const out = {};
  for (const [name, t] of Object.entries(tools ?? {})) {
    if (only && !only.includes(name)) continue;
    if (typeof t?.execute !== 'function') continue;
    out[name] = {
      ...t,
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
