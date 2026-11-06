// Types for the site's import of the live errand runner (live-runner.mjs).
export declare const LIVE_RUNNER_NEEDS: readonly string[];
export declare const PAY_RETRY_WAITS_MS: readonly number[];
export declare const VERIFY_UNAVAILABLE: string;
export declare const FACILITATOR_BUSY: string;
export declare function payWithRetry<A, R extends { status: number; body?: unknown }>(pay: (args: A) => Promise<R>, args: A, options?: { waits?: readonly number[]; signal?: AbortSignal | null; log?: (line: string) => void; sleep?: (ms: number) => Promise<void> }): Promise<R>;
export declare function liveRunnerMissing(env?: Record<string, string | undefined>): string[];
export interface LiveErrandInput {
  runId: string;
  request: string;
  onEvent: (event: never) => void;
  signal: AbortSignal;
}
export declare function createLiveRunner(
  env?: Record<string, string | undefined>,
  options?: { log?: (line: string) => void; buildParts?: (() => Promise<unknown>) | null },
): ((input: LiveErrandInput) => Promise<unknown>) | null;
