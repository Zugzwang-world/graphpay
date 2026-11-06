# Changelog

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
