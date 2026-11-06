// Types for the site's import of the live errand runner (live-runner.mjs).
export declare const LIVE_RUNNER_NEEDS: readonly string[];
export declare const RUNS_PER_HOUR: number;
export declare function liveRunnerMissing(env?: Record<string, string | undefined>): string[];
export interface LiveErrandInput {
  runId: string;
  request: string;
  onEvent: (event: never) => void;
  signal: AbortSignal;
}
export declare function createLiveRunner(
  env?: Record<string, string | undefined>,
  options?: { log?: (line: string) => void; now?: () => number },
): ((input: LiveErrandInput) => Promise<unknown>) | null;
