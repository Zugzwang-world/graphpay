// @graphpay/agents: the buyer and shop teams (planning/SPEC/AGENTS.md). The live
// services reach the agents only through the interfaces below; Join wires the
// real ones in M12 (ENS: resolvePayee, readAccepts, ensCheck, nodeOf; Arkiv:
// directory, findQuotes, shopKey, McpLike; payments: sign, the shop API).

import type { LanguageModel, ToolSet } from 'ai';
import type { z } from 'zod';

// ---- the run log (§9) ------------------------------------------------------

export type TraceEvent =
  | { seq: number; type: 'message'; from: string; to: string; text: string }
  | { seq: number; type: 'agent.start'; agent: string; role: Role; task: unknown }
  | { seq: number; type: 'agent.end'; agent: string; role: Role; output: unknown; usageTokens?: number; model?: string; effort?: string | null; calls?: ModelCall[]; seconds?: number; error?: string }
  | { seq: number; type: 'tool.call'; agent: string; tool: string; input: unknown }
  | { seq: number; type: 'tool.result'; agent: string; tool: string; output: unknown; error?: string }
  | { seq: number; type: 'guard'; guard: string; ok: boolean; detail: string };

/** One model call of an agent (agent.end `calls`): tokens in (of which cached), out (of which
 * reasoning), its API cost, the tools it asked for; on live runs the seconds the model took to
 * answer and the longest of its tools. */
export interface ModelCall {
  input: number;
  cached: number;
  output: number;
  reasoning: number;
  usd: number | null;
  tools: string[];
  seconds?: number | null;
  toolSeconds?: number | null;
}

export interface AgentUsage {
  agent: string;
  role: Role;
  model: string | null;
  effort: string | null;
  seconds: number | null;
  calls: number;
  input: number;
  cached: number;
  output: number;
  reasoning: number;
  usd: number;
  modelSeconds: number;
  perCall: ModelCall[];
  error?: string;
}
export interface ErrandUsage {
  agents: AgentUsage[];
  total: { agents: number; calls: number; input: number; cached: number; output: number; reasoning: number; usd: number; modelSeconds: number };
}
/** Tokens and seconds per agent and per call, from a run log's events (or the site's trace frames). */
export declare function usageOf(events: TraceEvent[]): ErrandUsage;
/** The same as a Markdown table: a row per agent, then a row per call. */
export declare function usageTable(usage: ErrandUsage): string;

export interface RankedShop {
  ens: string;
  score: number;
  eligible: boolean;
  reasons: string[];
}

export interface Receipt {
  success: boolean;
  transaction: string;
  network: string;
  payer: string;
  payTo: string;
  amountUsdt: string;
  asset: string;
  explorerUrl: string;
}

export interface ErrandResult {
  status: 'paid' | 'refused' | 'no-purchase' | 'unsettled';
  chosenShop: string | null;
  priceUsdt: string | null;
  receipt: Receipt | null;
  orderId: string | null;
  arrivesAt: string | null;
  ranking: RankedShop[];
  explainId: string | null;
  refusals: { reason: string; detail: string; agent?: string }[];
  /** Model prose: never shown as a figure (G13). */
  narrative: string | null;
  modelChoice: string | null;
  mandate: { budgetUsdt: string; deadlineIso: string; hash: string } | null;
  synthetic: true;
  error?: string;
}

export interface RunLog {
  schema: 'graphpay.agent-run/v1';
  label: string;
  runId: string;
  mode: 'mock' | 'live';
  model: string;
  synthetic: true;
  cast: unknown;
  request: string;
  edges: { seq: number; from: string; to: string }[];
  events: TraceEvent[];
  result: ErrandResult;
  usageTokens: number;
  apiCostUsd: number;
}

// ---- the live interfaces ----------------------------------------------------

/** An HTTP answer as the payer reads it; header names in any case. */
export interface HttpLike {
  status: number;
  headers?: Record<string, string> | Headers;
  body?: unknown;
}

/** x402 header codec. The default is base64 JSON; Join may pass @x402/core/http's. */
export interface X402Codec {
  decodePaymentRequired(value: string | undefined): unknown;
  encodePaymentRequired?(value: unknown): string;
  encodePaymentSignature(payload: unknown): string;
  decodePaymentResponse(value: string | undefined): unknown;
}

/** The graph's MCP tools (planning/SPEC/ARKIV_GRAPH.md §6). */
export interface McpLike {
  /** The model-facing tools, e.g. `await createMCPClient(...).tools()` from @ai-sdk/mcp. */
  tools(): Promise<ToolSet>;
  /** Code's own calls, answered as parsed JSON: { sdl } | { text } | { data, errors?, extensions } | the explain trace. */
  call(name: 'schema' | 'ask' | 'graphql' | 'explain', args: Record<string, unknown>): Promise<any>;
}

export interface QuoteRequest {
  shopEns: string;
  item: string;
  quantity: number;
  buyer: string;
  payer: string;
  wallet: string;
  requestId: string;
  deadlineIso: string;
}

/** What a shop answers to a buyer: an in-process gateway (createShopGateway) or an HTTP client to one. */
export interface ShopClient {
  quote(req: QuoteRequest): Promise<
    | { ok: true; quote: { shop: string; item: string; quantity: number; priceMicro: string; etaMinutes: number; validUntil: number; orderId: string }; terms: Record<string, unknown>; payUrl: string; synthetic?: boolean }
    | { ok: false; refused: string; reasons: string[] }
  >;
  /** Without `signature`: the 402. With it: the settlement. */
  pay(req: { payUrl: string; terms: Record<string, unknown>; requestId: string; signature?: string }): Promise<HttpLike>;
}

/** The shop API behind a gateway (planning/SPEC/PAYMENTS_WHITECHAIN.md §6), adapted to these shapes. */
export interface ShopSurface {
  quote(req: QuoteRequest & { shopEns: string }): Promise<{
    shop: string;
    item: string;
    quantity: number;
    priceMicro: string | number;
    etaMinutes: number;
    /** unix seconds */
    validUntil: number;
    orderId: string;
    terms: Record<string, unknown>;
    /** the shop API's own pay URL */
    payUrl: string;
  }>;
  pay(req: { payUrl: string; terms: Record<string, unknown>; requestId: string; signature?: string }): Promise<HttpLike>;
  /** On-chain status of an order: NONE, CREATED, PAID, DELIVERED, CANCELLED, REFUNDED. */
  orderStatus(orderId: string): Promise<{ status: string }>;
}

export interface EnsCheck {
  name: string;
  registryState: 'REGISTERED' | 'EXPIRED' | 'UNREGISTERED' | 'UNKNOWN';
  status: 'ACTIVE' | 'PAUSED' | 'REVOKED' | 'EXPIRED' | 'UNKNOWN';
  records: Record<string, unknown>;
}

/** A quote entity on Arkiv (docs/plan/amendments/M7-arkiv.md §5), owner W_DIRECTORY checked by the reader. */
export interface QuoteEntity {
  key: string;
  requestId: string;
  shopKey: string;
  agentEns: string;
  priceMicro: string | number | bigint;
  /** unix seconds */
  validUntil: number;
}

/** What an in-process shop gateway shares with the errand that calls it. */
export interface TeamContext {
  log: unknown;
  models: ModelFactory;
  meter: unknown;
  sdl: string;
  clock: () => number;
  signal?: AbortSignal;
  codec?: X402Codec;
}

export interface LiveHooks {
  /** Shop names for a category and city (Arkiv discovery around the persona; M7 amendment §6). */
  directory(q: { category: string; city: string }): Promise<string[]>;
  /** A shop's catalog: items priced per piece (unitPriceMicro) or per pack (priceMicro for quantity). */
  catalog(shopEns: string): Promise<{ items: { sku?: string; item?: string; name?: string; unitPriceMicro?: number | string; priceMicro?: number | string; quantity?: number; stock?: number; etaMinutes: number; distanceKm?: number }[]; synthetic?: boolean }>;
  /** The agent-facing base URL of a shop's storefront; the payer pays only below it. */
  storefrontUrl(shopEns: string): Promise<string>;
  shopClient(shopEns: string, team: TeamContext): ShopClient | Promise<ShopClient>;
  /** The paying agent's wallet address (by cast key: payer, rehearsal, acceptance…). */
  payerWallet(key: string): Promise<string>;
  /** ENS namehash of a name. */
  nodeOf(name: string): Promise<string>;
  /** T2's resolvePayee: the shop's Whitechain address (coin type 2147485522), read now. */
  resolvePayee(shopEns: string): Promise<string | null>;
  /** T2's readAccepts, as { network: 'eip155:<chain>', asset } entries. */
  readAccepts(shopEns: string): Promise<{ network: string; asset: string }[]>;
  /** T3's findQuotes(requestId). */
  findQuotes(requestId: string): Promise<QuoteEntity[]>;
  /** keccak256(abi.encode(node, uint32 epoch)) of a shop at its current epoch. */
  shopKey(shopEns: string): Promise<string>;
  /** The ENS gate's ens_check (registry state, not resolution). */
  ensCheck(name: string): Promise<EnsCheck>;
  /** Signs the checked requirement; returns the PAYMENT-SIGNATURE header value. Called only after every check passed. */
  sign(input: {
    paymentRequired: unknown;
    requirement: Record<string, any>;
    mandate: { budgetUsdt: string; deadlineIso: string; hash: string };
    payerEns: string;
    approved: { shopEns: string; orderId: string; amountMicro: bigint };
  }): Promise<string>;
  /** Contract addresses the payer may sign for; default: the config's whitechain.contracts. */
  contracts?: string[];
  x402?: X402Codec;
  /**
   * Optional, no-op when absent (EVENT_ADDENDUM A7). Called at an agent's first start, then 'renew'
   * every PRESENCE_RENEW_MS while the errand runs. Fire and forget: errors are logged, never thrown.
   */
  presence?(phase: 'start' | 'renew', info: { agentEns: string; ownerEns: string; role: Role; session: string }): void | Promise<void>;
  /** Optional, no-op when absent (A8): every message edge between two agents; `step` is the explainer lane. */
  handoff?(from: string, to: string, step: HandoffStep, info: { requestId: string }): void | Promise<void>;
}

export type HandoffStep = 'ask' | 'check' | 'check-back' | 'quote' | 'pay';
export declare const STEPS: { readonly ask: 'ask'; readonly check: 'check'; readonly checkBack: 'check-back'; readonly quote: 'quote'; readonly pay: 'pay' };
export declare const PRESENCE_RENEW_MS: number;

// ---- running an errand ------------------------------------------------------

export type Role = 'concierge' | 'scout' | 'analyst' | 'payer' | 'storefront' | 'risk' | 'dispatch';

export interface ModelChoice {
  model: LanguageModel;
  settings: { preset: string; role: string; provider: string; model: string; effort: string | null; maxTokens: number | null };
  callSettings: Record<string, unknown>;
}
export type ModelFactory = (role: Role) => ModelChoice;

export interface ErrandOptions {
  /** Default: the story order's request (packages/config/story.json). Code reads its budget and its
   * deadline: a clock time today ("by 8 pm") or a span from the request ("within an hour"). */
  request?: string;
  /** ms; fixes the clock for deterministic runs. */
  now?: number;
  clock?: () => number;
  /** AGENT_MODE, AGENT_PRESET and the keys of the preset's providers (ANTHROPIC_API_KEY, KIMI_API_KEY). Default: process.env. */
  env?: Record<string, string | undefined>;
  /** `anthropic` is the old name of `live`. */
  mode?: 'mock' | 'live' | 'anthropic';
  models?: ModelFactory;
  mockModels?: (role: Role) => LanguageModel | null;
  /** E2E_BUYER: the cast key of the paying agent (default "payer"). */
  buyer?: string;
  hooks: LiveHooks;
  mcp: McpLike;
  runId?: string;
  label?: string;
  /** Called with every event as it happens (the website's SSE feed). */
  onEvent?: (event: TraceEvent) => void;
  /** Extra secret values to scrub from the log. */
  secrets?: string[];
  cast?: TeamCast;
  signal?: AbortSignal;
  /** Run every pre-sign check, then stop with DRY_RUN: nothing is signed (acceptance B9 b, D10). */
  dryRun?: boolean;
  /** Per-call seconds in the run log (default: on for live runs, off for mock runs, so two mock run logs stay byte-identical). */
  timing?: boolean;
  /** Presence renewal period in ms (default PRESENCE_RENEW_MS), and the timer functions (tests). */
  presenceRenewMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (timer: any) => void;
}

export interface ErrandMetrics {
  seconds: number;
  calls: number;
  tokens: number;
  apiCostUsd: number;
  byRole: Record<string, { calls: number; tokens: number; costUsd: number }>;
  usage: ErrandUsage;
}

export declare function runErrand(options: ErrandOptions): Promise<{ runLog: RunLog; metrics: ErrandMetrics; state: RunState }>;

export interface TeamCast {
  key: string;
  root: string;
  city: { name: string; timeZone: string; currency: string };
  persona: { key: string; displayName: string; ens: string };
  buyer: Record<string, string>;
  payers: Record<string, { key: string; ens: string; walletRole: string; capMicro: bigint }>;
  shops: { key: string; label: string; displayName: string; storyRole: string; ens: string; category: string; products: unknown[]; scenario: Record<string, number | boolean>; agents: Record<string, string> }[];
  order: Record<string, any>;
  food: { item: string; quantity: number; category: string };
  shopByRole(role: string): TeamCast['shops'][number];
  shopByEns(name: string): TeamCast['shops'][number] | null;
  shopAgentNames(shopEns: string): Record<string, string>;
}

export interface RunState {
  mandate: { budgetUsdt: string; budgetMicro: bigint; deadlineIso: string; deadlineMs: number; hash: string } | null;
  need: Record<string, any> | null;
  offers: Map<string, unknown>;
  ranking: RankedShop[] | null;
  explainId: string | null;
  scoutDone: boolean;
  analystDone: boolean;
  paying: { shopEns: string; priceMicro: bigint } | null;
  payment: Record<string, any> | null;
  spentMicro: bigint;
  reservedMicro: bigint;
  refusals: { reason: string; detail: string; agent?: string }[];
  [k: string]: unknown;
}

export declare const ROOT: string;
export declare const SHOP_ROLES: readonly string[];
export declare function teamCast(cast?: unknown, root?: string): TeamCast;

export declare function createShopGateway(ctx: {
  shopEns: string;
  surface: ShopSurface;
  mcp: McpLike;
  hooks: Pick<LiveHooks, 'ensCheck'>;
  storefront: string;
  names: Record<string, string>;
} & TeamContext): ShopClient;

export declare function presignCheck(input: {
  paymentRequired: unknown;
  approved: { shopEns: string; storefront: string; maxPriceMicro: bigint };
  pending: { orderId: string; payUrl: string; priceMicro: bigint; etaMinutes: number };
  payerEns: string;
  buyerEns: string;
  requestId: string;
  hooks: Pick<LiveHooks, 'nodeOf' | 'resolvePayee' | 'readAccepts' | 'findQuotes' | 'shopKey'>;
  now: number;
  budgetLeftMicro: bigint;
  contracts?: Set<string>;
}): Promise<{ ok: true; requirement: Record<string, any>; amountMicro: bigint; paymentRequired: unknown; quoteEntity: QuoteEntity } | { ok: false; reason: string; detail: string; requote?: boolean }>;

export declare function resolveAgentMode(env?: Record<string, string | undefined>): 'mock' | 'live';
export declare function createModelFactory(options: { mode: 'mock' | 'live'; env?: Record<string, string | undefined>; mocks?: (role: Role) => LanguageModel | null }): ModelFactory;
export declare const AGENT_MODES: readonly ['mock', 'live', 'anthropic', 'auto'];

export declare function parseMandate(
  request: string,
  options: { now: number; timeZone: string; currency: string; buyer: string },
): { ok: true; mandate: NonNullable<RunState['mandate']> & { currency: string; buyer: string } } | { ok: false; reason: string; detail: string };

export declare function toMicro(text: string): bigint;
export declare function fromMicro(micro: bigint | number | string): string;
export declare function displayUsdt(micro: bigint | number | string): string;

export declare function rankShops(tallies: unknown[], volumeRef: number): RankedShop[];
export declare function volumeReference(cast: TeamCast): number;
export declare const RANKING_QUERY: string;
export declare const PAYMENT_NETWORK: string;
export declare const PAYMENT_ASSET: string;
export declare const base64JsonCodec: X402Codec & { encode(v: unknown): string; decode(v: string): unknown };
export declare const TAIL: string;
export declare function promptFor(role: Role, options?: { sdl?: string }): string;
export declare const OUTPUTS: Record<Role, z.ZodType>;
// The remaining exports of index.mjs are the building blocks the tests use.
