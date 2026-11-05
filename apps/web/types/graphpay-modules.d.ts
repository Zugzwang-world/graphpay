// Declarations for workspace packages that ship JavaScript without types for what the
// website uses (T3's race function and city truth, docs/sessions/arkiv/README.md "Race mode").
import '@graphpay/money-graph';
import type { ArkivConnection } from '@graphpay/money-graph';

declare module '@graphpay/money-graph' {
  export const RACE_QUESTIONS: string[];
  export interface RaceCallEvent {
    call: number;
    ms: number;
    bytes: number;
    status?: number;
  }
  export interface CallTap {
    log(entry: Record<string, unknown>): void;
    listen(stats: ArkivConnection['stats'], onCall: (call: RaceCallEvent) => void): void;
    stop(): void;
  }
  export function callTap(): CallTap;
  export interface RaceResult {
    answer: unknown;
    correct: boolean | null;
    truthBasis: 'identity' | 'name' | null;
    matchesIdentityTruth: boolean | null;
    calls: number;
    bytes: number;
    ms: number;
  }
  export function raceQuestion(
    arkiv: ArkivConnection,
    options: { question?: string; mode: 'graph' | 'plain'; inFlight?: number | 'all'; params: unknown; truth?: unknown; size?: string; tap?: CallTap | null; onCall?: (call: RaceCallEvent) => void; writers?: Record<string, `0x${string}`>; story?: unknown },
  ): Promise<RaceResult>;
}
