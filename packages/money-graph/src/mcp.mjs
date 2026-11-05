// The hosted MCP server (planning/SPEC/ARKIV_GRAPH.md §6, M7 amendment §8, ADR-0037):
// read-only tools `schema`, `ask`, `graphql` and `explain`, no model inside, Streamable
// HTTP, stateless (a server and transport per request; ADR-0003), at most 50 rows, a
// stricter GraphQL limit than the server's (6 top-level fields, depth 4, 4,000
// characters), names normalised (ENSIP-15) and the empty name refused.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { normalizedName } from './identity.mjs';
import { SDL, runGraphql, usdt } from './graphql.mjs';

export const MCP_TOOLS = ['schema', 'ask', 'graphql', 'explain'];
const MCP_LIMITS = { maxFields: 6, maxDepth: 4, maxChars: 4000 };
const MCP_CALLS = 25;

const text = (t) => ({ content: [{ type: 'text', text: t }] });
const fail = (t) => ({ content: [{ type: 'text', text: t }], isError: true });

function names(list) {
  if (!Array.isArray(list) || list.length === 0 || list.length > 10) throw new Error('give 1 to 10 ENS names');
  return list.map((n) => normalizedName(n));
}

// The fixed GraphQL document for each intent.
export function askDocument({ intent, ens = [], order_id, window = 'D90', verify = false }) {
  if (intent === 'order_trail') {
    if (typeof order_id !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(order_id)) throw new Error('order_trail needs order_id, a 32-byte hex string');
    return { query: `{ order(id: ${JSON.stringify(order_id.toLowerCase())}) { kind from { ens } to { ens } amountMicro day ref } }`, columns: ['kind', 'from', 'to', 'amount_micro', 'day', 'ref'] };
  }
  const list = names(ens);
  if (intent === 'buyer_risk') {
    // The buyer's standing as the shop's risk check reads it (packages/agents parseBuyerRisk):
    // status and cap from the node row, the window's orders, cancellations and disputes, today's
    // spend, and the principal (the owner) with its verified flag.
    const body = list
      .map((n, i) => `n${i}: node(ens: ${JSON.stringify(n)}) { ens status capMicro owner { ens verified } reputation(window: ${window}, verify: ${verify ? 'true' : 'false'}) { orders cancellations disputes } today: reputation(window: TODAY) { paidUsdt } }`)
      .join(' ');
    return { query: `{ ${body} }`, columns: BUYER_COLUMNS };
  }
  const fields = 'orders refunds fails delivered onTime disputes refundRate onTimeRate paidUsdt refundedUsdt source synthetic';
  const body = list.map((n, i) => `n${i}: node(ens: ${JSON.stringify(n)}) { ens epoch reputation(window: ${window}, verify: ${verify ? 'true' : 'false'}) { ${fields} } }`).join(' ');
  return { query: `{ ${body} }`, columns: ['ens', 'epoch', ...fields.split(' ')] };
}

const BUYER_COLUMNS = ['ens', 'status', 'orders', 'cancellations', 'disputes', 'daily_cap_usdt', 'spend_today_usdt', 'principal', 'principal_verified'];

export function askTable(intent, data, columns) {
  const rows = [columns.join('\t')];
  if (intent === 'buyer_risk') {
    for (const n of Object.values(data ?? {})) {
      if (!n) continue;
      const rep = n.reputation ?? {};
      rows.push([n.ens, n.status ?? 'unknown', rep.orders ?? 0, rep.cancellations ?? 0, rep.disputes ?? 0, usdt(n.capMicro ?? 0), n.today?.paidUsdt ?? '0', n.owner?.ens ?? '', n.owner?.verified ? 'true' : 'false'].join('\t'));
    }
  } else if (intent === 'order_trail') {
    for (const e of data.order ?? []) rows.push([e.kind, e.from?.ens ?? '', e.to?.ens ?? '', e.amountMicro, e.day, e.ref].join('\t'));
  } else {
    const list = Object.values(data ?? {});
    if (intent === 'compare_shops') list.sort((a, b) => Number(a.reputation.refundRate) - Number(b.reputation.refundRate));
    for (const n of list) rows.push([n.ens, n.epoch, ...columns.slice(2).map((c) => n.reputation[c])].join('\t'));
  }
  return rows.join('\n');
}

export function createMcpServer({ engine, dataset = 'live' }) {
  const server = new McpServer({ name: 'graphpay-arkiv', version: '1.0.0' });
  server.registerTool('schema', { description: 'The GraphQL schema (SDL) of the GraphPay money graph on Arkiv.', inputSchema: {} }, async () => text(JSON.stringify({ sdl: SDL })));
  server.registerTool(
    'ask',
    {
      description: 'A fixed money question about ENS names, answered from Arkiv with an explain trace: shop_reputation, buyer_risk, compare_shops (ens: 1–10 names) or order_trail (order_id).',
      inputSchema: {
        intent: z.enum(['shop_reputation', 'buyer_risk', 'compare_shops', 'order_trail']),
        ens: z.array(z.string()).max(10).optional(),
        order_id: z.string().optional(),
        window: z.enum(['D30', 'D90', 'ALL']).default('D90'),
        verify: z.boolean().default(false),
      },
    },
    async (args) => {
      let doc;
      try {
        doc = askDocument(args);
      } catch (error) {
        return fail(error.message);
      }
      const r = await runGraphql({ engine, query: doc.query, dataset, listCap: 50, limits: { maxFields: 10, maxDepth: 4 }, callBudget: MCP_CALLS });
      if (r.errors) return fail(r.errors.map((e) => e.message).join('; '));
      return text(`${askTable(args.intent, r.data, doc.columns)}\nexplain=${r.extensions.arkiv.explainId} calls=${r.extensions.arkiv.calls}`);
    },
  );
  server.registerTool(
    'graphql',
    { description: 'One read-only GraphQL query (at most 4,000 characters, 6 top-level fields, depth 4, 50 rows) with its explain id and the Arkiv calls it made.', inputSchema: { query: z.string().max(4000), variables: z.record(z.string(), z.unknown()).optional() } },
    async ({ query, variables }) => {
      const r = await runGraphql({ engine, query, variables: variables ?? {}, dataset, limits: MCP_LIMITS, listCap: 50, callBudget: MCP_CALLS });
      const out = { data: r.data ?? null, ...(r.errors ? { errors: r.errors } : {}), extensions: { arkiv: { calls: r.extensions?.arkiv?.calls ?? 0, explainId: r.extensions?.arkiv?.explainId ?? null, entityKeys: r.extensions?.arkiv?.entityKeys ?? [] } } };
      return r.errors && !r.data ? fail(JSON.stringify(out)) : text(JSON.stringify(out));
    },
  );
  server.registerTool('explain', { description: 'The trace of an earlier answer: every Arkiv read, by explain id.', inputSchema: { explainId: z.string().regex(/^[0-9a-f]{12}$/) } }, async ({ explainId }) => {
    const t = engine.explainStore.get(explainId);
    if (!t) return fail(`no trace for ${explainId} on this instance (the last 200 are kept)`);
    return text(JSON.stringify({ calls: t.calls, queries: t.queries, entityKeys: t.entityKeys, blockNumber: t.blockNumber, note: t.truncated ? 'truncated: a row cap was reached' : 'complete' }));
  });
  return server;
}

// A stateless Streamable HTTP handler: Request in, Response out.
export async function handleMcpRequest(request, { engine, dataset = 'live' }) {
  const server = createMcpServer({ engine, dataset });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(request);
}
