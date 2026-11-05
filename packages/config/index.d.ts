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
  category: string;
  area: string | null;
  location: { lat: number; lng: number } | null;
  products: { sku: string; name: string; unit: string; quantity: number; priceMicro: number }[];
  scenario: Record<string, number | boolean>;
}

export interface Cast {
  key: string;
  city: { name: string; timeZone: string; currency: string };
  persona: { key: string; label: string; displayName: string; walletRole: string };
  buyerAgents: CastAgent[];
  workingAgents: CastAgent[];
  disposable: { labelPrefix: string; walletRolePrefix: string; capMicro: number; expiryDays: number };
  shopAgents: { key: string; label: string; displayName: string }[];
  shops: CastShop[];
  order: Record<string, unknown>;
  renewal: Record<string, unknown>;
}

export interface AgentModelSettings {
  provider: string;
  model: string;
  effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  maxTokens: number;
}

export interface Story {
  about: string;
  storyVersion: number;
  name: string;
  locked: boolean;
  synthetic: boolean;
  agentModels: { about: string; active: string; presets: Record<string, { purpose: string; roles: Record<string, AgentModelSettings> }> };
  [section: string]: unknown;
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

// `url` is a non-enumerable property, so logging or JSON-encoding the result never
// shows a keyed URL; a spread or structuredClone drops it, so pass the object itself.
export interface ResolvedRpc extends RpcCandidate {
  chainId: number;
  refused: string[];
}

// The parsed graphpay.config.json; see the file for every section.
export declare const config: Record<string, any> & {
  root: { ens: string };
  networks: Record<NetworkKey, Network>;
};

export declare const story: Story;

export declare function network(key: NetworkKey): Network;
export declare function activeCast(source?: Story): Cast;
export declare function agentPreset(
  role: string,
  options?: { env?: Record<string, string | undefined>; source?: Story },
): AgentModelSettings & { preset: string; role: string };
export declare function apiCostUsd(
  model: string,
  usage: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
    cache_creation?: { ephemeral_1h_input_tokens?: number | null; ephemeral_5m_input_tokens?: number | null } | null;
  },
): number;
export declare function castEntries(cast?: Cast, root?: string): CastEntry[];
export declare function disposableEntry(n: number, cast?: Cast, root?: string): CastEntry;
export declare function rpcCandidates(key: NetworkKey, env?: Record<string, string | undefined>): RpcCandidate[];
export declare function probeChainId(url: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<number>;
export declare function resolveRpc(
  key: NetworkKey,
  options?: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<ResolvedRpc>;
