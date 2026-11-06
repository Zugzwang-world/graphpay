import type { Account, PublicClient, WalletClient } from 'viem';
import type { Tool } from 'ai';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

type Hex = `0x${string}`;
type Address = `0x${string}`;
type Micro = bigint | number | string;

// --- network -----------------------------------------------------------------------------

export interface AgentPayNetwork {
  name: string;
  chainId: number;
  caip2: string;
  nativeSymbol: string;
  explorer: string;
  checkout: Address;
  deployBlock: bigint;
  permit2: Address;
  token: { address: Address; symbol: string; decimals: 6; eip712: { name: string; version: string } };
  neverUse: readonly Address[];
}
export declare const ALLOWED_CHAIN_IDS: readonly number[];
export declare function whitechainNetwork(overrides?: Partial<AgentPayNetwork>): AgentPayNetwork;
export declare function assertChain(publicClient: PublicClient, network: AgentPayNetwork): Promise<number>;
export declare function assertClientChain(client: { chain?: { id: number } }, network: AgentPayNetwork): void;
export declare function assertWriteChain(publicClient: PublicClient, walletClient: WalletClient, network: AgentPayNetwork): Promise<void>;
export declare function explorerTx(network: AgentPayNetwork, hash: Hex): string;
export declare class AgentPayError extends Error {
  code: string;
  details?: unknown;
}

// --- money -------------------------------------------------------------------------------

export declare function usdt(value: string | number | bigint): bigint;
export declare function formatUsdt(micro: Micro): string;
export declare function toMicro(value: Micro, what?: string): bigint;

// --- the order model ---------------------------------------------------------------------

export type FulfilmentType = 'delivery' | 'pickup' | 'ride' | 'digital' | 'service';
export declare const FULFILMENT_TYPES: readonly FulfilmentType[];
export declare const ORDER_SCHEMA: 'agentpay.order/v1';
export declare const ZERO32: Hex;

export interface ItemInput {
  sku: string;
  name: string;
  quantity?: number;
  unitPriceMicro: Micro;
}
export interface OrderInput {
  merchant: { name: string; address: Address };
  payer?: { name?: string; address?: Address };
  buyer?: { name: string };
  items: ItemInput[];
  fulfilment: { type: FulfilmentType; details?: Record<string, unknown> };
  deadline: number | bigint;
  parentOrderId?: Hex;
  salt?: Hex;
  totalMicro?: Micro;
}
export interface ChainOrder {
  orderId: Hex;
  parentOrderId: Hex;
  buyerNode: Hex;
  shopNode: Hex;
  payerNode: Hex;
  merchant: Address;
  amountMicro: bigint;
  deadline: bigint;
  kind: number;
}
export interface Order {
  schema: 'agentpay.order/v1';
  orderId: Hex;
  merchant: { name: string; node: Hex; address: Address };
  buyer: { name: string; node: Hex; address: Address };
  payer: { name: string; node: Hex; address: Address };
  items: readonly { sku: string; name: string; quantity: number; unitPriceMicro: bigint; lineTotalMicro: bigint }[];
  totalMicro: bigint;
  fulfilment: { type: FulfilmentType; details: Record<string, unknown> };
  deadline: bigint;
  parentOrderId: Hex;
  salt: Hex;
  kind: number;
  detailsHash: Hex;
  chain: ChainOrder;
}
export declare function createOrder(input: OrderInput): Order;
export declare function orderToWire(order: Order): Record<string, unknown>;
export declare function orderFromWire(wire: Record<string, unknown>): Order;
export declare function deriveOrderId(fields: Record<string, unknown>): Hex;
export declare function detailsHash(fields: { items: Order['items']; totalMicro: bigint; fulfilment: Order['fulfilment'] }): Hex;
export declare function nodeOf(name?: string): Hex;
export declare function canonicalJson(value: unknown): string;

// --- the graphpay-order wire -------------------------------------------------------------

export declare const SCHEME: 'graphpay-order';
export declare const X402_VERSION: 2;
export declare const HEADERS: Readonly<{ required: 'PAYMENT-REQUIRED'; signature: 'PAYMENT-SIGNATURE'; response: 'PAYMENT-RESPONSE' }>;
export declare const PAYER_HEADERS: Readonly<{ address: string; name: string; buyer: string; salt: string }>;
export interface PaymentRequirement {
  scheme: 'graphpay-order';
  network: string;
  asset: Address;
  amount: string;
  payTo: Address;
  maxTimeoutSeconds: number;
  extra: { contract: Address; order: Record<string, string>; shopName: string; mandateRequired: true; quoteKey?: Hex };
}
export interface PaymentRequired {
  x402Version: 2;
  error?: string;
  resource: { url: string; description?: string; mimeType?: string };
  accepts: [PaymentRequirement];
  extensions?: Record<string, unknown>;
}
export interface PaymentPayload {
  x402Version: 2;
  resource?: { url: string };
  accepted: PaymentRequirement;
  payload: {
    order: Record<string, string>;
    mandateHash: Hex;
    payerName: string;
    payer: Address;
    permit: { token: Address; amount: string; nonce: string; deadline: string };
    signature: Hex;
    approvalPermit: Hex;
  };
  extensions?: Record<string, unknown>;
}
export declare function buildRequirement(order: Order, network: AgentPayNetwork, options?: { shopName?: string; maxTimeoutSeconds?: number }): PaymentRequirement;
export declare function buildPaymentRequired(order: Order, network: AgentPayNetwork, options?: { resourceUrl?: string; description?: string; error?: string }): PaymentRequired;
export declare function orderOfPaymentRequired(paymentRequired: unknown, network: AgentPayNetwork): { paymentRequired: PaymentRequired; requirement: PaymentRequirement; order: Order };
export declare function encodeHeader(value: unknown): string;
export declare function decodeHeader(value: string | null | undefined): any;
export declare const requirementSchema: import('zod').ZodType<PaymentRequirement>;
export declare const paymentPayloadSchema: import('zod').ZodType<PaymentPayload>;
export declare const paymentRequiredSchema: import('zod').ZodType<PaymentRequired>;

// --- plug-in interfaces ------------------------------------------------------------------

export interface IdentityResolver {
  resolve(name: string): Promise<{ name: string; node: Hex; address: Address } | null>;
  verifyMerchant?(m: { name: string; node: Hex; address: Address }): Promise<boolean>;
  verifyPayer?(p: { name: string; node: Hex; address: Address }): Promise<boolean>;
}
export interface ReputationProvider {
  assess(subject: { subject: 'buyer' | 'merchant'; name: string; node: Hex; address: Address }): Promise<{ risk: 'low' | 'medium' | 'high'; score?: number; reasons?: string[]; source?: string }>;
}
export declare function staticIdentity(entries: { name: string; address: Address }[]): Required<IdentityResolver>;
export declare function staticReputation(table: Record<string, { risk: 'low' | 'medium' | 'high'; reasons?: string[] }>): ReputationProvider;

// --- the buyer ---------------------------------------------------------------------------

export type PassPeriod = 'day' | 'week' | 'month';
export declare const PERIOD_DAYS: Readonly<Record<PassPeriod, number>>;
export interface SpendingPassLimits {
  capMicro: Micro;
  period?: PassPeriod;
  perPaymentMaxMicro?: Micro;
  merchants?: (string | Address)[];
}
export interface Mandate {
  buyer: string;
  request: string;
  currency: string;
  budgetMicro: bigint;
  deadlineMs: number;
  merchants: readonly string[];
  hash: Hex;
}
export declare function createMandate(input: { buyer?: string; request?: string; budgetMicro: Micro; deadlineMs: number; merchants?: string[]; currency?: string }): Mandate;

export interface OnchainPass {
  node: Hex;
  exists: boolean;
  epoch: number;
  wallet: Address;
  revoked: boolean;
  dailyCapMicro: bigint;
  expiry: bigint;
  expired: boolean;
  unlimited: boolean;
  spentTodayMicro: bigint;
  remainingTodayMicro: bigint;
  boundNode?: Hex;
  active: boolean;
}
export interface PayResult {
  status: 'paid' | 'failed' | 'unknown' | 'free' | 'not_payable';
  httpStatus?: number;
  orderId?: Hex;
  amountMicro?: bigint;
  merchant?: Order['merchant'];
  order?: Order;
  transaction?: Hex;
  reason?: string;
  orderStatus?: string;
  response?: Response;
}
export interface BuyerAgent {
  address: Address;
  name: string;
  node: Hex;
  network: AgentPayNetwork;
  limits: Readonly<{ capMicro: bigint; period: PassPeriod; perPaymentMaxMicro?: bigint; merchants: readonly string[] }>;
  mandateHash: Hex;
  passStatus(): Promise<Record<string, unknown>>;
  quote(url: string, init?: RequestInit): Promise<{ free: true; status: number; response: Response } | { free: false; order: Order; requirement: PaymentRequirement; paymentRequired: PaymentRequired }>;
  pay(url: string, init?: RequestInit & { body?: string; maxMicro?: Micro }): Promise<PayResult>;
  check(order: Order, options?: { maxMicro?: Micro }): Promise<{ status: string }>;
  requestRefund(input: { url: string; orderId: Hex; amountMicro: Micro; reason: string }): Promise<Record<string, unknown> & { ok: boolean; httpStatus: number }>;
  subscribe(input: { url: string; maxMicro?: Micro }): Promise<Record<string, unknown> & { ok: boolean; httpStatus: number; subId: Hex }>;
  cancel(input: { url: string; subId: Hex }): Promise<Record<string, unknown> & { ok: boolean; httpStatus: number; subId: Hex }>;
}
export declare function createBuyerAgent(options: {
  account: Account & { signTypedData: (...args: any[]) => Promise<Hex> };
  publicClient: PublicClient;
  network?: AgentPayNetwork;
  name?: string;
  buyerName?: string;
  pass: SpendingPassLimits;
  mandate?: Mandate;
  identity?: IdentityResolver;
  reputation?: ReputationProvider;
  approvalMicro?: bigint;
  fetch?: typeof fetch;
  clock?: () => number;
  onEvent?: (event: Record<string, unknown>) => void;
}): BuyerAgent;

export declare function readSpendingPass(options: { publicClient: PublicClient; network: AgentPayNetwork; name?: string; node?: Hex; wallet?: Address; nowSec: number }): Promise<OnchainPass>;
export declare function issueSpendingPass(options: {
  walletClient: WalletClient;
  publicClient: PublicClient;
  network: AgentPayNetwork;
  name?: string;
  node?: Hex;
  wallet: Address;
  dailyCapMicro: Micro;
  expiry?: Micro;
  epoch?: number;
  revoked?: boolean;
}): Promise<{ transaction: Hex; node: Hex; epoch: number; wallet: Address; dailyCapMicro: bigint; expiry: bigint; revoked: boolean }>;
export declare function revokeSpendingPass(options: { walletClient: WalletClient; publicClient: PublicClient; network: AgentPayNetwork; name?: string; node?: Hex }): ReturnType<typeof issueSpendingPass>;
export declare function spentInPeriod(options: { publicClient: PublicClient; network: AgentPayNetwork; node: Hex; epoch: number; period: PassPeriod; nowSec: number }): Promise<bigint>;

export declare const DEFAULT_APPROVAL_MICRO: bigint;
export declare function signOrderPayment(options: Record<string, unknown>): Promise<PaymentPayload['payload']>;
export declare function signSubscription(options: Record<string, unknown>): Promise<{ permitSingle: unknown; permitSig: Hex; subSig: Hex; approvalPermit: Hex }>;
export declare function signCancel(options: Record<string, unknown>): Promise<{ subId: Hex; deadline: bigint; signature: Hex }>;
export declare function signRefundRequest(options: Record<string, unknown>): Promise<{ request: Record<string, string>; signature: Hex }>;

// --- the facilitator ---------------------------------------------------------------------

export interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  payer?: Address;
}
export interface SettleResponse {
  success: boolean;
  errorReason?: string;
  payer?: Address;
  transaction: string;
  network: string;
  amount?: string;
}
export interface Facilitator {
  kind?: string;
  verify(paymentPayload: PaymentPayload, requirements: PaymentRequirement): Promise<VerifyResponse>;
  settle(paymentPayload: PaymentPayload, requirements: PaymentRequirement): Promise<SettleResponse>;
  supported?(): unknown;
  subscribe?(input: { sub: Record<string, unknown>; permitSingle: unknown; permitSig: Hex; subSig: Hex; approvalPermit?: Hex }): Promise<Record<string, unknown> & { success: boolean }>;
  renew?(subId: Hex): Promise<Record<string, unknown> & { success: boolean }>;
  cancelSubscription?(input: { subId: Hex; deadline: string; signature: Hex }): Promise<Record<string, unknown> & { success: boolean }>;
}
export declare class FacilitatorUnavailable extends Error {}
export declare function httpFacilitator(options: { url: string; authToken?: string; fetch?: typeof fetch; timeoutMs?: number }): Facilitator;
export declare function inProcessFacilitator(facilitator: { verify: Function; settle: Function }): Facilitator;

export interface RelayerLimits {
  minRelayerBalanceWei: bigint;
  maxOrderMicro: bigint;
  maxSettlesPerHour: number;
  maxMicroPerHour: bigint;
  perPayerPerMinute: number;
  maxSettleGas: bigint;
  minSendGas: bigint;
  maxSubscribeGas: bigint;
  maxRenewGas: bigint;
  maxCancelGas: bigint;
  receiptTimeoutMs: number;
}
export declare const RELAYER_DEFAULTS: Readonly<RelayerLimits>;
export declare function resolveLimits(overrides?: Partial<RelayerLimits>): RelayerLimits;
export declare function createReferenceRelayer(options: {
  walletClient: WalletClient;
  publicClient: PublicClient;
  network?: AgentPayNetwork;
  allowedMerchants: Address[];
  identity?: IdentityResolver;
  limits?: Partial<RelayerLimits>;
  clock?: () => number;
  log?: (line: string) => void;
}): Required<Facilitator> & { address: Address; limits: Readonly<RelayerLimits>; stats(): Record<string, number | string> };
export declare function predictPolicy(input: Record<string, unknown>): string;

// --- the merchant ------------------------------------------------------------------------

export interface PricerContext {
  request: Request;
  url: URL;
  req?: unknown;
  routeCtx?: unknown;
}
export type Pricer = (ctx: PricerContext) =>
  | { items: ItemInput[]; fulfilment: OrderInput['fulfilment']; description?: string; parentOrderId?: Hex }
  | null
  | Promise<{ items: ItemInput[]; fulfilment: OrderInput['fulfilment']; description?: string; parentOrderId?: Hex } | null>;
export interface Paid {
  paid: true;
  order: Order;
  settlement: SettleResponse & { alreadyPaid?: boolean };
  alreadyPaid?: boolean;
}
export type RiskCheck = (ctx: { order: Order | Record<string, unknown>; payer: Address; payerName: string; payerNode: Hex; request?: Request; reputation?: ReputationProvider; identity?: IdentityResolver; context?: unknown }) => Promise<{ allow: boolean; reason?: string }> | { allow: boolean; reason?: string };
export type MerchantEvent = 'paid' | 'payment.failed' | 'refund.requested' | 'refunded' | 'accepted' | 'delivered' | 'subscribed' | 'renewal.charged' | 'cancelled';
export interface Merchant {
  name: string;
  node: Hex;
  address: Address;
  network: AgentPayNetwork;
  on(event: MerchantEvent, listener: (payload: any) => void): void;
  off(event: MerchantEvent, listener: (payload: any) => void): void;
  once(event: MerchantEvent, listener: (payload: any) => void): void;
  order(input: Omit<OrderInput, 'merchant' | 'deadline'> & { deadline?: bigint }): Order;
  charge(request: Request, pricer: Pricer, extra?: Record<string, unknown>): Promise<Paid | { free: true } | { response: Response; order?: Order }>;
  route(pricer: Pricer, handler: (request: Request, paid: Paid & { routeCtx?: unknown }) => unknown): (request: Request, routeCtx?: unknown) => Promise<Response>;
  express(pricer: Pricer): (req: any, res: any, next: () => void) => Promise<void>;
  node(pricer: Pricer, handler: (request: Request, paid: Paid) => unknown): (req: any, res: any) => Promise<void>;
  refund(orderId: Hex, amountMicro: Micro, options?: { reasonCode?: number; note?: string }): Promise<{ orderId: Hex; amountMicro: bigint; full: boolean; transaction: Hex; explorer: string }>;
  deliver(orderId: Hex): Promise<{ orderId: Hex; transaction: Hex; explorer: string }>;
  accept(orderId: Hex, context?: Record<string, unknown>): Promise<{ accepted: boolean; orderId: Hex; reason?: string }>;
  refundRequests(): (request: Request) => Promise<Response>;
  subscriptions(plan: { id: string; items?: unknown[]; amountMicro: Micro; periodSeconds: number; maxCycles?: number }): (request: Request) => Promise<Response>;
  cancellations(): (request: Request) => Promise<Response>;
  chargeDueRenewals(options?: { fromBlock?: bigint }): Promise<Record<string, unknown>[]>;
  watchRenewals(options?: { intervalMs?: number; fromBlock?: bigint }): { stop(): void; tick(): Promise<void> };
  exportCsv(options?: { fromBlock?: bigint; toBlock?: bigint }): Promise<string>;
}
export declare function createMerchant(options: {
  name: string;
  address: Address;
  facilitator: Facilitator;
  publicClient: PublicClient;
  walletClient?: WalletClient;
  network?: AgentPayNetwork;
  riskCheck?: RiskCheck;
  identity?: IdentityResolver;
  reputation?: ReputationProvider;
  quoteTtlSeconds?: number;
  maxRefundMicro?: Micro;
  /** eth_getLogs span in blocks (default 10,000); drops to a tenth, for good, when the RPC refuses the range. */
  logChunk?: bigint | number;
  resourceBase?: string;
  clock?: () => number;
  log?: (line: string) => void;
}): Merchant;
export declare function toFetchRequest(req: any): Promise<Request>;
export declare function sendFetchResponse(res: any, response: Response): Promise<void>;
export declare function jsonResponse(status: number, body: unknown, headers?: Record<string, string>): Response;
export declare function toCsv(columns: string[], rows: Record<string, unknown>[]): string;

// --- AI tools ----------------------------------------------------------------------------

export interface ToolDefinition {
  name: string;
  description: string;
  shape: Record<string, import('zod').ZodTypeAny>;
  run(input: any): Promise<Record<string, unknown> & { ok: boolean }>;
}
export declare function buyerToolDefinitions(buyer: BuyerAgent, options?: { allowedOrigins?: string[] }): ToolDefinition[];
export declare function merchantToolDefinitions(merchant: Merchant, options?: { catalog?: Record<string, { name: string; unitPriceMicro: Micro }>; fulfilmentTypes?: FulfilmentType[] }): ToolDefinition[];
export declare function aiSdkTools(definitions: ToolDefinition[]): Record<string, Tool>;
export declare function buyerTools(buyer: BuyerAgent, options?: { allowedOrigins?: string[] }): Record<string, Tool>;
export declare function merchantTools(merchant: Merchant, options?: { catalog?: Record<string, { name: string; unitPriceMicro: Micro }> }): Record<string, Tool>;
export declare function registerTools(server: McpServer, definitions: ToolDefinition[], options?: { prefix?: string }): McpServer;
export declare function registerBuyerTools(server: McpServer, buyer: BuyerAgent, options?: { allowedOrigins?: string[] }): McpServer;
export declare function registerMerchantTools(server: McpServer, merchant: Merchant, options?: { catalog?: Record<string, { name: string; unitPriceMicro: Micro }> }): McpServer;
export declare function createAgentPayMcpServer(options: { buyer?: BuyerAgent; merchant?: Merchant; buyerOptions?: { allowedOrigins?: string[] }; merchantOptions?: { catalog?: Record<string, { name: string; unitPriceMicro: Micro }> }; name?: string; version?: string }): McpServer;

// --- deploy ------------------------------------------------------------------------------
export declare function deployCheckout(options: {
  walletClient: WalletClient;
  publicClient: PublicClient;
  relayer: Address;
  policyWriter: Address;
  network?: AgentPayNetwork;
}): Promise<{ address: Address; transactionHash: Hex; deployBlock: bigint; network: AgentPayNetwork }>;
