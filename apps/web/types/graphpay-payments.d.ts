// @graphpay/facilitator and @graphpay/shop ship JavaScript without types; only what the hosted
// payment routes (lib/payments.server.ts) use is declared, loosely: the packages check their
// own inputs at run time.
declare module '@graphpay/facilitator' {
  type Handler = (request: Request) => Promise<Response>;
  type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
  export class StartupError extends Error {}
  export function facilitatorSettings(env?: Record<string, string | undefined>): Any;
  export function shopSettings(env: Record<string, string | undefined>, options: { shopKeys: string[] }): Any;
  export function networkMode(options: { rpcUrl: string; allowRealNetwork?: string; ensStub?: boolean; hosted?: boolean }): 'fork' | 'real';
  export function startupChecks(options: Any): Promise<void>;
  export function readiness(run: () => Promise<void>): () => Promise<void>;
  export function viemChain(options: Any): Any;
  export function checkoutPolicyReads(publicClient: Any, checkout: string): { policy(node: string): Promise<Any>; expectedEpoch(node: string): Promise<number | null>; policyCapMicro(node: string, epoch: number): Promise<bigint | null>; spentToday(node: string, epoch: number): Promise<bigint> };
  export function createGraphPayFacilitator(deps: Any): Any;
  export function facilitatorHandler(options: Any): Handler;
  export function recorderClient(options: { url: string; token: string }): { refused(entry: Any): Promise<void> };
  export function recorderHandler(options: { token: string; write: ((edge: Any) => Promise<Any>) | null; log?: (line: string) => void }): Handler;
  export function bearerOk(request: Request, token: string): boolean;
  export class x402Facilitator {
    register(network: string, scheme: Any): x402Facilitator;
  }
  export class HTTPFacilitatorClient {
    constructor(options: { url: string; createAuthHeaders?: () => Promise<Record<string, Record<string, string>>> });
  }
}

declare module '@graphpay/shop' {
  type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
  export function storyShops(): Array<{ key: string; ensName: string; walletRole: string } & Record<string, Any>>;
  export function shopHandler(deps: Any): (request: Request) => Promise<Response>;
  export function viemOrders(options: { publicClient: Any; checkout: string }): Any;
  export function merchantActions(options: { publicClient: Any; walletClients: Record<string, Any>; checkout: string; chain: Any; waitMs?: number }): {
    deliver(shopKey: string, orderId: string): Promise<'delivered' | 'pending' | 'not_configured'>;
    refund(shopKey: string, orderId: string, amountMicro: bigint | string, reason?: number): Promise<{ hash: string; status: string; gasUsed: bigint }>;
  };
}

declare module '@graphpay/ens' {
  import type { PublicClient } from 'viem';
  export interface EnsGate {
    ensGate(name: string, amountMicro: bigint): Promise<{ ok: boolean; reason?: string } & Record<string, unknown>>;
  }
  export function createEnsGate(options: { client: PublicClient; expectedEpoch?: unknown; policyCapMicro?: unknown; spentToday?: unknown; ttlMs?: number }): EnsGate;
  export function retryingReads<T>(client: T, options?: { tries?: number; delayMs?: number }): T;
  export function createEnsReader(options: { client: PublicClient; ttlMs?: number }): { resolvePayee(shopName: string): Promise<{ ok: true; payee: `0x${string}` } | { ok: false; reason: string }> };
}
