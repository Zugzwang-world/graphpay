# LOG

One line per PR: time (IST) · activity · result · PR link. Append under your own activity's heading only. Main (M14) alone rolls older lines into a dated summary at the top and keeps the last 60.

**Rolled up 06:55 IST (Coordinator), the 15 oldest lines:** M0, Thu 21:47–23:55 IST (PRs #1–#7): the repo, CI, secret helpers, the funding script, the story config, the handover. The full history is in `git log` and the merged PRs.

**Rolled up 11:15 IST (Coordinator), the 28 lines before Fri 04:00 IST:** payments: M1, the checkout contract and its fork tests (#12); M2, the USDT checkout deployed and set up on Whitechain Sepolia (#15). identity: M5, the ENS package and the namespace on Sepolia (#18); M6 part 1, the gate and the owner actions (#34). arkiv: M7a, the SDK and the money graph (#14); M8, size S seeded, and M7b, the engine, GraphQL and the MCP routes (#21); fixes #25 and #30; M9 at S with D6 passing (#31); the activity rows (#35). agents: M10 (#11); the presence and hand-off hooks (#16). integration: the mirror core, the workers process and the mirror live on Rabdi (#8, #20, #33). website: the shell, the phone views, the run route, the order stream and CSV, the order trail (#10, #13, #17, #23, #26). records: the first Coordinator's start, the recovery after the sleep, the prompt-log hook fix and sweep, the usage step-down, ADR-0061 (#19, #24, #27, #29, #32).

## foundation

## payments

- 04:05 IST · payments · M3 part A: facilitator pipeline, shop 402 API, recorder; 77 offline tests and a fork e2e on the real contract and test USDT; reviewer pass 2: ship · https://github.com/Zugzwang-world/graphpay/pull/42
- 04:06 IST · payments · merged: M3 part A, the facilitator, the shop 402 API and the recorder · https://github.com/Zugzwang-world/graphpay/pull/42
- 04:20 IST · payments · M3 part B on the real chain: C7 paid once as acceptance.vitalik, the lifecycle as rehearsal.vitalik, the subscription renewed and cancelled; reviewer: ship · https://github.com/Zugzwang-world/graphpay/pull/45
- 04:40 IST · payments · M4 dependencies: apps/web depends on the facilitator and shop packages · https://github.com/Zugzwang-world/graphpay/pull/53
- 05:05 IST · payments · M4 hosted routes: shop, facilitator, recorder, renewal cron; vercel-env (14 Sensitive values set) and pay:public; two reviews fixed · https://github.com/Zugzwang-world/graphpay/pull/58
- 05:05 IST · payments · merged: M4 part 1, the hosted routes · https://github.com/Zugzwang-world/graphpay/pull/58
- 05:11 IST · payments · M4 live: pay:public settled 0.40 through the public URL, C6 401s, recorder edge, cron renewal (M4 done) · https://github.com/Zugzwang-world/graphpay/pull/62
- 09:47 IST · payments · F3: relayer floor enforced on the production build (refused as relayer_floor, nothing sent) · https://github.com/Zugzwang-world/graphpay/pull/78
- 10:56 IST · payments · the hosted shop retries an uncertain W_DIRECTORY quote write (nonce clashes across instances), within 45 s; reviewer: ship · pay/quote-retry

## identity
- 04:25 IST · identity · M6 done: the ENS watcher library and policy sink (reviewed twice), B8's MCP call in the acceptance script · [PR #40](https://github.com/Zugzwang-world/graphpay/pull/40)
- 05:00 IST · identity · B7: fork test for the epoch on re-registration (after a lapse and after an unregister: e + 1); fork tests moved to disposable-2/3; B9 (a) payee comparison in the acceptance script, passes for the settled shop · [PR #83](https://github.com/Zugzwang-world/graphpay/pull/83), [PR #84](https://github.com/Zugzwang-world/graphpay/pull/84)

## arkiv

- 09:50 IST · arkiv · SDK publish prep: renamed to @graphpay_ethglobal/arkiv-graph, 0.1.0, connect/createStore, README quickstart, leaderboard, CHANGELOG, FEEDBACK, MIT; pack, install and run pass · https://github.com/Zugzwang-world/graphpay/pull/97
- 09:45 IST · arkiv · Friday item 15: drafts of `arkiv/friction.md`, `how-you-use-arkiv.md`, `swarm.md` · https://github.com/Zugzwang-world/graphpay/pull/77 (merged)
- 09:55 IST · arkiv · Friday items 4–5 (menu): Swarm gateway probe, `menu` entity, 3 cast menus on Swarm and Arkiv, verified; `swarm.md` filled in · https://github.com/Zugzwang-world/graphpay/pull/82
- 11:05 IST · arkiv · fix: the writer no longer adopts another instance of the same key's transaction at our nonce (T1's finding); reviewer pass · https://github.com/Zugzwang-world/graphpay/pull/97

## agents


## integration

- 04:10 IST · integration · opened: the ENS gate on the payer's signing path (M12) and batched live presence and hand-off hooks (Friday item 3) · https://github.com/Zugzwang-world/graphpay/pull/37
- 04:30 IST · integration · opened: T2's watcher hosted in the workers; the first ACCEPTANCE_REPORT (18 pass, 0 fail, 1 blocked, 29 not run; D1 and D3 pass on the real payments) · https://github.com/Zugzwang-world/graphpay/pull/46
- 05:10 IST · integration · merged: the buyer_risk fix and `pnpm e2e:food` (M12) · https://github.com/Zugzwang-world/graphpay/pull/48
- 04:55 IST · integration · opened: the counting e2e:food run passed A–E on the real networks (paid 4.80, delivered, refunded 0.80); the signer fix; the report at 24 pass · https://github.com/Zugzwang-world/graphpay/pull/52
- 05:00 IST · integration · opened: the kill check F passes for real (402 after 9.3 s, the watcher revoked the policy, the fail edge on Arkiv); the recorder ref fix; (M12 done) · https://github.com/Zugzwang-world/graphpay/pull/56
- 05:15 IST · integration · opened: acceptance A5, C7, E3 pass (the qualifying USDT payment read from its receipt); the report at 29 pass, 0 fail, 1 blocked · https://github.com/Zugzwang-world/graphpay/pull/57
- 05:10 IST · integration · opened: D2b, D2c and D15 pass live (a frozen mirror, a raced nonce, a crash after send); the report at 31 pass (M11 done) · https://github.com/Zugzwang-world/graphpay/pull/60
- 05:33 IST · integration · opened: M13's hosted run passes C2, C3, C5, C6, F2 and C4(b) on the production domain (4.80 paid, 0.80 refunded, 1.20 re-order, over-cap refused); A3, A4, A9, A10, B3 wired; the report at 41 pass, 0 fail · https://github.com/Zugzwang-world/graphpay/pull/66
- 05:41 IST · integration · opened: C4(a) passes (the scout agent revoked, refused on-chain AGENT_REVOKED, restored exactly; the mirror's fail edge once after a paused restart); the report at 42 pass, 0 fail; then F1 (no secrets in the tree, the history of every branch or Vercel), 43 pass · https://github.com/Zugzwang-world/graphpay/pull/67
- 09:47 IST · integration · opened: D10 passes (the hosted shop's quote on Arkiv: owner W_DIRECTORY, 15 minutes, valid_until 10 minutes); the report at 44 pass, 0 fail, 1 blocked, 3 not run (M13 done); then F3 from T1's record, 45 pass · https://github.com/Zugzwang-world/graphpay/pull/79
- 10:36 IST · integration · opened: the e2e stack on the hosted shop and facilitator; D11's presence half passes (6.7 s to appear, lapsed 14.98 min after the end, owner W_DIRECTORY) · https://github.com/Zugzwang-world/graphpay/pull/85

## website

- 04:20 IST · website · opened: race mode live (Friday item 8): `/api/race` runs one side on Rabdi with per-read ticks and truth badges, the committed benchmark table under it · https://github.com/Zugzwang-world/graphpay/pull/36 (merged)
- 05:05 IST · website · opened: the Open toggle (Friday item 9): `POST /api/merchant/open` writes the shop's `shop_open` row as W_DIRECTORY, renewed every 5 minutes by the merchant phone; reviewer pass · https://github.com/Zugzwang-world/graphpay/pull/39
- 05:50 IST · website · opened: the customer's Pause and Resume buttons (M6): the owner wallet sets `graphpay.status` of the payer agent on Sepolia, behind the passcode; reviewer pass · https://github.com/Zugzwang-world/graphpay/pull/43
- 06:05 IST · website · opened: the customer phone's live state (`/api/state/customer`: status from ENS and the AgentPolicy, cap and spend from the checkout contract, last order from the graph) and the checkout address fix · https://github.com/Zugzwang-world/graphpay/pull/44
- 07:10 IST · website · opened: M16 the checkout kit and the demo store (a shop in 17 lines, a person pays from a browser wallet, merchant view, chain-based accountant export), two reviewer passes, a bundler-safe ABI import in contracts · https://github.com/Zugzwang-world/graphpay/pull/51
- 07:55 IST · website · opened: the Mumbai map (Friday item 10): our own SVG of the neighbourhoods, directory dots, open shops and agents glowing, explorer links · https://github.com/Zugzwang-world/graphpay/pull/54
- 08:20 IST · website · opened: the explainer's agent lanes (Friday item 13) from the handoff rows, and the run id passed to the errand runner · https://github.com/Zugzwang-world/graphpay/pull/55
- 05:40 IST · website · opened: M16 proof, one real 4.80 USDT kit payment on the hosted facilitator (tx 0xf1e76a91…), the store's facilitator env name, the export's RPC range cap logged · https://github.com/Zugzwang-world/graphpay/pull/63
- 06:10 IST · website · opened: the merchant phone's Mark dispatched and Refund (Friday item 12), signed with the shop's key behind the passcode, reviewer pass · https://github.com/Zugzwang-world/graphpay/pull/65
- 09:50 IST · website · opened: the customer phone's Request refund (Friday item 11): a request edge on Arkiv from the recorder's key behind the passcode, reviewer pass; the website relay trimmed to about 700 words · https://github.com/Zugzwang-world/graphpay/pull/73
- 10:50 IST · website · opened: the customer phone's Re-order (Friday item 11): the payer agent's one signed payment through the hosted shop behind the passcode, reviewer pass (three double-payment findings fixed) · https://github.com/Zugzwang-world/graphpay/pull/81

## agentpay
- 04:05 IST · agentpay · opened: `@graphpay/agentpay` V1, the two-sided SDK (buyer pass and guards, merchant middleware, facilitator interface and reference relayer, AI SDK and MCP tools, the sweet shop and ride examples), 36 offline and 13 fork tests, reviewer's 2 blocking fixed · https://github.com/Zugzwang-world/graphpay/pull/38
- 04:10 IST · agentpay · opened: the first real test payment through the SDK (0.01 test USDT, rehearsal agent → good shop, https://explorer.testnet.whitechain.io/tx/0xfbd7d307b1b0c08f3af015b4bdb03aaeed12d0c2d18c2553432cb4679ff14c7e), its script and tx log · https://github.com/Zugzwang-world/graphpay/pull/41 (merged)
- 04:20 IST · agentpay · opened: A4, the SDK merchant settling through T1's facilitator on a fork (in process and over HTTP; bad token and a gate refusal send nothing), 4 fork tests; the CSV's cached-head fix · https://github.com/Zugzwang-world/graphpay/pull/47 (merged)
- 05:30 IST · agentpay · opened: the merchant's log reads fit the public RPCs' block-range caps (10,000, then 1,000 on a refusal; T5's report), checked on the real chain; fork tests write test USDT on the fork instead of drawing on FUNDER · https://github.com/Zugzwang-world/graphpay/pull/64
- 09:50 IST · agentpay · opened: `@graphpay_ethglobal/agentpay` 0.1.0 ready to publish (renamed, self-contained, chain 1874 only, own relayer with anti-drain limits on, sandbox and `deployCheckout`, sweet shop and cab examples, MIT, lane test; packed, installed in an empty folder, quickstart passes) · https://github.com/Zugzwang-world/graphpay/pull/80

## records

- 04:45 IST · records · M14 relay: first real payment, the first acceptance report, ADR-0062 (92% pause), wallets §2b, the README payment link, T5's secrets set in Vercel · https://github.com/Zugzwang-world/graphpay/pull/49
- 05:15 IST · records · CP4 met: M11 and M12 done on the real networks, acceptance at 31 pass, 0 fail, 1 blocked; CP4 relay · https://github.com/Zugzwang-world/graphpay/pull/61
- 06:55 IST · records · 06:45 relay: M4 and M16 done, acceptance at 42 pass, 0 fail; LOG rolled up; OPEN's closed M0 tables condensed · https://github.com/Zugzwang-world/graphpay/pull/68
- 08:30 IST · records · morning relay: 42 pass, 0 fail; usage 82%; the story brief, a message to wake the sessions, and the budget call are the founder's · https://github.com/Zugzwang-world/graphpay/pull/69
- 09:35 IST · records · the 09:35 brief filed; ADR-0063 (both SDKs as @graphpay_ethglobal by 13:00), ADR-0064 (one SDK per lane, the cab-ride moment), ADR-0065 (apps/demo-ui); labels and issue templates; the names renamed in the records; NOW and Founder now for the handoff · https://github.com/Zugzwang-world/graphpay/pull/72
- 09:46 IST · records · the standing rule "no target times" (ADR-0066) in the coordinator file, NOW, OPEN and the master plan; every session told · https://github.com/Zugzwang-world/graphpay/pull/76
- 10:25 IST · records · Kimi secret: KIMI_API_KEY server-only, a Kimi rule in the secret scan, JSON-escaped keys caught, a non-Kimi value refused; reviewer: ship · https://github.com/Zugzwang-world/graphpay/pull/89
- 10:50 IST · records · handover: arkiv-graph 0.1.0 and agentpay 0.1.0 on npm (registry quickstarts pass; FACTS, README, Arkiv file); Kimi key stored and on Vercel; ADR-0068 (the team's site, the server-side runner); the Coordinator's resume file · coord/handover
- 11:15 IST · records · the new Coordinator took over (tick, keep-awake, every session told); ADR-0062 amended (95%: no new real payment, merge or publish, resumes written; 97%: pause); #93 conflict resolved and merged; arkiv-graph 0.1.1 checked for publish; LOG rolled up before 04:00 · https://github.com/Zugzwang-world/graphpay/pull/101

## submission
