# SPEC: Graph Arkiv (the money graph on Arkiv Rabdi)

A thin graph layer over Arkiv. Actors are **nodes keyed by their ENS name** (`node = namehash(normalize(ens))`, identity = node + epoch). **Every event is an edge.** **Tallies** keep running totals per node, epoch and window, and **pair links** keep a running count and sum per payer–shop pair. An agent sends one GraphQL document; the engine turns it into the fewest Arkiv queries it can and returns the answer with an **explain trace** of every read. Say "tallies", never "rollups".

Proven in the lab: on an emulator (ArkivSim) and live on Rabdi (write cost, idempotency, ORDER BY, request limits, two seeded synthetic cities, a live benchmark). **Not proven live:** the mirror writing real payment events to Rabdi (implemented, never run with tGLM). Plan M11 to be the first live run.

## 1. Pinned versions (re-verify at 9 pm with `npm view`)

`@arkiv-network/sdk` 1.0.1 (peer `viem ^2`), `viem` 2.57.16, `graphql` **16.14.2** (one major across the whole monorepo: two copies give "from another module or realm"), `graphql-yoga` 5.24.6 (not 6.x), `dataloader` 2.2.3, Node 22. Rabdi is days old: run a smoke test at 9 pm.

## 2. Verified API and limits (SDK 1.0.1, Rabdi)

| need | API or value |
|---|---|
| chain | `rabdi({ accessKey })` from `@arkiv-network/sdk/chains`; chain id 7794095; RPC `https://rpc.rabdi.db-chain.testnet.arkiv.network/<access key>` (the key is the last path segment); WebSocket `wss://` same host; block time 2 s; gas token tGLM (18 decimals) |
| clients | `createPublicClient` and `createWalletClient` from `@arkiv-network/sdk` (options: `chain`, `transport`, and `account` for the wallet client); configure the HTTP transport with `retryCount: 0` and `timeout: 15000` (an anonymous quota error otherwise retries for the whole `Retry-After`) |
| schema | `defineSchema(name, columns)` from `/schema`; builders `str() u64() u256() i32() dec() key() addr() bool() bytes()`, then `.indexed()`, `.optional()` (`bytes` cannot be indexed). A named schema writes the `arkiv.schema` attribute |
| read | `client.select('*').from(schema).where(...).ownedBy(addr).createdBy(addr).orderBy(asc/desc).limit(n).offset(n).fetch()` → `{ entities, blockNumber, skipped, count }`; `client.count().from(schema).where(...).fetch()` → bigint; `getEntity(key, schema?)`; `query(expr or string)` |
| predicates | `eq gt gte lt lte between exists startsWith and or asc desc render` from `/query`. **Type every value**: `u64(5n)`, `key(hex)`, `addr(hex)`, `str(s)`, `bool(b)`; a bare bigint renders as u256 and silently matches nothing on a u64 column. No `not`, no `!=` |
| rows | flat: `$key $owner $creator $createdAt $updatedAt $expiresAt $creationFlags` plus one property per column, each `{ type, value }` (u64 → bigint, bytes → hex). Unwrap |
| write | `createEntity(schema, values, { expiration, flags?, salt? })`, `patchEntity(schema, key, { set })`, `deleteEntity`, `extendEntity`, `changeOwnership`, **`executeBatch({ creates, patches, deletes, extensions, ownershipChanges })`** (fixed order: creates, patches, deletes, extensions, ownership). `ExpirationTime.max()`, `.fromDays(n)` |
| entity contract | every write is `execute((uint8,bytes)[])` on `0x4400000000000000000000000000000000000044` |
| columns | at most 32 attributes including the schema tag → **31 columns**; string ≤ 128 bytes; attribute name ≤ 32 bytes (letter, then letters, digits, `.`, `-`, `_`; camelCase is accepted on-chain, we use snake_case) |
| bytes | all `bytes` values of one create or patch share 128 KiB |
| page | 100 rows; offset paging; `limit(101)` is rejected |
| predicate budget | **64 leaves of any kind, including the schema tag and the owner filter**; 65 → `-32004 query has too many predicates`; AND/OR depth ≤ 4; query text ≤ 8 KiB |
| a query needs a predicate | `.from(schema)` supplies one; `$createdAt` cannot be filtered |
| non-indexed column in a filter | matches nothing, no error |
| ORDER BY | works on u64 at scale (400 rows over 4 pages, indexed or not), on `$key` and on `str`; ties in creation order. (SDK PR #130's "not supported on Rabdi" is out of date) |
| `key` column | accepts a 32-byte ENS namehash; stored lowercase; `eq`, `or`, `count` work |
| lifetime | at most 7,884,000 blocks (about 182 days); beyond → `InvalidExpiryError` |
| **request body** | **256 KiB**: 262,138 bytes pass, 262,222 get HTTP 413 "request body too large". About 131 KB of calldata per transaction, about 40 creates. viem shows "HTTP request failed. BAD_REQUEST"; the SDK's top message is "Execution error without revert data" at `eth_estimateGas` |
| gas | 1 gwei; EIP-1559 works; per-transaction cap 2^24; block 30M. SDK estimate + 25% is fine |
| **repeated create** | **duplicates**: the key is `keccak256(chainId, registry, owner, entityNonce, salt)` and the nonce moves; no uniqueness constraint |
| batch | atomic: a failing op reverts the whole batch |
| read-after-write | a create is visible to `count()` on the first query after its receipt (5 of 5) |
| same nonce twice | one lands, the other is refused |
| readonly entity | a patch reverts; it can still be extended, transferred or deleted |
| rate limit | header `ratelimit: limit=5000, remaining=N, reset=10` with a key (1 unit per call); `limit=2000` keyless. No 429 in 24,484 logged requests. Monthly key quota: unknown (ask at the booth) |
| events | `watchEntityEvents` carries keys only and none fires on expiry; `eth_getLogs` backfill fails about 1,000 blocks behind head. Not used for the pipeline |
| explorer / indexer | `https://rabdi.explorer.arkiv.network`; `https://indexer.rabdi.db-chain.testnet.arkiv.network` is the explorer app with `/api/entity/<key>`, `/api/blocks`, `/api/search`, `/api/transaction/<hash>`; no attribute query |

## 3. Entities (the standard model: names on edges and pair links)

`*` indexed, `?` optional. Amounts are integer micro-USDT (u64).

| entity | columns | notes |
|---|---|---|
| `graphpay.node.v1` (one per actor and epoch) | `node`* key, `ens`* str, `epoch`* u64, `kind`* str (human, agent, shop), `owner_node`* key?, `verified` bool, `synthetic`* bool, `dataset`* str, `category`* str?, `city`* str?, `status`* str? (active, paused, revoked, expired), `cap_micro` u64? | current epoch = the highest. A re-registration writes a new row with epoch+1. Status and cap are the only mutable part (standing patches from ENS and the AgentPolicy) |
| `graphpay.edge.v1` (one per event; readonly for money kinds) | `from_node`* key, `to_node`* key, `kind`* str, `amount_micro`* u64, `day`* u64, `ts` u64, `from_epoch`* u64, `to_epoch`* u64, `ref`* str (source event id), `synthetic`* bool, `dataset`* str, `payload` bytes?, `from_ens` str?, `to_ens` str?, `order_id`* str? (bytes32 hex) | kinds: `owns`, `order`, `pay`, `refund`, `fail`, `subscribe`, `renew`, `deliver`, `late`, `cancel`, `dispute`, plus `request` (new at the event: a customer's refund request, `WEBSITE_SPEC.md` §3; moves no tally). Money kinds: `pay`, `refund`, `fail`, `renew` |
| `graphpay.tally.v1` (one per node, epoch, window) | `node`* key, `epoch`* u64, `kind`* str (the node's kind), `window`* str (`all` or `day:<n>`), `day`* u64 (0 for all), counters u64 (not indexed): `orders paid_micro refunds refunded_micro fails delivered on_time cancels disputes last_ts seq`, `synthetic`* bool | no bytes column (patch gas grows with size) |
| `graphpay.link.v1` (one per from, to, kind, epochs) | `from_node`* key, `to_node`* key, `kind`* str, `from_epoch`* u64, `to_epoch`* u64, `count` u64, `sum_micro` u64, `first_ts` u64, `last_ts` u64, `from_ens` str?, `to_ens` str?, `synthetic`* bool | halves all-time path search |
| `graphpay.checkpoint.v1` | `stream`* str, `block` u64, `log_index` u64, `events` u64, `updated_ts` u64 | written in the same batch as each event |

**Tally rules.** An event moves counters on both ends in `all` and in its day: `order`/`subscribe` → orders; `pay`/`renew` → paid_micro (a renewal's money is counted once, on its `PaymentSettled`; the `renew` edge carries 0); `refund` → refunds, refunded_micro; `fail` → fails (`DUPLICATE` is not counted); `deliver` → delivered and on_time; `late` → delivered; `cancel` → cancels; `dispute` → disputes; `owns` and `request` → nothing. Values are **absolute** (each write carries the new full counts), so a rebuild from edges gives the same rows. Rates are computed at read time from integer counts, never stored.

**Writes per live money event:** 1 transaction, 6 operations (edge, 4 tally rows, link) plus the checkpoint patch. Measured on Rabdi with 1-day rows and the pre-merge columns: steady state (edge + 4 tally patches) **310,527 gas = 0.00031 tGLM**; with the link 333,320; the first event between two actors (5 creates; 6 with a link) 822,393 / 977,978. Expect more at the event (30-day rows, the merged columns and the checkpoint patch); measure the first steady write and use that as the reference. A live event is about 10–18 KB of calldata.

**Plain model (benchmark baseline only):** what a careful plain-Arkiv app stores. Record: `from_name`* str, `to_name`* str, `kind`* str, `amount_micro`* u64, `day`* u64, `ts` u64, `ref` str, `synthetic`* bool, `dataset`* str, `payload` bytes?. Profile: `name`* str, `kind`* str, `owner_name`* str?, `synthetic`* bool, `dataset`* str. It has no epochs, so a re-registered name inherits the previous holder's sales.

**Trusted owners.** Anyone can write entities with our schema names. Every read carries `ownedBy(<trusted writer>)`. Real data: W_LEDGER (the mirror, run as exactly one process: the single writer of nodes, chain-derived edges, tallies, links and checkpoints; `DECISIONS.md` E-2) and W_SYNC (the recorder: create-only off-chain `fail` and `request` edges, no tallies; trusted for edges only). Synthetic: W_SEED_EVENT (size S) and W_SEED_M_EVENT (size M), fresh wallets at the event, included only when a request opts in. **One dataset per owner wallet**: reads filter by owner, not dataset. An empty or malformed owner address is a **start-up error**, never "any owner".

**Lifetimes (`DECISIONS.md` E-4).** Real rows 30 days (extend weekly if needed); synthetic rows 14 days. `ExpirationTime.max()` roughly triples a create (589,094 gas against 214,800 for 1 day) and is not needed for the event.

**Synthetic labels everywhere:** `synthetic=true`, `dataset`, the seed owner, and names under `sim.graphpay.eth`.

## 4. The engine

| piece | rule |
|---|---|
| trust | one trusted owner per engine (or one call per owner, merged and de-duplicated by `$key`); every query carries `ownedBy`; also check the owner of every returned row |
| budget | split the largest top-level `or` into chunks of `64 − tag − owner − other filters` terms (61 with one kind filter); on `-32004` halve and retry (offset 0 only). Probe the budget at start-up from 20 terms upward |
| paging | offsets of 100; `limit = min(100, rowsWanted)`; an existence check asks for `limit 1`; stop at a cap (default 500 rows) and mark the answer **truncated**; never show a truncated answer as complete |
| `edges(nodes, direction, kinds, sinceDay)` | one query per chunk covering both directions, de-duplicated by key; fetch only the columns the GraphQL selection needs |
| `khop(start, depth ≤ 3)` | breadth-first; at most 500 nodes expanded per hop, else cut and warn |
| `path(a, b, maxDepth ≤ 3)` | two-ended: expand the side with the smaller degree (from `all` tallies); last hop is a targeted query between the two frontiers; with pair links, walk links instead of edges |
| `top(kind, by, window, limit)` | one `ORDER BY <counter> DESC` over tallies, then one batched node lookup to drop superseded epochs. **This is the 2-call answer to "top 10 shops by sales"** |
| windows | `last:N` with counts only → `count()` over edges; with sums → day tallies by one `BETWEEN` |
| `verify` | recount `orders`, `refunds`, `fails` with `count()` over edges **of the same epoch**; sums only with `full` (paging: no SUM in Arkiv) |
| empty `in` | matches nothing: send no query |
| joins | a per-request DataLoader per (entity, column); never share loaders across requests |
| explain | every call records `{ entity, readable query, owner, limit, offset, orderBy, rows, ms, bytes, entity keys, error }`; every answer carries `extensions.arkiv = { explainId, backend, calls, queries[], ms, bytes, entityKeys[], blockNumber, warnings, notes, truncated }`. `explainId` = sha256 of backend + sorted queries, 12 hex: the same work gives the same id. Keep the last 200 traces for the `explain` tool |
| backend switch | `ARKIV_BACKEND=sim` (ArkivSim in process), `local` (`ARKIV_RPC_URL`), `rabdi` (`ARKIV_ACCESS_KEY`) |
| redaction | wrap every real-node transport so no error carries the access key (it is in the URL, and viem puts URLs in errors); keep the JSON-RPC `code` and `data` |

**Filter compiler.** Input `{ field: { eq, in, gt, gte, lt, lte, between: [lo, hi], startsWith, exists }, AND: [...], OR: [...] }`; top-level keys are ANDed. Reject as errors, never silently: unknown fields, unindexed columns, `startsWith` on non-strings, ranges on non-u64, `exists: false`, u64 outside 0…2⁶⁴−1, a `key` that is not 32-byte hex, an `addr` that is not 20 bytes, strings over 128 bytes. Lowercase keys and addresses.

## 5. GraphQL (Yoga 5.24.6; queries only; served on GET with `Cache-Control: s-maxage=5, stale-while-revalidate=10` for the website, POST uncached for agents)

Query fields: `node(ens, epoch)`, `nodes(kind, category, city, ens, limit)`, `top(kind, by, window, limit)`, `path(from, to, maxDepth, kinds)`, `neighborhood(ens, depth, kind, sinceDay)`, `edges(kind, sinceDay, untilDay, limit)`, `order(id)`, `today`.

Types (fields):
- `Node { ens key epoch kind verified synthetic dataset category city status capMicro tally(window) out(kind|kinds, sinceDay, limit) in(...) owner agents reputation(window: TODAY|D30|D90|ALL, verify) }`. A Node is a lazy reference: its key comes from the name with no lookup; `out`/`in` default to the current epoch.
- `Edge { kind from to amountMicro day ts fromEpoch toEpoch ref orderId synthetic }`
- `Tally { orders paidMicro refunds refundedMicro fails delivered onTime cancels disputes lastTs }`
- `Reputation { orders refunds fails delivered onTime cancellations disputes refundRate onTimeRate paidUsdt refundedUsdt source synthetic }`. Rates are 4-place decimal strings rounded down. `source` ∈ `TALLY`, `RAW_VERIFIED`, `MISMATCH`, `TRUNCATED`.
- `U64` is a custom scalar serialised as a decimal string.
- Limits: list fields capped at 100 rows (50 through MCP), at most 8 top-level fields (aliases are free calls), depth ≤ 8 counting inline and named fragments. No mutations.

Reputation reads **the current epoch only**: `ALL` reads the `all` tally; `D30`/`D90`/`TODAY` read day tallies by `between(day, today − N + 1, today)`, chunked so a window never silently exceeds the row cap (five shops per chunk for D90 at 500 rows). A re-registered name starts empty.

## 6. MCP tools (no model inside the server)

| tool | input | output |
|---|---|---|
| `schema` | `{}` | `{ sdl }` |
| `ask` | `{ intent: 'shop_reputation' \| 'buyer_risk' \| 'compare_shops' \| 'order_trail', ens: string[] (≤ 10; not used by `order_trail`), order_id?: string (only `order_trail`), window: 'D30' \| 'D90' \| 'ALL' = 'D90', verify: boolean = false }` | `{ text }`: a TSV table, then a line `explain=<id> calls=<n>` |
| `graphql` | `{ query: string (≤ 4000), variables? }` | `{ data, errors?, extensions.arkiv { calls, explainId, entityKeys[] } }` (read-only, ≤ 50 rows) |
| `explain` | `{ explainId }` | `{ calls, queries[], entityKeys[], blockNumber, note }` |

Handlers: ENSIP-15 normalise names and return a tool error for invalid or empty names (`normalize('')` is the root node: reject it); match "not found" by namehash; count depth through fragments; the MCP `graphql` tool is stricter than the GraphQL server (§5 allows 8 top-level fields; the tool rejects more than 6, and depth 4); turn syntax errors into tool errors. A benchmark-only `arkiv_query` tool (one columnar page of plain rows) must **parse and re-render** the agent's text before adding the owner filter: concatenating `(<text>) AND owner` lets `x) OR (y` escape it.

## 7. The write path (ADR-0023)

1. **One writer per wallet**, serialised. Send with the **confirmed** nonce (`getTransactionCount(addr, 'latest')`), never `pending`.
2. **Anchor in the same batch.** Before writing an event, read the stream checkpoint and skip what it covers; also skip if an edge with `ref` = the event id exists. Then send **one** `executeBatch` with the edge, the tally creates and patches, the link and the checkpoint patch. The checkpoint advances if and only if the rows exist.
3. **After an uncertain send** (timeout, no receipt): look for the mined transaction by that nonce in the blocks since the send and read its receipt; created keys come from its `EntityCreated` logs in batch order. **Never resend blindly.** On a real revert, stop.
4. **A created tally row needs its entity key** before the next patch: take it from the receipt (`createdEntities`, batch order). A created row without a key is an error.
5. On any failed write: discard the queued operations, re-read state from Arkiv (`dumpOwned`), re-read from the cursor.
6. Money edges keep an indexed `ref` = `1874:<tx>:<logIndex>`; readers count each `ref` once (earliest wins); a reconcile job deletes later copies.
7. **Size every transaction by encoded bytes:** create ≈ 352 bytes + 192 per attribute (schema tag included), patch ≈ 256 + 192 per column, + 68 per transaction. Split under 120 KB; halve again on a 413 (detect it down the error's cause chain). Patches only touch rows committed earlier, so splitting is safe for seeding.
8. Salts stay the SDK's random default (a deterministic salt is fine for audit, never for idempotency).

## 8. Synthetic city and seeding (M8)

Generator (deterministic, `mulberry32`, seed 2026, labelled; names under `sim.graphpay.eth`; dataset name of your choice, for example `graphpay-city-v1`):
- the cast plus generated humans (each with a `payer.` agent, 30% also an `errands.` agent) and shops (each with a `storefront.` agent);
- 120 days ending at a fixed UTC midnight; Zipf popularity (s ≈ 1.1) with the three cast shops at ranks 1–3 and their refund rates as inputs (kesar-kingdom 1.2%, jamun-junction 18.4%, syrup-street 3.1%); amounts log-normal (median 4.5 USDT);
- per order an `order` edge then `pay` (or `fail` at 2.5%) and sometimes a `refund`; a few weekly subscriptions;
- Vitalik's agents buy only in the last week (payer: kesar-kingdom twice, syrup-street once; concierge: syrup-street once; never jamun-junction);
- one generated shop is re-registered 30 days before the end (its epoch goes up by one: 1 if names start at epoch 0, as fresh ENSv2 names do; the lab's generator numbered from 1 and so used 2), which is what makes plain Arkiv wrong by identity.
- Sizes: **S** ≈ 1,000 edges (lab: 945 transactions, 91 actors, 12 shops, 999 edges), **M** ≈ 10,000 (lab: 9,612 transactions, 463 actors, 40 shops, 9,874 edges).
- Tallies come from the **same tally code** as the mirror, so they agree with the raw edges.

Seeding: a driver per (size, store) writes a manifest (owner, transactions, creates, patches, minutes, gas, tGLM, first and last tx, HTTP status counts, lowest `ratelimit` remaining); refuses to seed a store an owner already holds or a second size under one owner; 25 events per logical batch, split by bytes; a wipe script deletes an owner's rows (60 per batch, halving on refusal) after a failed run.

Lab cost and time (graph model before the merge; the merged model writes about 30% more bytes, so expect more):

| size | store | transactions | minutes | tGLM |
|---|---|---:|---:|---:|
| S | graph + names + links | 88 | 10.7 | 0.491 |
| S | plain | 42 | 4.3 | 0.174 |
| M | graph + names + links | 905 | 79.2 | 4.622 |
| M | plain | 202 | 20.5 | 1.704 |

About 5–8 s per transaction end to end. S and M can seed at the same time (different wallets). **Funding needed at the event (projections): about 0.9 tGLM for S, 6.3–8.5 for M, and about 1.5 for W_LEDGER (the 5% cast history of about 1,256 events plus live events); the wallets held 2.86 tGLM in total on 2026-11-05, so about 8 more are needed (`WALLETS.md` §3).**

**Plain call counts depend on the city.** Plain Q2 reads every payment and renewal row, so its sequential call count is `ceil(rows / 100)` and the parallel mode adds one `count()`. The lab's cities had 462 and 4,604 such rows (5 and 47 pages). The event's generator will not reproduce those counts exactly; the benchmark derives the expected plain counts from its own city (`SPEC/BENCHMARK.md` §6).

## 9. Tests that must exist (each is a rule above)

Versions and a smoke read; entity definitions (≤ 31 columns, snake_case, `*_micro` is u64, epoch wherever a node is stored, Tally has no bytes); filter-compiler rejections; empty `in` sends nothing; the reader refuses a blank owner; spoofed rows are invisible; synthetic only on opt-in; a 130-value OR becomes 3 queries; halve-and-retry; paging and truncation; tallies are absolute, replay-safe with the anchor, epoch-separated; a commit without a key throws; reputation for three shops costs 2 calls; `TRUNCATED`, not `TALLY`, when a cap bites; a re-registered name starts empty; identical questions give identical explain ids; MCP name validation, fragments, aliases, syntax errors; the write path's restart, duplicate event and uncertain send; seeding is deterministic for a seed; **ArkivSim enforces the 256 KiB request limit** (the lab's did not, which is how the first seed failed).

## 10. Pitfalls

1. Bare bigints render as u256 and silently match nothing.
2. A blank owner (`''` is falsy) skipped the trusted-writer filter in a lab draft. Validate at start-up.
3. Silent undercounting when fan-out exceeds the row cap. Size chunks to the cap and report `TRUNCATED`.
4. `verify` across epochs reports a false mismatch. Filter raw edges by epoch; the mirror stamps shop and buyer epochs.
5. "Absolute values converge on replay" is only half true: an old event replayed after a restart double-counts unless the anchor is checked.
6. Keys are 66 characters on the wire, names about 30: put names on edges.
7. Existence checks ask for `limit 1`; project only the needed columns.
8. One transaction per event is fine live and too slow for seeding.
9. Cold connections: the first Rabdi call took 909 ms, warm calls about 0.3 s. Warm up before timing anything.
10. Rounds, not only calls: a one-hop question on the graph is 1–2 round trips slower than plain code that fires its counts at once.
11. The win is derived data (tallies, links), not the edge index. Do not claim fewer reads for this-week traversals.
12. ArkivSim's `count()` returns rows that the real node does not, so emulated bytes overstate count-heavy answers.
13. A one-off `Revm … HandleInvalid` error was seen once on a 60-delete gas estimate (not reproduced). Retry deletes in smaller batches.
14. Editing a shell script while bash runs it corrupts the running copy.
