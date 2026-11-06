import type { Address, Chain, Hex, LocalAccount, PublicClient, WalletClient } from 'viem';
import type { AgentPayNetwork } from './index.js';

export declare function startSandbox(options?: { buyerUsdt?: bigint; port?: number }): Promise<{
  url: string;
  chain: Chain;
  network: AgentPayNetwork;
  publicClient: PublicClient;
  accounts: { admin: LocalAccount; relayer: LocalAccount; policyWriter: LocalAccount; merchant: LocalAccount; buyer: LocalAccount };
  wallet(account: LocalAccount): WalletClient;
  giveUsdt(to: Address, micro: bigint): Promise<void>;
  checkout: { address: Address; transactionHash: Hex; deployBlock: bigint; network: AgentPayNetwork };
  stop(): void;
}>;
