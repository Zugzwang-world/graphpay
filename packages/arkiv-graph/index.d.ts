// Types of the public API. Values on the wire are typed by column; plain rows carry
// u64 as bigint, i32 as number, key and addr as lower-case hex.
import type { Expiry, Schema, PublicArkivClient, WalletArkivClient } from '@arkiv-network/sdk';
import type { Expression } from '@arkiv-network/sdk/query';
import type { Chain, Transport, Hex } from 'viem';

export declare const LIMITS: Readonly<{ userAttributes: number; nameBytes: number; stringBytes: number; pageSize: number; predicateLeaves: number; requestBodyBytes: number; splitBytes: number; maxLifetimeBlocks: bigint; blockSeconds: number }>;

export interface EntityDef { type: string; schema: Schema; readonly: boolean; indexed: Set<string>; names: string[]; project: string; schemaVersion: bigint }
export declare function parseColumns(specs: string[]): Record<string, unknown>;
export declare function defineEntity(type: string, spec: { columns?: string[]; readonly?: boolean }, ctx: { project: string; schemaVersion?: number }): EntityDef;
export declare function checkDefinition(def: EntityDef, options?: { noBytes?: boolean }): string[];
export declare function checkIndexes(def: EntityDef, filtered: string[]): string[];

export type Row = Record<string, any> & { $key: Hex; $owner: Hex };
export interface GraphEnd { node: Hex; epoch: number | bigint; kind: string; columns?: Record<string, unknown> }
export interface GraphEvent {
  ref: string; kind: string; from: GraphEnd; to: GraphEnd; value?: bigint; ts: number | bigint; day?: number;
  position?: { block: bigint | number; logIndex: number }; columns?: Record<string, unknown>; labels?: Record<string, unknown>;
  existingEdge?: boolean; counted?: boolean; nodeUpdate?: { node: Hex; epoch: number | bigint; values: Record<string, unknown> };
  [extra: string]: unknown;
}
export interface PlannedCreate { def: EntityDef; values: Record<string, unknown> }
export interface PlannedPatch { def: EntityDef; key: Hex; values: Record<string, unknown> }
export interface Plan { creates: PlannedCreate[]; patches: PlannedPatch[]; skipped: string[]; applied: string[]; commit(createdKeys: Hex[]): Record<string, Hex> }
export interface GraphState { totals: Map<string, { key: Hex | null; values: Record<string, unknown> }>; links: Map<string, any>; nodes: Map<string, any>; checkpoints: Map<string, any> }
export type Rules = Record<string, Record<string, 'count' | 'value' | number | bigint>> | ((event: GraphEvent) => Record<string, 'count' | 'value' | number | bigint> | null);
export interface Graph {
  project: string; schemaVersion: bigint; names: Record<string, string>;
  defs: { node: EntityDef; edge: EntityDef; totals: EntityDef; link: EntityDef; checkpoint: EntityDef; [extra: string]: EntityDef };
  counters: string[]; windows: string[]; valueColumn: string; sumColumn: string;
  newState(): GraphState;
  plan(events: GraphEvent[], state: GraphState, options?: { stream?: string | null; createNodes?: boolean; labels?: Record<string, unknown> }): Plan;
}
export declare function defineGraph(spec: {
  project: string; schemaVersion?: number; types?: Partial<Record<'node' | 'edge' | 'totals' | 'link' | 'checkpoint', string>>;
  node?: { columns?: string[]; index?: string[] }; edge?: { columns?: string[]; index?: string[]; value?: string; readonly?: boolean };
  totals?: { counters: string[]; rules?: Rules; columns?: string[]; windows?: ('all' | 'day')[]; index?: string[] };
  link?: { sum?: string; kinds?: string[]; columns?: string[]; index?: string[] }; checkpoint?: { columns?: string[] };
  entities?: Record<string, { type?: string; columns?: string[]; readonly?: boolean }>;
}): Graph;

export declare function typed(type: string, value: unknown): unknown;
export declare function entityValues(def: EntityDef, values: Record<string, unknown>): Record<string, unknown>;
export declare function patchValues(def: EntityDef, values: Record<string, unknown>): Record<string, unknown>;
export declare function plainRow(row: Record<string, unknown>): Row;
export declare function jsonBytes(value: unknown): Hex;
export declare function fromJsonBytes(hex: string): any;
export declare function nodeKeyOf(name: string): Hex;
export declare function dayOf(ts: number | bigint): number;

export declare function checkedOwner(address: string, label?: string): Hex;
export declare function scope(def: EntityDef): Expression[];
export declare function trustedRows(def: EntityDef, owner: string, entities: Record<string, unknown>[]): Row[];
export declare function readAll(client: PublicArkivClient, def: EntityDef, options: { owner: string; where?: Expression[]; cap?: number }): Promise<Row[]>;
export declare function findOne(client: PublicArkivClient, def: EntityDef, options: { owner: string; where?: Expression[] }): Promise<Row | null>;
export declare function countRows(client: PublicArkivClient, def: EntityDef, options: { owner: string; where?: Expression[] }): Promise<bigint>;

export interface WriteBatch {
  creates?: { def: EntityDef; values: Record<string, unknown>; expiration: Expiry; readonly?: boolean }[];
  patches?: { def: EntityDef; key: Hex; values: Record<string, unknown> }[];
  deletes?: { key: Hex }[];
  extensions?: { key: Hex; expiration: Expiry }[];
}
export interface SentTx { hash: Hex; blockNumber: bigint; gasUsed: bigint; effectiveGasPrice: bigint; creates: number; patches: number; createdKeys: Hex[]; recovered: boolean }
export interface Writer {
  address: Hex;
  send(batch: WriteBatch, options?: { split?: boolean; nonce?: number | null; verifyRecovered?: ((createdKeys: Hex[]) => Promise<boolean>) | null }): Promise<{ txs: SentTx[]; createdKeys: Hex[] }>;
  confirmedNonce(): Promise<number>;
}
export declare function createWriter(options: { walletClient: WalletArkivClient; publicClient: PublicArkivClient; entityContract: string; splitBytes?: number; recoveryMs?: number; pollMs?: number; maxSends?: number; sentHashes?: { has(hash: string): boolean } | null; log?: (entry: Record<string, unknown>) => void }): Writer;
export declare function operationBytes(op: unknown): number;
export declare class WriteRevertedError extends Error { txHash?: Hex }
export declare class WriteUncertainError extends Error { nonce?: number }
export declare class WriteNonceTakenError extends Error { code: 'NONCE_TAKEN'; nonce: number }

export interface TransportStats { calls: number; requestBytes: number; responseBytes: number; status: Record<string, number>; lowestRemaining: number | null; limit: number | null; waits: number; byMethod: Record<string, number> }
export declare function newStats(): TransportStats;
export declare function parseRateLimit(header: string | null): { limit: number; remaining: number; reset?: number } | null;
export declare function redactError<E>(error: E, secrets: string[]): E;
export declare function isRequestTooLarge(error: unknown): boolean;
export declare function arkivTransport(options: { url: string; fetchFn?: typeof fetch; secrets?: string[]; timeout?: number; stats?: TransportStats; log?: (entry: Record<string, unknown>) => void; lowWater?: number }): Transport & { stats: TransportStats; sent: Set<string> };
export declare function arkivChain(options: { id: number; name?: string; symbol?: string }): Chain;
export declare function arkivClients(options: { transport: Transport; chain: Chain; account?: unknown; pollingInterval?: number }): { publicClient: PublicArkivClient; walletClient: WalletArkivClient | null; chain: Chain; stats: TransportStats; sentHashes: Set<string> };
export declare function assertChain(client: PublicArkivClient, expected: number): Promise<number>;

export declare class ArkivSim {
  constructor(options: { chainId: number; entityContract: string; startBlock?: bigint; blockTime?: number; requestLimit?: number; gasPrice?: bigint; rateLimit?: number });
  fetch: typeof fetch;
  blockNumber: bigint;
  stats: { requests: number; byMethod: Record<string, number>; status: Record<string, number> };
  injectFault(fault: { method: string; kind: 'apply-then-fail' | 'fail'; times?: number }): void;
  advanceBlocks(n: number | bigint): void;
  advanceSeconds(seconds: number): void;
  dispatch(method: string, params?: unknown[]): Promise<unknown>;
}
export declare const EXECUTE_ABI: readonly unknown[];
export declare const EVENTS_ABI: readonly unknown[];
export declare function parseQuery(text: string): { where: unknown; orderBy: { name: string; tag: string; direction: 'ASC' | 'DESC' } | null; leaves: number; depth: number };
export declare function renderQuery(node: unknown): string;

export declare const ENTITY_ADDRESS: Hex;
export interface Connection { backend: 'sim' | 'node'; publicClient: PublicArkivClient; walletClient: WalletArkivClient | null; writer: Writer | null; owner: Hex | null; stats: TransportStats; sim: ArkivSim | null; chainId: number }
export declare function connect(options?: { rpcUrl?: string; chainId?: number; privateKey?: Hex; log?: (entry: Record<string, unknown>) => void; sim?: ArkivSim }): Promise<Connection>;

export type Filter = { [field: string]: { eq?: unknown; in?: unknown[]; gt?: unknown; gte?: unknown; lt?: unknown; lte?: unknown; between?: [unknown, unknown]; startsWith?: string; exists?: true } } | { AND?: Filter[]; OR?: Filter[] };
export interface ExplainTrace { explainId: string; backend: string; calls: number; queries: string[]; ms: number; bytes: number; entityKeys: Hex[]; blockNumber: string | null; warnings: string[]; notes: string[]; truncated: boolean; reads: Record<string, unknown>[] }
export interface Store {
  owner: Hex; graph: Graph;
  load(): Promise<GraphState>;
  write(events: GraphEvent[], options?: { split?: boolean }): Promise<{ applied: string[]; skipped: string[]; txs: SentTx[] }>;
  query(entity: string, options?: { filter?: Filter; orderBy?: { field: string; direction?: 'asc' | 'desc' }; limit?: number }): Promise<{ rows: Row[]; explain: ExplainTrace; truncated: boolean }>;
  explainStore: { get(id: string): ExplainTrace | null; size(): number };
}
export declare function createStore(options: { graph: Graph; arkiv: Connection; stream?: string | null; days?: number; labels?: Record<string, unknown>; createNodes?: boolean }): Store;
export { ExpirationTime } from '@arkiv-network/sdk';
