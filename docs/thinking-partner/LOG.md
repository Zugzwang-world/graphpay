# LOG

One line per PR: time (IST) · activity · result · PR link. Append under your own activity's heading only. Main (M14) alone rolls older lines into a dated summary at the top and keeps the last 60.

## foundation

- 21:47 IST · foundation · repo created; the pack committed as `planning/` (direct to `main`, before branch protection, as M0 requires) · https://github.com/Zugzwang-world/graphpay/commit/847f96a
- 21:56 IST · foundation · bootstrap: deny rules, prompt-log hook, CLAUDE.md, agents, skills, this folder (direct to `main`, before protection) · https://github.com/Zugzwang-world/graphpay/commit/6ccf3fd
- 21:59 IST · foundation · CI bootstrap: workspace, secret scan, placeholder contracts, CI; both jobs green, then protection on at 22:01 · https://github.com/Zugzwang-world/graphpay/commit/ffbc950
- 22:13 IST · foundation · merged by auto-merge: placeholder `apps/web` for the Vercel project · https://github.com/Zugzwang-world/graphpay/pull/1
- 22:22 IST · foundation · merged: `prepare` is a no-op outside git (fixes the first Vercel deploy) · https://github.com/Zugzwang-world/graphpay/pull/2
- 22:35 IST · foundation · opened: secret helpers, env loader and the one config file (reviewer pass 1 fixed; pass 2 running) · https://github.com/Zugzwang-world/graphpay/pull/3
- 22:36 IST · foundation · opened: funding script (used for 29 transfers; reviewer pass running) · https://github.com/Zugzwang-world/graphpay/pull/4
- 22:45 IST · foundation · records: facts, wallets, plan, amendments, acceptance additions, ADRs, AI usage, README, the A7 check · https://github.com/Zugzwang-world/graphpay/pull/5
- 22:50 IST · foundation · Vercel: ignored-build step set (docs-only commits skip); W_DIRECTORY topped up to 0.5 tGLM; Ankr URL verified (chain 1874); presets probed (all accepted, $0.0012) · no PR (settings and chain); recorded in PR #5
- 23:05 IST · foundation · records: ADR-0047 to ADR-0056 (story config, presets, big-city hold, Mumbai, tracks, wording, timeline and cut order, stand-in retired, HTTPS polling, mirror keep-awake), the two briefs, NOW and OPEN · https://github.com/Zugzwang-world/graphpay/pull/5
- 23:25 IST · foundation · coverage table, story-inputs digest, acceptance A10, D15, E8, session lines for an unattended night (six sessions, efforts, founder moments) · https://github.com/Zugzwang-world/graphpay/pull/5
- 23:16 IST · foundation · merged: secret helpers and the config package (three reviewer passes; the lock made atomic) · https://github.com/Zugzwang-world/graphpay/pull/3
- 23:37 IST · foundation · merged: funding script (two reviewer passes; no double top-up, identity checks, explicit chain) · https://github.com/Zugzwang-world/graphpay/pull/4
- 23:53 IST · foundation · merged: the one story config, agent presets, story rule, preset probe, Vercel env helper · https://github.com/Zugzwang-world/graphpay/pull/6
- 23:55 IST · foundation · handover: one run file per session, the index, the Coordinator file with the handover state, NOW and OPEN · https://github.com/Zugzwang-world/graphpay/pull/7

## payments

- 01:55 IST · payments · M1 contract and 88 fork tests on the real test USDT and Permit2; two reviewer passes: ship; auto-merge after the contracts job · https://github.com/Zugzwang-world/graphpay/pull/12
- 01:51 IST · payments · merged: M1 checkout contract and 90 fork tests (M1 done) · https://github.com/Zugzwang-world/graphpay/pull/12
- 01:58 IST · payments · M2 on the real chain (deploy 01:54, setup 01:57): USDT checkout deployed, verified, set up; scripts and records PR · pay/deploy
- 01:59 IST · payments · merged: USDT checkout deployed, verified and set up on Whitechain Sepolia (M2 done) · https://github.com/Zugzwang-world/graphpay/pull/15
- 04:05 IST · payments · M3 part A: facilitator pipeline, shop 402 API, recorder; 77 offline tests and a fork e2e on the real contract and test USDT; reviewer pass 2: ship · https://github.com/Zugzwang-world/graphpay/pull/42
- 04:06 IST · payments · merged: M3 part A, the facilitator, the shop 402 API and the recorder · https://github.com/Zugzwang-world/graphpay/pull/42
- 04:20 IST · payments · M3 part B on the real chain: C7 paid once as acceptance.vitalik, the lifecycle as rehearsal.vitalik, the subscription renewed and cancelled; reviewer: ship · https://github.com/Zugzwang-world/graphpay/pull/45

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

## agentpay
- 04:05 IST · agentpay · opened: `@graphpay/agentpay` V1, the two-sided SDK (buyer pass and guards, merchant middleware, facilitator interface and reference relayer, AI SDK and MCP tools, the sweet shop and ride examples), 36 offline and 13 fork tests, reviewer's 2 blocking fixed · https://github.com/Zugzwang-world/graphpay/pull/38
- 04:10 IST · agentpay · opened: the first real test payment through the SDK (0.01 test USDT, rehearsal agent → good shop, https://explorer.testnet.whitechain.io/tx/0xfbd7d307b1b0c08f3af015b4bdb03aaeed12d0c2d18c2553432cb4679ff14c7e), its script and tx log · https://github.com/Zugzwang-world/graphpay/pull/41 (merged)
- 04:20 IST · agentpay · opened: A4, the SDK merchant settling through T1's facilitator on a fork (in process and over HTTP; bad token and a gate refusal send nothing), 4 fork tests · (link once merged)

## records

- 01:20 IST · records · the Coordinator took over at 00:46 (10-minute ticks, keep-awake); ADR-0057 (the graph SDK, npm on Friday) and Friday item 18; T3 briefed; M0's background tasks checked (none failed); usage risk raised and the six track sessions switched to the planned models at 01:22; first M14 relay · https://github.com/Zugzwang-world/graphpay/pull/9
- 03:10 IST · records · records after the 02:14–03:01 sleep: four milestones merged (M7a, M1, M10, M2), power and lid first in "Founder now", usage 74%, fresh starts under way · https://github.com/Zugzwang-world/graphpay/pull/19
- 03:20 IST · records · after the sleep: no session hung; T3 and T5 fresh; the main checkout fast-forwarded (M0's failed step); the prompt-log hook writes to the session's own checkout (P-records-1, reviewer: ship) · https://github.com/Zugzwang-world/graphpay/pull/24
- 03:30 IST · records · the main checkout fast-forwarded to #24, so the fixed hook is live; the seven old prompt logs swept here as `*.main-checkout.jsonl` and the main checkout left clean · https://github.com/Zugzwang-world/graphpay/pull/27
- 03:40 IST · records · usage 76% (about 3.75 points an hour, would run out around 10:00): T1, T3, Join and T6 stepped from xhigh to high; extra usage asked again · https://github.com/Zugzwang-world/graphpay/pull/29
- 03:50 IST · records · ADR-0061: Swarm public content (the menu) through the gateway; refund evidence encrypted client-side, last and first to cut · https://github.com/Zugzwang-world/graphpay/pull/32

## submission
