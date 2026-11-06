// @graphpay/ens ships JavaScript without types; only what the owner routes use is declared.
declare module '@graphpay/ens' {
  import type { Chain, PublicClient } from 'viem';
  export function ensChain(): Chain;
  export function ownerRoleOf(name: string): string;
  export interface OwnerSender {
    role: string;
    address: `0x${string}`;
    sendTransaction(request: Record<string, unknown>): Promise<`0x${string}`>;
  }
  export interface TxRunner {
    send(step: string, sender: OwnerSender, request: { to: `0x${string}`; data: `0x${string}`; value?: bigint }): Promise<{ hash: `0x${string}`; receipt: unknown }>;
  }
  export function createTxRunner(options: { client: PublicClient; chainId: number; explorerTx?: (hash: string) => string; log?: (line: string) => void }): TxRunner;
  export interface OwnerActionResult {
    changed: boolean;
    reason?: string;
    name?: string;
    hash?: `0x${string}`;
  }
  export interface OwnerActions {
    pause(name: string): Promise<OwnerActionResult>;
    resume(name: string): Promise<OwnerActionResult>;
  }
  // The kill: the owner's `unregister`, one-shot per label ("killed earlier" on a second call).
  export interface OwnerKill {
    kill(name: string): Promise<OwnerActionResult & { killedEarlier?: boolean }>;
  }
  export function createOwnerActions(context: { client: PublicClient; runner: TxRunner; senderFor(role: string): OwnerSender; log?: (line: string) => void; retryReads?: boolean }): OwnerActions & OwnerKill;
  // The lowest live disposable-<n> among `numbers`, from chain state.
  export interface LiveDisposable {
    n: number;
    name: string;
    node: `0x${string}`;
    epoch: number;
    expiry: bigint;
    holder: `0x${string}`;
    registry: `0x${string}`;
    resolver: `0x${string}`;
  }
  export function liveDisposable(client: PublicClient, numbers: number[], options?: { parentRegistry?: `0x${string}` }): Promise<LiveDisposable | null>;
  export function ensPublicClient(options?: { env?: Record<string, string | undefined> }): Promise<{ client: PublicClient; rpcLabel: string }>;
  // Self-healing (lib/heal.server.ts): the status record, the agent's own resolver and its event.
  export const KEYS: Readonly<Record<string, string>> & { readonly status: string; readonly capMicro: string };
  export function readText(client: PublicClient, name: string, key: string): Promise<string>;
  export function locate(client: PublicClient, name: string): Promise<{ name: string; label: string; registry: `0x${string}`; resolver: `0x${string}`; state: { status: number } }>;
  export const permissionedResolverAbi: readonly { type: string; name?: string; inputs?: readonly { name: string; type: string; indexed?: boolean }[] }[];
  export interface EnsGate {
    // Registry state and the public records of a name; status is never "ACTIVE" for a name that could not be read.
    ensCheck(name: string): Promise<{ name: string; registryState: string; status: 'ACTIVE' | 'PAUSED' | 'REVOKED' | 'EXPIRED' | 'UNKNOWN'; records: Record<string, string> }>;
    invalidate(name?: string): void;
  }
  export function createEnsGate(options: { client: PublicClient; expectedEpoch?: unknown; policyCapMicro?: unknown; spentToday?: unknown }): EnsGate;
}
