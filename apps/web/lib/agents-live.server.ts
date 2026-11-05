// The errand runner behind POST /api/agents/run. Join wires the real one in M12
// (`e2e:food`): the buyer team over live ENS, Arkiv, the shop API and the signer.
// Until then there is none, and the route says so: the shipped site has no fake path.

import type { ErrandRunner } from './run-registry.server.ts';

export const RUNNER_WAITING_FOR = 'M12 live wiring of the agents (Join)';

let override: ErrandRunner | null = null;

// For tests only: nothing in the shipped site calls this.
export function setErrandRunnerForTests(runner: ErrandRunner | null): void {
  if (process.env.NODE_ENV === 'production') throw new Error('the test runner seam is closed in production');
  override = runner;
}

export function errandRunner(): ErrandRunner | null {
  return override;
}
