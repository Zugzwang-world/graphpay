import type { Graph, EntityDef, Row, Writer, TransportStats, ArkivSim } from '@graphpay_ethglobal/arkiv-graph';
import type { PublicArkivClient, WalletArkivClient } from '@arkiv-network/sdk';
import type { Hex } from 'viem';

export declare const PROJECT: string;
export declare const SCHEMA_VERSION: number;
export declare const ENTITY_CONTRACT: Hex;
export declare const RABDI: { name: string; chainId: number; rpcBase: string; accessKeyEnv: string; explorer: string };
export declare const LIFETIME: Readonly<{ realDays: number; syntheticDays: number; shopDays: number; quoteMinutes: number; probeDays: number; heartbeatDays: number }>;
export declare const EDGE_KINDS: string[];
export declare const MONEY_KINDS: string[];
export declare const TALLY_COUNTERS: string[];
export declare function tallyRules(event: { kind: string; reason?: string }): Record<string, 'count' | 'value'> | null;
export declare const graph: Graph;
export declare const ENTITIES: Record<'node' | 'edge' | 'tally' | 'link' | 'checkpoint' | 'shop' | 'quote' | 'record' | 'profile' | 'heartbeat', EntityDef>;
export declare const QUERIES: Record<string, string[]>;
export declare const WRITER_ROLES: string[];
export type WriterRole = 'W_LEDGER' | 'W_SYNC' | 'W_DIRECTORY' | 'W_SEED_EVENT' | 'W_SEED_M_EVENT';
export declare function writerAddresses(source?: unknown): Record<WriterRole, Hex>;
export declare function trustedOwners(type: string, options?: { writers?: Record<WriterRole, Hex>; synthetic?: string | null }): Hex[];
export declare function seedOwner(size: string, story: unknown, writers?: Record<WriterRole, Hex>): Hex;

export declare function normalizedName(ens: string): string;
export declare function nodeOf(ens: string): Hex;
export declare function identityKey(node: Hex, epoch: number | bigint): Hex;
export declare function microDegrees(deg: number): number;
export declare function boxAround(point: { lat: number; lng: number }, km: number): { latMin: number; latMax: number; lngMin: number; lngMax: number };

export interface ArkivConnection { backend: 'sim' | 'local' | 'rabdi'; label: string; publicClient: PublicArkivClient; walletClient: WalletArkivClient | null; writer: Writer | null; owner: Hex | null; role: WriterRole | null; sim: ArkivSim | null; stats: TransportStats; chainId: number }
export declare function connectArkiv(options?: { backend?: 'sim' | 'local' | 'rabdi'; env?: Record<string, string | undefined>; role?: WriterRole | null; privateKey?: Hex | null; sim?: ArkivSim | null; log?: (entry: Record<string, unknown>) => void; recoveryMs?: number; pollMs?: number }): Promise<ArkivConnection>;
export declare function newSim(options?: Record<string, unknown>): ArkivSim;

export interface MoneyEnd { ens: string; epoch?: number | bigint; kind: string; verified?: boolean; columns?: Record<string, unknown> }
export interface MoneyEvent { ref: string; kind: string; from: MoneyEnd; to: MoneyEnd; amountMicro?: bigint; ts: number; day?: number; orderId?: string; reason?: string; counted?: boolean; payload?: Hex; position?: { block: bigint | number; logIndex: number }; existingEdge?: boolean }
export interface WriteResult { skipped: string[]; applied: string[]; txs: { hash: Hex; gasUsed: bigint; recovered: boolean }[]; edgeKeys: Record<string, Hex> }
export interface Ledger {
  owner: Hex;
  load(): Promise<unknown>;
  apply(event: MoneyEvent, options?: { nonce?: number | null }): Promise<WriteResult>;
  applyBatch(events: MoneyEvent[]): Promise<WriteResult>;
  foldRecorder(events: MoneyEvent[], options?: { nonce?: number | null }): Promise<WriteResult>;
  writeStanding(change: { ref: string; ens: string; epoch: number | bigint; status?: string; capMicro?: bigint; ts: number; position?: { block: bigint | number; logIndex: number } }, options?: { nonce?: number | null }): Promise<WriteResult>;
  edgeExists(ref: string): Promise<boolean>;
  confirmedNonce(): Promise<number>;
  readonly state: unknown;
}
export declare function createLedger(options: { arkiv: ArkivConnection; stream?: string | null; synthetic?: { dataset: string } | null; lifetimeDays?: number; createNodes?: boolean }): Ledger;
export declare function toGraphEvent(event: MoneyEvent, labels: Record<string, unknown>): unknown;

export declare const RECORDER_KINDS: string[];
export declare function recorderEdgeValues(edge: { ref: string; kind: 'fail' | 'request'; from: { ens: string; epoch?: number | bigint }; to: { ens: string; epoch?: number | bigint }; amountMicro?: bigint; ts: number; orderId?: string; payload?: Hex }): Record<string, unknown>;
export declare function recordEdge(arkiv: ArkivConnection, edge: Parameters<typeof recorderEdgeValues>[0]): Promise<{ entityKey: Hex; txHash: Hex; recovered: boolean }>;

export interface QuoteInput { requestId: Hex; shopKey: Hex; agentEns: string; price: bigint; validUntil: number | bigint }
export declare function quoteValues(quote: QuoteInput): Record<string, unknown>;
export declare function createQuote(arkiv: ArkivConnection, quote: QuoteInput): Promise<{ entityKey: Hex; txHash: Hex; recovered: boolean }>;
export declare function findQuotes(client: PublicArkivClient, requestId: Hex, options?: { owner?: string }): Promise<{ key: Hex; requestId: Hex; shopKey: Hex; agentEns: string; price: bigint; validUntil: bigint; expiresAt: bigint }[]>;

export declare const SHOP_STATUS: string[];
export interface ShopInput { shopEns: string; epoch?: number; category: string; area?: string; city?: string; lat: number; lng: number; status?: string; synthetic?: boolean; dataset?: string; name?: string; hours?: string }
export declare function shopValues(shop: ShopInput): Record<string, unknown>;
export declare function writeShop(arkiv: ArkivConnection, shop: ShopInput, options?: { lifetimeDays?: number }): Promise<{ entityKey: Hex; txHash: Hex | null; created: boolean; unchanged?: boolean }>;
export declare function discoveryFilters(options: { category?: string; box: { latMin: number; latMax: number; lngMin: number; lngMax: number }; synthetic?: boolean }): unknown[];
export declare function discoverShops(client: PublicArkivClient, options: { category?: string; box: { latMin: number; latMax: number; lngMin: number; lngMax: number }; synthetic?: boolean; owner?: string; cap?: number }): Promise<{ shops: { key: Hex; shopKey: Hex; ens: string; category: string; area: string | null; city: string | null; lat: number; lng: number; synthetic: boolean; dataset: string | null; name: string | null; hours: string | null }[]; queries: string[]; calls: number; query: string }>;

export declare function writeHeartbeat(arkiv: ArkivConnection, values: { instance: string; state: string; cursorBlock: number | bigint; cursorLog: number | bigint; headBlock: number | bigint; lagBlocks: number | bigint; updatedTs: number | bigint }, options?: { key?: Hex | null; extend?: boolean }): Promise<Hex>;
export declare function readHeartbeats(client: PublicArkivClient, options?: { owner?: string }): Promise<Row[]>;

export declare function openShop(arkiv: ArkivConnection, shop: { shopKey: Hex; shopEns: string; now?: number; key?: Hex | null }): Promise<{ key: Hex; created: boolean }>;
export declare function closeShop(arkiv: ArkivConnection, options: { key: Hex; now?: number }): Promise<{ closed: true; gone: boolean }>;
export declare function openShopKeys(client: PublicArkivClient, options?: { owner?: string; now?: number }): Promise<Set<string>>;
export interface PresenceInput { agentEns: string; ownerEns: string; role: string; session: string }
export declare function markPresence(arkiv: ArkivConnection, presence: PresenceInput & { key?: Hex | null }): Promise<{ key: Hex; created: boolean }>;
export declare function agentsOnline(client: PublicArkivClient, options?: { owner?: string; ownerEns?: string | null; session?: string | null }): Promise<{ key: Hex; agentEns: string; ownerEns: string; role: string; session: string; expiresAt: bigint }[]>;
export declare function recordHandoff(arkiv: ArkivConnection, handoff: { requestId: string; fromAgent: string; toAgent: string; step: string }): Promise<{ key: Hex; txHash: Hex }>;
export declare function handoffsFor(client: PublicArkivClient, requestId: string, options?: { owner?: string }): Promise<{ key: Hex; requestId: string; fromAgent: string; toAgent: string; step: string; createdAt: bigint | null }[]>;
export declare function activityHooks(arkiv: ArkivConnection): { presence(phase: 'start' | 'renew', info: PresenceInput): Promise<void>; handoff(from: string, to: string, step: string, meta: { requestId: string }): Promise<void> };

export interface ExplainTrace { explainId: string; backend: string; calls: number; queries: string[]; ms: number; bytes: number; entityKeys: Hex[]; blockNumber: string | null; warnings: string[]; notes: string[]; truncated: boolean; reads?: unknown[] }
export interface GraphEngine { backend: string; explainStore: { get(id: string): ExplainTrace | null; put(trace: ExplainTrace): void; size(): number }; context(options?: { rowCap?: number }): unknown }
export declare const SDL: string;
export declare const graphqlSchema: unknown;
export declare function createGraphEngine(arkiv: ArkivConnection, options?: { rowCap?: number }): GraphEngine;
export declare function runGraphql(options: { engine: GraphEngine; query: string; variables?: Record<string, unknown>; dataset?: 'live' | 'S' | 'M'; limits?: { maxFields?: number; maxDepth?: number; maxChars?: number }; listCap?: number; writers?: Record<WriterRole, Hex> }): Promise<{ data?: unknown; errors?: { message: string; path?: unknown }[]; extensions?: { arkiv: Omit<ExplainTrace, 'reads'> } }>;
export declare function checkLimits(document: unknown, limits?: { maxFields?: number; maxDepth?: number }): void;
export declare function ownersFor(dataset?: 'live' | 'S' | 'M', writers?: Record<WriterRole, Hex>): Record<string, Hex[]>;
export declare function rate(n: bigint | number, d: bigint | number): string;
export declare function usdt(micro: bigint | number): string;
export declare function createContext(options: { engine: GraphEngine; dataset?: string; listCap?: number; writers?: Record<WriterRole, Hex> }): unknown;
export declare const MCP_TOOLS: string[];
export declare function askDocument(args: { intent: string; ens?: string[]; order_id?: string; window?: string; verify?: boolean }): { query: string; columns: string[] };
export declare function createMcpServer(options: { engine: GraphEngine; dataset?: 'live' | 'S' | 'M' }): unknown;
export declare function handleMcpRequest(request: Request, options: { engine: GraphEngine; dataset?: 'live' | 'S' | 'M' }): Promise<Response>;

export declare const ZERO_BATCH: string;
export declare class SwarmError extends Error { status?: number }
export declare function sha256Hex(bytes: Uint8Array | string): string;
export interface SwarmClient { gateway: string; upload(bytes: Uint8Array, options: { name: string; contentType?: string }): Promise<{ reference: string; link: string }>; read(reference: string, name: string): Promise<Uint8Array | null>; link(reference: string, name: string): string }
export declare function swarmClient(options?: { gateway?: string; fetchFn?: typeof fetch; timeoutMs?: number; attempts?: number }): SwarmClient;
export interface MenuImage { ref: string; name: string; contentType: 'image/svg+xml' | 'image/png' | 'image/jpeg' | 'image/webp'; sha256: string; bytes: number }
export interface MenuItem { sku: string; name: string; unit: string; quantity: number; priceMicro: number; image?: MenuImage }
export declare function uploadMenuImage(swarm: SwarmClient, options: { bytes: Uint8Array; name: string; contentType: MenuImage['contentType'] }): Promise<MenuImage>;
export declare function menuImageLink(swarm: SwarmClient, image: MenuImage): string;
export declare function menuDocument(options: { shopEns: string; name: string; items: MenuItem[]; version: number; synthetic?: boolean }): Record<string, unknown>;
export declare function menuBytes(document: unknown): Uint8Array;
export declare function menuValues(options: { shopEns: string; epoch?: number; version: number; reference: string; bytes: Uint8Array }): Record<string, unknown>;
export declare function writeMenu(arkiv: ArkivConnection, swarm: SwarmClient, options: { shopEns: string; epoch?: number; document: Record<string, unknown>; lifetimeDays?: number }): Promise<{ entityKey: Hex; txHash: Hex | null; reference: string; link: string; version: number; created: boolean; unchanged: boolean }>;
export declare function readMenu(publicClient: unknown, swarm: SwarmClient, options: { shopEns: string; epoch?: number; owner?: Hex; document?: Record<string, unknown> | null }): Promise<{ row: Record<string, unknown>; document: Record<string, unknown> | null; link: string; reuploaded: boolean; verified: boolean; missing: boolean } | null>;
export declare function castMenus(cast?: unknown): { key: string; shopEns: string; name: string; items: MenuItem[]; synthetic: boolean }[];
// verifyRecovered checks for a shared wallet: a transaction found by nonce created this write's row
// (its type, shop key and `expected` values), or the row with this key now holds `expected`.
export declare function ownCreate(arkiv: ArkivConnection, def: { type: string }, shopKey: Hex, expected?: Record<string, unknown>): (createdKeys: Hex[]) => Promise<boolean>;
export declare function rowHolds(arkiv: ArkivConnection, entityKey: Hex, expected: Record<string, unknown>): () => Promise<boolean>;
