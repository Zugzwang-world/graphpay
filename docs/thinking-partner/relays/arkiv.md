# Relay: arkiv (T3)

Updated 03:20 IST, Fri 6 Nov. This step: a fix to the merged money graph (Join's finding). Before it: M8 (the synthetic city, size S) and M7b (GraphQL, explain, hosted MCP), merged at 03:11 ([PR #21](https://github.com/Zugzwang-world/graphpay/pull/21)); M7a merged at 01:51 ([PR #14](https://github.com/Zugzwang-world/graphpay/pull/14)).

## This step: a send that landed is adopted, not written twice

**In plain words.** Several server instances share one Arkiv wallet, so when a write is reported as failed, the writer looks up what actually landed at that transaction slot and asks "is this ours?" before trying again. For the recorder (refusals and refund requests), for quotes and for the ledger's check, that question read the row in the wrong shape and always answered "no". The writer then sent the same row again, so one refusal could get two receipts. Join's mirror already counted it once, so no tally was wrong, but T1's recorder needs it fixed. Now the check reads the row the way Arkiv's SDK returns it, and a simulator test proves each of the three lands exactly once.

**Technical.** `publicClient.getEntity(key)` in `@arkiv-network/sdk` 1.0.1 returns a flat row with the columns under `$attributes` (`dist/index.d.ts`, `getEntity`; `FullEntity`). `recordEdge` (`src/recorder.mjs`), `createQuote` (`src/quotes.mjs`) and the unstreamed ledger verifier (`src/ledger.mjs`) read `e.attributes`, so `verifyRecovered` returned false and the writer took the pinned nonce as another writer's and sent again at a new nonce. All three now read `e.$attributes ?? e.attributes`, as the mirror already did. The new test in `packages/money-graph/test/ledger.test.mjs` injects ArkivSim's `apply-then-fail` fault (the transaction applies, the send reports an error) on each path and checks `recovered` is true and exactly one row exists; it fails on the old code. Tests: money-graph 14, arkiv-graph 23, mirror 29, city 14; `pnpm check` clean.

## M8 and M7b (merged in PR #21)

### In plain words

Agents ask Arkiv questions before they pay ("is this shop good?"). To show that this works at a realistic size, we wrote a labelled synthetic city straight into Arkiv's testnet: tonight the small city only, with the test story; the big city waits for the founder's final story (ADR-0049). It has 91 people, agents and shops and 1,003 events over 120 days (orders, payments, refusals, partial refunds, weekly subscriptions), in real Mumbai neighbourhoods from OpenStreetMap, with fictional shop names, every row labelled synthetic.

Agents ask through GraphQL, and each answer comes back with a trace of every Arkiv read behind it and an id (the same question always gets the same id). The same questions are open to any AI agent over MCP at `/api/mcp`, with four read-only tools. Proven on the live testnet: every check matched the generator's truth; the city-wide top 10 takes 2 reads (plain code needs 5 here, because it must read all 490 payment rows); the map query returns exactly the three demo shops (eleven with synthetic shops opted in); a shop's totals recount from the raw receipts and agree.

### Technical

- **Generator** (`packages/city/src/generate.mjs`): mulberry32, seed 2026; every parameter, name and place from `story.json`. Truth for the six questions in `docs/sessions/arkiv/city/truth-S.json`.
- **Seeding** (`packages/city/src/seed.mjs`, driver `scripts/seed.mjs`): the graph store through the mirror's ledger and planner (25 events per batch, split by bytes); the plain store one record per event and one profile per actor; directory rows from W_DIRECTORY. Refuses an owner that already holds a store and size M while the story is unlocked; has a wipe and `--resume`.
- **Live (Rabdi):** graph store 97 transactions (2,200 creates, 940 patches), 0.494 tGLM, 8.9 minutes; directory 12 rows in 1 transaction; plain store 43 transactions, 0.181 tGLM, after one resume. Numbers in `docs/technical/FACTS.md` (T3 rows).
- **Engine** (`packages/arkiv-graph/src/engine.mjs`, generic): one call per trusted owner, rows owner-checked; OR lists chunked to the predicate budget; pages of 100 to a 500-row cap with `truncated`; explain id = sha256 of the backend and the sorted queries.
- **GraphQL and MCP** (`packages/money-graph/src/graphql.mjs`, `mcp.mjs`): reputation from current-epoch tallies, `top` as one ORDER BY plus one node lookup, `path` over pair links; 8 fields and depth 8 (MCP 6 and 4); no mutations; a per-request call budget (60; MCP 25). Routes `/api/graphql`, `/api/explain/[id]`, `/api/mcp` (ADR-0060).
- **Deviations:** graphql-js directly rather than Yoga (ADR-0060); the benchmark-only `arkiv_query` tool moves to M9; the story's re-registration epoch is 2, not the spec's +1 (OPEN).

**Checked on production (03:22 IST):** `POST /api/graphql` with `dataset: "S"` returns the top shops in 2 calls (backend rabdi, not truncated); `/api/mcp` answers `tools/list`.

**Next:** M9, the live benchmark: plain against Graph Arkiv, reads and bytes, CSVs and the report.
