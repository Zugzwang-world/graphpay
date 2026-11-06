// The errand runner behind POST /api/agents/run: Join's live runner (@graphpay/integration,
// live-runner.mjs), the buyer team on the `live` preset over live ENS, Arkiv, the MCP and the
// hosted shop and facilitator, as the story's payer agent. Server side only: its keys are this
// server's environment. Until every name it needs is set there is none: the route says it is
// waiting, and the server log names what is missing. The shipped site has no fake path.

import { createLiveRunner, liveRunnerMissing } from '@graphpay/integration/live-runner';
import type { RunResult } from './contracts.ts';
import type { ErrandRunner } from './run-registry.server.ts';

export const RUNNER_WAITING_FOR = "the live runner's server settings (Join)";
// The names (never values) it still needs go to the server log only.
const missing = liveRunnerMissing(process.env);
if (missing.length && process.env.NODE_ENV === 'production') console.log(`agents: the live runner waits for ${missing.join(', ')}`);

let override: ErrandRunner | null = null;
let live: ErrandRunner | null | undefined;

// For tests only: nothing in the shipped site calls this.
export function setErrandRunnerForTests(runner: ErrandRunner | null): void {
  if (process.env.NODE_ENV === 'production') throw new Error('the test runner seam is closed in production');
  override = runner;
}

export function errandRunner(): ErrandRunner | null {
  if (override) return override;
  if (live === undefined) {
    const runner = createLiveRunner(process.env, { log: (line) => console.log(line) });
    live = runner ? (input) => runner(input) as Promise<RunResult> : null;
  }
  return live;
}
