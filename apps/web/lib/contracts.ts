// The website's data contracts: the response shapes of WEBSITE_SPEC.md §7 and the
// agents' run log (planning/SPEC/AGENTS.md §9). Amounts are micro-USDT as decimal
// strings (U64 in GraphQL); hashes and keys are 0x hex.

export type Micro = string;

// GET /api/status
export interface StatusResponse {
  heads: { whitechain: string | null; sepolia: string | null; rabdi: string | null };
  mirrorLagBlocks: number | null;
  relayerWbt: string | null;
  token: 'usdt' | 'standin';
  tokenAddress: string;
  checkout: string | null;
  // Why a value is missing (a source not live yet, or an RPC that did not answer).
  notes: string[];
  at: string;
}

export type AgentStatus = 'ACTIVE' | 'PAUSED' | 'REVOKED' | 'EXPIRED' | 'UNKNOWN';

export interface OrderSummary {
  orderId: string;
  shopEns: string;
  // The graph's edge does not carry what was bought; null until a source does.
  item: string | null;
  quantity: number | null;
  amountMicro: Micro;
  status: 'PAID' | 'DELIVERED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'FAILED';
  transaction: string;
}

export interface SubscriptionSummary {
  subId: string;
  plan: string;
  // The period's label (the story's demo clock, e.g. "2-minute demo period"); periodSeconds is the chain's.
  period: string;
  priceMicro: Micro;
  // null once it is no longer active.
  nextChargeAt: string | null;
  // Charges, newest first, each with its Whitechain transaction (the first charge is in the subscribe transaction).
  renewals: { at: string; transaction: string }[];
  active: boolean;
  // The checkout's own state, the charges so far, and how many more the demo allowance still covers.
  status: 'ACTIVE' | 'LAPSED' | 'CANCELLED';
  cycle: number;
  periodSeconds: number;
  chargesLeft: number;
  item: string;
  shopEns: string;
}

// GET /api/state/customer
export interface CustomerState {
  agent: { ens: string; status: AgentStatus; epoch: number };
  capMicro: Micro;
  spentTodayMicro: Micro;
  // The AgentPolicy's expiry (ISO), when the route reports one.
  policyExpiresAt?: string | null;
  lastOrder: OrderSummary | null;
  subscription: SubscriptionSummary | null;
}

// Agent run log events (graphpay.agent-run/v1, planning/SPEC/AGENTS.md §9; the shapes
// match packages/agents), sequence-numbered.
export type TraceEvent =
  | { seq: number; type: 'message'; from: string; to: string; text: string }
  | { seq: number; type: 'agent.start'; agent: string; role: string; task: unknown }
  | { seq: number; type: 'agent.end'; agent: string; role: string; output: unknown; usageTokens?: number; model?: string; error?: string }
  | { seq: number; type: 'tool.call'; agent: string; tool: string; input: unknown }
  | { seq: number; type: 'tool.result'; agent: string; tool: string; output: unknown; error?: string }
  | { seq: number; type: 'guard'; guard: string; ok: boolean; detail: string };

export interface RankedShop {
  ens: string;
  score: number;
  eligible: boolean;
  reasons: string[];
}

// The errand's result (ErrandResult in packages/agents). Prices, receipts and rankings
// come from tool data; `narrative` is model prose and is never shown as a figure.
export interface RunResult {
  status: 'paid' | 'refused' | 'no-purchase' | 'unsettled';
  chosenShop: string | null;
  priceUsdt: string | null;
  receipt: { success: boolean; transaction: string; network: string; payer: string; payTo: string; amountUsdt: string; asset: string; explorerUrl: string } | null;
  orderId: string | null;
  arrivesAt: string | null;
  ranking: RankedShop[];
  explainId: string | null;
  refusals: { reason: string; detail: string; agent?: string }[];
  narrative: string | null;
  modelChoice: string | null;
  mandate: { budgetUsdt: string; deadlineIso: string; hash: string } | null;
  synthetic: true;
  error?: string;
}

// POST /api/agents/run answers a server-sent stream: `started`, then `trace` for every
// event, then `result` (or `failed`). The run lives in the request that started it, so
// no instance ever has to find another instance's run.
export interface RunStarted {
  runId: string;
}

// The shop's new edges (GET /api/merchant/events), as the mirror wrote them.
export type EdgeKind = 'order' | 'pay' | 'refund' | 'deliver' | 'fail' | 'request' | 'subscribe' | 'renew';

export interface MerchantEdgeEvent {
  kind: EdgeKind;
  from: string;
  to: string;
  amountMicro: Micro;
  orderId: string | null;
  ref: string;
  ts: string;
  entityKey: string | null;
  arkivTx: string | null;
  settlementTx: string | null;
}

// GET /api/race: one Arkiv call, then the answer.
export interface RaceCall {
  call: number;
  ms: number;
  bytes: number;
}

export interface RaceAnswer {
  answer: unknown;
  correct: boolean;
  truthBasis: 'identity' | 'name';
  calls: number;
  bytes: number;
}

// Every spending route answers { transaction } (Whitechain), { sepoliaTx } or { arkivTx }.
export interface TransactionResponse {
  transaction: string;
}

// A route that is wired but whose source has not landed yet answers 503 with this.
export interface NotLive {
  error: 'not live yet';
  waitingFor: string;
}
