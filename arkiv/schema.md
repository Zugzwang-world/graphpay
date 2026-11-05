# GraphPay's entities on Arkiv

Every entity GraphPay writes to Arkiv Rabdi (chain 7794095), defined in `packages/money-graph/src/model.mjs` on the generic SDK `packages/arkiv-graph`. Synthetic data is always labelled (`synthetic = true`, a `dataset`, a seed wallet, names under `sim.graphpay.eth`).

## Conventions

- Every entity carries `project = "graphpay"` (str, indexed), `type = <entity type>` (str, indexed) and `schema_v = 1` (u64, stored), our own convention (ADR-0040). Schemas are unnamed, so the SDK writes no tag of its own. At most 30 attributes, snake_case.
- **Owner rule.** Anyone can write entities that look like ours. Every query filters `project`, `type` and `$owner = <trusted writer>`, and every returned row is checked again for owner and `schema_v`. A blank or malformed writer address is a start-up error, never "any owner".
- **Index rule (ADR-0041).** An attribute is indexed (`*` below) if and only if a shipped query filters on it; `QUERIES` in `model.mjs` lists them and a test holds the two together. ORDER BY needs no index.
- **Nothing private** in attributes or payloads.
- Writer addresses: `packages/config/graphpay.config.json` → `arkiv.writers`.
- Explorer: transactions at `https://rabdi.explorer.arkiv.network/tx/<hash>` (verified on the M0 funding links); entities at `/entity/<key>` and addresses at `/address/<addr>` (read from the explorer's own client bundle; `docs/technical/FACTS.md`, website rows).

## Entities

| type | writer | attributes (`*` indexed) | queried by | readonly | expiry |
|---|---|---|---|---|---|
| `node` | W_LEDGER | `node`* key, `ens`* str, `epoch` u64, `kind`* str (human, agent, shop), `owner_node`* key?, `verified` bool, `synthetic` bool, `dataset` str, `category`* str?, `city`* str?, `status` str?, `cap_micro` u64? | lookups by node key, ens, kind, owner, category, city | no: status and cap are standing patches (same epoch) | 30 days (synthetic 14) |
| `edge` | W_LEDGER (chain events), W_SYNC (off-chain `fail`, `request`) | `from_node`* key, `to_node`* key, `kind`* str, `amount_micro` u64, `day`* u64, `ts`* u64, `from_epoch`* u64, `to_epoch`* u64, `ref`* str, `synthetic` bool, `dataset` str, `payload` bytes?, `from_ens` str?, `to_ens` str?, `order_id`* str? | traversals, windows, epoch recounts, dedupe by `ref`, `order(id)`, the mirror's poll by `ts` | **yes**: a receipt cannot be edited (ADR-0034); it can still be extended, transferred or deleted | 30 days (synthetic 14) |
| `tally` | W_LEDGER | `node`* key, `epoch`* u64, `kind`* str (the node's kind), `window`* str (`all`, `day:<n>`), `day`* u64, counters u64 (`orders paid_micro refunds refunded_micro fails delivered on_time cancels disputes`), `seq` u64, `last_ts` u64, `last_event` str, `synthetic` bool, `dataset` str | reputation and top lists | no: patched with absolute values by the mirror only | 30 days (synthetic 14) |
| `link` | W_LEDGER | `from_node`* key, `to_node`* key, `kind`* str (`pay`, `refund`, `fail`, `renew`), `from_epoch` u64, `to_epoch` u64, `count` u64, `sum_micro` u64, `first_ts` u64, `last_ts` u64, `last_event` str, `from_ens` str?, `to_ens` str?, `synthetic` bool, `dataset` str | path search | no: running count and sum | 30 days (synthetic 14) |
| `checkpoint` | W_LEDGER | `stream`* str, `block` u64, `log_index` u64, `events` u64, `updated_ts` u64, `last_event` str | the mirror's anchor | no: advanced in the same batch as each event | 30 days |
| `heartbeat` | W_LEDGER | `instance` str, `state` str, `cursor_block` u64, `cursor_log` u64, `head_block` u64, `lag_blocks` u64, `updated_ts` u64 | the mirror's lease, the website's lag chip (read by owner and type) | no | 1 day, extended while running |
| `shop` | W_DIRECTORY (cast and synthetic shops) | `shop_key`* key (`keccak256(abi.encode(node, uint32 epoch))`), `shop_ens` str, `category`* str, `area` str?, `city` str?, `lat`* i32, `lng`* i32 (micro-degrees), `status` str (`active`, `paused`, `delisted`), `synthetic`* bool, `dataset` str?, `payload` bytes (JSON `{ name, hours }`) | discovery: one query with both i32 ranges (ADR-0058) | no: status and payload, by the M8 script only, never while the site is live | 14 days |
| `quote` | W_DIRECTORY | `request_id`* str (32-byte hex run id), `shop_key` key, `agent_ens` str, `price` u64 (6 decimals), `valid_until` u64 (unix s, 10 minutes) | the payer's pre-sign check by `request_id` | **yes** | 15 minutes (ADR-0035) |
| `record` | the seed wallets (plain store) | `from_name`* str, `to_name`* str, `kind`* str, `amount_micro` u64, `day`* u64, `ts` u64, `ref` str, `synthetic` bool, `dataset` str, `payload` bytes? | the benchmark's plain baseline | yes | 14 days |
| `profile` | the seed wallets (plain store) | `name`* str, `kind`* str, `owner_name`* str?, `synthetic` bool, `dataset` str | the plain baseline | no | 14 days |

The synthetic cities' graph rows (`node`, `edge`, `tally`, `link`) are written by W_SEED_EVENT (size S) and W_SEED_M_EVENT (size M) and read only when a request opts in, one dataset per owner. Their shops are listed in the `shop` directory by W_DIRECTORY with `synthetic = true` (ADR-0043).

## Write path

One serialised writer per wallet, the confirmed nonce, the event's rows and the checkpoint in one atomic batch, find-by-nonce after an uncertain send (ADR-0023). Measured on Rabdi: a steady money event (edge, four tally patches, link and checkpoint patches) costs 377,893 gas; the first event between two actors (seven creates) 1,301,681 (`docs/technical/FACTS.md`, T3 rows).

Friday additions (`shop_open`, `agent_presence`, `handoff`, `menu`, `refund_evidence`) get their rows here when they ship.
