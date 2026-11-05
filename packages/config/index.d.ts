export type NetworkKey = 'whitechain' | 'sepolia' | 'rabdi';

export interface PublicRpc {
  label: string;
  url: string;
}

export interface Network {
  name: string;
  chainId: number;
  nativeSymbol: string;
  secretRpcEnv?: string;
  accessKeyEnv?: string;
  rpcBase?: string;
  publicRpcs: PublicRpc[];
  explorer: string;
  explorerApi?: string;
  ws?: string;
  ensCoinType?: number;
}

export interface CastAgent {
  key: string;
  label: string;
  displayName: string;
  walletRole: string;
  pays: boolean;
  capMicro?: number;
}

export interface CastShop {
  key: string;
  label: string;
  displayName: string;
  storyRole: string;
  walletRole: string;
  scenario: Record<string, number | boolean>;
}

export interface Cast {
  key: string;
  about: string;
  city: { name: string; timeZone: string };
  persona: { key: string; label: string; displayName: string; walletRole: string };
  buyerAgents: CastAgent[];
  workingAgents: CastAgent[];
  disposable: { labelPrefix: string; walletRolePrefix: string; capMicro: number; expiryDays: number };
  shopAgents: { key: string; label: string; displayName: string }[];
  shops: CastShop[];
  order: Record<string, string | number | boolean>;
}

export interface CastEntry {
  kind: 'persona' | 'buyer-agent' | 'shop' | 'shop-agent';
  key: string;
  ensName: string;
  walletRole: string;
  pays?: boolean;
  capMicro?: number;
  storyRole?: string;
}

export interface RpcCandidate extends PublicRpc {
  secret: boolean;
}

export interface ResolvedRpc extends RpcCandidate {
  chainId: number;
  refused: string[];
}

// The parsed graphpay.config.json; see the file for every section.
export declare const config: Record<string, any> & {
  root: { ens: string };
  networks: Record<NetworkKey, Network>;
};

export declare function network(key: NetworkKey): Network;
export declare function activeCast(env?: Record<string, string | undefined>): Cast;
export declare function castEntries(cast?: Cast, root?: string): CastEntry[];
export declare function disposableEntry(n: number, cast?: Cast, root?: string): CastEntry;
export declare function rpcCandidates(key: NetworkKey, env?: Record<string, string | undefined>): RpcCandidate[];
export declare function probeChainId(url: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<number>;
export declare function resolveRpc(
  key: NetworkKey,
  options?: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<ResolvedRpc>;
