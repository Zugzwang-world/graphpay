# Acceptance additions

Additions to `planning/ACCEPTANCE_TESTS.md` from `planning/EVENT_ADDENDUM.md` (its Arkiv and ENS checks) and from decisions D2 (race mode shows reads) and D3 (no ENSIP-31), plus D6 (one config file) and D7 (W_DIRECTORY) where they change wording. Same rules, tolerances and report format as the pack; the ids continue its series. **Friday** checks run with `pnpm acceptance --friday`: they are not part of the CP4 run and must pass before CP6. Every name and address below is read from `packages/config/graphpay.config.json`.

## A. Foundation

| id | checks | how to run | pass criteria | evidence |
|---|---|---|---|---|
| A7 | No known address literal in code outside the config file (D6) | `pnpm check` on `main`; then a negative check: a temporary source file holding one config address, built at run time, scanned, deleted | the check takes every 20-byte hex value in the config file and finds none of them (any case, with or without `0x`, also inside longer hex) in code or test files elsewhere: exit 0; the negative check is flagged and exits non-zero. Not scanned: `planning/`, Markdown docs (`docs/`, `arkiv/`, README, reports) and lockfiles, which must list addresses | output (labels and paths only) |

| A8 | No story name or value in code outside the story file (ADR-0047) | `pnpm check`; a negative check: a temporary source file holding a story label built at run time | the check takes the distinctive story literals (persona and shop labels and display names, products and SKUs, the renewal item and plan id, the request text) and finds none in code or tests outside `packages/config/story.json`: exit 0; the negative check is flagged | output (labels and paths only) |
| A9 | The agent presets are accepted (ADR-0048) | `pnpm agents:probe` | every preset's model and effort answer with a non-empty final text block and `stop_reason` `end_turn` (the live preset also over a three-turn exchange); seconds and cost recorded | the probe table (M0: all accepted, $0.0012 in all) |
| A10 | The Whitechain RPC rules hold (ADR-0031) | the config tests; a label-only `resolveRpc('whitechain')` with the founder's key set; the hook and pre-commit proof with a keyed Ankr URL built at run time | a wrong-chain or plain-http candidate is refused and no error carries a URL; the secret URL is chosen first and answers 1874; the hook masks the key and the pre-commit scan refuses it | test output; the M0 relay (22:51 and 23:10 IST) |

## B. ENS (real Ethereum Sepolia)

| id | checks | how to run | pass criteria | evidence |
|---|---|---|---|---|
| B8 | ENSIP-26 records exist and the MCP endpoint answers | read `agent-context`, `agent-endpoint[mcp]` and `agent-endpoint[web]` of `graphpay.eth`, and `agent-context` and `agent-endpoint[mcp]` of every agent of the active cast; then an MCP client over Streamable HTTP to the `[mcp]` URL: `initialize`, `tools/list`, `schema` | `graphpay.eth`: context non-empty, `[mcp]` = `site.url` + `site.mcpPath`, `[web]` = `site.url` and answers 200; the tools are exactly `schema`, `ask`, `graphql`, `explain`; `schema` returns the SDL. Every agent: context non-empty, endpoint = `site.url` + `site.mcpPath` | reads; HTTP statuses; tool list |
| B9 | The payee is the shop's ENS address | (a) for each cast shop with a settled payment: `addr(2147485522)` through the Universal Resolver, and the merchant of its last settled order (`PaymentSettled`, then `orders(id)`); and each paying agent's `addr(2147485522)`. (b) In process: give the payer a 402 for the approved shop whose `payTo` is another address | (a) equal (lower case); each paying agent's address is its own wallet. (b) refused `PAYEE_MISMATCH` before any signature; nothing reaches the facilitator | addresses; tx link; refusal |

## D. Arkiv (real Rabdi)

| id | checks | how to run | pass criteria | evidence |
|---|---|---|---|---|
| D8 | The geo query returns only shops inside the box, and only from our writers | Rabdi: `shops(category, box)` around the persona's configured location; a box beside every shop; at S also `synthetic: true`. ArkivSim: the same with a spoofed `shop` row (another owner, same attributes) inside the box | Rabdi: exactly the cast shops (plus, when opted in, the S generator's shops in the box); every row inside the box with owner W_DIRECTORY; the side box returns none; each query carries the owner filter and both i32 ranges (explain trace). ArkivSim: the spoofed row is never returned | answers with explain ids; counts |
| D9 | A receipt cannot be edited | take C2's `pay` edge (by `ref`); simulate a patch of its `amount_micro` with `from` = W_LEDGER (no key, nothing sent); read its creation flags; simulate a patch of the good shop's `all` tally | the edge patch reverts; the flags show readonly; the tally patch would succeed (tallies stay mutable); the website and README say "cannot be edited", never "permanent" | flags; simulation results |
| D10 | An expired or missing quote is refused and the agent re-quotes | as `acceptance.vitalik`, never signing: (a) request a 402 without `requestId`, then run the payer's pre-sign check; (b) request a 402 with `requestId`, then run the check with the payer's clock set past `valid_until`; each followed by the payer tool's own re-quote; (c) read the quote entity's expiry | (a) `QUOTE_MISSING`, then one re-quote whose check passes; (b) `QUOTE_EXPIRED`, then one re-quote with a new entity key whose check passes; no signature in (a) or (b); (c) owner W_DIRECTORY, expiry 15 min after creation (±2 blocks), `valid_until` 10 min after | refusals; entity keys with explorer links |
| D15 | The mirror resumes after a sleep or a network drop (ADR-0056) | with the workers process running under `caffeinate -ims -w <pid>`: cut the network for 2 minutes (or stop the process with SIGSTOP), restore it; then force a restart | no event is skipped or written twice (`count(edge where ref = id) = 1` for every event in the window); the cursor continues from the last processed block; `pmset -g assertions` shows the caffeinate hold while it runs | cursor before and after; counts |
| D11 (Friday) | Heartbeats lapse | turn the Open toggle on, read `shop_open`, turn it off; start an errand and let it end; poll every 60 s | `shop_open` present while on; gone, and the shop out of "open now", within 15 min of off; `agent_presence` present within 30 s of the start and gone within 15 min of the stop; both owned by W_DIRECTORY | timestamps; entity keys |
| D12 (Friday) | Every dot and receipt opens the right explorer page | crawl the site: every map dot, receipt, quote and handoff chip; follow each explorer link | each link follows the configured explorer pattern for that entity key or transaction hash, answers 200 and shows that key or hash | link table with statuses |
| D13 (Friday) | Race mode shows reads, not speed (D2) | run the Q2 race at S (and at M if seeded) | the result on screen is each side's Arkiv reads (and bytes), equal to the `calls` of that mode in `bench/results/questions-<size>.csv`; no time is shown as the result | screenshot; CSV row |
| D14 (Friday) | Swarm references are safe and open | read every `menu` and `refund_evidence` entity; open each `swarm_ref` through the gateway; run the regex test | every `swarm_ref` is 64 hex and opens; no attribute or payload of those entities holds a 128-hex run (`[0-9a-fA-F]{128}`); the writer's unit test refuses one | references; links; regex output |

## E. Integration (addition)

| id | checks | how to run | pass criteria | evidence |
|---|---|---|---|---|
| E8 | Every counting errand records its time and cost (ADR-0048) | read the preset calibration table in `docs/thinking-partner/OPEN.md` after M10's live runs and M12's counting run | one row per full errand: preset, model and effort, wall seconds, API cost from `apiCostUsd` over every response's usage | the table rows |

## Amended existing tests

| id | new wording |
|---|---|
| A5 | W_DIRECTORY (D7) joins the fresh roles; no two roles share an address. |
| B1 | "18 of 18 cast names" becomes every name of the active cast plus both working agents. The address record checked is coin type 2147485522: each paying agent's own wallet, each shop's merchant wallet. |
| B2 | "13 of 13" becomes every agent of the active cast. |
| B3 | As the agent's key (ACCEPTANCE_PAYER): `setText(<name>, "agent-context", <text>)` lands (tx); `setAddress(<name>, 2147485522, <own wallet>)` succeeds in simulation; simulated `setText` of `graphpay.cap_micro` ("999000000"), `graphpay.status`, `x-graphpay-accepts` and `agent-endpoint[mcp]`, and `setAddress(<name>, 60, …)`, each revert `EACUnauthorizedAccountRoles`, and none is sent. Evidence: the Sepolia tx link and the revert reasons. |
| B4 | (D3) Read each cast shop's text record `x-graphpay-accepts` (`getEnsText`), parse it, parse a malformed copy, run the ERC-7930 encoder test. Pass: the value is `0x0001000002075214cedfb56113143d55b2358b8cfbb0deb5ad2f55a7` (28 bytes) and equals the config's value; parse gives `{ chainId: 1874, token: <configured test USDT> }`; the malformed copy gives no preference; no `payment-preference` data record is read or written. Evidence: the value, the parse output, the test output. |
| C2 | Evidence also lists the quote entity key and the ENS payee read that the payer checked before signing. |
| D6 | Calls stay exact as written. "Times" becomes "recorded in the CSV, not a pass criterion" (D2), and the `fail (network)` clause is dropped. |
| D7 | As D6, at size M; `blocked: waiting for the locked story` until the founder locks it (ADR-0049). |
| E2 | The shop names come from the cast's roles (good, trap, runner-up); with the test cast these are kesar-kingdom, jamun-junction and syrup-street. |
| F2 | The route list includes every route that makes W_DIRECTORY sign (the 402 step that writes a quote; on Friday, the Open toggle). |

**Expected spend** adds about five quote writes by W_DIRECTORY (C2, D10), well under 0.01 tGLM; B3 is still one Sepolia transaction; D8, D9 and B9 read or simulate only. **M13's done when** is unchanged (only C7, E3 and D7 may be `blocked`); D11–D14 are not in the CP4 run.
