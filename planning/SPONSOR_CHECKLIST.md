# Sponsor checklist

This file lists what each sponsor and track asks for, which file or screen proves it, what the lab already showed, and what is still open. It holds knowledge only: no code. Build every file listed here fresh in the event repo.

**How to read it**
- Every rule came from the research reports, read on ETHGlobal's prize pages on 3 Nov 2026. None was re-checked since. Each rule therefore carries the tag "(from research; re-verify at the booth/rules page)". Event-day job 1: re-read the three prize pages and ETHGlobal's rules page, then fix this file.
- "Team decision" means we chose it; no sponsor demands it. "Unclear in the research; ask" means the sources do not settle it.
- Source key: **R1, R2, R3** = the research reports (Arkiv, Whitechain + x402, ENS). **Briefs** = the research briefs. **Dossier** = the product dossier. **Fact log** = the verified-facts log (date of check given). **Arkiv spec** = the lab's Arkiv event spec (§12 has the prize-file notes). **Feedback draft** = the lab's draft Whitechain feedback. **Relay F, G, H, C** = the lab's day and night session relays (integration, Arkiv for real, Whitechain for real, ENS).
- Lab numbers are context, not event results. Measure again on the event build. Synthetic data stays labelled synthetic. Say "tallies".
- Specs: SPEC/ARCHITECTURE.md, SPEC/IDENTITY_ENS.md, SPEC/PAYMENTS_WHITECHAIN.md, SPEC/ARKIV_GRAPH.md, SPEC/AGENTS.md, SPEC/INTEGRATION_AND_MIRROR.md, SPEC/SECURITY_AND_OPS.md, SPEC/BENCHMARK.md, WEBSITE_SPEC.md, ACCEPTANCE_TESTS.md, DISCLOSURE.md.

| Sponsor / track | Prize (from research) | The ask, in one line |
|---|---|---|
| Arkiv, "Build on Arkiv" | 1st $3,000, 2nd $1,000 (R1 §8) | Write to Arkiv through the SDK or JSON-RPC, read it in a user-facing feature, and ship a README with writer wallets and a runnable query, `schema.md`, and files that argue friction, reach, why Arkiv and how you use it. |
| Whitechain, "Operate: Stablecoin Payments for Business" | $5,000 (2,500 / 1,500 / 1,000) (R2) | Get a business paid in USDT on Whitechain Sepolia, past the first payment: drop-in checkout (about 20 lines), merchant and customer views, refunds, renewals, export. |
| Whitechain, "Scale" (R2 calls it "Payments Nobody Notices") | $3,000 (2,000 / 1,000) (R2) | A payer pays in stablecoins with zero visible crypto steps; an AI agent pays a business over x402 through a facilitator you run. |
| ENS, "Best Use of ENSv2" | $7,000 (3,000 / 2,000 / 1,000 / 1,000) (R3 §1) | Build on ENSv2 on Sepolia so that it is central, not cosmetic: functional, live demo, open source. |
| ETHGlobal, general | none | Code written during the hackathon; public repo with a real commit history; live link; video in a human voice; AI use documented; pre-event work disclosed in writing to ETHGlobal; submitted before Sat 09:00 IST. |

## 1. Arkiv: "Build on Arkiv"

Specs: SPEC/ARKIV_GRAPH.md, SPEC/INTEGRATION_AND_MIRROR.md, SPEC/BENCHMARK.md, WEBSITE_SPEC.md.

**Qualification rules**
1. Write to Arkiv through the SDK or JSON-RPC. Source: Briefs, R1 "Already known"; Fact log, "Prize Build on Arkiv". (from research; re-verify at the booth/rules page)
2. Read from Arkiv in a user-facing feature. Same sources. (from research; re-verify at the booth/rules page)
3. The README lists the writer wallets and one runnable query. Same sources. (from research; re-verify at the booth/rules page)
4. The repo ships `schema.md`. Same sources. (from research; re-verify at the booth/rules page)
5. Judging has four equal parts (25% each): friction feedback, reach, why Arkiv over Postgres, how you use Arkiv. Source: R1 §8. (from research; re-verify at the booth/rules page)
6. A team can win only one Arkiv track prize. Source: R2 §Qualification, quoting the prize page. (from research; re-verify at the booth/rules page)
7. Use the Arkiv testnet Rabdi (chain 7794095); the prize page lists its RPC, explorer, faucet and access-key URLs. Source: R1 §9. (from research; re-verify at the booth/rules page)
8. The five prize files sit in an `arkiv/` folder (Dossier §5). Whether the folder name and file names are mandatory: unclear in the research; ask.

**Required files**
| file | must contain |
|---|---|
| `README.md` (root) | The writer wallet addresses and what each writes: W_LEDGER (the mirror: nodes, edges, tallies, checkpoints), W_SYNC (the recorder: off-chain refusals and refund requests), W_SEED_EVENT and W_SEED_M_EVENT (the synthetic cities); one runnable query that prints rows from Rabdi with no secrets; links to the five files; the AI-usage link (R1 §4.4 step 12). Addresses only, never keys. |
| `arkiv/schema.md` | Every entity: name, columns, which are indexed, writer wallet, readonly or mutable, expiry. Built from SPEC/ARKIV_GRAPH.md. |
| `arkiv/friction.md` | Each gap with a repro, expected vs actual, and what GraphPay contributes (R1 §8). Include only items you reproduced on the event day (Arkiv spec §12). Candidates the lab reproduced: no joins, SUM or GROUP BY; the SDK says ORDER BY is unsupported on Rabdi but it works on u64 at scale; a salted create duplicates and nothing documents it; the 256 KiB request cap shows up as "Execution error without revert data"; the 64-predicate limit is undocumented; a query needs at least one predicate and `$createdAt` cannot be filtered; the "indexer" URL is an explorer app with no attribute query; camelCase attribute names are accepted although R1 says they revert. From research only (reproduce first): `eth_getLogs` fails about 1,000 blocks behind head; watch events carry no attributes and nothing fires on expiry; the API reference is generated from an old SDK. Not reproduced (ask at the booth): a one-off `HandleInvalid` error on a 60-delete batch. |
| `arkiv/reach.md` | `npm i arkiv-graphql`; a ten-line quickstart for any SDK-1.0 schema; the MCP server any agent can add; a live GraphiQL URL; a roadmap after Mumbai (cursor support, a server-side aggregates proposal); credit to arkiv-sync and arkiv-graph (R1 §8). |
| `arkiv/why-arkiv.md` | Reputation no platform owns; verifiable authorship (owner filter plus re-derivable Payments); expiry as policy; permissionless reads. Also what stays off Arkiv: personal data (none collected), the ENS cache, LLM prompts (R1 §8, Arkiv spec §12). |
| `arkiv/how-you-use-arkiv.md` | A table from each Arkiv feature to something the user sees: indexed filters to shop search; readonly to immutable receipts; owner split to trusted reads and the synthetic filter; expiration to subscription lapse and day-tally retention; `executeBatch` to atomic order-and-tally updates; `count()` to the `verify` badge; `watchEntityEvents` to the live graph (R1 §8). |

**Demo moments** (screens: customer = Vitalik, merchant = Kesar Kingdom; exact controls in WEBSITE_SPEC.md)
| rule | what the judge sees | screen |
|---|---|---|
| 2 | The analyst agent asks about each shop in one call (90-day refund rate, on-time rate, orders, verified owner). A "show the queries" button opens the explain trace: calls, readable queries, entity keys. | Customer |
| 1, 3 | After the payment, a Payment record (readonly) and updated tallies appear. The record links to the writer wallet on the Rabdi explorer. | Merchant |
| 3 | The same writer addresses as in the README, with explorer links. Add this panel to WEBSITE_SPEC.md if missing. | Middle explainer |
| 2, 5 | The `verify` badge recounts a shop's tallies from raw records with `count()` and shows match or mismatch. A subscription lapses by expiry. | Merchant |
| 5 | Same question, two panels: plain Arkiv against Graph Arkiv ("top 10 shops by sales") with live counters for Arkiv calls, bytes and seconds. Label: SYNTHETIC, plus the city size. | Race mode |

**What the lab already proved** (Fact log "Arkiv writes on Rabdi", 2026-11-04; Relay G; live benchmark)
- A live payment record (edge plus four tallies) costs 310,527 gas = 0.00031 tGLM at 1 gwei. One 13-column row costs 214,800 gas for a 1-day life and 589,094 for the maximum of about 182 days.
- Two synthetic cities were seeded and benchmarked live: 945 and 9,612 events (the benchmark calls them transactions). Seeding the larger one cost 6.33 tGLM over 1,107 chain transactions and 99.6 minutes.
- Race result, synthetic city of 9,612 events (40 shops): top 10 shops by sales takes Graph Arkiv 2 calls, 31 KB, 0.65 s. Plain Arkiv reads all 4,604 payment rows: 48 calls, about 1 MB, 1.17 s with every page at once, 15.2 s page by page. At 945 events they are level (0.65 s against 0.66 s). Plain's answer is also wrong by identity after a shop re-registers. Traversals are not a win (even or slightly worse); pair links cut all-time path search to 9 calls against 11. Do not overclaim.
- Limits measured: 256 KiB request cap (about 40 creates per transaction); 64 predicate leaves per query; ORDER BY on u64 across pages; an ENS namehash works as a `key` column; EIP-1559 transactions work; the header says 5,000 calls per 10 s per access key (no 429 in 24,484 logged requests; the budget is the header's claim). A salted create duplicates, so the write path uses an anchor in the same batch and retries pinned to the confirmed nonce (SPEC/INTEGRATION_AND_MIRROR.md).

**Still open**
- A real Whitechain payment flowing through mirror and ledger into Rabdi, with a GraphQL answer behind the live URL, was not run end to end. The lab integration used an Arkiv simulator (Relay F).
- `arkiv-graphql` is not published and no GraphiQL URL exists. Whether the npm name is free is unchecked.
- Monthly access-key quota: unknown. Event writer wallets need tGLM and an access key.
- Race-mode numbers must be measured again on event data (SPEC/BENCHMARK.md).

**Questions for the Arkiv booth**
1. What is the monthly quota of an access key? Is the keyless window per IP? (The node shows only `limit=5000 ... reset=10`.)
2. Is the one-off `Revm ... HandleInvalid` error on a 60-delete gas estimate known?
3. Will a uniqueness or "create if absent" option come? (A salted create duplicates.)
4. What counts as an "Arkiv track" for the one-prize limit? Are the `arkiv/` folder and exact file names required, and is there a friction template?
5. Which faucet amount is right today? R1 §7 found 0.1 GLM per 24 h in a skill file and 10 GLM per hour in the faucet code. We need to fund four writer wallets: 9.4–11.6 tGLM in all, of which FUNDER already holds 2.86, so the founder brings at least 9 (`WALLETS.md` §3).
6. Does a published package plus a live GraphiQL count as reach, or do judges want other users?

## 2. Whitechain: "Operate: Stablecoin Payments for Business"

Specs: SPEC/PAYMENTS_WHITECHAIN.md, SPEC/SECURITY_AND_OPS.md, SPEC/AGENTS.md, WEBSITE_SPEC.md.

**Qualification rules** (R2 §Qualification applies to every Whitechain sub-prize)
1. Contracts deployed on Whitechain Sepolia (chain 1874) and verified on the Whitechain explorer. R2 §Qualification. (from research; re-verify at the booth/rules page)
2. At least one payment in USDT `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` in the main flow, with its explorer link in the README. A token you minted yourself does not count. R2 §Qualification. (from research; re-verify at the booth/rules page)
3. A README line on why the flow needs on-chain stablecoin settlement. R2 §Qualification. (from research; re-verify at the booth/rules page)
4. A public repo with steady commits. R2 §Qualification. (from research; re-verify at the booth/rules page)
5. A 2-4 minute video that shows each party involved. R2 §Qualification. (from research; re-verify at the booth/rules page)
6. A `WHITECHAIN_FEEDBACK.md`. R2 §Qualification. (from research; re-verify at the booth/rules page)
7. A drop-in piece that a separate demo app adds in about 20 lines. R2 §Prize text. (from research; re-verify at the booth/rules page)
8. Both views in the demo: the merchant and the paying customer. R2 §Prize text. (from research; re-verify at the booth/rules page)
9. Extra credit if the flow goes past the first payment: a refund, a renewal, or an export an accountant can use. R2 §Prize text. (from research; re-verify at the booth/rules page)
10. Will not place: a pay button that sends a plain transfer, tipping jars, bill splitters, custodial bridges into a local-currency token, and payroll, escrow or revenue splits on their own. A QR code must link to a web page, not an EIP-681 URI, which would send a plain transfer. R2 §Prize text and §How it works (f). (from research; re-verify at the booth/rules page)
11. Whether one project can win both Whitechain prizes: unclear in the research; ask at the workshop.

**Required files**
| file | must contain |
|---|---|
| `README.md` | Contract addresses with explorer "verified" links; the USDT payment's explorer link; the "why on-chain settlement" line (R2 checklist: agents of different owners need a settlement record neither side controls; one verifiable event holds the order, refund cap and subscription terms and feeds reputation anyone can query on Arkiv); how to run the 20-line demo store; AI-usage link. |
| `WHITECHAIN_FEEDBACK.md` | What we built; what worked; friction, ranked by cost; gas measured on the event build; docs we would add. Every number from the event build's own runs. Lab topics: EVM parity (canonical Permit2, deterministic deployer, EntryPoint, Multicall3 and x402's Permit2 proxy are all deployed); test USDT is a full TetherTokenV2 with EIP-2612 and EIP-3009; no way to get test USDT (faucet gives WBT only, `mint` is owner-only); two USDT tokens in the docs; faucet limits; Blockscout shows "verified" but not "fully verified" for builds with no metadata hash; the 50 requests/s public RPC limit (Feedback draft). Do not repeat R2's claims that the lab disproved: EIP-3009 is present; the x402 Permit2 proxy is deployed. |
| Demo store | A separate small app; the diff that adds the checkout is about 20 lines. |
| Optional export | Accountant CSV with order, kind, parent, customer and merchant names, gross, refunded, net, status, tx hash, explorer link; synthetic rows excluded by default (R2 §5). |

**Demo moments**
| rule | what the judge sees | screen |
|---|---|---|
| 1 | The contract address with a "verified" explorer link. | Middle explainer |
| 2, 8 | Customer pays 4.80 USDT for 12 gulab jamun; the receipt shows the USDT token address, the amount and the explorer link. | Customer |
| 3 | One on-screen line on why settlement is on-chain. | Middle explainer |
| 8, 9 | The order arrives; a one-click partial refund of 0.80 USDT for two squashed jamuns; the customer's receipt shows the refund. A subscription renews and is cancelled with a signature. CSV export button. | Merchant, then Customer |
| 7 | The demo store page with the 20-line diff on screen. | Demo store (see WEBSITE_SPEC.md) |
| 5 | The video shows every party: the customer and his agent, the merchant and the shop's risk agent, the facilitator operator (health page), the explorer. Our reading of "each party"; confirm at the workshop. | All |

**What the lab already proved** (Fact log "Whitechain Sepolia, real chain", 2026-11-04; Relay H; Feedback draft)
- Contracts deployed and Blockscout-verified with Foundry on 1874. A stand-in token, `gpUSD-TEST`, was used because no test USDT could be obtained. It does not qualify.
- Full lifecycle on the real chain with the stand-in: one-signature payment with no gas for the payer, safe replay, partial refund, re-order, a revoked agent recorded on-chain, human payer, subscription created, renewed and cancelled.
- Gas: first agent payment 312,024 (about 0.0016 WBT); refund 65,681; renewal 201,555; subscription creation 437,794. A whole demo day cost about 0.045 WBT.
- Checked on-chain: canonical Permit2, the deterministic deployer, EntryPoint v0.7 and Multicall3 exist on 1874. Test USDT has EIP-2612 and EIP-3009; signing parity tests ran on a fork.
- One payment through the public Vercel URL settled on 1874 (234,292 gas).

**Still open**
- **The qualifying payment in test USDT has not happened.** No test USDT could be obtained: the faucet gives WBT only, `mint` is owner-only, and 1,945,270 USDT sit with 50 holders (Feedback draft). The event repo starts with new contracts and wallets, so this payment must happen there. A dry run estimated about 3.56M gas to deploy the checkout for USDT.
- Whether the event facilitator runs as a serverless function or a long-lived process (SPEC/SECURITY_AND_OPS.md).
- Relayer WBT: the faucet gives 0.5 WBT per 24 h per GitHub account (account at least 30 days old, captcha).

**Questions for the Whitechain workshop** ("How to Win on Whitechain, Tracks and Tips", Thu 5 Nov, 4:30 PM IST, Workshop Room 2)
1. How do we get test USDT `0xcedf...55a7`, how much, and to which address? (The docs token-list page still shows USDT.e `0xaa79...8f46`: confirm `0xcedf...55a7` is the prize's USDT.)
2. Can one project win both Operate and Scale?
3. Does a Blockscout "verified" status without "fully verified" meet "verified on the explorer"?
4. Who counts as "each party" in the video?
5. Can the team get extra WBT for the relayer?

## 3. Whitechain: "Scale" (agents pay over x402 through your own facilitator)

Specs: SPEC/PAYMENTS_WHITECHAIN.md, SPEC/AGENTS.md, SPEC/SECURITY_AND_OPS.md.

**Qualification rules** (plus the six in section 2)
1. The payer pays in stablecoins without holding WBT for gas, writing down a seed phrase, or knowing what chain they are on. R2 §Prize text. (from research; re-verify at the booth/rules page)
2. A listed idea: pay-per-request APIs where an AI agent pays a business in USDT over x402, settled on Whitechain through a facilitator you run. R2 §Prize text. (from research; re-verify at the booth/rules page)
3. Must show: a payer flow with zero visible crypto steps; how the business pays the gas; how the relayer gets its WBT; what stops someone draining it. R2 §Prize text. (from research; re-verify at the booth/rules page)
4. Will not place: flows where the payer still signs a transaction that costs gas, and AI chats that never actually pay. R2 §Prize text. (from research; re-verify at the booth/rules page)
5. Whether Scale can be entered with Operate: unclear in the research; ask. Dossier open question Q3: lead with Operate and show the agent story inside it.

**Required files:** the same as section 2, plus a README section on the gas budget, how the relayer is funded, and the drain limits (R2 judge table). The facilitator's health page shows the gas budget and drain protections (Dossier §5).

**Demo moments**
| rule | what the judge sees | screen |
|---|---|---|
| 1, 3 | One sentence to the concierge ("some gulab jamun, under 6 USDT, by 8 pm"); no wallet pop-up, no chain picker, no gas. | Customer |
| 2 | A live message flow: shop answers 402, agent signs once, facilitator verifies and settles, transaction hash. | Middle explainer |
| 3 | Panel: who pays gas, relayer balance and floor, daily gas budget, failure limits. | Middle explainer |
| 3 | A rogue agent is refused ("name revoked") and an over-cap payment is refused off-chain with no gas spent. | Customer, Merchant |
| 4 | The agent's payment shows on the merchant screen with the explorer link: it really paid. | Merchant |

**What the lab already proved** (Relay F, Relay H, Fact log 2026-11-04)
- An integration run passed 6 of 6 checks with Claude Haiku agents: ENS name check on real Sepolia, 402, facilitator, checkout contract on a local fork of Whitechain, mirror, simulated Arkiv, GraphQL answer.
- On the real chain an agent bought with one signature and no gas of its own; the replay did not charge twice; the subscriber sent no transaction.
- The hosted facilitator rejects calls without a bearer token (401). A relayer-balance floor stops it after about 0.09 WBT of gas, roughly 60 payments (Relay H). In-memory limits count per serverless instance, so the floor is the real bound.

**Still open**
- No agent payment in real test USDT; the public URL used the stand-in token.
- Relayer-griefing fixes (renewal ids in their own id space; one-off ids derived from payer and witness) were left for the event build (Relay H; SPEC/PAYMENTS_WHITECHAIN.md).
- Whether one signed gasless approval counts as "zero crypto steps" for a human payer.

**Questions for the workshop:** the five in section 2, plus: Is a facilitator on serverless functions "a facilitator you run"? Does a one-time off-chain signature (no gas) count as zero visible crypto steps?

## 4. ENS: "Best Use of ENSv2"

Specs: SPEC/IDENTITY_ENS.md, SPEC/PAYMENTS_WHITECHAIN.md (the facilitator's name check), WEBSITE_SPEC.md.

**Qualification rules** (R3 §1, from the prize text)
1. Built on ENSv2 on Ethereum mainnet or Sepolia. We use Sepolia (chain 11155111). (from research; re-verify at the booth/rules page)
2. ENSv2 features are central to the product, not a cosmetic add-on. (from research; re-verify at the booth/rules page)
3. The demo is functional, not hard-coded values. (from research; re-verify at the booth/rules page)
4. The project showcase links a live demo. (from research; re-verify at the booth/rules page)
5. The code is open source on GitHub or similar. (from research; re-verify at the booth/rules page)
6. Rewarded features, not rules: hierarchical registries; wildcard resolution; your own subname registry; Enhanced Access Control; a Permissioned Resolver per subname; aliasing; expiring, revocable, non-transferable subnames. Bonus for AI agents as namespaces. (from research; re-verify at the booth/rules page)
7. The "Best Integration of ENSv2 into an Existing Project" prize ($3,000) needs mainnet and does not apply. R3 §1. Do not repeat the claim that ENSv2 is live on mainnet; ENS's own pages disagree (R3 Caveats). (from research; re-verify at the booth/rules page)

**Required files:** README with the live demo link, the root name, the registry and resolver addresses with explorer links, and the AI-usage link; a license (MIT is our team decision); open repo link. No sponsor file list was found in the research. ENSIP-26 records (`agent-context`, `agent-endpoint[mcp|a2a|web]`) and ENSIP-25 are listed as prize resources in R3 §1.

**Demo moments** (Dossier §5 numbering; R3 "Judge-facing proof points")
| rule | what the judge sees | screen |
|---|---|---|
| 2 | **Moment 1.** The owner kills the rogue agent (`unregister`); its next payment is refused ("refused: name revoked"); the node turns red. | Customer, then Merchant |
| 2 | **Moment 2 (optional).** A tracker agent with a short expiry lapses mid-demo; payment refused; the owner renews; same epoch and reputation return. Needs an extra `tracker.vitalik.graphpay.eth` with a 5-minute expiry (not among the 13 agents; the lapse-and-renew behaviour is proven on a fork). The everyday switch on stage is "pause my agent" (`DECISIONS.md` E-9). | Customer |
| 2, 6 | **Moment 3.** The payer agent updates its own `agent-endpoint[mcp]`; its attempt to raise its own cap reverts with `EACUnauthorizedAccountRoles`. | Middle explainer |
| 3, 6 | **Moment 4.** A name like `sim-NNNN.sim.graphpay.eth` resolves live with zero per-agent transactions and is marked synthetic. | Middle explainer or race mode (see WEBSITE_SPEC.md) |
| 2 | **Moment 5.** The ENS name is the centre of the graph: shop tallies hang off its namehash. In race mode, plain Arkiv credits a re-registered shop's old holder, Graph Arkiv (name plus epoch) does not. | Merchant, Race mode |
| 3, 4 | Names, caps and status read live from Sepolia; the live URL is in the submission. | All |

**What the lab already proved** (Relay C; Fact log, ENS rows, 2026-11-04)
- The 13 ENSv2 Sepolia contract addresses we use were checked on-chain and match ENS's deployments page. A root name, its own subname registry, 4 owners and 13 agents ran on real Sepolia: 77 transactions, 68.4M gas. One agent costs 3 transactions. Registration costs about 8 MockUSDC a year; `mint` on MockUSDC is open to anyone.
- Each agent has its own resolver and a non-transferable, expiring token. An agent edits its endpoint; its cap write is rejected by the chain. Any `sim` name resolves with no transaction.
- Kill switch: after `unregister` the old records do not keep resolving (the parent answers with empty values, not an error), so only registry state tells you an agent is dead. Pitch line: "the registry decides, not the records."
- `graphpay.eth` was registered bare (no records, no registry) on Sepolia before the event. List it in DISCLOSURE.md; everything under it is created at the event.
- Stock viem reads ENSv2 and wildcard names with no custom code. A name check costs 12 chain reads plus 1 block read: cache it 20 seconds (the value used everywhere in the pack).

**Still open**
- ERC-8004 and ENSIP-25 linking, the rename alias demo (`linkToNode`), reverse names and the CCIP-Read stretch were not built. Whether the agents bonus needs them: ask.
- ENSIP-31 payment preference is a draft that changed in October; feature-flag it. Sepolia was redeployed on 15 Sep: re-read the deployments page on 5 Nov.
- A watcher that mirrors text-record changes (status, cap) was not finished.

**Questions for the ENS workshop** ("ENSv2 - Identity for Apps, Agents & Beyond", Thu 5 Nov, 4:00 PM IST, Workshop Room 1; it starts 30 minutes before the Whitechain one and durations are not in the research, so the founder may have to choose, or use the booths)
1. Is it intended that `renew()` on an unregistered label makes it RESERVED and brings the old resolver back?
2. Is another Sepolia redeploy planned before 8 Nov?
3. Is ENSIP-31 `payment-preference` stable?
4. Is registering the root name before the event fine, since a name is not code?
5. Do ERC-8004 and ENSIP-25 matter for the agents bonus, or do scoped, expiring agent subnames suffice?

## 5. ETHGlobal: general rules

Specs: SPEC/ARCHITECTURE.md, DISCLOSURE.md.

1. **Read on 2026-11-05 from the ETHGlobal pages (`FACTS.md` §6).** Classic ("Start Fresh") track: all work on the project must begin after the hackathon starts; prior project-specific code, designs or assets are barred unless they come from public libraries or starter kits; pre-existing work must be disclosed **in writing to the ETHGlobal team** with full details, or the project may be disqualified. Version control during the event is required; "large single commits or missing histories may be disqualified". AI tools are "generally permitted": document where and how they were used; AI should assist, "not to create the entire project"; spec-driven workflows are allowed, but "all spec files, prompts, and planning artifacts" must be in the repo (`planning/` and `prompts/raw/` do this). The demo video must not use text-to-speech or an AI voiceover. Open questions for an organiser are in `DISCLOSURE.md`.
2. Our practice (team decision): the public repo starts empty at kickoff, commits are frequent, and no lab code is copied. The pack hands over knowledge only.
3. The submission form takes **up to 3 partner prizes** (submission guidelines, 2026-11-05). Arkiv + Whitechain + ENS uses all three; if Whitechain's Operate and Scale count as two prizes, choose one of them (ask at the workshop).
4. Submission needs a public repo (Whitechain, ENS), a live demo link (ENS) and a 2-4 minute video (Whitechain). The form asks for a title, a description and the repo link, then the partner prizes. **Deadline: Saturday 7 November 2026, 09:00 IST; late submissions are not accepted.** Finalist judging is 7 minutes (4 demo, 3 Q&A); the slot appears on the Hacker Dashboard.
5. AI use: R1 §4.4 step 12 puts an AI-usage disclosure in the README. `AI_USAGE.md` is a team decision. Whether ETHGlobal requires one: unclear; do it anyway. It states: Claude Code wrote the code at the event; product models are Claude by default and Grok optional; what the humans did; and a link to DISCLOSURE.md.
6. `DISCLOSURE.md` states what existed before the event (research, specs, prompts, the bare `graphpay.eth` registration), that synthetic data is labelled, and that the demo holds the owner's key (demo custody).
7. No secrets in the public repo; addresses only. Testnets only.

## 6. Submission day checklist

| item | sponsor | file or link | owner | done-when |
|---|---|---|---|---|
| Re-read the three prize pages and the rules page; fix this file | All | prize pages; this file | Claude (founder pastes text if a page needs a login) | Every rule is ticked or corrected. |
| Ask the booth and workshop questions; log the answers | All | sections 1-4 | Founder | Each answer is written in this file or in friction.md. |
| Fund the writer wallets with tGLM (the founder brings at least 9 to FUNDER; FUNDER pays them); the lab's Arkiv access key is reused (imported at M0; the writer wallets themselves are fresh) | Arkiv | hub.arkiv.network faucet or the Arkiv booth; WALLETS.md §3 | Founder | W_LEDGER, the S and M seed wallets hold their targets; `ARKIV_ACCESS_KEY` is set (name check only). |
| Seed the synthetic city; measure the race | Arkiv | SPEC/BENCHMARK.md; race mode | Claude | Numbers are from the event build, labelled synthetic, with the city size. |
| `README.md` with writer wallets and a runnable query | Arkiv | README.md | Claude | A fresh clone runs the query and prints rows. |
| `arkiv/schema.md`, `friction.md`, `why-arkiv.md`, `how-you-use-arkiv.md` | Arkiv | arkiv/ | Claude | Each friction item has a repro run on the event day. |
| `arkiv/reach.md`; package published; live GraphiQL URL | Arkiv | npm; GraphiQL URL | Founder (npm login), Claude (publish) | `npm i arkiv-graphql` works; the URL answers. |
| Get test USDT `0xcedf...55a7` at the Whitechain booth | Whitechain | event funder wallet | Founder | The wallet shows at least 5 USDT. |
| Fund the relayer with WBT (FUNDER holds 1.848 WBT after the 2026-11-05 sweep; M0 sends FACILITATOR 0.8 by script) | Whitechain | WALLETS.md §3; faucet.testnet.whitechain.io only if FUNDER runs low | Claude | Relayer is well above its 0.3 WBT floor. |
| Contracts deployed and verified on 1874 | Whitechain | explorer links in README | Claude | Explorer shows the source as verified. |
| The qualifying USDT payment | Whitechain | explorer tx link in README | Claude | The tx page shows token `0xcedf...55a7` and the settled event. |
| README line on why on-chain settlement | Whitechain | README.md | Claude | The line is present. |
| 20-line drop-in checkout in a separate demo store | Operate | demo store | Claude | The diff is about 20 lines and a payment goes through. |
| Merchant and customer views; refund, renewal, export | Operate | live URL | Claude | Each runs once on the live URL. |
| Facilitator health page; gas and drain section in README | Scale | health URL; README.md | Claude | The page shows the budget and floor; the README explains them. |
| `WHITECHAIN_FEEDBACK.md` from event-build runs | Whitechain | WHITECHAIN_FEEDBACK.md | Claude | Every number has an event-build source. |
| Root name, registry, resolvers and agents on Sepolia | ENS | SPEC/IDENTITY_ENS.md | Claude | The names resolve live; the kill demo works. |
| ENS moments 1 to 5 rehearsed on the live URL | ENS | live URL | Claude | All five run without edits. |
| Live demo opens for judges | ENS, all | live URL | Claude | A passcode, if any, is in the submission notes; or the demo is open. |
| `AI_USAGE.md` and `DISCLOSURE.md`, linked from README | All | both files | Claude | Both exist and README links them. |
| Public repo: commits through the event, license, no secrets | All | repo URL | Claude | The secrets scan is clean; the license is in place. |
| 2-4 minute video showing every party | Whitechain, all | video link | Founder (Claude writes the run order) | The video is public and between 2 and 4 minutes. |
| ETHGlobal submission: tracks, repo, live link, video, sponsor files | All | ETHGlobal form | Founder | The submission is confirmed before the deadline. |
