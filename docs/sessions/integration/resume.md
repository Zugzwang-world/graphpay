# Join: resume after a fresh start

Updated 04:10 IST, Fri 6 Nov. Read this first, then `docs/plan/sessions/join.md`.

## Running now

- `pnpm workers` (instance `f82114f0ed9f425b`), started 03:30 IST from this worktree (`.claude/worktrees/graphpay-join-session-272a7b`), log `workers.log` there (gitignored). Check it with `curl -s 127.0.0.1:8788/status` or `node acceptance/mirror.mjs lag`. **Never start a second one.** If it died, start it again from this worktree: it resumes from Arkiv.
- A 30-minute lag sample to `lag-sample.log` (one line a minute).

## Where M11 stands

- Merged: PR 8 (core), PR 20 (the ledger and the workers). PR 33 (M11 part 3) merged: the replay tool, the acceptance reads, the integration package.
- Live: the cast and the history are on Rabdi; D2a passes; D15 has a first pass on an empty window (`docs/sessions/integration/mirror.md`).
- To finish: on the first real payment (T1's M3 part B), run D1, D2b and D2c (workers stopped, see `mirror.md`), D3, D15 again with payments, and 30 minutes of lag under 30 s. Host T2's M6 watcher in `main.mjs` when it merges. Then the PR titled `… (M11 done)`.

## M12 (started)

- `integration/src/mcp.mjs` (works against the hosted MCP) and `integration/src/hooks.mjs` (ENS payee and accepts, discovery, shop keys, quotes, payer wallets).
- Done since: `integration/src/gate.mjs` (the gate on the signing path, `ensCheck`) and `integration/src/activity.mjs` (Friday item 3, batched presence and hand-offs). E7's kill step must use the ungated sign.
- Missing: the shop surface (catalog, storefront, 402, settlement) and x402 signing from T1's M3 (`graphPayOrderClient` in `@graphpay/facilitator`); T2's watcher (M6 part 2) hosted in `packages/mirror/src/main.mjs`. Then `pnpm e2e:food` (`planning/PROMPTS/12-e2e-food.md`).

## The website's errand runner (T5, 05:05 IST)

- When wiring `apps/web/lib/agents-live.server.ts` `errandRunner()`: pass `runId: input.runId` to `runErrand` (PR 55); the explainer lanes and the map query the hand-off and presence rows by it. Use `batchedActivity(dir)` with `await activity.flush()` before the stream ends. The seam waits for M4 (the hosted facilitator and shop).

## Notes

- T3 was told (via the Coordinator, 03:29) that `Reputation.synthetic` ignores the tally rows' label.
- The reviewer runs on every money, key or writer change. Keep tool output short; end the turn when blocked.
