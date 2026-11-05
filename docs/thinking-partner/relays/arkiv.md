# Relay: arkiv (T3)

Updated 03:55 IST, Fri 6 Nov. This step: M9, the live benchmark at size S (branch `arkiv/bench`). Before it: Join's `$attributes` fix ([PR #25](https://github.com/Zugzwang-world/graphpay/pull/25), merged 03:23); M8 S and M7b ([PR #21](https://github.com/Zugzwang-world/graphpay/pull/21), 03:11); M7a ([PR #14](https://github.com/Zugzwang-world/graphpay/pull/14), 01:51).

## In plain words

The benchmark asks the same six money questions of the same synthetic city in two ways. One is plain Arkiv code written by hand, which can only read rows and count them. The other is Graph Arkiv, with one GraphQL question each. Then it counts how many Arkiv reads each needs. Reads are the result, not seconds, because seconds depend on the venue's network (ADR-0042).

**The headline:** ranking the city's shops by sales takes Graph Arkiv **2 reads against 5** (6 when plain asks for every page at once). Arkiv has no SUM, so plain code must read all 490 payment and renewal rows and add them up itself. Graph Arkiv keeps running totals, written with each payment. The gap grows with every payment. At this small size it is modest; the bigger city waits for the founder's final story.

**Correctness:** every Graph Arkiv answer was right. Plain code was right by name, but wrong by identity on the ranking: it credits a re-registered shop's earlier owner's sales to the new owner. Acceptance D6 passes: the calls are exact and the answers right.

**Honest limits, stated in the report:** Graph Arkiv needs no fewer reads for this week's traversals (equal on Q1, Q4 and Q6; 3 against 2 on Q3). It moves more bytes on several questions; for example, its 90-day window adds up one row per active day. Writing the graph costs more (0.494 against 0.181 tGLM). No request failed or hit the rate limit.

**The website's race mode** gets a function that runs one side live and reports each read as it lands; T5 wires it into `/api/race`.

**Two bugs found and fixed on the way.** First, the byte meter lost counts when reads overlapped, so parallel byte numbers came out too low; fixed, tested, and the benchmark run again. Second, GraphQL read each agent's payments separately; that is now one batched read, so the persona's spending is 3 reads, as in the lab.

## Technical

- **Questions both ways** (`packages/money-graph/src/bench.mjs`, exported):
  - Plain against the plain store (owner W_SEED_EVENT): `count()` where a count answers (Q1: 3); keyset pages of 100 one at a time, or one `count()` then offset pages with 4, 8, 16 or all in flight (Q2); profiles then one OR batch (Q3); refunds then payments into those shops (Q4); a two-ended path search expanding the smaller side (Q5); two levels of OR batches inside the 64-leaf budget (Q6). Projections everywhere, rows owner-checked.
  - Graph Arkiv: one document each (`graphDocument`), answers normalised by `graphAnswer`.
  - `score` is by identity for Graph Arkiv and by name for plain, plus `matchesIdentityTruth`.
- **Truth** (`packages/city/src/bench.mjs`): `benchParams(city)` (who and which days; Q1's 90 days end on the engine's today) and `benchTruth`, built from `truthOf` (identity and name differ only on Q2).
- **Harness** (`bench/run.mjs`, `bench/report.mjs`):
  - one metered connection; it checks R = 490 against the generator first;
  - a warm-up, 5 interleaved runs of Q1–Q6, and 11 rotating rounds of the six Q2 modes;
  - CSVs with a SYNTHETIC header, commit, backend and block range: `questions-S`, `q2-parallel-S`, `writes-S`, `http-S` (status, ms, ratelimit, never the URL);
  - `BENCHMARK-LIVE.md`, reads and bytes only.
- **Race** (`raceQuestion`, `callTap`): Q1, Q2 and Q5; `onCall({ call, ms, bytes, status })` per read, then `{ answer, correct, truthBasis, matchesIdentityTruth, calls, bytes }`. Usage for T5 is in `docs/sessions/arkiv/README.md` ("Race mode"). The truth needs `@graphpay/city` in `apps/web` (OPEN).
- **Engine change** (`graphql.mjs`): `out()`/`in()` of sibling nodes goes through one DataLoader, grouped by direction, epoch, kinds and first day, using `queryAny` (budget-chunked OR). Each node keeps its `limit`; the 500-row cap still marks the answer truncated.
- **Meter fix** (`packages/arkiv-graph/src/transport.mjs`): `responseBytes += await …` was a lost update under concurrency (P-arkiv-2). It now reads the body first, then adds.
- **Tests:**
  - `packages/city/test/bench.test.mjs` (4, on ArkivSim): all six questions right both ways; Q2 calls exact (plain `ceil(R/100)`, parallel +1, Graph Arkiv 2); Q3 = 3; the race's per-call events add up to its totals.
  - `packages/arkiv-graph/test/sim.test.mjs`: five overlapping reads count five bodies.
  - Totals: arkiv-graph 24, money-graph 15, city 18; `pnpm check` clean.
- **Against the lab:** 9 of 13 counts are the same. Q4 is 1 and 1 here (no refunds this week, so there is no second read); Q5 is plain 5 and Graph Arkiv 3 here (lab 3 and 5). The generator does not reproduce the lab's city row for row.

**Deviations, and why:**
- No times in the report (ADR-0042; they stay in the CSVs).
- Q1's 90-day window ends today, as the engine's does, not at the city's end.
- Lists use the production cap of 100.
- Size M is refused by the harness until the story is locked (D7 blocked).

**Next:** ship M9, then Friday items 4–5 (Swarm, gateway first; ADR-0039, ADR-0053), then 1, 6, 15, 18.
