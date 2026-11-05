# Relay: arkiv (T3)

Updated 01:40 IST, Fri 6 Nov. Step: M7a (graph model, safe writer, emulator).

## In plain words

GraphPay remembers every payment on Arkiv, a decentralized, secure and verifiable database chain. Tonight's first Arkiv step built the part that writes that memory safely and the rules for what it looks like.

It now comes in two pieces. The first is a general tool any developer could use, `@graphpay/arkiv-graph`: you describe your own kinds of things (nodes), the events between them (edges) and the running totals you want (for example "count every like per person, per day"), and it stores them on Arkiv correctly. On Friday it is published on npm, as the Arkiv team asked (ADR-0057). The second piece is GraphPay's own: shops, agents, payments, refunds, reputation counters, quotes and the map of shops. It uses the general tool only through its front door, and a test makes sure no payment words leak into the general tool.

What was proven on Arkiv's live testnet tonight:

- **One payment, one atomic write.** A labelled test payment was written as one transaction holding the receipt, the four running totals (both sides, all-time and today), the payer–shop link and the bookmark of how far the mirror has read. Either all of it lands or none of it. At steady state it costs 377,893 gas (the lab measured 310,527 before tonight's extra columns).
- **Receipts cannot be edited.** The receipt reads back as readonly; a simulated edit is refused by the chain, while a simulated update of a running total would pass.
- **The map query works.** A test shop row was found by a box around the visitor's starting point and not by a box next to it, in one read.
- **The limits are as the lab found:** 64 conditions per query pass, 65 are refused; the access key allows 5,000 requests per window and we never got close.

Nothing about the founder is needed for this step.

## Technical

**Packages.**
- `packages/arkiv-graph` (generic): `defineEntity` and `defineGraph` (structural columns for node, edge, totals, link and checkpoint; developer columns, counters, rules and windows), the planner (absolute totals on both ends in `all` and the event's day, pair links, the checkpoint in the same batch; replay guarded by the checkpoint and by each row's `last_event`; `commit` refuses a create without its key; fold-only events, uncounted events, node updates), the writer, owner-scoped reads (`readAll` keyset-paged by `$key`, `findOne`, `countRows`), the transport and ArkivSim.
- `packages/money-graph` (GraphPay): the model (`node`, `edge`, `tally`, `link`, `checkpoint`, `heartbeat`, `shop`, `quote`, `record`, `profile`), `connectArkiv` with `ARKIV_BACKEND=sim|local|rabdi`, `createLedger` for the mirror and the seeding, `recordEdge` (W_SYNC), `createQuote`/`findQuotes`, `writeShop`/`discoverShops`, `writeHeartbeat`, and the live scripts `smoke` and `probe`.

**The writer (ADR-0023).** One serialised queue per wallet; the confirmed nonce, never below the last one it saw land (a load-balanced RPC can answer one behind, P-foundation-2); after an uncertain send it waits for the nonce to move and finds the mined transaction by nonce, taking created keys from its logs; it resends the same chunk at the same nonce only if the nonce never moved; an optional fixed nonce is refused with `NONCE_TAKEN` if taken (Join's ask); shared-wallet writers (recorder, quotes) adopt a found transaction only if it carries their own row. Split mode cuts by encoded bytes under 120 KB and halves on an HTTP 413 found down the cause chain; a revert stops it.

**ArkivSim** answers the JSON-RPC the stock SDK sends, behind viem's own HTTP transport (only `fetchFn` is swapped), so a 413 surfaces exactly as on Rabdi. It enforces pages of 100, 64 predicate leaves, indexed-only filters, typed literals, creation order and ORDER BY, count, atomic batches, readonly, expiry by block, per-owner entity nonces (a repeated create duplicates), one landing per transaction nonce, and the 256 KiB body limit; hooks inject lost responses and move the clock.

**Index rule.** `QUERIES` lists every filter per type and a test fails unless indexed equals filtered (ADR-0041). The live probe's `attributeSchema` shows exactly the planned flags.

**Tests.** 23 in `arkiv-graph` (sim rules, planner, writer recovery, 413 halving, redaction, boundary) and 13 in `money-graph` (definitions, index rule, a recorded flow with exact tallies and replays, NONCE_TAKEN, recorder folding, readonly receipts, discovery with a spoofed row and a side box, quote expiry, heartbeat, standing).

**Deviations from the pack, and why.**
- Two packages instead of one (founder's brief via the Coordinator, ADR-0057).
- Entity types are `node`, `edge`, `tally`… with `project`/`type`/`schema_v` columns, not `graphpay.node.v1` schema tags (ADR-0040).
- `synthetic`, `dataset`, `verified` and the link epochs are stored, not indexed: no shipped query filters them (ADR-0041); `ts` on edges is indexed for the mirror's poll.
- Tallies and links carry `last_event` (the row-level replay guard the prompt names) and `dataset` (labels everywhere).
- Pair links only for the money kinds (`pay`, `refund`, `fail`, `renew`), matching "6 operations per money event".
- The box query uses i32 ranges; the u64 fallback is not needed (ADR-0058).

**Records.** `docs/technical/FACTS.md` (T3 rows: live hashes, gas, limits), `docs/technical/VERSIONS.md` (T3 pins), `arkiv/schema.md`, ADR-0058, `docs/sessions/arkiv/README.md` (API for T1, T4 and Join). Brief: `docs/thinking-partner/briefs/0048-arkiv-graph-sdk.md` and ADR-0057 (Coordinator's PR).

**Next.** Seed size S only (test story) in the background once M7a merges, then M7b: the engine, GraphQL, explain and the hosted MCP at `/api/mcp`.
