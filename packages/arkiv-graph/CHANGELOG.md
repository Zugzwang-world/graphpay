# Changelog

## 1.0.0 (2026-11-06)

The first stable release, built and reviewed at ETHGlobal Mumbai. The API is the one 0.1.1 shipped, now documented and typed in full; this release fixes what the review before it found. No new features.

- Fix: reads page past rows that do not fit the schema (rows written before a column was added, say). The SDK leaves such a row out of a page but the node counts it, and `readAll`, `findOne` and `store.query` used to read the short page as the last one: they now read on, and `explain.warnings` says how many rows were left out; those rows count toward `readAll`'s `cap`. Without such rows, reads are unchanged.
- Fix: a store extends a row it patches once half its lifetime has passed, so running totals, links, nodes and the checkpoint no longer expire `days` after they were created while the graph is still written.
- Fix: `store.write(events, { split: true })` sends whole events with their checkpoint in each transaction, so a write that fails part-way leaves no event half-counted and a replay with positions completes it exactly (only an event too large for a transaction of its own still goes out in parts). A group the node refuses as too large (HTTP 413) is sent again as smaller groups. Before, the checkpoint rode in the last transaction and a failure in the middle could lose or repeat counts.
- Fix: a batch the Arkiv SDK refuses before sending (a lifetime over Arkiv's maximum, say) fails at once with the SDK's error, instead of waiting out the recovery window three times and ending in `WriteUncertainError`. `createStore` refuses a `days` outside 0 to 182, or one the SDK cannot set as a lifetime.
- Fix: a filter over Arkiv's 64 predicates (an `in` list of more than 61 values) is refused before it is sent, with an error that says why; u64 filter values must be a bigint, a safe integer or a decimal or `0x` string (no booleans, empty strings or inexact numbers), and i32 filter values may be a bigint in range.
- Types: `index.d.ts` declares `createEngine`, `createExplainStore`, `explainIdOf` and `compileFilter` (exported since 0.1.0 without types), `readAll`'s `truncate`, the writer's `operations`, `operationBytes` and `recover`, the graph's `incrementsOf`, and node-update events (`GraphEvent` is now `GraphEdgeEvent | GraphNodeUpdateEvent`).
- Docs: the README starts with the quickstart and documents every export; it says what a transaction holds, how replays, day windows, links and lifetimes work, and the query caps; it links GraphPay, live on Arkiv Rabdi, as the reference app.
- Example: the quickstart's events carry positions, so running it twice on a node counts nothing twice.
- Tests: the README quickstart must equal `examples/quickstart.mjs`, both examples must run, and every export must be in the README's API reference and in `index.d.ts`.

Known limits: totals are written as absolute values, so one process should write one graph; `store.load()` reads up to 50,000 rows per entity; replay protection needs strictly ascending positions.

## 0.1.1

- Fix: when another instance of the same key takes your nonce, the writer no longer returns that transaction's entities as yours. The transport records the hash of every transaction it sends (`sentHashes`, exposed by `arkivTransport` and `arkivClients`); `createWriter({ sentHashes })` treats a receipt it did not send as a replacement and sends again at the next nonce, or refuses with `NONCE_TAKEN` when the nonce was fixed. `connect()` passes it for you; if you build a writer yourself, pass `sentHashes: transport.sent`. Writers built without it behave as in 0.1.0.
- `index.d.ts`: `sentHashes` on `createWriter` and `arkivClients`, `sent` on `arkivTransport`.

## 0.1.0

First release. Built at ETHGlobal Mumbai (5 to 7 November 2026) and in use there before it was published.

- `defineGraph`: nodes, edges, totals (counters moved by edge kinds, in `all` and `day` windows), pair links and stream checkpoints. One atomic batch per event.
- `connect` and `createStore`: ArkivSim by default, or an Arkiv node with your own RPC URL, chain id and key; `load`, `write` and `query`, with an explain trace on every query.
- The safe writer: split by size, recovery after an uncertain send, refusal of a nonce another transaction holds, errors with the RPC URL and key redacted.
- Owner-scoped reads: `readAll`, `findOne`, `countRows`, and a read engine that chunks long OR lists to fit the node's predicate limit and marks answers `truncated` when a cap bites.
- A filter compiler: `eq`, `in`, `gt`, `gte`, `lt`, `lte`, `between`, `startsWith`, `exists`, `AND`, `OR`, typed by column.
- ArkivSim: an in-memory Arkiv node for tests, with fault injection and a movable clock.
- Examples: a quickstart and a leaderboard.

Known limits in 0.1.0: `connect` and `createStore` are tested on ArkivSim, and `connect` was checked read-only against Arkiv Rabdi's public node (the chain id is accepted, a wrong one is refused). The writer and the read engine underneath them also run GraphPay's graph on Rabdi. A full API reference follows in 0.1.x. Totals are written as absolute values, so one process should write one graph. `store.load()` reads up to 50,000 rows per entity and throws past that, so a very large graph cannot be loaded yet.
