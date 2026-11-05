# Relay: records (the Coordinator), 01:20 IST, Fri 6 Nov

## Where we are

M0 closed at 23:55 IST (PRs #1–#7). The six wave-1 sessions (T1 Payments, T2 Identity, T3 Arkiv, T4 Agents, T5 Web and Join) started at about 00:44 IST, and the Coordinator took over at 00:46. Since then it has run a check every 10 minutes and held the Mac awake. No track has opened a PR yet. T3 is writing the in-memory Arkiv stand-in for M7a, which is the first gate: T1's recorder, Join's mirror and the small city all wait for it. Checkpoint estimates are unchanged: CP2 about 01:35, CP4 (acceptance) about 05:30, freeze Fri 18:00, submit by Sat 08:00.

## What the founder needs to do

| what | where | why |
|---|---|---|
| Set the Coordinator to Opus 5.5 at high, and decide on extra usage with a cap | the Coordinator's model menu; Claude account settings | The weekly plan limit is 71% used and resets Fri 21:30 IST. If it runs out, every session stops until after the freeze. The six track sessions were switched to the planned models at 01:22 |
| Send the disclosure, if not sent yet | Hacker Dashboard; text in `docs/plan/DISCLOSURE_MESSAGE.md` | The rules require it |
| Send the story brief | the Coordinator, by 08:30 (at the latest 13:00) | Rehearsal 1, and the large city that has to start seeding by 14:00 |
| Keep the laptop on power, lid open, app open | — | Every session runs on this Mac |
| Optional: claim the npm organisation `graphpay` | npmjs.com → Add Organization (free) | Only the scope's owner can publish `@graphpay/arkiv-graph`. Nobody has claimed it yet |

## Done since the handover

- **The graph layer becomes a developer SDK.** The Arkiv booth asked for one, and the founder decided at 00:48 (ADR-0057). T3 was told at 01:04 and adopted it in M7a:
  - `packages/arkiv-graph` (`@graphpay/arkiv-graph`) is generic: the developer defines the nodes, the edges and the totals (views).
  - GraphPay's payment model (entity names, edge kinds, tally counters, reputation, the GraphQL types and the MCP tools) lives in `packages/money-graph` (`@graphpay/money-graph`).
  - GraphPay uses the SDK only through its exports, and a boundary test keeps payment words out of the SDK.
  - T1 and Join will import the writer with `import { connectArkiv, createLedger, recordEdge, createQuote, findQuotes } from '@graphpay/money-graph'` (T3's reply).
- **New Friday item 18** (`docs/plan/MASTER_PLAN.md` §4): after the acceptance run, publish the package to npm with a README quickstart, an API reference, a leaderboard example, tests, and links from `arkiv/reach.md` and `arkiv/how-you-use-arkiv.md`. T3 writes the package docs; the Coordinator checks the name and publishes with the founder's npm login. It replaces the pack's planned `arkiv-graphql` package, so there is one package.
- **The npm name is free** (01:02): `@graphpay/arkiv-graph` is not on the registry, and nobody owns the `graphpay` scope. The unscoped `arkiv-graph` belongs to another Arkiv project (graphs and tables for Arkiv entities). The README will credit it and say how ours differs (`docs/technical/FACTS.md`, records rows).
- **M0's background tasks: none failed.** The founder asked; checked in M0's transcript and on GitHub:
  - all 11 subagents (reviewers, verifier, writers) finished;
  - all 3 background waits exited 0;
  - all 24 Actions runs succeeded;
  - the production site answers 200.

  Three things went wrong during M0, and each was fixed before the handover, so none of them matters now:
  - the first hidden prompt for the Ankr URL was closed by M0 at 22:30 and reopened on the fixed setter, and the URL was stored at 22:51;
  - the first CLI deploy failed at install and was fixed by PR #2 (P-foundation-1);
  - one Sepolia transfer was refused and re-sent safely (P-foundation-2).
- **AI usage:** rows for the seven event sessions with their actual model and effort (`AI_USAGE.md` §2).

## Problems

- **P-records-1:** every session's prompt log lands in the main checkout (`~/graphpay/prompts/raw/`), not in its worktree, so track PRs do not carry their logs. Fix next: the hook writes into the session's own checkout, and the logs written so far are swept into a records PR.
- **P-records-2:** the venue network is slow. Name lookups take 3–7 s and TLS about 6 s, so `gh` and `git fetch` sometimes time out. Retrying works.

## Questions for the thinking partner

| question | recommendation |
|---|---|
| Is the planned model mix enough to last until the reset at Fri 21:30, or should extra usage be on? | Extra usage with a cap. The switch cuts the burn, but a stop before the freeze would cost far more than the overage |
| Is it fine that `@graphpay/arkiv-graph` replaces the pack's `arkiv-graphql` package? | Yes. One package is clearer for reach, and the GraphiQL URL and the MCP server stay |

## Next

Ticks every 10 minutes. Restart each track session with "continue" when it goes idle on its new setting. On M7a's merge, tell T1 and Join the import path and T3 to seed size S. Fix the prompt-log hook (with a reviewer pass, since it masks secrets). Measure the usage burn each tick. Records again about 02:45.

## Technical notes

- Ticks: a session-only cron, `3-59/10 * * * *`, first run 00:58. Keep-awake: `session_idle` (the app's hold). Join's mirror adds `caffeinate` after M11 (ADR-0056).
- Usage: the app's usage card read 70% at 01:08 and again at 01:10 (no change measurable in minutes). Fable's own weekly limit is at 0%. Extra usage is off.
- Session metadata: all seven sessions report `claude-opus-5-5` at `max`; the plan is in `docs/plan/sessions/README.md`.
- Records changed in this PR: ADR-0057; `MASTER_PLAN.md` (§1 status, §2 owners, §4 item 18); the T3, Coordinator and Submission run files; `FACTS.md` records rows; `PROBLEM_LOG.md` (P-records-1, P-records-2); `AI_USAGE.md` §2; `NOW.md`; `OPEN.md`; `LOG.md`; the brief `briefs/0048-arkiv-graph-sdk.md`.
