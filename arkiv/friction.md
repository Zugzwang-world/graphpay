# Friction on Arkiv: what we hit at the event

**DRAFT (T3, Fri 6 Nov 2026; Submission finishes it).** Only gaps we ran into during this event (Thu 5 to Sat 7 Nov) are listed, each with how to reproduce it, what we expected, what happened, and what we did about it. Everything here ran on Arkiv Rabdi (chain 7794095) or against the published `@arkiv-network/sdk` 1.0.1, and the source is named in each row. Nothing is copied from earlier research. Dates and times are IST; the numbers come from `docs/technical/FACTS.md` and `docs/problems/PROBLEM_LOG.md`. Synthetic data is labelled as such.

Our own query shapes that are slow because of how we wrote them are left out. If a row is our mistake, it says so.

## Gaps

| # | gap | repro | expected | actual | cost and what we did | what we contribute |
|---|---|---|---|---|---|---|
| 1 | **No SUM, GROUP BY or join.** A city-wide ranking has to be added up by the client. | `node bench/run.mjs --size S --end 2026-11-05` (read-only, Rabdi, synthetic dataset `graphpay-city-v1-S`, 490 payment and renewal rows), question Q2. | One query for "top 10 shops by sales". | Plain code reads every row: 5 reads one page at a time (6 with every page in flight), 131.9 KB. | We built a graph layer that writes running totals with each event: the same answer in 2 reads, 34.5 KB (Q2). It is the point of our project, so we measure the gap rather than complain about it. Graph Arkiv needs fewer reads on Q2 and Q5, the same on Q1, Q4 and Q6, and more on Q3 (3 against 2), and it moves more bytes on Q1, Q3, Q4, Q5 and Q6 (`bench/BENCHMARK-LIVE.md`). | The package `@graphpay_ethglobal/arkiv-graph` and the benchmark. A server-side aggregate (`sum`, `count` by group) would remove the need; `count()` already exists and helped us verify answers. |
| 2 | **A bare `bigint` in a query matches nothing, with no error.** | `pnpm -s --filter @graphpay/money-graph smoke`: `u64(20398n)` renders `day = u64(20398)`; a bare `20398n` renders `day = u256(20398)`. A `u256` literal never equals a `u64` column. | A type error, or the column's type applied. | The query is valid and, per our probe and tests, matches nothing. | A silent empty result is easy to miss. Our reads type every value by its column, with a test. | `typed()` and the filter compiler in our package, which reject mismatches loudly. |
| 3 | **`getEntity` puts attributes under `$attributes`, which is easy to miss.** | Read an entity with `publicClient.getEntity(key)` on SDK 1.0.1 and look for `.attributes`. | The attributes under `.attributes`, which is where our first code looked. | A flat row with the columns under `$attributes` (`dist/index.d.ts`, `FullEntity`). | About 25 minutes and a real risk: our "is this transaction ours?" check read `.attributes`, always said no, and a refusal receipt could be written twice (problem log P-arkiv-1, PR #25). We read `$attributes ?? attributes` and test the recovery through the stock SDK client. | The regression tests, which run the stock client against ArkivSim in both directions (`packages/arkiv-graph/test`). |
| 4 | **The docs' API reference lists symbols the published SDK does not have.** | Search the extracted `@arkiv-network/sdk` 1.0.1 for `ne`, `not`, `tiramisu`, `MimeType`, `NoMoreResultsError`, `Bytes32Value` (all are in the docs reference). | The reference matches the latest release. | None of them is in 1.0.1's types or JS (checked Thu 5 Nov 21:59). | We coded against the 1.0.1 `.d.ts` files, not the docs (`docs/technical/FACTS.md`). | The recorded list, so the docs can be regenerated from the current release. |
| 5 | **The 64-predicate limit is not in the SDK's types.** | `pnpm -s --filter @graphpay/money-graph smoke` on Rabdi: a query with 64 leaves (project, type, owner and 61 OR terms) is accepted; 65 is refused with JSON-RPC `-32004`. | A documented limit, or a typed error that names it. | The limit shows only as the refusal (we checked the SDK 1.0.1 types, not every docs page). | Our engine sizes OR lists from the budget and halves a refused chunk. | The chunking code in `packages/arkiv-graph/src/engine.mjs`. |
| 6 | **A read timed out mid-seed.** | Seeding the plain store on Rabdi, size S, Fri 03:02: after 24 transactions an RPC read failed with "The request took too long to respond" before a send. | The seed to continue. | The run stopped (91 profiles and 550 records were already written). | We resumed with `--resume` (it skips rows already written) and the writer now retries its reads. Likely a transient on the node or the path; we do not know. | The resume logic and the retry in the writer. |
| 7 | **The node reports `key` columns as `bytes32`.** | `smoke <edge key>` (raw `arkiv_query`, `attributeSchema`) on a probe edge. | The SDK's `key` type. | `attributeSchema` lists the key columns as `bytes32`. | Only a mapping to remember; no cost. | Noted for anyone reading `attributeSchema`. |

## What worked, so the list is fair

- ORDER BY works on unindexed `u64` columns on Rabdi (our top-10 reads use it); the SDK 1.0.1 types document it.
- The `i32` range query found a probe shop 1 km away in 1 call and none 0.05 degrees north. Coordinates are `i32` micro-degrees (ADR-0058).
- Readonly entities: a simulated patch to a readonly edge's `amount_micro` reverts, a tally patch passes (`eth_call`, nothing sent).
- Rate limit: the keyed endpoint reported `limit=5000`, the lowest remaining we saw was 4,834 across the S seed (1,432 responses, all HTTP 200).
- Gas we measured: a first event between two actors (7 creates) 1,301,681; a steady event (1 create, 6 patches) 377,893. The size S graph seed was 97 transactions and 0.494 tGLM.

## Emulated or documented only, not reproduced on the live node

- **A batch over 256 KiB** fails at `eth_estimateGas` as `EntityMutationError` "Execution error without revert data" with an HTTP 413 three causes down. We saw this in ArkivSim, which uses the same viem HTTP path; we did not send an oversized batch to Rabdi. Our writer halves on it.
- **Readonly is not immutable.** The SDK types say the owner can still extend, transfer or delete a readonly entity. We rely on "cannot be edited", not "cannot be removed" (ADR-0034). Not tried live.

- **Offset paging and concurrent writes.** The SDK types say offset paging reads the latest block on every request, so concurrent writes can repeat or skip rows; keyset paging is the remedy. We did not observe it and did not move to keyset paging. Our reads page by offset under a row cap and mark an answer `truncated`.

## Open questions (no booth answers came; the founder's defaults are final, ADR-0044)

1. **Monthly quota of an access key; is the keyless window per IP?** The node shows only a `ratelimit` header (keyless `limit=2000`, keyed `limit=5000`). We log it and back off near the limit. We saw no 429.
2. **A uniqueness or "create if absent" option?** None assumed. A repeated create with the same content duplicates, so we dedupe on a `ref` attribute and a checkpoint (ADR-0023).
3. **Was the one-off `Revm ... HandleInvalid` error on a 60-delete gas estimate a known issue?** We did not reproduce it at the event.
4. **The faucet amount per claim.** The page does not show one; our funding holds only what we received.
5. **Does a published package plus a live GraphiQL URL count as reach?** Our reach file says what we ship (`@graphpay_ethglobal/arkiv-graph`, the hosted GraphQL and MCP).
