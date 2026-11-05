# Relay: arkiv (T3)

Updated 03:05 IST, Fri 6 Nov. Steps: M8 (the synthetic city, size S) and M7b (GraphQL, explain, hosted MCP). M7a merged at 01:51 ([PR #14](https://github.com/Zugzwang-world/graphpay/pull/14)).

## In plain words

GraphPay's agents ask Arkiv questions before they pay ("is this shop good?"). To show that this works at a realistic size, without paying for thousands of real orders, we built a labelled synthetic city and wrote it straight into Arkiv's testnet. Tonight that is the small city only, with the test story. The big city waits until the founder locks the final story (ADR-0049).

The small city has 91 people, agents and shops and 1,003 events: orders, payments, refusals, partial refunds and weekly subscriptions over 120 days. The three demo shops are the most popular, with their story refund rates. The persona's agents buy only in the last week and never from the trap shop. One generated shop re-registers its name 30 days before the end, so its history starts again. The shops sit in real Mumbai neighbourhoods near the persona's starting point, taken from OpenStreetMap. The shop names are fictional and every row is labelled synthetic.

The second half is the part agents talk to. One GraphQL question goes in and the answer comes back with a trace of every Arkiv read behind it, plus an id. The same question always gets the same id. The same questions are available to any AI agent over MCP at `/api/mcp`, with four read-only tools.

What was proven on the live testnet:

- **Every check matched the generator's truth.** We asked the seeded city through GraphQL and compared each answer with what the generator says is true.
- **The city-wide top 10 takes 2 reads.** That is the claim the benchmark (M9) will race against plain Arkiv code. Plain code needs 5 reads here, because it must read all 490 payment rows.
- **The map query works.** It returns exactly the three demo shops, or eleven when synthetic shops are opted in.
- **Totals are verifiable.** A shop's totals were recounted from the raw receipts and agreed.

## Technical

**Generator** (`packages/city/src/generate.mjs`): mulberry32 with seed 2026 from the story. Every parameter, name and place comes from `story.json`: `syntheticCity`, the new `syntheticCity.generator` block, the cast, `locations.neighbourhoods` and `renewal`. Zipf with s = 1.1; log-normal amounts with a median of 4.5 USDT; 2.5% refusals; partial refunds at each shop's rate. Ground truth for the six questions is in `docs/sessions/arkiv/city/truth-S.json` (identity truth and by-name truth).

**Seeding** (`packages/city/src/seed.mjs`, driver `scripts/seed.mjs`):
- The graph store goes through the same ledger and tally planner as the mirror: 25 events per batch, split by bytes.
- The plain store has one record per event and one profile per actor.
- The directory rows come from W_DIRECTORY.
- Safeguards: an owner that already holds a store is refused; size M is refused while the story is unlocked; there is a wipe; the plain store can `--resume`.
- On ArkivSim first: the counts equal a direct load, and Q1 and Q2 equal the truth.

**Live (Rabdi):**
- Graph store: 97 transactions, 2,200 creates and 940 patches, 0.494 tGLM, 8.9 minutes.
- Directory: 12 rows in 1 transaction.
- Plain store: the first run stopped after 24 transactions on an RPC read timeout before a send; it was resumed.
- All 1,432 graph-store responses were HTTP 200, and the lowest rate-limit headroom was 4,834 of 5,000.
- Numbers and links are in `docs/technical/FACTS.md` (T3 rows).

**Engine** (`packages/arkiv-graph/src/engine.mjs`, generic):
- One call per trusted owner, merged by `$key`, with every row owner-checked.
- OR lists are chunked to the predicate budget and halved and retried on `-32004`.
- Pages of 100 up to a 500-row cap, with `truncated` when the cap bites.
- The explain trace keeps the last 200 per instance; `explainId` = sha256 of the backend and the sorted queries.
- The filter compiler rejects everything §4 lists.

**GraphQL** (`packages/money-graph/src/graphql.mjs`): the §5 fields, plus `shops(box)` and lazy Node references.
- Reputation is computed from tallies of the current epoch, with windows over day tallies, `verify` by `count()` of the same epoch, and `TRUNCATED` when a cap bites.
- `top` is one ORDER BY over tallies plus one batched node lookup.
- `path` is a two-ended search over pair links.
- Limits: 8 top-level fields and depth 8 through fragments; the MCP tool allows 6 fields and depth 4. No mutations.

**MCP** (`mcp.mjs`): the tools `schema`, `ask` (shop_reputation, buyer_risk, compare_shops, order_trail; TSV plus `explain=… calls=…`), `graphql` and `explain`. A server and a stateless web-standard Streamable HTTP transport are created per request.

**Routes** (T3's): `/api/graphql` (GET cached 5 s, POST uncached), `/api/explain/[id]` and `/api/mcp`, rate-limited per instance (ADR-0060).

**Tests:**
- 9 M7b tests on the simulated S city: Q2 in 2 calls, the same explain id twice, Q1 verified, three shops in 2 calls, the re-registered name empty, Q3 and Q5, TRUNCATED, the limits, the MCP tool list.
- The city tests: determinism, last-week purchases, the re-registration.
- The writer now retries its reads.

**Deviations, and why:**
- GraphQL runs on graphql-js directly rather than Yoga (simpler, and it gives the same answers): ADR-0060.
- The benchmark-only `arkiv_query` tool moves to M9.
- `top` reads up to twice the limit so that superseded epochs can be dropped and still leave 10.
- The story's re-registration epoch is 2 rather than the spec's +1 (OPEN).

**Next:** after the PR merges, check `/api/graphql` and `/api/mcp` on `graphpay-event.vercel.app`, then M9, the live benchmark: plain against Graph Arkiv, reads and bytes, CSVs and the report.
