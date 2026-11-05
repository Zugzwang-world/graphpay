# T3 Arkiv: resume here (fresh start)

Updated 03:20 IST, Fri 6 Nov. Read this, then `docs/plan/sessions/T3-arkiv.md`, then `docs/sessions/arkiv/README.md` (API) and `seeding.md` (city runbook).

## Done

- **M7a** merged (PR #14, 01:51 IST): `packages/arkiv-graph` (generic SDK: defineGraph, planner, safe writer, ArkivSim, transport, reads) and `packages/money-graph` (GraphPay model, connectArkiv, ledger, recorder, quotes, directory, heartbeat). Live probe results in `docs/technical/FACTS.md` (T3 rows).
- **M8 size S** seeded on Rabdi from W_SEED_EVENT (graph store 97 txs, 0.494 tGLM, 8.9 min; directory 12 shops from W_DIRECTORY, 1 tx; plain store 43 txs, 0.181 tGLM, done 03:04 after a resume). End date `2026-11-05`, dataset `graphpay-city-v1-S`, 91 actors, 12 shops, 1,003 events, 490 pay and renew rows. Manifests and truth in `docs/sessions/arkiv/city/` (`seed-S-*.json`, `truth-S.json`, `sim-check-S.json`, `check-S.json`); they live under `docs/` because they carry names and addresses, which the code scan refuses under `packages/`.
- **M7b** merged with M8 (PR #21, 03:11 IST): `packages/arkiv-graph/src/engine.mjs` (owner-scoped calls, budget chunking, cap and truncated, explain trace and id), `filter.mjs`, `packages/money-graph/src/graphql.mjs` (SDL, resolvers, limits, `runGraphql`), `mcp.mjs` (schema, ask, graphql, explain; stateless), routes `apps/web/app/api/{graphql,explain/[id],mcp}` (ADR-0060). Tests: `packages/city/test/engine.test.mjs` (9 on ArkivSim). Live check on Rabdi S: all six checks pass (`node packages/city/scripts/check.mjs --size S --end 2026-11-05`), Q2 in 2 calls.

## Next

1. PR #21 (M8 S + M7b) merged at 03:11 IST; the seeding survived the 02:14–03:01 sleep (all three manifests `done`). Join's `$attributes` fix (run file, Open items) ships as branch `arkiv/attributes`; watch it until it merges.
2. Done 03:22: production `/api/graphql` (`dataset: "S"`, top shops in 2 calls) and `/api/mcp` `tools/list` both answer.
3. **M9** (`planning/PROMPTS/09-live-benchmark.md`, M7 amendment §8: reads, not speed): `bench/` harness, plain baseline Q1–Q6 against the plain store (records/profiles under W_SEED_EVENT), Q2 race function for the website (`/api/race` belongs to T5; give them a function), CSVs and `bench/BENCHMARK-LIVE.md`. Expected plain Q2 at S: `ceil(490 / 100)` = 5 calls sequential, 6 in parallel; Graph Arkiv 2.
4. Friday items (MASTER_PLAN §4): 1 (heartbeat-like `shop_open`, `agent_presence`, `handoff`), 4–5 (Swarm), 6 (demo cast `shop` rows), 10, 15, 18 (SDK publish prep: README, API reference, leaderboard example).

## How to check the seeding

- A finished store has `docs/sessions/arkiv/city/seed-S-<store>.json` with `"status": "done"` (all three are done).
- Counts on Rabdi: `node packages/city/scripts/check.mjs --size S --end 2026-11-05` (read-only).
- A failed store: `node packages/city/scripts/seed.mjs --size S --backend rabdi --wipe --execute --store <graph|plain>`, then seed that store again (`--store <store>`).

## Open threads

- The `arkiv` LOG line of 03:20 says "PR pending": in the next PR, add the `arkiv/attributes` PR's link and merge time.
- Story `syntheticCity.reRegisteredShop.epoch` is 2 while fresh names start at epoch 0 (the spec says +1). The generator uses the story value; flagged in OPEN for the Coordinator.
- `graphql-yoga` is a dependency but unused (GraphQL runs on graphql-js; ADR-0060).
- The benchmark-only MCP tool `arkiv_query` (parse and re-render before adding the owner) is not built yet: M9.
- The explorer's entity page URL pattern is unverified (`arkiv/schema.md`).
- Q4 (agents that paid a shop this week that later refunded someone else) has an empty truth at S; fine, but say so in the benchmark report.
