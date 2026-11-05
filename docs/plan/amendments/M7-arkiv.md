# Amendment: M7a, M7b, M8, M9 (Arkiv)

**Applies to** `planning/PROMPTS/07a-graph-model-writer.md` (7a:L*n*), `07b-graph-engine-graphql-mcp.md` (7b:), `08-city-and-seeding.md` (8:), `09-live-benchmark.md` (9:) and `planning/SPEC/ARKIV_GRAPH.md` (AG:L*n*). **Owner:** T3, plus the parts named for T1, T4 and Join. **Sources:** `planning/EVENT_ADDENDUM.md` A1–A5 (A6–A11: Friday plan); decisions D1 (ADR-0040, -0041, -0044), D2 (ADR-0042), D5 (ADR-0043), D6 (ADR-0030), D7 (W_DIRECTORY), D8 (hosted MCP).

| item | milestone (session) |
|---|---|
| conventions, writers, index rule | M7a definitions and ArkivSim; M7b engine (T3) |
| A1 `shop` | M7a definition; M8 rows (T3) |
| A2 readonly receipts | M7a flag and probe (T3); M11 mirror (Join) |
| A3 `quote` | M7a definition (T3); written M3/M4 (T1); enforced M10 (T4); wired M12 (Join) |
| A4 discovery | M7b engine and GraphQL; M8 coordinates (T3); M12 hook (Join) |
| A5 `arkiv/schema.md` | M7a, updated M7b, M8 (T3) |

## 1. Conventions (every entity)

- `project="graphpay"` (str), `type=<entity type>` (str), `schema_v=1` (u64): our own convention (D1a), not the explorer's schema tag. If the SDK can type columns without writing its own tag, the convention replaces it; otherwise that tag stays internal and counts in the predicate budget.
- Every query filters `project`, `type` and `$owner`; every returned row is checked for owner and `schema_v`. The chunk size of AG:L72 ("61 with one kind filter") counts these and comes from the start-up probe, never a constant.
- At most 30 user attributes, these three included (supersedes AG:L23 and 7a:L13's "31 columns").
- **Index rule (D1b).** SDK 1.0.1 has `.indexed()` per column (AG:L17), so an attribute is indexed **if and only if** a shipped query filters on it (ORDER BY needs none, AG:L29); a test fails on a filter over an unindexed one. This replaces the `*` marks of AG:L49–L53: `dataset`, `synthetic`, `verified` are never filtered (reads split by owner), so stored only; the mirror polls recorder edges "by ts" from its checkpoint (`SPEC/INTEGRATION_AND_MIRROR.md` §2), and §3 leaves `ts` unindexed: if that poll filters on `ts`, index it.
- Nothing private in attributes or payloads.
- **No booth answers (D1d).** Every Arkiv transport logs the `ratelimit` header and waits for `reset` under 10% remaining. Idempotency: ADR-0023 anchors, query-before-create for `shop`, newest-wins for quotes. Key quota, create-if-absent and `HandleInvalid` go to `arkiv/friction.md` as open questions (AG:L39, L168).

## 2. Writers and `$owner` scoping (D6, D7)

| role | writes (`type`) | from |
|---|---|---|
| W_LEDGER | node, edge (chain-derived), tally, link, checkpoint | the workers process (E-2) |
| W_SYNC | edge (off-chain `fail`, `request`), create-only | recorder routes |
| **W_DIRECTORY** (new) | `shop` (cast and synthetic, ADR-0043), `quote`; Friday `shop_open`, `agent_presence`, `handoff`; **never** node, edge, tally, link, checkpoint | M8 script (`shop`), Vercel routes (`quote`) |
| W_SEED_EVENT, W_SEED_M_EVENT | the synthetic cities' graph data (no `shop` rows) | founder's Mac |

- **Trusted owners per type** (supersedes AG:L61, AG:L71): node, tally, link, checkpoint → W_LEDGER; edge → W_LEDGER and W_SYNC (one call each, merged by `ref`); shop, quote → W_DIRECTORY (cast and synthetic shops alike); synthetic graph rows → the size's seed wallet, on opt-in only. Addresses from the config's `arkiv` section; blank or malformed → start-up error; `RECORDER_OWNER`, if kept, must equal the config.
- **W_DIRECTORY** (done at M0): generated one role per run (`W_DIRECTORY_PRIVATE_KEY`), funded 0.2 tGLM. Before M8 writes the synthetic directory, ask main to top it up to 0.5 (FUNDER holds about 1.06 tGLM after M0). Set it on Vercel as Sensitive when the routes need it.
- **Nonces.** Vercel instances cannot share ADR-0023's serialised queue: route writes are create-only with the confirmed nonce, retried on a clash (the recorder's rule, `PROMPTS/03` L10). Only the M8 script patches `shop` rows, never while the site is live.

## 3. `shop` directory entity (A1)

| attribute | type | queried |
|---|---|---|
| `shop_key` | key: `keccak256(abi.encode(node, uint32 epoch))` (`SPEC/IDENTITY_ENS.md` §9) | yes: upsert, Friday joins |
| `shop_ens` | str | no (the join derives the node, AG:L93) |
| `category` | str (`sweets`) | yes: discovery |
| `area`, `city` | str (`bandra`, `mumbai`) | no |
| `lat`, `lng` | i32, degrees × 1,000,000 (19.0760 → 19076000) | yes: box |
| `status` | str: `active`, `paused`, `delisted` | no (checked per row) |
| `synthetic`, `dataset` | bool, str | no (labels, AG:L65) |
| payload | bytes: JSON `{ name, hours }` | no |

**Mutable** (status, payload). **Expiry 14 days:** the event plus a judging margin, equal to the synthetic rows' life (E-4), so a city's shops and history lapse together and an unrenewed listing drops out on its own. **Rows:** cast shops (config `cast`) once from W_DIRECTORY, placed at the scenario's distances from the persona's configured location (0.9, 1.4, 2.1 km, `SPEC/AGENTS.md` §1); generated shops, fictional Mumbai shops at realistic neighbourhood coordinates (D5), also from W_DIRECTORY, with `synthetic=true` and `dataset` (`S` or `M`) naming whose graph data holds their tallies. If the scout filters real against synthetic, `synthetic` is indexed (ADR-0041).

## 4. Locked receipts (A2)

- **Every edge** is created readonly (extends AG:L50, which named money kinds): nothing patches an edge, and dedupe deletes, which readonly allows (AG:L38). Recorder edges already are (`PROMPTS/03` L10). Tallies, links, nodes, checkpoints and `shop` rows stay mutable.
- Wording: "cannot be edited", never "permanent" (the owner can still extend, transfer or delete).
- Take the flag from the installed SDK types (AG:L21). M7a's live write (7a:L16) is readonly and a simulated patch must revert (acceptance D9).

## 5. `quote` entity (A3)

| attribute | type | use |
|---|---|---|
| `request_id` | str, 32-byte hex | the errand's run id; queried |
| `shop_key` | key | checked |
| `agent_ens` | str | the paying agent; checked |
| `price` | u64, 6 decimals | equals the 402 amount |
| `valid_until` | u64, unix s | the shop's 10-minute quote (`SPEC/AGENTS.md` G11) |

**Readonly. Expiry 15 minutes** (about 450 blocks at 2 s, or the SDK's helper): Arkiv removes a stale offer on its own, and the extra 5 minutes let an expired quote be refused by its own date before it vanishes. Exempt from "epoch wherever a node is stored" (7a:L13): names only, 15-minute life.

- **T1 writes (M3, M4):** the passcode-gated 402 step (`POST /orders/:id/pay`, `/reorder` without `PAYMENT-SIGNATURE`) takes an optional `requestId`; with it, the shop writes the quote from W_DIRECTORY and answers 402 after the receipt (about 5–8 s), key in `extra.quoteKey`; a failed write → 503. `GET /quote` stays free and writes nothing (free writes would drain tGLM).
- **T4 enforces (M10):** before signing, the payer reads the quotes for its `requestId` (owner W_DIRECTORY) and needs the approved shop's `shop_key`, its own `agent_ens`, `price` = the 402 amount and 60 s left before `valid_until`. Missing → `QUOTE_MISSING`, expired → `QUOTE_EXPIRED`: re-quote once (new `get_quote`, new 402), then refuse. Mismatch → `QUOTE_MISMATCH`: refuse. No signature before a passing check.
- **T3** (M7a): definition, create-only helper, `findQuotes(requestId)`. **Join** (M12): live hook; `requestId` through the shop gateway. The facilitator and the M16 kit do not use quotes.

## 6. Scout discovery query (A4): M7b

- `discoverShops({ category, box, synthetic })`: one query on `project`, `type = shop`, `category`, `lat` and `lng` between the box edges (typed i32) and `ownedBy(W_DIRECTORY)`, limit 100, paged by `$key`; rows checked for owner, `schema_v`, box and `status = active`; merged by `shop_ens`.
- The join with the tallies is one GraphQL document: `shops(category, box: { latMin, latMax, lngMin, lngMax }, synthetic, limit): [Shop]`, each `Shop` carrying its attributes and a lazy `node` (AG:L93), so `node { reputation(window: D90) }` shares one explain trace (one discovery call plus the batched tally reads).
- The filter compiler allows i32 ranges (supersedes AG:L86's "ranges on non-u64") and rejects values outside i32.
- **Live probe in M7a** (7a:L11, L16): W_DIRECTORY writes one labelled `shop` row (1-day life); a box around it finds it, one beside it does not. If i32 ranges fail on Rabdi: u64 offset by 180,000,000, an ADR and a friction note.
- `directory_list` (`SPEC/AGENTS.md` L89) becomes `discoverShops` around the persona's configured location and radius (3 km covers the cast shops); output unchanged.

## 7. `arkiv/schema.md` (A5)

T3 owns it tonight. Per entity: `type`; writer role and address (config); each attribute's type and the query that uses it, if any; readonly or mutable (what, by whom); expiry and reason; payload. Plus the conventions, the owner rule, "nothing private" and the explorer link pattern (verified at M0). Every type written is listed, including the mirror's heartbeat row.

## 8. Other changes by milestone

- **M7a** (7a:L12–L17): ArkivSim also enforces readonly, i32 ranges, per-type owners, minute-scale expiry. Tests: a spoofed `shop` row is invisible to discovery; a readonly edge refuses a patch; a quote is gone after expiry; §1's definition check. Done when adds `arkiv/schema.md`.
- **M7b** (7b:L12–L19), **D8:** T3 builds the hosted MCP at `site.url` + `site.mcpPath` (`<site url>/api/mcp`): Streamable HTTP, stateless (ADR-0003), read-only `schema`, `ask`, `graphql`, `explain` (not `arkiv_query`), 50 rows, rate-limited. T3 owns `apps/web/app/api/{graphql,explain,mcp}` as thin routes over `packages/arkiv-graph` (adds to `planning/BUILD_SEQUENCE.md` §5; T1 and T5 keep out). Done when adds `tools/list` answering on the preview. Verify the MCP SDK version (`planning/FACTS.md` §5: from-research).
- **M8** (8:L10–L17), **D5:** the city goes straight to Arkiv, labelled synthetic, no Whitechain payment. **Tonight seed size S only, with the test story; size M waits until the founder locks the final story and is never seeded with the test cast (ADR-0049).** Every generator parameter, name and location comes from `packages/config/story.json` (`syntheticCity`, the cast, `locations`; ADR-0047); each generated shop gets a category, a Mumbai `area` and nearby coordinates. Done when adds: discovery on S equals the generator's truth for a test box.
- **M9** (9:L12, L17, L21), **D2:** the race result is the Arkiv reads each side needs (and bytes); times may go into the CSVs but are neither the result nor a pass criterion (amended D6, D7). Reports say "2 reads against N", never seconds.

## 9. Settled by main (22:25 IST); ADRs

- Every `shop` row, cast or synthetic, is written by W_DIRECTORY, so discovery is one query on one owner, as the addendum's scout filter says (ADR-0043); synthetic graph data stays under the seed wallets (one dataset per owner).
- Recorder edges index `ts` (or an equivalent u64 sequence) because the mirror polls by it; the pack's §3 left it unindexed (ADR-0041). Tell Join if you name it differently.
- Verified SDK 1.0.1 facts (readonly is `flags: { readonly: true }`; `.indexed()` per column; i32 supports negatives and ranges; no `ne` or `not`; `ownedBy()`; keyset paging on `$key`): `docs/technical/FACTS.md`, Arkiv SDK API notes. Code against the installed `.d.ts`, not the docs site.
- ADRs recorded at M0: ADR-0033 (W_DIRECTORY), ADR-0034 (locked receipts), ADR-0035 (expiring activity), ADR-0040 (naming), ADR-0041 (indexing), ADR-0042 (race mode reads), ADR-0043 (synthetic city). Record the i32 box (or its u64 fallback) and the hosted MCP route ownership as new ADRs when you build them.
