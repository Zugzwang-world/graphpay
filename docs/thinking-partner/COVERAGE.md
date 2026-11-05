# COVERAGE: every item new since the lab build

Updated 23:20 IST, Thu 5 Nov (main). Where each new item lives in the plan, the check that proves it, and its status: **done**, **tonight** (before CP4, Fri about 05:30), **Friday**, or **cut-first** (the first to go if time runs short, ADR-0053). Sessions: T1 payments, T2 identity, T3 arkiv, T4 agents, T5 web, Join, main. Acceptance ids: `planning/ACCEPTANCE_TESTS.md` plus `docs/plan/ACCEPTANCE_ADDITIONS.md`.

## Foundation and rules

| item | where (session · milestone · file · ADR) | check | status |
|---|---|---|---|
| Personal Ankr RPC, fallbacks (public Ankr, then `rpc.testnet.whitechain.io`), chain-1874 guard | main · M0 · `packages/config` `resolveRpc`, `scripts/secrets/set.mjs` · ADR-0031 | config tests (wrong chain refused; no URL in errors; plain-http secret refused); live 22:51 (secret URL chosen first, chain 1874); A10 | done |
| Ankr secret-scan rule | main · M0 · `scripts/lib/secret-shapes.mjs` (`ankr-api-key-in-url`) · ADR-0031 | shape tests; 23:10 proof: the prompt-log hook masks a keyed Ankr URL and the pre-commit scan refuses it; A2, A10 | done |
| Live events over HTTPS (Ankr free tier has no WSS) | T1, T5, Join · M3/M4, M15, M11 · ADR-0055 | the chime and the explainer work with no WebSocket (rehearsal 1) | tonight |
| Fresh event wallets (+ W_DIRECTORY), funding | main · M0 · `docs/technical/WALLETS.md` · ADR-0024, ADR-0033 | A5; balances in WALLETS.md | done |
| Test USDT in the main flow; stand-in retired | main (distribution) · T1 · M2 · ADR-0045, ADR-0054 | C1 (USDT checkout only), C7, E3 | done (funds) / tonight (checkout) |
| One story config, nothing story-specific in code | main · M0 · `packages/config/story.json` (PR #6) · ADR-0047 | A8 (`pnpm check` fails on a story literal in code) | tonight |
| Infrastructure config, no address literals in code | main · M0 · `packages/config/graphpay.config.json` · ADR-0030 | A7 | done |
| Agent model presets (testing active; video; live) | main (config, probe) · T4 · M10 · ADR-0048 | A9 (`pnpm agents:probe`: all three accepted at 22:54) | done (probe) / tonight (agents use them) |
| Errand cost recording (seconds and API cost per full errand) | T4 · M10; Join · M12, M13 · ADR-0048 | E8: every counting run has a row in `OPEN.md` (preset calibration) | tonight |
| Big-city hold (seed S only; M after the locked story) | T3 · M8 · ADR-0049 | D4–D6 at S; D7 `blocked: waiting for the locked story` | tonight (S) / Friday (M, start by 14:00) |
| Mirror keeps the Mac awake and resumes | Join · M11 · ADR-0056 | D15: resume from the last processed block after a forced network drop | tonight |
| Vercel: one project, ignored build step, public production link | main · M0 · FACTS (Vercel rows) | `Canceled by Ignored Build Step` on the docs-only PR #5; production domain 200 without a login | done |
| Prompt log per session | main · M0 · ADR-0029 | hook tests | done |

## Addendum B: ENS (T2, M5 and M6; `docs/plan/amendments/M5-ens.md`)

| item | where | check | status |
|---|---|---|---|
| Shop's Whitechain address record (coin type 2147485522) | M5 · ADR-0046 | B1 (amended), B9 | tonight |
| Shop's text record `x-graphpay-accepts` (ERC-7930 value; no ENSIP-31) | M5 · ADR-0038 | B4 (amended) and the ERC-7930 unit test | tonight |
| MCP endpoint records (`agent-endpoint[mcp]`, `[web]`, `agent-context`) on `graphpay.eth` and every agent | M5; T3 hosts `/api/mcp` (M7b) · ADR-0037 | B8 (record reads tonight; the MCP call once M7b is hosted) | tonight |
| An agent edits its own record, its cap change is refused | M5 · ADR-0036 | B3 (amended: `agent-context` lands; `graphpay.cap_micro` reverts) | tonight |
| Payee resolved from ENS at pay time | T2 `resolvePayee`; T1 (shop 402); T4 (payer) · ADR-0046 | B9 | tonight |

## Addendum A: Arkiv (T3, M7a, M7b and M8; `docs/plan/amendments/M7-arkiv.md`)

| item | where | check | status |
|---|---|---|---|
| Conventions `project`, `type`, `schema_v`; at most 30 attributes | M7a · ADR-0040 | M7a definition test | tonight |
| Index only queried fields | M7a · ADR-0041 | a test fails on a filter over an unindexed field | tonight |
| Two writers (money mirror, directory writer); every read scoped by `$owner` | M7a · ADR-0033 | D8 (spoofed rows invisible) | tonight |
| `shop` directory entity (cast and synthetic shops, i32 coordinates) | M7a, M8 · ADR-0043 | D8 | tonight |
| Locked receipts (every edge readonly) | M7a, M11 (Join) · ADR-0034 | D9 (negative patch test) | tonight |
| `quote` entity (15 min); the payer refuses an expired or missing quote and re-quotes | T3 M7a; T1 M3/M4; T4 M10; Join M12 · ADR-0035 | D10 | tonight |
| Scout discovery query (category, bounding box, owner, joined with tallies) | M7b | D8 | tonight |
| `arkiv/schema.md` | M7a, M7b, M8 | M7a done-when (no acceptance id) | tonight |

## Friday (`docs/plan/MASTER_PLAN.md` §4)

| item | where | check | status |
|---|---|---|---|
| `shop_open` and `agent_presence` heartbeats | T3, T5, Join · items 1, 3, 9 · ADR-0035 | D11 | Friday (map heartbeats: second to cut) |
| `handoff` entity, explainer lanes | T3, T5 · items 1, 13 | rehearsal 1 | Friday |
| Mumbai map with explorer links | T5, T3 · item 10 · ADR-0050 | D12 | Friday |
| Swarm `menu`, `refund_evidence` (encrypted reference AES-wrapped) | T3 · items 4–5 · ADR-0039 | D14 | **cut-first** |
| UI patterns (spending pass, refund flow, Pause toggle, merchant pop-up, CSV, notifications) | T5 · items 11–12 | D12 and the rehearsals | Friday |
| Final story locked and swapped in (demo cast, products, places, demo steps) | main, then T2, T1, T3, Join · item 6 · ADR-0047 | B1, B8, B9, A8 re-run | Friday (founder's story by 08:30) |
| Large city M seeded from the locked story | T3 · M8 · ADR-0049 | D7 | Friday (start by 14:00) |
| Race mode shows reads (the 48-against-2 race) | T5 M15, T3 M9 · ADR-0042 | D6, D7, D13 | Friday (never cut) |
| `/arkiv` files (friction, reach, why, how-you-use, swarm) | T3, then main M17 · item 15 | sponsor checklist | Friday |
| Checkout kit and demo store (the Operate drop-in snippet) | T5 · M16 · ADR-0032 | M16 done-when (no acceptance id) | Friday |
| ERC-8004 and ENSIP-25 | T2 · item 17 · ADR-0044 | none | Friday, only if time |

## Booth defaults (ADR-0038 to ADR-0044)

| ADR | default | where it shows | check |
|---|---|---|---|
| 0038 | Whitechain address record plus `x-graphpay-accepts`; skip ENSIP-31 | M5 | B4 (amended), ERC-7930 unit test |
| 0039 | Swarm public gateway first; never a mainnet batch | Friday items 4–5 | D14 |
| 0040 | our own entity naming | M7a | definition test |
| 0041 | index only queried fields (the SDK allows it) | M7a | unindexed-filter test |
| 0042 | race mode shows reads, not speed | M9, M15 | D6, D7 (calls exact), D13 |
| 0043 | synthetic city straight into Arkiv, labelled, no real payments | M8 | D4 |
| 0044 | quota, create-if-absent, `HandleInvalid`, Blockscout badge, ENSv2 stability, `sim` wildcard, ERC-8004 | friction notes; M2; M5 | C1 (Blockscout "verified" is enough) |

## Checks the defaults make moot (or change)

- **The ERC-7930 encoding test is not moot:** it now produces the `x-graphpay-accepts` text value (ADR-0038). Only ENSIP-31's `payment-preference` data record and its ENSIP-24 read are dropped (old B4 wording).
- **The addendum's "ENSIP-31 behind a flag, if the booth confirms"** is moot (ADR-0038).
- **The addendum's "UNVERIFIED: ask the Arkiv booth"** items are resolved: our own naming (ADR-0040); `.indexed()` per column, verified in SDK 1.0.1 (ADR-0041).
- **D6 and D7's time bands** are no longer pass criteria; the call counts stay exact (ADR-0042).
- **Every stand-in clause is moot** (ADR-0054): C1's "and the stand-in", C3's stand-in gas note, E3's "blocked (stand-in run passed)", and the stand-in mint.
- **"Ask the booth: a shared Swarm batch; is the gateway acceptable"** is moot (ADR-0039).
- **The old B3** (the agent writes its own `agent-endpoint[mcp]`) changes to `agent-context` (ADR-0036).
- **"One Whitechain prize or two"** is moot (ADR-0051).

## Gaps found and closed

- **Swarm without the public gateway:** a postage batch needs **xBZZ on Gnosis Chain, which is mainnet; FUNDER holds none, and the hard limit forbids mainnet funds.** So if the gateway refuses uploads, either a Bee node on Swarm's testnet (test tokens; untested) or the bonus is dropped, and `arkiv/swarm.md` says which (ADR-0039).
- **The 48-against-2 race (never cut) depends on the M city**, which waits for the locked story (seed start by Fri 14:00). Without M, race mode shows the S city's numbers, about 2 reads against 5 to 6; say so rather than quoting 48.
- **Vercel env push helper** (`planning/SPEC/SECURITY_AND_OPS.md` §3): not built in M0. Home: main builds it overnight before M4 needs it (Sensitive values from `.env`, never printed, never `NEXT_PUBLIC_`).
- **Swarm reference wrapping key** (a new secret): home: main generates it when Friday item 5 starts.
- **No acceptance check existed** for the Ankr RPC rules, the mirror's resume, or the cost recording: added as A10, D15 and E8 in `docs/plan/ACCEPTANCE_ADDITIONS.md`.
- **No acceptance id** (covered by done-when only): `arkiv/schema.md`, the checkout kit and demo store, ERC-8004.
- No other item lacks a home.
