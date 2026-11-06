# OPEN

The founder's to-dos and open questions. Each item says what, where, why and what we recommend. "Founder now" is kept by the Coordinator; every session keeps its own section below.

## Founder now (Coordinator only)

Updated 23:10 IST, Fri 6 Nov (night Coordinator). **Only the submission (Sat 09:00 IST) and the presentation (09:30 IST) are fixed** (ADR-0066). The full status is in `TRACKER.md`; tonight's seven streams are in NOW.

0. **Plug in the charger now.** The Mac is on battery (75% at 22:59 IST, about 4 h 20 min left). It runs the mirror and all eight night sessions. Keep the lid open until the presentation.
1. **The Arkiv key's quota is used up.** Reads fall back to the keyless endpoint (#148), which is slower.
   - Ask the Arkiv team to reset the quota or give us a new key.
   - With a new key, run `pnpm -s secrets:set ARKIV_ACCESS_KEY` in the main checkout. The Coordinator pushes it to Vercel, and W5 restarts the mirror.
2. **Funding:** the test USDT you are sending to FUNDER, and the Kimi top-up (anyone can run an errand, at up to $3.55 each). The Coordinator tells you early if WBT, Sepolia ETH or tGLM run low.
3. **npm's web approval** when W6 asks for it (it lasts about 5 minutes), to publish both SDKs at 1.0.0.
4. **The video,** in your own voice (the event's rule), once tonight's streams have landed.
5. **ETHGlobal:**
   - send the written pre-event disclosure, if you haven't (`docs/plan/DISCLOSURE_MESSAGE.md`);
   - confirm that every team member is registered.
6. **Submit by 08:00 IST** from W7's `docs/submission/ETHGLOBAL.md`; the form closes at 09:00.

**Closed tonight:**
- the payer resumed at 23:00 IST, and Filter & Fold open again;
- the demo scope: the night brief decides it (the new shops on chain, the big city, caps, the kill, subscriptions);
- the Submission session: W7 replaces it;
- a fresh Coordinator took over at 22:59 IST.

**Closed today:**
- both SDKs at 0.1.1;
- #70 and #132 merged, credited to ajatshatru01;
- the integration phases 1 to 4;
- public access;
- the payer's pass at 100;
- every stage button proven live;
- the story on screen;
- the deck as the stage;
- the CLAUDE.md model line;
- the Arkiv read outage (#148).

## Funding (the Coordinator)

Current balances and every transfer are in `docs/technical/WALLETS.md` (§2 for M0, §2b for the event top-ups). FUNDER after the 05:1x runs: about 2.59 WBT, 0.275 Sepolia ETH, 15.08 tGLM, 15.54 test USDT. Every role is at its plan target. W_SEED_M_EVENT holds 8.5 tGLM for the large city.

## Preset calibration (seconds and API cost per full errand; every test run adds a row)

Agents (T4) and Join add one row per full errand run, so the presets can be calibrated on Friday (ADR-0048). Cost comes from `apiCostUsd` and the prices in the config.

| time (IST) | run | preset | model, effort | seconds per errand | API cost per errand | notes |
|---|---|---|---|---|---|---|
| 22:54 | M0 probe (one-word reply, not an errand) | testing | `claude-opus-5-5`, xhigh | 2.2 | $0.0005 | accepted |
| 22:54 | M0 probe (one-word reply, not an errand) | video | `claude-opus-5-5`, xhigh | 1.6 | $0.0006 | accepted |
| 22:54 | M0 probe (one word, then three short turns) | live | `claude-haiku-5-5`, xhigh | 0.9; turns 0.9 / 0.9 / 1.9 | under $0.0002 in all | accepted; no empty reply, no `max_tokens`; once the same answer in two text blocks (read the final block) |
| 01:29 | T4 M10 live run 1 (mock services) | testing | `claude-opus-5-5`, xhigh | 94.1 | $0.2857 | paid the good shop; 19 calls, 47,456 tokens; risk reply over the strict schema |
| 01:31 | T4 M10 live run 2 | testing | `claude-opus-5-5`, xhigh | 73.2 | $0.3050 | paid the good shop; 20 calls, 51,639 tokens |
| 01:33 | T4 M10 live run 3 | testing | `claude-opus-5-5`, xhigh | 85.1 | $0.3049 | paid the good shop; 20 calls, 50,916 tokens |
| 01:34 | T4 M10 live run 4 | testing | `claude-opus-5-5`, xhigh | 139.5 | $0.2903 | paid the good shop; 19 calls, 46,989 tokens |
| 01:36 | T4 M10 live run 5 | testing | `claude-opus-5-5`, xhigh | 321.0 | $0.2965 | paid the good shop; 19 calls, 47,287 tokens; one slow model call (range 73 to 321 s) |
| 04:32 | Join e2e:food real, rehearsal (live hooks, real shop) | testing | `claude-opus-5-5`, xhigh | 56.5 | $0.2289 | refused by kesar's risk check: the MCP's buyer_risk table bug (fixed, PR 48) and rehearsal's real 1/6 cancel rate (correct by policy) |
| 04:40 | Join e2e:food real, payer | testing | `claude-opus-5-5`, xhigh | 88.8 | $0.2623 | approved by the shop; the signer answered a headers object, so nothing was signed (fixed) |
| 04:43 | Join e2e:food real, payer (the counting run) | testing | `claude-opus-5-5`, xhigh | 122.1 | $0.2986 | **paid** 4.80 on Whitechain, delivered, refunded 0.80; A–E pass |
| 10:41–10:42 | Join live runner on the production site (`/api/agents/run`), three runs, payer | live | `kimi-k3.1-pro-highspeed`, high | 11.9, 9.4, 7.6 | ≤ $0.025 each (1,225 and 1,187 tokens; the server's `apiCostUsd` line is in the Vercel log, not read here) | no-purchase: the concierge answered ("I'll find the best gulab jamun options…") and stopped without delegating to the scout and analyst; nothing signed |
| 10:31 | T4 Kimi run 0 (mock services, before the fix) | testing | `kimi-k3.1-pro`, high | 6.4 | $0.0042 | **no purchase**: with a `response_format` Kimi answered the JSON at once and called no tool (1 call); fixed in PR 92 by putting the schema in the instructions |
| 10:32 | T4 Kimi run 1 (mock services, after the fix) | testing | `kimi-k3.1-pro`, high | 123.4 | $0.0687 | paid the good shop; 18 calls, 26,452 tokens |
| 10:34 | T4 Kimi calibration 1 (mock services) | testing | `kimi-k3.1-pro`, high | 149.7 | $0.0661 | paid the good shop; 19 calls, 28,764 tokens |
| 10:37 | T4 Kimi calibration 2 | testing | `kimi-k3.1-pro`, high | 126.7 | $0.0586 | paid the good shop; 19 calls, 27,804 tokens |
| 10:39 | T4 Kimi calibration 3 | testing | `kimi-k3.1-pro`, high | 155.4 | $0.0664 | paid the good shop; 19 calls, 28,697 tokens |
| 10:41 | T4 Kimi calibration 1 (mock services) | video | `kimi-k3.1-pro-highspeed`, high | 70.0 | $0.1423 | paid the good shop; 19 calls, 28,706 tokens |
| 10:42 | T4 Kimi calibration 2 | video | `kimi-k3.1-pro-highspeed`, high | 56.0 | $0.1091 | paid the good shop; 19 calls, 27,189 tokens |
| 10:43 | T4 Kimi calibration 3 | video | `kimi-k3.1-pro-highspeed`, high | 57.2 | $0.1145 | paid the good shop; 19 calls, 27,850 tokens |
| 10:44 | T4 Kimi calibration 1 (mock services) | live | `kimi-k3.1-pro-highspeed`, high | 58.3 | $0.1139 | paid the good shop; 19 calls, 27,448 tokens |
| 10:45 | T4 Kimi calibration 2 | live | `kimi-k3.1-pro-highspeed`, high | 60.3 | $0.1210 | paid the good shop; 19 calls, 28,304 tokens |
| 10:46 | T4 Kimi calibration 3 | live | `kimi-k3.1-pro-highspeed`, high | 64.5 | $0.1249 | paid the good shop; 19 calls, 28,281 tokens; highspeed is about 2.2 times faster than pro and about 1.9 times the cost; Opus 5.5 xhigh was 73 to 321 s at about $0.30 |
| 10:47 | Join live runner on the production site, payer (after T4's Kimi fix, PR 92) | live | `kimi-k3.1-pro-highspeed`, high | 85.0 | not read (the server's `apiCostUsd` line is in the Vercel log) | refused before signing: the team ranked and chose kesar (0.913), the risk agent approved the payer, then the hosted shop's 402 step answered "quote write failed" (W_DIRECTORY; most likely a clash with this run's presence batches, now held around the 402 step, PR 93); 6 agents, 16 tool calls |
| 11:08 | Join live runner on the production site, payer (after PR 93's hold) | live | `kimi-k3.1-pro-highspeed`, high | 95.7 | not read (server log) | unsettled: every check passed and the payer signed 4.80, then the hosted facilitator's settle send threw (ContractFunctionExecutionError, T1's log); order NONE, relayer nonce unchanged, nothing sent |
| 11:11 | Join live runner on the production site, payer (retry) | live | `kimi-k3.1-pro-highspeed`, high | 171.2 | 177,690 tokens: between $0.71 (all input) and $3.55 (all output) at the config's prices, less with cache reads; the exact `apiCostUsd` is in the server log | **paid** 4.80 to kesar on Whitechain, the first live errand through the site: https://explorer.testnet.whitechain.io/tx/0x8617754857a8eb1fb1483b4f18fb6fa6a4f1607241d3f08c7ccd062de1b8863a ; 7 agents, 19 tool calls |
| 13:28 | Join live runner on the production site, payer (after #108, #112 and T1's settle-safety #114) | live | `kimi-k3.1-pro-highspeed`, high | 128.9 | 32,584 tokens: $0.13–$0.65 at the config's prices (exact `apiCostUsd` in the server log) | **paid** 4.80 to kesar: https://explorer.testnet.whitechain.io/tx/0x9749a7f766282021a4e0e255276b938e53c608f55985a68b4b59b08d852a1e1a ; 7 agents, 16 tool calls, no retry |
| 13:30 | Join live runner on the production site, payer (the second of the founder's two) | live | `kimi-k3.1-pro-highspeed`, high | 115.1 | 28,712 tokens: $0.11–$0.57 | **paid** 4.80 to kesar: https://explorer.testnet.whitechain.io/tx/0x11588a5e47611c1e9095219ab95b8907d8b0f59a602f56d8b12d11a16cfa0a13 ; 7 agents, 15 tool calls, no retry |
| 23:30 | W4 baseline: one live errand on the production site (`scripts/agents/site-errand.mjs`), payer | live | `kimi-k3.1-pro-highspeed`, high (every role) | 91.4 | $0.1455 (the sum of the agents' own call costs) | **paid** 4.80 to kesar: https://explorer.testnet.whitechain.io/tx/0xeac35d0ad3cfd0ed77f51bfd76974b545b973d1be69e13b1edb535d48e76abe6 ; 19 calls, 33,287 tokens (29,050 in, 14,592 of them cached; 4,237 out, 2,187 reasoning); 62.6 s of model time; per call in `docs/sessions/w4-agents/runs/` |
| 23:45 | W4 code mode on mock services (`AGENT_MODE=live AGENT_PRESET=live pnpm agents:errand --runs 2`), before the analyst went to low | live | `kimi-k3.1-pro-highspeed`, concierge and analyst high, risk low; scout, payer, storefront and dispatch in code | 18.2, 27.4 | $0.0359, $0.0530 | paid the good shop, the concierge's own choice; 3 calls, 3,352 and 4,396 tokens; nothing paid on chain (mocks) |
| 23:47 | W4 code mode on mock services, the analyst at low | live | `kimi-k3.1-pro-highspeed`, concierge high, analyst and risk low; the rest in code | 13.8, 14.3 | $0.0267, $0.0271 | paid the good shop, the concierge's own choice; 3 calls, 2,927 and 3,043 tokens; nothing paid on chain (mocks) |
| 23:49 | W4 first cut (#162) live on the production site, payer | live | `kimi-k3.1-pro-highspeed`, concierge and analyst high, the rest low | 87.6 | $0.1435 | **paid** 4.80 to kesar: https://explorer.testnet.whitechain.io/tx/0xd4fd98b7e85fb5af7cd661fb58bac2d6fd89b5fd467f476a81eca363bff69d2f ; 19 calls, 33,346 tokens (29,251 in, 14,592 cached; 4,095 out, 2,098 reasoning); only 4% faster than the baseline: each call costs 1.5 to 4 s even at low, so the number of calls is what counts |
| 00:10 | W4 code mode live, before merging: Join's live runner run locally with this branch's agents, over the production shop, facilitator, ENS and Arkiv | live | `kimi-k3.1-pro-highspeed`, concierge high, analyst and risk low; the rest in code | 57.3 (the runner's own clock) | $0.0358 | **refused before signing, correctly:** the payer was PAUSED again (`ENS_PAUSED` at the gate); scout, analyst, risk, storefront, quote and 402 all ran; 3 calls, 3,282 tokens; the analyst's one call took 20.5 s for 608 tokens (its answers are now kept short) |
| 00:11 | W4 code mode on mock services, short answers | live | the same | 15.6, 11.7 | $0.0266, $0.0227 | paid the good shop, the concierge's own choice; 3 calls, 2,887 and 2,839 tokens |
| 00:14 | W4 code mode live, local runner (as at 00:10) | live | the same | 22.0 | $0.0265 | refused at G8, the shop's re-check before the 402: the buyer-standing read failed (`fetch failed`), so the guard failed closed; now a read that throws is tried once more |
| 00:15 | W4 code mode live, local runner, after that fix | live | the same | 55.2 | $0.0247 | **paid** 4.80 to kesar: https://explorer.testnet.whitechain.io/tx/0xfe0a4327fb7dca69d7363f05c73a8cc15b486b57184fc2f1e72c6812785070d5 ; 3 calls, 2,886 tokens (1,884 in, 768 cached; 1,002 out, 605 reasoning); 13.6 s of model time; the payer's 41.7 s is the quote, the 402, the checks, the signature and the settlement |

## Kickoff rules and booth questions (closed; rolled up 06:55 IST)

The kickoff rules (the deadline Sat 09:00 IST; AI use documented; spec files in the repo; pre-event work disclosed in writing; the video in the founder's own voice) are in `planning/` and ADR-0028. The organiser said "go all out, use AI the best you can", and we keep full AI disclosure (ADR-0028). Every booth question is closed with the founder's defaults (ADR-0038 to ADR-0044). Prize tracks: ADR-0051; Swarm: ADR-0039 and ADR-0061.

## foundation

- Nothing open. M0 retired Thu 23:58 IST.
- Closed today: nothing (M0 closed Thursday, #1 to #7).

## payments

- **Subscribe and cancel** (owner: T1). The hosted shop and facilitator have no subscription endpoints, so both phone buttons say "not live yet". Next: build them, if the founder keeps subscriptions in the demo.
- **Run the next renewal** (owner: T1). It does nothing in live mode; the hosted cron renews due subscriptions by itself, on the 2-minute demo clock. Next: a route for the phone, with subscribe.
- **Decline refund** (owner: T1). "Not live yet" on the merchant phone. Next: build it if the demo shows it.
- **The cap actions** (owner: T1). The agent raising its own cap is "not live yet", and "Dosas for everyone" must be refused as over the pass. Next: build both on the real cap checks, if in scope.
- **The 0.80 coffee re-order** (owner: T1; ADR-0073). The re-order still re-buys the 4.80 combo. Next: the Coordinator adds `order.reorder.sku` (0.80) and its prompt text to `story.json`; the shop and the re-order route follow it.
- **The CI gate** (owner: Coordinator). The `contracts` job does not block a merge. Next: an aggregator `ci` job that fails unless every job passed; until then, merge contract PRs only on a green `contracts`.
- Closed today: M3 and M4 (#45, #62); F3, the relayer floor (#78); the quote retry (#96); the payer's cap at 100 on-chain (#107); the settle safety (#114); the merchant addresses (env default kept).

## identity

- **ENS names for the dosa shops** (owner: T2). Filter & Fold, Idli Index and Tawa Tangle, and their agents, still use the test cast's labels. Next: if the founder says yes, register the new names; the Coordinator updates `story.json`; then T3 moves the history.
- **The kill** (owner: T2, with the Coordinator). `/api/customer/kill-disposable` says "not live yet": it needs T2's provisioning and a funded disposable wallet (`disposable-1` is already killed). Next: if in scope, the Coordinator funds DISPOSABLE_2 (0.005 WBT and 1 test USDT, `pnpm funding`); T2 provisions it (`node scripts/ens/owner.mjs disposable --real`) and wires the route.
- Closed today: M6 and B8's MCP call (#40); the watcher in the workers (#46); B7 and B9 (a) (#83, #84); the payer's ENS cap at 100 (#106); the `ens_check` wording (the spec's, kept).

## arkiv

- **The dosa shops' history and category** (owner: T3). The history sits under the test cast's names, and the Arkiv category still says "sweets". Next: after T2's names, move the history and rename the category in the directory rows and graph nodes together; re-upload the Swarm menus (`pnpm -s --filter @graphpay/money-graph menus --execute`), and once more before the video.
- **The big city at size M** (owner: T3). It waits for the locked story (ADR-0049), and `story.json` still says `test`, unlocked. Next: the Coordinator locks it and sets `syntheticCity.reRegisteredShop.epoch` to 1; T3 seeds M, lifts the size guard and runs D7 (`node bench/run.mjs --size M --end <date>`).
- **The website's GraphQL asks** (owner: T3; default taken). `Shop` has no Arkiv entity `key`, and `Edge` no `entityKey` or `orderKind` (the map's links, three CSV columns). Next: add them if cheap; the demo works without them.
- Closed today: `Reputation.synthetic` (#30); the race's truth badges (#36); the activity rows, wired (#39, #88); menus and images on Swarm (#82, #109); the writer fix and 0.1.1 on npm (#97, #98, #103); `refund_evidence` dropped (#86); the Arkiv read outage (#148).

## agents

- Nothing open. T4 is idle; Kimi tuning only if asked.
- Closed today: the Kimi switch (#87, #92) and its calibration (#95); the checkout address in the config.

## integration

- **The mirror's new write** (owner: Join). The mirror restarted on #148 at 21:58 IST and caught up, with no new payment since. Next: once the payer is ACTIVE again, run one errand and check that its event reaches Arkiv.
- Closed today: the live runner, with the run id and hooks (#88); the reliable errand (#108, #112, #114, #119); no hourly cap (ADR-0069); C6 and F2 for public access (#120); M13, D10 and C4(a) (#66, #67, #79); the lid note (now in "Founder now").

## phones

- **The team's four asks** (owner: the team, through T5's review):
  - a receipt card for a paid re-order (receipts are drawn only for quotes);
  - `ShopChoice.repeatBuyers` optional (the live card shows a dash);
  - a "Sample data" chip for seeded orders;
  - hiding unbuilt buttons (an optional `supports` map the adapter fills), once the founder settles the demo scope.
- Closed today: the team's phones and controls (#70, #132); phases 1 to 4 (#111, #122, #124, #128); public access (#117); product photos (#140); the route labels (#120); the re-order's prompt text (moved to payments); the Open switch's cooldown (accepted).

## website

- **The read-limit ceiling** (owner: T5). ADR-0069's amendment says no ceilings, but the read limits raised in #113 still cap a runaway client. Next: remove or keep them, and record which in the ADR.
- **The deck's other slides** (owner: T5). The non-demo slides have not been checked one by one (ADR-0074). Next: check each on production.
- **The refund-reason table** (owner: T5, with T1). The contract only emits a `uint8`, and the merchant phone sends 1. Next: one table in `@graphpay/contracts` for the mirror, the export and the phones.
- **The demo store online** (owner: Coordinator, then T5). https://graphpay-store.vercel.app answers "deployment not found" (22:40 IST). Next: create the Vercel project `graphpay-store` from `apps/store`, and set the names it reads (`MERCHANT_ADDRESS`, `FACILITATOR_URL`, `FACILITATOR_AUTH_TOKEN`, `DEMO_PASSCODE`) by helper. Then T5 makes one browser-wallet purchase and checks its export row. Its Sunday box only if time allows.
- Closed today: Request refund and Refund, live (#73, #129); Re-order, live (#81, #131); the Open toggle; pause and resume; the feed's 50-edge stall and the CSV (#104); the keys `SHOP_KESAR`, `W_SYNC` and `PAYER` on Vercel; the kit's log reads (#64).

## agentpay

- **The README link to the demo app** (owner: T6; T3 for arkiv-graph). ADR-0076 says both package READMEs link to it; neither does yet. Next: add it in the repo; npm shows it only after a 0.1.2 (the founder's login), before the freeze.
- **Feedback** (owner: T6). No `agentpay` issue yet. Next: log each one in `packages/agentpay/FEEDBACK.md`.
- Closed today: 0.1.1 on npm (#99, #103); the labels and issue templates; A4 (#47); the log-range fix (#64); the examples' story values (kept in `story.json`); RENEWER's second use (in `WALLETS.md`); FUNDER's test USDT (topped up); the ride (stays on the fork).

## records

- **Keep the stage ready** (owner: Coordinator). Top up PAYER if it falls under about 25 test USDT; push a new Arkiv key to Vercel when the founder has one; the pre-flight (`planning/EVENT_RUNBOOK.md` §4) and a read-only acceptance run before 07:00 IST; freeze both SDK versions at submission.
- Closed today: the npm login and both publishes; prompt logs in each checkout (#24, #27); the 18 key names on Vercel; ADR-0072 to ADR-0076 and the handover.

## booth

- Nothing open. The dosa shops on chain moved to identity and arkiv, and the 0.80 re-order to payments.
- Closed today: the story on screen (#135); the deck as the stage (#136, #139); the stream recovery (#138); Grok's figurines and photos (#140); the 11:59 pm deadline (#142); the phones drive the deck (#143, #144).

## w7-submission

Updated 23:38 IST, Fri 6 Nov (W7 Submission).
- **Submit by 08:00 IST** (what: the title, the descriptions, the links and three partner prizes; where: [`docs/submission/ETHGLOBAL.md`](../submission/ETHGLOBAL.md), one block per form field; why: the form closes at 09:00 IST; recommendation: paste from the file after W7's final pass, and tick its "Before you press Submit" list).
- **The video** (what: 2 to 4 minutes in your own voice, every party shown, from the shot list [`docs/submission/VIDEO.md`](../submission/VIDEO.md); where: its link goes in the form's video field; why: Whitechain's qualification and ETHGlobal's rules; recommendation: record after the night streams land, with the payer active and the shop open).
- **Review the README and the partner files** (what: the "verify each claim" table, the persona note, the Team section, `arkiv/`, `WHITECHAIN_FEEDBACK.md`, `docs/submission/ENS.md`; why: judges open them first; recommendation: tell W7 any change before 07:00 IST).
- **The team list** (what: the README names `Zugzwang-world` and `ajatshatru01` by GitHub handle; why: no other member is recorded in the repo; recommendation: add names or anyone missing, and confirm each is on the ETHGlobal project).
- Closed: the README (#154), AI_USAGE.md and the Arkiv files (#159), the Whitechain and ENS notes (#161), the form text (#164); the shot list and the checklist (this PR).

## w3-payments

- **The owner's cap change goes live with W1's watcher** (owner: W3, with W1 and W5). What: `POST /api/customer/cap` (#179) writes the owner's ENS cap. The policy follows through the watcher on the Mac, never above the configured cap (ADR-0078). Why: until W1's watcher change is merged and W5 has restarted the workers, the route answers `policy.applied: false`. Recommendation: merge W1's PR, restart the workers, and W3 proves it once, 300 → 250 → 300.
- **The "everyone" quantity** (owner: founder; default taken). What: `order.overPass.quantity` is 100, a synthetic story value; the brief gives no headcount. Why: any figure above the pass is refused the same way. Recommendation: keep 100, or set the real headcount in `story.json`.
- Closed tonight:
  - the 0.80 re-order (#155);
  - subscribe, renew and cancel (#173);
  - the refund decline (#163);
  - over the pass and the refused cap raise (#169);
  - acceptance C3 on the re-order's own item (W5).

## w4-agents

- **Acceptance E1 reads the old clock deadline** (owner: the Coordinator, who regenerates acceptance). What: `acceptance/checks.mjs` E1 expects the run's deadline to contain `T23:59:00` (`order.deadlineLocal`); the request now says "delivered within an hour". Why: E1 would fail on every fresh run. Recommendation: expect the deadline one hour after the run's request, to the minute (`result.mandate.deadlineIso`); E1 needs a fresh `e2e:food` run anyway.

## w2-city

- **The flip waits for the restart that follows the history** (owner: the Coordinator, who times it; W5 restarts the workers). What, in order:
  1. W2's history for the new shops is complete (1,258 of 1,258 events);
  2. then W5 restarts the workers;
  3. then W1's flip merges.

  Why: a mirror that read the new shops' tallies part-way would plan their first live payment from stale counts and overwrite their totals (reviewer finding, ADR-0077). Recommendation: keep that order. A mirror started after the history is fine; W5's restart on W2's "done" is that restart.
- **W1's flip changes the labels and the category together** (owner: W1). What: in `packages/config/story.json`, set `shops[].label` to the final cast's labels by story role and every `shops[].category` to `south-indian`, in one PR:
  - good → `filter-and-fold`;
  - runner-up → `idli-index`;
  - trap → `tawa-tangle`.

  Why: the analyst ranks `nodes(category)`, and the new rows are `south-indian`; a labels-only flip would rank the old shops. A test in `packages/city` fails it. Recommendation: one PR.
- **After the flip, delist the old shops' directory rows** (owner: W2). What: kesar-kingdom, syrup-street and jamun-junction stay listed under their new display names, so until then the map shows each name twice. Why: the old rows feed acceptance D8 at S until acceptance moves to M. Recommendation: W2 delists them once acceptance checks M.

## w6-sdk

- **npm's web approval for both SDKs at 1.0.0** (owner: the founder). What: W6 runs `npm login` (the sign-in link), then publishes both packages one after the other (one approval link, which lasts about 5 minutes; last time npm reused it for the second package). Where: the links come in this chat and as a notification; open them in the browser signed in to npm as the owner of `graphpay_ethglobal`. Why: the brief's done-when is both packages on npm at 1.0.0. Recommendation: about 10 minutes at the browser, as soon as both PRs are merged.

## frontend

- **Kill a disposable agent** (from w1-identity; owner: the frontend pass). What: the route is live once W1's kill PR is deployed.
  - `GET /api/customer/kill-disposable` answers `{ spare: { label, name, epoch } | null, live, pool }`. Show the button only while `spare` is set: it is set only when the spare's name and its spending pass are both live. After a kill, the next spare appears within a few minutes.
  - `POST` (no body) takes 40 to 110 s. It answers `{ label, name, txs: [{ chain: 'sepolia' | 'whitechain', what: 'unregister' | 'revoke', hash }], revoked, payment: { outcome: 'refused' | 'paid' | 'unknown' | 'not-sent', http, reason, orderId, transaction }, recorded: { ref } | null, nextSpare, incomplete }`.
  - The beat is `payment.outcome` `refused` with `reason` `ENS_EXPIRED_OR_REVOKED`, plus `recorded`. A step that failed after the kill is named in `incomplete`, and the kill stands.
  - Other answers: `409` while another kill runs, `503` when no spare is ready yet, `502` when the outcome is unclear (then check GET).
  - Why: the stage's kill beat (demo script step 7, the ENS kill switch). The story is the owner unregistering the agent's name, the watcher revoking its pass, and its next payment refused and recorded on Arkiv.
  - Recommendation: one presenter-facing button on Vitalik's phone, in an "advanced" corner, since each tap ends one name for good. Show a countdown, then three links: the Sepolia unregister, the Whitechain revoke and the refusal.
- **/customer's "By 23:59" chip** (from w4-agents; owner: the frontend pass). What: `apps/web/components/customer-screen.tsx` shows `order.deadlineLocal`, but the request is now relative. Why: the chip and the request disagree. Recommendation: show "within an hour", or the run's deadline from the result frame (`result.mandate.deadlineIso`); no new route or event is needed.
- **The deck's errand text** (from w4-agents; owner: the frontend pass). What: `apps/web/public/deck/index.html` keeps a hand copy of the request that still says "by 11:59 pm". Recommendation: copy the new request from `packages/config/story.json` (`order.request`).
- **Re-order is "another coffee"** (from w3-payments; owner: the frontend pass). What: `POST /api/customer/reorder` (body `{ parentOrderId }`, unchanged) pays the story's re-order, the filter coffee at 0.80; the answer is `{ status: 'paid', orderId, parentOrderId, amountMicro, transaction }`, or `202` with `status: 'pending'`. Recommendation: label the button from `order.reorder.item` and `order.reorder.priceMicro`; no new event.
- **Subscribe to the Sunday box** (from w3-payments; owner: the frontend pass). What: `POST /api/customer/subscribe`, body `{}` or `{ plan }`, where `plan` must be the story's. The persona subscribes and the payer agent pays 2.40 (`renewal.priceMicro`) on the labelled 2-minute demo clock (`renewal.demoPeriod`). The first box is charged in the same transaction, and the cron charges the next ones, at most `maxCharges` (3) in all.
  - Answer: `{ status: 'active' | 'pending', subId, plan, item, sku, shopEns, priceMicro, periodSeconds, period, maxCharges, allowanceMicro, firstChargeAt, nextChargeAt, transaction, firstCharge: { orderId, charged, failReason } }`.
  - Refusals: `ALREADY_SUBSCRIBED` (with `subId`), `TOO_SOON` (within 3 min of the last one), `PAYER_NOT_ACTIVE`, `OVER_PASS`, `BALANCE_LOW`, `PAYEE_MISMATCH`, `RENEWER_LOW`, `CHECKOUT_REFUSED` (with `revert`).
  - Recommendation: wire `startRenewal` to the route and emit `renewal.created` with the first charge's explorer link. Use `renewal.sku` for its product; `story-projection.mjs` still uses `order.sku`.
- **Cancel the subscription** (from w3-payments; owner: the frontend pass). What: `POST /api/customer/unsubscribe`, body `{}` or `{ subId }`, where `subId` must be the payer's own. The payer agent's own signature, gasless. Answer: `{ status: 'cancelled' | 'pending', subId, transaction, effectiveAt }`. Refusals: `NO_SUBSCRIPTION`, `NOT_THIS_SUBSCRIPTION`, `NOT_ACTIVE`. Recommendation: wire `cancelRenewal` and emit `renewal.cancelled`.
- **The subscription in the customer state** (from w3-payments; owner: the frontend pass). What: `GET /api/state/customer` now fills `subscription`: `{ subId, plan, period, priceMicro, nextChargeAt, renewals: [{ at, transaction }], active, status, cycle, periodSeconds, chargesLeft, item, shopEns }`, newest charge first. Events: each charge is a `renew` edge plus a `pay` edge in the merchant stream. The subscription itself is a `subscribe` edge, and a cancel is a `cancel` edge, both from the persona. Recommendation: fill `snapshot.renewals` from it; when `active` and `chargesLeft` is 0, offer Cancel, since the demo plan has used its charges and a new subscribe waits for the cancel.
- **Pause and Resume on the tapped card** (from w5-ops; owner: the frontend pass). What: `/api/customer/pause` and `/api/customer/resume` now act on `{ agent: <ENS name> }`; with no agent they still mean the payer. `apps/phones/src/live-adapter.ts` `pauseAgent(ens)` and `resumeAgent(ens)` send `{}` and report every change as the payer's. Why: the W5 brief, "act on the agent whose card was tapped". Recommendation: send `{ agent: ens }`, and emit `agent.permission` for that agent. A card without a spending pass (Concierge, Analyst) gets HTTP 409, `reason: "NO_PASS"`, with an `error` sentence to show as it is; or hide Pause on those cards.
- **Self-healing on the phones** (from w5-ops; owner: the frontend pass). What: a paused agent resumes by itself after 2 minutes; a closed shop reopens after 5 (the cron `/api/cron/heal`). The pause answer carries `resumesAfterS`. `GET /api/state/heal` gives each pausable agent's `status`, `pausedAt` and `resumesAt`, and the shop's `open`, `openUntil`, `closedAt` and `reopensAt` (ISO times). Why: `/api/state/customer` covers only the payer, and the merchant phone keeps its own Open state, so it shows Closed after the cron reopens the shop. Recommendation: poll `/api/state/heal` with the customer state; show "resumes by itself at …" and "reopens at …".

## w5-ops

- **Presenter-only Pause** (owner: the founder; from Founder now). What: a visitor's Pause now heals itself after 2 minutes, and a Close after 5. Why: the open question was whether to make Pause presenter-only after a visitor paused the payer for 96 minutes. Recommendation: keep Pause public; self-healing bounds the damage.
- **W_DIRECTORY's tGLM** (owner: W5). What: the cron renews the shop's listing about every 5 minutes when no merchant page is open; W_DIRECTORY held 0.417 tGLM at 23:15 IST. Recommendation: W5 watches the balance overnight and tops it up from FUNDER (15.08 tGLM) if it runs low.
- **Decline a refund request** (from w3-payments; owner: the frontend pass).
  - What: `POST /api/merchant/refund-decline`, body `{ orderId, note? }`. The note is plain text, at most 140 characters, with no `@ / :` and no run of six digits (no contact details on a public graph). The request's reason follows the same rule now.
  - Answer: `{ orderId, decision: 'declined', amountMicro, requestRef, ref, note, arkivTx, entityKey }`. `arkivTx` is null when the decline was already on the record.
  - Refusals: `NO_REQUEST`, `ALREADY_DECIDED`, `STILL_PENDING` (the chain shows a refund the graph does not yet), `NOT_REFUNDABLE`, `NOT_THE_STORY_BUYER`, `NOT_OURS`, `NO_SUCH_ORDER`, `BAD_ORDER`, `BAD_NOTE`, `TRAIL_TOO_LONG`, `TOO_SOON`.
  - Event: a `request` edge in `/api/merchant/events` *from the shop to the payer agent*, ref `dec:<orderId>:<the request's minute>`, one per request. A refund request is the same kind the other way round (payer to shop, ref `req:`). The note is in the route's answer only; the graph's edges carry no payload.
  - Recommendation: wire `declineRefund` to the route. In `apps/phones/src/orders.ts`, `isLive` drops `dec:` rows today, so nothing changes on the phones yet. When it is widened, add a `dec:` branch where `request` rows are folded (refund status `declined`), or the decline becomes a second pending request and rings `refund_request`. The `/order/<id>` page already words it "Refund declined" (`lib/order-trail.ts`). The unlinked `/merchant` page still says "Refund requested by" the shop.
- **Over the pass, "for everyone"** (from w3-payments; owner: the frontend pass).
  - What: `POST /api/customer/over-pass`, empty body. The payer agent signs the story's `order.overPass` order: 100 of the combo, 480 test USDT. The signed attempt goes to our facilitator's verify step only, which never sends. It refuses (`CAP_EXCEEDED`, the lower of the ENS cap and the policy cap), and its recorder writes the refusal to Arkiv. Only an attempt above the whole pass is ever signed.
  - Answer: `{ refused, reason, sent: false, request, item, quantity, attemptedMicro, passMicro, spentTodayMicro, leftMicro, orderId, arkiv: { ref, entityKey }, repeated? }`. A second tap within a minute gets the same answer with `repeated: true`, and no new record. `NOT_OVER_PASS` means the order fits the pass, so nothing is signed.
  - Event: a `fail` edge from the payer agent to the shop, ref `att:<orderId>:…`, in the merchant stream.
  - Recommendation: a "Dosas for everyone" chip (its text is `order.overPass.request`) that calls the route and shows a refused attempt (`RefusedAttempt` kind `payment`, reason `cap`) with the Arkiv entity link.
- **The agent tries to raise its own cap** (from w3-payments; owner: the frontend pass).
  - What: `POST /api/customer/raise-cap`, body `{ capMicro? }`; the default is double the ENS cap. The route simulates `setText(graphpay.cap_micro)` from the payer agent's address on Sepolia, at a stated block, and the resolver reverts `EACUnauthorizedAccountRoles`. Nothing is sent, and only that revert is recorded.
  - Answer: `{ refused: true, sent: false, simulated: true, revert, agent, owner, key, attemptedMicro, currentMicro, resolver, block, arkivTx, entityKey, repeated? }`.
  - Event: a `request` edge from the payer agent to the persona, ref `cap:<node>:<minute>`, amount 0 (the figure is in its payload). It is not in the shop's stream.
  - Recommendation: wire `tryRaiseCap` to the route and show `cap.change.refused` with the revert reason and the Arkiv link.
