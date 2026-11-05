import type { Abi, Hex, PublicClient } from 'viem';
import type { Server } from 'node:http';

export type Kind = 'human' | 'agent' | 'shop';
export type Status = 'active' | 'paused' | 'revoked' | 'expired';
export type EdgeKind = 'order' | 'pay' | 'fail' | 'refund' | 'deliver' | 'late' | 'cancel' | 'dispute' | 'subscribe' | 'renew' | 'request';

export interface Position {
  block: number;
  logIndex: number;
}

export interface Checkpoint extends Position {
  events: number;
}

export interface ActorInput {
  ens: string;
  kind: Kind;
  node?: Hex;
  epoch?: number;
  ownerNode?: Hex;
  category?: string;
  city?: string;
  verified?: boolean;
  synthetic?: boolean;
  status?: Status;
  capMicro?: number | bigint;
  wallet?: string;
}

export interface Actor extends Required<Pick<ActorInput, 'ens' | 'kind' | 'epoch' | 'verified' | 'synthetic' | 'status'>> {
  node: Hex;
  ownerNode?: Hex;
  category?: string;
  city?: string;
  capMicro?: number | bigint;
  wallet?: string;
}

export declare class Actors {
  register(actor: ActorInput): { added: boolean; actor: Actor };
  get(node: string): Actor | undefined;
  has(node: string): boolean;
  setStanding(node: string, standing: { epoch: number; status?: Status; capMicro?: bigint; wallet?: string }): boolean;
  nodeOfWallet(wallet: string): Hex | undefined;
  list(): Actor[];
  readonly size: number;
}

export declare function nodeOf(ens: string): Hex;
export declare function castActors(options?: { cast?: unknown; root?: string; epochs?: Record<string, number>; wallets?: Record<string, string> }): ActorInput[];
export declare function candidateNames(options?: { cast?: unknown; root?: string; disposableMax?: number }): Map<Hex, ActorInput>;

export interface CheckoutEvent extends Position {
  id: string;
  name: string;
  args: Record<string, any>;
  txHash: Hex;
  address: string;
}

export declare function decodeLogs(abi: Abi, logs: readonly any[], options: { chainId: number }): { events: CheckoutEvent[]; unknown: number };

export interface EdgeSpec {
  ref: string;
  kind: EdgeKind;
  fromNode: Hex;
  toNode: Hex;
  fromEpoch: number;
  toEpoch: number;
  fromEns: string;
  toEns: string;
  amountMicro: bigint;
  ts: number;
  day: number;
  orderId: Hex | null;
  payload: Record<string, unknown> | null;
  counted: boolean;
  synthetic: boolean;
}

export type Mapped =
  | { action: 'edge'; edge: EdgeSpec }
  | { action: 'standing'; node: Hex; epoch: number; status: Status; capMicro: bigint; wallet: string; unchanged: boolean }
  | { action: 'park'; nodes: Hex[]; why: string; orderId?: Hex; subId?: Hex }
  | { action: 'none'; why: string };

export declare const FAIL_REASONS: readonly string[];
export declare const DEFAULT_DELIVERY_PROMISE_S: number;
export declare function mapEvent(e: CheckoutEvent, ctx: { actors: Actors; orders: OrderBook; blockTime(block: number): Promise<number>; deliveryPromiseS?: number }): Promise<Mapped>;
export declare function observeEvent(e: CheckoutEvent, ctx: { orders: OrderBook }): void;
export declare function epochHint(e: CheckoutEvent, node: string): number | undefined;

export declare class OrderBook {
  constructor(options?: { load?(orderId: Hex): Promise<any>; loadSub?(subId: Hex): Promise<any> });
  noteOrder(orderId: Hex, order: Record<string, any>): void;
  notePaid(orderId: Hex, paid: { at: number }): void;
  noteSub(subId: Hex, sub: Record<string, any>): void;
  order(orderId: Hex): Promise<any>;
  sub(subId: Hex): Promise<any>;
  clear(): void;
}

export interface Ledger {
  readCheckpoint(stream: string): Promise<Checkpoint | null>;
  hasRef(ref: string): Promise<boolean>;
  readActors(): Promise<ActorInput[]>;
  confirmedNonce(): Promise<number>;
  writeEdge(edge: EdgeSpec, options: { stream: string; checkpoint: Checkpoint; nonce: number }): Promise<unknown>;
  writeStanding(standing: Mapped & { action: 'standing' }, options: { stream: string; checkpoint: Checkpoint; nonce: number }): Promise<unknown>;
  registerActors(actors: ActorInput[], options: { nonce: number }): Promise<unknown>;
  readRecorderEdges?(range: { sinceTs: number; untilTs: number }): Promise<EdgeSpec[]>;
  foldRecorder?(edges: EdgeSpec[], options: { stream: string; checkpoint: Checkpoint; nonce: number }): Promise<unknown>;
}

export interface Source {
  confirmations: number;
  head(): Promise<number>;
  events(from: number, to: number): Promise<{ events: CheckoutEvent[]; unknown: number }>;
  blockTime(block: number): Promise<number>;
}

export declare const MAX_RANGE: number;
export declare function ranges(from: number, to: number, max?: number): { from: number; to: number }[];
export declare function chainSource(options: { client: PublicClient; address: Hex; abi: Abi; chainId: number; confirmations?: number }): Source & { safeHead(): Promise<number> };

export interface MirrorStatus {
  stream: string;
  checkpoint: Checkpoint | null;
  cursor: Position | null;
  scannedTo: number;
  head: number | null;
  lagBlocks: number | null;
  parked: { id: string; name: string; block: number; why: string; nodes: Hex[] }[];
  actors: number;
  stats: Record<string, number | null>;
}

export declare class Mirror {
  constructor(options: {
    source: Source;
    ledger: Ledger;
    actors: Actors;
    orders: OrderBook;
    stream: string;
    deployBlock: number;
    candidates?: Map<Hex, ActorInput>;
    deliveryPromiseS?: number;
    log?(line: string): void;
  });
  readonly stream: string;
  readonly lock: Lock;
  checkpoint: Checkpoint | null;
  scannedTo: number;
  stats: Record<string, number | null>;
  adopt(): Promise<void>;
  register(actors: ActorInput[]): Promise<number>;
  poll(): Promise<MirrorStatus>;
  sync(): Promise<MirrorStatus>;
  status(): MirrorStatus;
}

export declare class Lock {
  readonly held: boolean;
  run<T>(fn: () => Promise<T> | T): Promise<T>;
}

export declare const RECORDER_STREAM: string;
export declare const SETTLE_S: number;
export declare function walletOf(edge: { ref?: string; payload?: Record<string, any> | null }): string | null;
export declare function groupsByTs<T extends { ts: number }>(edges: T[]): [number, T[]][];
export declare function foldRecorder(options: {
  ledger: Ledger;
  bindings: { nodeOfWallet(wallet: string): Promise<string | null> };
  nowS?: number;
  settleS?: number;
  since?: number;
}): Promise<{ folded: number; unattributed: number; requests: number; sinceTs: number; untilTs: number }>;

export interface HeartbeatRow {
  instance: string;
  state: 'running' | 'stopped';
  updatedTs: number;
  updatedBlock?: number;
  [field: string]: unknown;
}

export declare const HEARTBEAT_EVERY_MS: number;
export declare const STALE_AFTER_S: number;
export declare const ARKIV_BLOCK_S: number;
export declare function newInstanceId(): string;
export declare function defaultClaimPath(): string;
export declare function pidAlive(pid: number): boolean;
export declare function readClaim(path?: string): { instance: string; pid: number; startedTs?: number } | null;
export declare function writeClaim(claim: { instance: string; pid: number; startedTs?: number }, path?: string): void;
export declare function dropClaim(instance: string, path?: string): void;
export declare function heartbeatAgeS(row: HeartbeatRow, options?: { arkivBlock?: number; nowS?: number }): number;
export declare function leaseDecision(options: {
  row: HeartbeatRow | null;
  instance: string;
  ageS: number;
  claim?: { instance: string; pid: number; alive: boolean } | null;
  staleAfterS?: number;
}): { ok: boolean; why: string };

export interface HistoryParams {
  story: string;
  storyVersion: number;
  seed: number;
  days: number;
  buyers: number;
  scale: number;
  endDay: number;
  promiseS: number;
  shops: { label: string; orders90d: number; refundRate90d: number; onTimeRate: number; priceMicro: number; etaMinutes: number }[];
}

export interface HistoryEvent {
  seq: number;
  ref: string;
  kind: 'order' | 'pay' | 'deliver' | 'late' | 'refund';
  fromEns: string;
  toEns: string;
  amountMicro: bigint;
  ts: number;
  day: number;
  orderId: Hex;
  synthetic: true;
}

export declare const HISTORY_DAYS: number;
export declare const HISTORY_BATCH: number;
export declare const HISTORY_BUYERS: number;
export declare function historyCounts(shop: { scenario: Record<string, any> }, scale: number): { orders: number; refunds: number; late: number; full: { orders: number; refunds: number; late: number } };
export declare function historyBuyers(root?: string, n?: number): ActorInput[];
export declare function historyParams(options: { cast?: unknown; source?: unknown; scale: number; endDay: number; promiseS?: number }): HistoryParams;
export declare function historyStream(params: HistoryParams): string;
export declare function parseHistoryStream(name: string): { story: string; storyVersion: number; scale: number; endDay: number; hash: string } | null;
export declare function planHistory(params: HistoryParams, options?: { root?: string }): { stream: string; buyers: ActorInput[]; events: HistoryEvent[] };
export declare function historyBatches<T>(events: T[], size?: number): T[][];
export declare function historyDecision(
  existing: { stream: string } | null,
  paramsFor: (endDay: number) => HistoryParams,
): { action: 'write' } | { action: 'resume'; endDay: number } | { action: 'refuse'; why: string };

export declare const ZERO_NODE: Hex;
export declare const BLOCK_DONE: number;
export declare function eventId(chainId: number, txHash: string, logIndex: number | bigint): string;
export declare function comparePosition(a: Position, b: Position): number;
export declare function atOrBefore(pos: Position, checkpoint: Position | null | undefined): boolean;
export declare function before(pos: Position): Position;
export declare function utcDay(ts: number | bigint): number;

export declare const DEFAULT_PORT: number;
export declare function startServer(
  app: { health(): object; status(): object; sync(): Promise<object> },
  options?: { port?: number; host?: string; log?(line: string): void; redact?(text: string): string },
): Promise<Server>;

export declare function CAFFEINATE_ARGS(pid: number): string[];
export declare function keepAwake(options?: { pid?: number; platform?: string; spawnImpl?: unknown }): { held: boolean; pid?: number; why: string };
