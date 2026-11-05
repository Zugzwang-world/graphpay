import type { LanguageModel } from 'ai';
import type { ErrandOptions, LiveHooks, McpLike, Role, RunLog, RunState, ShopSurface, TeamCast } from '../index.d.ts';

export interface MockWorldOptions {
  cast?: TeamCast;
  now?: number;
  /** Bad play per role: concierge 'price-only' | 'trusts-analyst' | 'triple-pay' | 'widen-limits'; analyst 'lying'; payer 'overspend' | 'wrong-shop'. */
  play?: Partial<Record<Role, string>>;
  /** Edges per role: 'empty' | 'max-tokens' | 'two-blocks' | 'throw:<message>'. */
  faults?: Partial<Record<Role, string>>;
  /** ENS status per agent name: 'REVOKED' | 'PAUSED' | 'EXPIRED' | 'error'. */
  ens?: Record<string, string>;
  /** What ENS resolves as a shop's payee (null, a malformed value or 'error' to fail). */
  payee?: Record<string, string | null>;
  accepts?: Record<string, { network: string; asset: string }[]>;
  /** Shop API behaviour per shop name. */
  shops?: Record<string, { settle?: 'ok' | '502' | 'timeout' | 'failed' | 'refused' | 'no-receipt'; payTo?: string; extraAccepts?: boolean; amountBump?: number; quoteEntity?: 'write' | 'skip-once' | 'expired-once' | 'wrong-price' | 'never' }>;
  graph?: Record<string, Record<string, unknown>>;
}

export interface MockWorld {
  cast: TeamCast;
  mcp: McpLike & { calls: unknown[] };
  hooks: LiveHooks & { signed: unknown[]; surfaces: Map<string, ShopSurface & { paid: unknown[]; signatures?: number }>; quotes: { entries: unknown[] } };
  mockModels: ((role: Role) => LanguageModel | null) & { seen: { prompts: Record<string, string[]> } };
}

export declare function createMockWorld(options?: MockWorldOptions): MockWorld;
export declare function runMockErrand(options?: MockWorldOptions & Partial<ErrandOptions>): Promise<{ runLog: RunLog; metrics: unknown; state: RunState; world: MockWorld }>;
export declare const MOCK_SDL: string;
export declare const MOCK_CONTRACT: string;
export declare const MOCK_HOST: string;
export declare function mockAddress(label: string): string;
export declare function mockNode(name: string): string;
export declare function mockTx(label: string): string;
export declare function mockGraphRows(cast: TeamCast, overrides?: Record<string, Record<string, unknown>>): Record<string, any>[];
export declare function createMockMcp(options: { cast: TeamCast; rows?: Record<string, any>[] }): McpLike & { calls: unknown[] };
export declare function createMockHooks(options: Record<string, unknown>): MockWorld['hooks'];
export declare function createMockShopSurface(options: Record<string, unknown>): ShopSurface;
export declare function createScriptedModels(options: { cast: TeamCast; play?: MockWorldOptions['play']; faults?: MockWorldOptions['faults'] }): MockWorld['mockModels'];
export declare function readPrompt(prompt: unknown[]): { task: any; results: { toolName: string; output: any; step: number }[]; step: number; system: string };
