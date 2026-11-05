// Mock services behind the live interfaces (planning/PROMPTS/10-agents.md step 3):
// MCP over a fixture executed by real graphql-js, a shop API with the x402 flow
// (free quote, 402 on pay, settle with a signature), an ENS check, a quote
// store standing in for Arkiv. Every value is MOCK or SYNTHETIC and labelled;
// numbers come from the story config's scenario (ADR-0047).

import { createHash } from 'node:crypto';
import { tool } from 'ai';
import { buildSchema, graphql } from 'graphql';
import { z } from 'zod';
import { createShopGateway } from '../src/shop.mjs';
import { PAYMENT_ASSET, PAYMENT_NETWORK } from '../src/payer.mjs';
import { base64JsonCodec } from '../src/x402.mjs';

const hex = (text, length = 64) => createHash('sha256').update(text).digest('hex').slice(0, length);
export const mockAddress = (label) => `0x${hex(`address:${label}`, 40)}`;
export const mockNode = (name) => `0x${hex(`node:${name}`)}`;
export const mockTx = (label) => `0x${hex(`tx:${label}`)}`;
// A made-up contract address for mock 402s (never a real one: `pnpm check` knows those).
export const MOCK_CONTRACT = `0x${'0'.repeat(36)}c0de`;
export const MOCK_HOST = 'https://agents.mock.invalid';

// Rates as the graph returns them: 4-place decimal strings, rounded down.
const rate4 = (x) => (Math.floor(Math.round(x * 1e8) / 1e4) / 1e4).toFixed(4);

// The fixture SDL: the part of planning/SPEC/ARKIV_GRAPH.md §5 the agents read.
export const MOCK_SDL = `"""MOCK graph (fixture). The real SDL comes from the schema tool of Graph Arkiv."""
scalar U64

enum Window {
  TODAY
  D30
  D90
  ALL
}

enum ReputationSource {
  TALLY
  RAW_VERIFIED
  MISMATCH
  TRUNCATED
}

type Reputation {
  orders: U64!
  refunds: U64!
  fails: U64!
  delivered: U64!
  onTime: U64!
  cancellations: U64!
  disputes: U64!
  refundRate: String!
  onTimeRate: String!
  source: ReputationSource!
  synthetic: Boolean!
}

type Node {
  ens: String!
  kind: String!
  verified: Boolean!
  synthetic: Boolean!
  dataset: String
  category: String
  city: String
  status: String
  capMicro: U64
  reputation(window: Window = D90, verify: Boolean = false): Reputation
}

type Query {
  node(ens: String!): Node
  nodes(kind: String, category: String, city: String, ens: [String!], limit: Int = 50): [Node!]!
}
`;

// The graph's rows: the cast shops from their scenario numbers (90 days), and
// every paying agent with a clean standing. `overrides[ens]` patches a row.
export function mockGraphRows(cast, overrides = {}) {
  const rows = [];
  for (const shop of cast.shops) {
    const s = shop.scenario;
    const orders = Number(s.orders90d);
    rows.push({
      ens: shop.ens,
      kind: 'shop',
      verified: s.verified === true,
      synthetic: true,
      dataset: 'mock',
      category: shop.category,
      city: cast.city.name.toLowerCase(),
      status: 'active',
      capMicro: null,
      d90: {
        orders,
        refunds: Math.round(orders * s.refundRate90d),
        fails: 0,
        delivered: orders,
        onTime: Math.round(orders * s.onTimeRate),
        cancellations: 0,
        disputes: 0,
        refundRate: rate4(s.refundRate90d),
        onTimeRate: rate4(s.onTimeRate),
        source: 'TALLY',
      },
      ...overrides[shop.ens],
    });
  }
  for (const agent of Object.values(cast.payers)) {
    rows.push({
      ens: agent.ens,
      kind: 'agent',
      verified: true,
      synthetic: true,
      dataset: 'mock',
      category: null,
      city: null,
      status: 'active',
      capMicro: agent.capMicro.toString(),
      d90: { orders: 10, refunds: 0, fails: 0, delivered: 10, onTime: 10, cancellations: 0, disputes: 0, refundRate: '0.0000', onTimeRate: '1.0000', source: 'TALLY' },
      spendTodayMicro: 0n,
      principal: cast.persona.ens,
      ...overrides[agent.ens],
    });
  }
  return rows;
}

const usdt = (micro) => {
  const v = BigInt(micro);
  return `${v / 1_000_000n}.${(v % 1_000_000n).toString().padStart(6, '0')}`;
};

export function createMockMcp({ cast, rows = mockGraphRows(cast) } = {}) {
  const schema = buildSchema(MOCK_SDL);
  const traces = new Map();
  const byEns = new Map(rows.map((r) => [r.ens, r]));
  const calls = [];
  const asNode = (r) => ({
    ...r,
    reputation: ({ window }) => (window === 'D90' || window === 'ALL' ? { ...r.d90, synthetic: true } : null),
  });
  const root = {
    node: ({ ens }) => (byEns.has(ens) ? asNode(byEns.get(ens)) : null),
    nodes: ({ kind, category, city, ens, limit }) =>
      rows
        .filter((r) => (kind == null || r.kind === kind) && (category == null || r.category === category) && (city == null || r.city === city) && (ens == null || ens.includes(r.ens)))
        .slice(0, Math.min(limit ?? 50, 50))
        .map(asNode),
  };
  function trace(kind, text, keys) {
    const explainId = hex(`${kind}|${text}`, 12);
    traces.set(explainId, { calls: 2, queries: [`MOCK ${kind}`], entityKeys: keys.map((k) => `0x${hex(`entity:${k}`)}`), blockNumber: 0, note: 'MOCK explain trace (fixture, no Arkiv reads)' });
    return explainId;
  }
  async function runGraphql({ query, variables }) {
    calls.push({ tool: 'graphql', query });
    const answer = await graphql({ schema, source: query, rootValue: root, variableValues: variables ?? {} });
    const explainId = trace('graphql', `${query}|${JSON.stringify(variables ?? {})}`, rows.map((r) => r.ens));
    return {
      data: answer.data ?? null,
      ...(answer.errors ? { errors: answer.errors.map((e) => ({ message: e.message })) } : {}),
      extensions: { arkiv: { calls: 2, explainId, entityKeys: traces.get(explainId).entityKeys, mock: true } },
    };
  }
  function runAsk({ intent, ens = [], window = 'D90' }) {
    calls.push({ tool: 'ask', intent });
    if (intent === 'buyer_risk') {
      const head = 'ens\tstatus\torders\tcancellations\tdisputes\tdaily_cap_usdt\tspend_today_usdt\tprincipal\tprincipal_verified';
      const lines = ens
        .map((name) => byEns.get(name))
        .filter((r) => r && r.kind === 'agent')
        .map((r) => [r.ens, r.status, r.d90.orders, r.d90.cancellations, r.d90.disputes, usdt(r.capMicro ?? 0), usdt(r.spendTodayMicro ?? 0n), r.principal, 'true'].join('\t'));
      return { text: `${head}\n${lines.join('\n')}\nexplain=${trace('ask', `buyer_risk|${ens.join(',')}|${window}`, ens)} calls=2` };
    }
    if (intent === 'compare_shops') {
      const head = 'ens\torders\trefund_rate\ton_time_rate\tverified_owner\tscore';
      const lines = ens.map((name) => byEns.get(name)).filter(Boolean).map((r) => [r.ens, r.d90.orders, r.d90.refundRate, r.d90.onTimeRate, r.verified, ''].join('\t'));
      return { text: `${head}\n${lines.join('\n')}\nexplain=${trace('ask', `compare|${ens.join(',')}`, ens)} calls=2` };
    }
    return { text: `MOCK: intent ${intent} is not in the fixture` };
  }
  const handlers = {
    schema: async () => ({ sdl: MOCK_SDL }),
    ask: async (args) => runAsk(args),
    graphql: async (args) => runGraphql(args),
    explain: async ({ explainId }) => traces.get(explainId) ?? { error: `MOCK: no trace ${explainId}` },
  };
  return {
    calls,
    async call(name, args) {
      if (!handlers[name]) throw new Error(`MOCK MCP has no tool ${name}`);
      return handlers[name](args ?? {});
    },
    async tools() {
      return {
        schema: tool({ description: 'The GraphQL SDL of the GraphPay graph.', inputSchema: z.object({}), execute: handlers.schema }),
        ask: tool({
          description: 'Ask a fixed question of the graph; answers a TSV table and an explain id.',
          inputSchema: z.object({
            intent: z.enum(['shop_reputation', 'buyer_risk', 'compare_shops', 'order_trail']),
            ens: z.array(z.string()).max(10).default([]),
            order_id: z.string().optional(),
            window: z.enum(['D30', 'D90', 'ALL']).default('D90'),
            verify: z.boolean().default(false),
          }),
          execute: handlers.ask,
        }),
        graphql: tool({
          description: 'Run a read-only GraphQL query on the graph (at most 50 rows).',
          inputSchema: z.object({ query: z.string().max(4000), variables: z.record(z.string(), z.unknown()).optional() }),
          execute: handlers.graphql,
        }),
        explain: tool({ description: 'The reads behind an answer, by explain id.', inputSchema: z.object({ explainId: z.string().max(40) }), execute: handlers.explain }),
      };
    },
  };
}

// One shop's API with the x402 flow. `behaviour` bends it for the tests:
// { settle: 'ok'|'502'|'timeout'|'failed'|'refused'|'no-receipt', payTo, extraAccepts,
//   amountBump, quoteEntity: 'write'|'skip-once'|'expired-once'|'wrong-price'|'never' }.
export function createMockShopSurface({ cast, shop, quotes, clock = Date.now, behaviour = {} }) {
  const product = shop.products[0];
  const orders = new Map();
  let skipped = 0;
  const merchant = () => behaviour.payTo ?? mockAddress(shop.ens);
  const surface = {
    paid: [],
    async catalog() {
      return {
        items: [{ sku: product.sku, item: product.name, priceMicro: product.priceMicro, quantity: product.quantity, stock: 100, etaMinutes: shop.scenario.etaMinutes, distanceKm: shop.scenario.distanceKm }],
        synthetic: true,
      };
    },
    async quote({ item, quantity, buyer, payer, wallet }) {
      if (item !== product.name) throw new Error('MOCK shop does not sell that item');
      const priceMicro = (BigInt(product.priceMicro) * BigInt(quantity) + BigInt(product.quantity) - 1n) / BigInt(product.quantity);
      const exp = Math.floor(clock() / 1000) + 600;
      const orderId = `0x${hex(`order:${shop.ens}|${buyer}|${payer}|${wallet}|${item}|${quantity}|${exp}|${orders.size}`)}`;
      const terms = { orderId, shop: shop.ens, item, quantity, priceMicro: priceMicro.toString(), exp, buyer, payer, wallet };
      const payUrl = `https://shop-api.mock.invalid/${shop.label}/orders/${orderId}/pay`;
      orders.set(orderId, { terms, status: 'CREATED', payer, buyer });
      return { shop: shop.ens, item, quantity, priceMicro: priceMicro.toString(), etaMinutes: shop.scenario.etaMinutes, validUntil: exp, orderId, terms, payUrl, synthetic: true };
    },
    async pay({ payUrl, terms, requestId, signature }) {
      const order = orders.get(terms?.orderId);
      if (!order) return { status: 404, headers: {}, body: { reason: 'UNKNOWN_ORDER' } };
      if (order.status === 'PAID') return { status: 200, headers: {}, body: { alreadyPaid: true } };
      const amount = (BigInt(order.terms.priceMicro) + BigInt(behaviour.amountBump ?? 0)).toString();
      const requirement = {
        scheme: 'graphpay-order',
        network: PAYMENT_NETWORK,
        asset: PAYMENT_ASSET,
        amount,
        payTo: merchant(),
        maxTimeoutSeconds: 600,
        extra: {
          contract: MOCK_CONTRACT,
          shopName: shop.ens,
          mandateRequired: true,
          order: {
            orderId: order.terms.orderId,
            parentOrderId: `0x${'0'.repeat(64)}`,
            buyerNode: mockNode(order.buyer),
            shopNode: mockNode(shop.ens),
            payerNode: mockNode(order.payer),
            merchant: merchant(),
            amountMicro: amount,
            deadline: String(order.terms.exp),
            kind: '0',
          },
        },
      };
      if (!signature) {
        const mode = behaviour.quoteEntity ?? 'write';
        const skip = mode === 'never' || (mode === 'skip-once' && skipped++ === 0);
        if (requestId && !skip) {
          const expired = mode === 'expired-once' && skipped++ === 0;
          const key = `0x${hex(`quote:${order.terms.orderId}|${quotes.entries.length}`)}`;
          quotes.entries.push({
            key,
            requestId,
            shopKey: quotes.shopKeyOf(shop.ens),
            agentEns: order.payer,
            priceMicro: mode === 'wrong-price' ? (BigInt(amount) + 1n).toString() : amount,
            validUntil: expired ? Math.floor(clock() / 1000) - 1 : order.terms.exp,
            owner: 'W_DIRECTORY (MOCK)',
          });
          requirement.extra.quoteKey = key;
        }
        const accepts = behaviour.extraAccepts ? [requirement, { ...requirement, payTo: mockAddress('someone else') }] : [requirement];
        const pr = { x402Version: 2, resource: { url: payUrl, description: 'MOCK order' }, accepts };
        return { status: 402, headers: { 'PAYMENT-REQUIRED': base64JsonCodec.encode(pr) }, body: pr };
      }
      const settle = behaviour.settle ?? 'ok';
      surface.signatures = (surface.signatures ?? 0) + 1;
      if (settle === 'timeout') throw new Error('MOCK: the facilitator did not answer in time');
      if (settle === '502') return { status: 502, headers: {}, body: { reason: 'facilitator unavailable' } };
      if (settle === 'no-receipt') return { status: 200, headers: {}, body: { status: 'paid' } };
      const tx = mockTx(order.terms.orderId);
      if (settle === 'failed') {
        return { status: 402, headers: { 'PAYMENT-RESPONSE': base64JsonCodec.encode({ success: false, errorReason: 'SPEND_CAP', transaction: tx, network: PAYMENT_NETWORK }) }, body: {} };
      }
      if (settle === 'refused') {
        return { status: 402, headers: { 'PAYMENT-RESPONSE': base64JsonCodec.encode({ success: false, errorReason: 'ENS_EXPIRED_OR_REVOKED', network: PAYMENT_NETWORK }) }, body: {} };
      }
      order.status = 'PAID';
      surface.paid.push({ orderId: order.terms.orderId, amount, payTo: merchant() });
      const response = { success: true, transaction: tx, network: PAYMENT_NETWORK, payer: order.terms.wallet };
      return { status: 200, headers: { 'PAYMENT-RESPONSE': base64JsonCodec.encode(response) }, body: { status: 'paid', orderId: order.terms.orderId, transaction: tx, delivery: 'pending' } };
    },
    async orderStatus(orderId) {
      return { status: orders.get(orderId)?.status ?? 'NONE' };
    },
  };
  return surface;
}

// The full set of live hooks, mocked. `ens[name]` sets an agent's ENS status
// ('REVOKED', 'PAUSED', 'EXPIRED' or 'error'); `payee[shop]` changes what ENS
// resolves; `shops[shop]` is that shop's behaviour.
export function createMockHooks({ cast, mcp, clock = Date.now, ens = {}, payee = {}, accepts = {}, shops = {} }) {
  const quotes = { entries: [], shopKeyOf: (name) => `0x${hex(`shopkey:${name}:1`)}` };
  const surfaces = new Map(cast.shops.map((s) => [s.ens, createMockShopSurface({ cast, shop: s, quotes, clock, behaviour: shops[s.ens] ?? {} })]));
  const storefrontUrl = (shopEns) => `${MOCK_HOST}/shops/${shopEns.split('.')[0]}`;
  const signed = [];
  const hooks = {
    quotes,
    surfaces,
    signed,
    contracts: [MOCK_CONTRACT],
    x402: base64JsonCodec,
    async directory() {
      return cast.shops.map((s) => s.ens);
    },
    async catalog(shopEns) {
      const surface = surfaces.get(shopEns);
      if (!surface) throw new Error(`MOCK: no shop ${shopEns}`);
      return surface.catalog();
    },
    async storefrontUrl(shopEns) {
      return storefrontUrl(shopEns);
    },
    async payerWallet(key) {
      return mockAddress(`wallet:${key}`);
    },
    async nodeOf(name) {
      return mockNode(name);
    },
    async shopKey(shopEns) {
      return quotes.shopKeyOf(shopEns);
    },
    async findQuotes(requestId) {
      return quotes.entries.filter((q) => q.requestId === requestId);
    },
    async resolvePayee(shopEns) {
      if (payee[shopEns] === 'error') throw new Error('MOCK: the ENS read failed');
      if (shopEns in payee) return payee[shopEns];
      return mockAddress(shopEns);
    },
    async readAccepts(shopEns) {
      return accepts[shopEns] ?? [{ network: PAYMENT_NETWORK, asset: PAYMENT_ASSET }];
    },
    async ensCheck(name) {
      const status = ens[name] ?? 'ACTIVE';
      if (status === 'error') throw new Error('MOCK: the ENS read failed');
      const registryState = status === 'REVOKED' ? 'UNREGISTERED' : status === 'EXPIRED' ? 'EXPIRED' : 'REGISTERED';
      return { name, registryState, status, records: { 'graphpay.status': status === 'PAUSED' ? 'paused' : 'active', 'graphpay.kind': 'agent', mock: true } };
    },
    async sign({ requirement, mandate, payerEns, approved }) {
      signed.push({ orderId: approved.orderId, amount: requirement.amount, payTo: requirement.payTo, mandateHash: mandate.hash, payerEns });
      return base64JsonCodec.encode({ x402Version: 2, accepted: requirement, payload: { mock: true, orderId: approved.orderId, mandateHash: mandate.hash, payerName: payerEns } });
    },
    shopClient(shopEns, team) {
      const surface = surfaces.get(shopEns);
      if (!surface) throw new Error(`MOCK: no shop ${shopEns}`);
      return createShopGateway({ shopEns, surface, mcp, hooks, storefront: storefrontUrl(shopEns), names: cast.shopAgentNames(shopEns), ...team });
    },
  };
  return hooks;
}
