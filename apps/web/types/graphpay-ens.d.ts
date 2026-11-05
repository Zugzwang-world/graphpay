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
  export function createOwnerActions(context: { client: PublicClient; runner: TxRunner; senderFor(role: string): OwnerSender; log?: (line: string) => void; retryReads?: boolean }): OwnerActions;
}
