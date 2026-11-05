# T3 Arkiv: resume here (fresh start)

Updated 03:50 IST, Fri 6 Nov. Read this, then `docs/plan/sessions/T3-arkiv.md`, then `docs/sessions/arkiv/README.md` (API) and `seeding.md` (city runbook).

## Done

- **M7a** merged (PR #14, 01:51 IST): `packages/arkiv-graph` (generic SDK: defineGraph, planner, safe writer, ArkivSim, transport, reads) and `packages/money-graph` (GraphPay model, connectArkiv, ledger, recorder, quotes, directory, heartbeat). Live probe results in `docs/technical/FACTS.md` (T3 rows).
- **M8 size S** seeded on Rabdi from W_SEED_EVENT (graph store 97 txs, 0.494 tGLM, 8.9 min; directory 12 shops from W_DIRECTORY, 1 tx; plain store 43 txs, 0.181 tGLM, done 03:04 after a resume). End date `2026-11-05`, dataset `graphpay-city-v1-S`, 91 actors, 12 shops, 1,003 events, 490 pay and renew rows. Manifests and truth in `docs/sessions/arkiv/city/` (`seed-S-*.json`, `truth-S.json`, `sim-check-S.json`, `check-S.json`); they live under `docs/` because they carry names and addresses, which the code scan refuses under `packages/`.
- **M7b** merged with M8 (PR #21, 03:11 IST): `packages/arkiv-graph/src/engine.mjs` (owner-scoped calls, budget chunking, cap and truncated, explain trace and id), `filter.mjs`, `packages/money-graph/src/graphql.mjs` (SDL, resolvers, limits, `runGraphql`), `mcp.mjs` (schema, ask, graphql, explain; stateless), routes `apps/web/app/api/{graphql,explain/[id],mcp}` (ADR-0060). Tests: `packages/city/test/engine.test.mjs` (9 on ArkivSim). Live check on Rabdi S: all six checks pass (`node packages/city/scripts/check.mjs --size S --end 2026-11-05`), Q2 in 2 calls.

## Next

1. Merged: PR #25 (03:23), #30 (labels, 03:41), #31 (M9, 03:45). Friday item 1 is on branch `arkiv/activity` (`packages/money-graph/src/activity.mjs`, GraphQL `shops(openNow)`, `agentsOnline`, `handoffs`, `activityHooks`); ship it and watch it.
2. **Swarm** (Coordinator, 03:4x): item 4 and the `menu` part of item 5 go through the public gateway (`api.gateway.ethswarm.org`, `POST /bytes` or `/bzz`, `swarm-postage-batch-id` = 64 zeros); public unencrypted menu JSON only, no personal data; keep the reference and a content hash on Arkiv; re-upload on 404; never send or buy a stamp of our own; no Bee node, no sBZZ. `refund_evidence` last: AES-256-GCM in our code with a per-file key, upload the ciphertext as plain bytes (64-hex ref), store the per-file key wrapped with the Swarm wrapping key (base64url); the writer refuses any 128-hex run. Ask the Coordinator for the wrapping key (`pnpm -s secrets:gen`) then. Swarm is first in the cut order (ADR-0053): drop refund_evidence before any demo-path item.
3. Then Friday items 6 (demo cast `shop` rows, after the founder's names), 15 (`arkiv/` drafts), 18 (SDK publish prep after CP4), 10 (map support for T5).

## How to check the seeding

- A finished store has `docs/sessions/arkiv/city/seed-S-<store>.json` with `"status": "done"` (all three are done).
- Counts on Rabdi: `node packages/city/scripts/check.mjs --size S --end 2026-11-05` (read-only).
- A failed store: `node packages/city/scripts/seed.mjs --size S --backend rabdi --wipe --execute --store <graph|plain>`, then seed that store again (`--store <store>`).

## Open threads

- Story `syntheticCity.reRegisteredShop.epoch` is 2 while fresh names start at epoch 0 (the spec says +1). The generator uses the story value; flagged in OPEN for the Coordinator.
- `graphql-yoga` is a dependency but unused (GraphQL runs on graphql-js; ADR-0060).
- The benchmark-only MCP tool `arkiv_query` is not built: the M7 amendment keeps it out of the hosted MCP, and M9 did not need it.
- Q4's truth is empty at S (no refunds this week); the report says so. Graph Arkiv's Q1 moves about 110 KB (70 day-tally rows for the 90-day window) against plain's 1.3 KB; reads are equal. Projections in the engine's reads would cut it (not done).
