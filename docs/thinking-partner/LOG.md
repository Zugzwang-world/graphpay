# LOG

One line per PR: time (IST) · activity · result · PR link. Append under your own activity's heading only. Main (M14) alone rolls older lines into a dated summary at the top and keeps the last 60.

**Rolled up 06:55 IST (Coordinator), the 15 oldest lines:** M0, Thu 21:47–23:55 IST (PRs #1–#7): the repo, CI, secret helpers, the funding script, the story config, the handover. The full history is in `git log` and the merged PRs.

## foundation

## payments

- 01:55 IST · payments · M1 contract and 88 fork tests on the real test USDT and Permit2; two reviewer passes: ship; auto-merge after the contracts job · https://github.com/Zugzwang-world/graphpay/pull/12
- 01:51 IST · payments · merged: M1 checkout contract and 90 fork tests (M1 done) · https://github.com/Zugzwang-world/graphpay/pull/12
- 01:58 IST · payments · M2 on the real chain (deploy 01:54, setup 01:57): USDT checkout deployed, verified, set up; scripts and records PR · pay/deploy
- 01:59 IST · payments · merged: USDT checkout deployed, verified and set up on Whitechain Sepolia (M2 done) · https://github.com/Zugzwang-world/graphpay/pull/15
- 04:05 IST · payments · M3 part A: facilitator pipeline, shop 402 API, recorder; 77 offline tests and a fork e2e on the real contract and test USDT; reviewer pass 2: ship · https://github.com/Zugzwang-world/graphpay/pull/42
- 04:06 IST · payments · merged: M3 part A, the facilitator, the shop 402 API and the recorder · https://github.com/Zugzwang-world/graphpay/pull/42
- 04:20 IST · payments · M3 part B on the real chain: C7 paid once as acceptance.vitalik, the lifecycle as rehearsal.vitalik, the subscription renewed and cancelled; reviewer: ship · https://github.com/Zugzwang-world/graphpay/pull/45
- 04:40 IST · payments · M4 dependencies: apps/web depends on the facilitator and shop packages · https://github.com/Zugzwang-world/graphpay/pull/53
- 05:05 IST · payments · M4 hosted routes: shop, facilitator, recorder, renewal cron; vercel-env (14 Sensitive values set) and pay:public; two reviews fixed · https://github.com/Zugzwang-world/graphpay/pull/58
- 05:05 IST · payments · merged: M4 part 1, the hosted routes · https://github.com/Zugzwang-world/graphpay/pull/58
- 05:11 IST · payments · M4 live: pay:public settled 0.40 through the public URL, C6 401s, recorder edge, cron renewal (M4 done) · pay/hosted-done

## identity
- 02:00 IST · identity · M5: the ens package, ABIs from Sourcify, run script and checkers; namespace provisioned on real Sepolia (60 tx, 72.7M gas); B1/B4/B5/B8/B9a reads pass · [PR #18](https://github.com/Zugzwang-world/graphpay/pull/18)
- 03:50 IST · identity · M6 part 1: `ensGate`, `ens_check`, owner actions (pause, resume, kill), `scripts/ens/owner.mjs`; 33 unit + 10 fork tests, real-Sepolia read-only gate pass · [PR #34](https://github.com/Zugzwang-world/graphpay/pull/34)
- 04:25 IST · identity · M6 done: the ENS watcher library and policy sink (reviewed twice), B8's MCP call in the acceptance script · [PR #40](https://github.com/Zugzwang-world/graphpay/pull/40)

## arkiv

- 01:40 IST · arkiv · M7a: generic `@graphpay/arkiv-graph` SDK and `@graphpay/money-graph` (model, safe writer, ArkivSim, ledger, recorder, quotes, directory); live probe on Rabdi · https://github.com/Zugzwang-world/graphpay/pull/14 (merged 01:51)
- 03:05 IST · arkiv · M8 size S seeded on Rabdi (graph 97 txs, 0.494 tGLM; directory; plain resuming) and M7b (engine, GraphQL, explain, hosted MCP routes); live checks pass · https://github.com/Zugzwang-world/graphpay/pull/21 (merged 03:11)
- 03:20 IST · arkiv · fix: the recorder, quotes and the ledger's check read `getEntity`'s `$attributes`, so an uncertain send is adopted, never written twice (Join's finding); ArkivSim test · https://github.com/Zugzwang-world/graphpay/pull/25 (merged 03:23)
- 03:40 IST · arkiv · fix: a reputation is labelled synthetic when any tally row it reads is, so real cast shops with labelled history say so (Join's finding via the Coordinator); ArkivSim test · https://github.com/Zugzwang-world/graphpay/pull/30 (merged 03:41)
- 03:42 IST · arkiv · M9 at S: live benchmark, D6 passes (Q2: Graph Arkiv 2 reads, plain 5, 6 in parallel; every answer right), race function for /api/race, batched out()/in(), byte meter fix · https://github.com/Zugzwang-world/graphpay/pull/31 (merged 03:45)
- 03:50 IST · arkiv · Friday item 1: `shop_open`, `agent_presence`, `handoff` rows (W_DIRECTORY, lapse by themselves, renewals never past now + lifetime), GraphQL `shops(openNow)`, `agentsOnline`, `handoffs`, the agents' hooks · https://github.com/Zugzwang-world/graphpay/pull/35

## agents

- 01:40 IST · agents · M10 package, guards, mocks and tests, reviewer findings fixed; five live runs on the testing preset all paid the good shop · [PR 11](https://github.com/Zugzwang-world/graphpay/pull/11)
- 02:40 IST · agents · Friday item 2: optional `presence` and `handoff` hooks, mocks and 8 tests, no-op by default · [PR 16](https://github.com/Zugzwang-world/graphpay/pull/16)

## integration

- 01:20 IST · integration · opened: the mirror core on test doubles (decoding, mapping, parking, lease, recorder fold, 5% history, endpoints; 22 tests) · https://github.com/Zugzwang-world/graphpay/pull/8
- 02:05 IST · integration · opened: the mirror on M7a's writer, the workers process, `pnpm workers` (ArkivSim with the real planner; 29 tests; reviewer: 2 blocking and 7 should-fix items, all fixed) · https://github.com/Zugzwang-world/graphpay/pull/20
- 03:36 IST · integration · opened: the mirror live on Rabdi (history 1,258 labelled events; retry and drop tests clean, counted after the first payment), the replay tool and acceptance reads, the integration package with the live MCP client and read hooks · https://github.com/Zugzwang-world/graphpay/pull/33
- 04:10 IST · integration · opened: the ENS gate on the payer's signing path (M12) and batched live presence and hand-off hooks (Friday item 3) · https://github.com/Zugzwang-world/graphpay/pull/37
- 04:30 IST · integration · opened: T2's watcher hosted in the workers; the first ACCEPTANCE_REPORT (18 pass, 0 fail, 1 blocked, 29 not run; D1 and D3 pass on the real payments) · https://github.com/Zugzwang-world/graphpay/pull/46
- 05:10 IST · integration · merged: the buyer_risk fix and `pnpm e2e:food` (M12) · https://github.com/Zugzwang-world/graphpay/pull/48
- 04:55 IST · integration · opened: the counting e2e:food run passed A–E on the real networks (paid 4.80, delivered, refunded 0.80); the signer fix; the report at 24 pass · https://github.com/Zugzwang-world/graphpay/pull/52
- 05:00 IST · integration · opened: the kill check F passes for real (402 after 9.3 s, the watcher revoked the policy, the fail edge on Arkiv); the recorder ref fix; (M12 done) · https://github.com/Zugzwang-world/graphpay/pull/56
- 05:15 IST · integration · opened: acceptance A5, C7, E3 pass (the qualifying USDT payment read from its receipt); the report at 29 pass, 0 fail, 1 blocked · https://github.com/Zugzwang-world/graphpay/pull/57
- 05:10 IST · integration · opened: D2b, D2c and D15 pass live (a frozen mirror, a raced nonce, a crash after send); the report at 31 pass (M11 done) · https://github.com/Zugzwang-world/graphpay/pull/60
- 05:33 IST · integration · opened: M13's hosted run passes C2, C3, C5, C6, F2 and C4(b) on the production domain (4.80 paid, 0.80 refunded, 1.20 re-order, over-cap refused); A3, A4, A9, A10, B3 wired; the report at 41 pass, 0 fail · https://github.com/Zugzwang-world/graphpay/pull/66
- 05:41 IST · integration · opened: C4(a) passes (the scout agent revoked, refused on-chain AGENT_REVOKED, restored exactly; the mirror's fail edge once after a paused restart); the report at 42 pass, 0 fail; then F1 (no secrets in the tree, the history of every branch or Vercel), 43 pass · https://github.com/Zugzwang-world/graphpay/pull/67

## website

- 01:30 IST · website · opened: the website shell (stage, both phones, explainer, race, how-it-works, passcode guard and its F2 tests, status chips) · https://github.com/Zugzwang-world/graphpay/pull/10 (merged; production serves it)
- 01:31 IST · website · opened: phone views, Friday items 11 and 12 that need no other track (request card with budget and deadline countdown, spending-pass states, merchant notifications) · https://github.com/Zugzwang-world/graphpay/pull/13
- 03:03 IST · website · opened: the agent run route (one request streams the errand over SSE, one at a time, 503 until M12 wires the live agents), the run registry, client streaming · https://github.com/Zugzwang-world/graphpay/pull/17 (merged)
- 03:20 IST · website · opened: the merchant order stream and the accountant CSV read live from the money graph through GraphQL, tested on ArkivSim · https://github.com/Zugzwang-world/graphpay/pull/23 (merged)
- 03:45 IST · website · opened: the order trail page on GraphQL `order(id)`, the explain page shows each call's rows, bytes and ms · https://github.com/Zugzwang-world/graphpay/pull/26
- 04:20 IST · website · opened: race mode live (Friday item 8): `/api/race` runs one side on Rabdi with per-read ticks and truth badges, the committed benchmark table under it · https://github.com/Zugzwang-world/graphpay/pull/36 (merged)
- 05:05 IST · website · opened: the Open toggle (Friday item 9): `POST /api/merchant/open` writes the shop's `shop_open` row as W_DIRECTORY, renewed every 5 minutes by the merchant phone; reviewer pass · https://github.com/Zugzwang-world/graphpay/pull/39
- 05:50 IST · website · opened: the customer's Pause and Resume buttons (M6): the owner wallet sets `graphpay.status` of the payer agent on Sepolia, behind the passcode; reviewer pass · https://github.com/Zugzwang-world/graphpay/pull/43
- 06:05 IST · website · opened: the customer phone's live state (`/api/state/customer`: status from ENS and the AgentPolicy, cap and spend from the checkout contract, last order from the graph) and the checkout address fix · https://github.com/Zugzwang-world/graphpay/pull/44
- 07:10 IST · website · opened: M16 the checkout kit and the demo store (a shop in 17 lines, a person pays from a browser wallet, merchant view, chain-based accountant export), two reviewer passes, a bundler-safe ABI import in contracts · https://github.com/Zugzwang-world/graphpay/pull/51
- 07:55 IST · website · opened: the Mumbai map (Friday item 10): our own SVG of the neighbourhoods, directory dots, open shops and agents glowing, explorer links · https://github.com/Zugzwang-world/graphpay/pull/54
- 08:20 IST · website · opened: the explainer's agent lanes (Friday item 13) from the handoff rows, and the run id passed to the errand runner · https://github.com/Zugzwang-world/graphpay/pull/55
- 05:40 IST · website · opened: M16 proof, one real 4.80 USDT kit payment on the hosted facilitator (tx 0xf1e76a91…), the store's facilitator env name, the export's RPC range cap logged · https://github.com/Zugzwang-world/graphpay/pull/63
- 06:10 IST · website · opened: the merchant phone's Mark dispatched and Refund (Friday item 12), signed with the shop's key behind the passcode, reviewer pass · https://github.com/Zugzwang-world/graphpay/pull/65

## agentpay
- 04:05 IST · agentpay · opened: `@graphpay/agentpay` V1, the two-sided SDK (buyer pass and guards, merchant middleware, facilitator interface and reference relayer, AI SDK and MCP tools, the sweet shop and ride examples), 36 offline and 13 fork tests, reviewer's 2 blocking fixed · https://github.com/Zugzwang-world/graphpay/pull/38
- 04:10 IST · agentpay · opened: the first real test payment through the SDK (0.01 test USDT, rehearsal agent → good shop, https://explorer.testnet.whitechain.io/tx/0xfbd7d307b1b0c08f3af015b4bdb03aaeed12d0c2d18c2553432cb4679ff14c7e), its script and tx log · https://github.com/Zugzwang-world/graphpay/pull/41 (merged)
- 04:20 IST · agentpay · opened: A4, the SDK merchant settling through T1's facilitator on a fork (in process and over HTTP; bad token and a gate refusal send nothing), 4 fork tests; the CSV's cached-head fix · https://github.com/Zugzwang-world/graphpay/pull/47 (merged)
- 05:30 IST · agentpay · opened: the merchant's log reads fit the public RPCs' block-range caps (10,000, then 1,000 on a refusal; T5's report), checked on the real chain; fork tests write test USDT on the fork instead of drawing on FUNDER · https://github.com/Zugzwang-world/graphpay/pull/64

## records

- 01:20 IST · records · the Coordinator took over at 00:46 (10-minute ticks, keep-awake); ADR-0057 (the graph SDK, npm on Friday) and Friday item 18; T3 briefed; M0's background tasks checked (none failed); usage risk raised and the six track sessions switched to the planned models at 01:22; first M14 relay · https://github.com/Zugzwang-world/graphpay/pull/9
- 03:10 IST · records · records after the 02:14–03:01 sleep: four milestones merged (M7a, M1, M10, M2), power and lid first in "Founder now", usage 74%, fresh starts under way · https://github.com/Zugzwang-world/graphpay/pull/19
- 03:20 IST · records · after the sleep: no session hung; T3 and T5 fresh; the main checkout fast-forwarded (M0's failed step); the prompt-log hook writes to the session's own checkout (P-records-1, reviewer: ship) · https://github.com/Zugzwang-world/graphpay/pull/24
- 03:30 IST · records · the main checkout fast-forwarded to #24, so the fixed hook is live; the seven old prompt logs swept here as `*.main-checkout.jsonl` and the main checkout left clean · https://github.com/Zugzwang-world/graphpay/pull/27
- 03:40 IST · records · usage 76% (about 3.75 points an hour, would run out around 10:00): T1, T3, Join and T6 stepped from xhigh to high; extra usage asked again · https://github.com/Zugzwang-world/graphpay/pull/29
- 03:50 IST · records · ADR-0061: Swarm public content (the menu) through the gateway; refund evidence encrypted client-side, last and first to cut · https://github.com/Zugzwang-world/graphpay/pull/32
- 04:45 IST · records · M14 relay: first real payment, the first acceptance report, ADR-0062 (92% pause), wallets §2b, the README payment link, T5's secrets set in Vercel · https://github.com/Zugzwang-world/graphpay/pull/49
- 05:15 IST · records · CP4 met: M11 and M12 done on the real networks, acceptance at 31 pass, 0 fail, 1 blocked; CP4 relay · https://github.com/Zugzwang-world/graphpay/pull/61
- 06:55 IST · records · 06:45 relay: M4 and M16 done, acceptance at 42 pass, 0 fail; LOG rolled up; OPEN's closed M0 tables condensed · https://github.com/Zugzwang-world/graphpay/pull/68
- 08:30 IST · records · morning relay: 42 pass, 0 fail; usage 82%; the story brief, a message to wake the sessions, and the budget call are the founder's · https://github.com/Zugzwang-world/graphpay/pull/69

## submission
