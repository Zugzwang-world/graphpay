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

- **Acceptance follows the 0.80 re-order** (owner: W5). What: `integration/hosted.mjs` C3 quotes `story.order.sku` against the re-order's 0.80, and `acceptance/checks.mjs` C3 expects 1.20. Why: C3 is refused before signing on every fresh run. Recommendation: quote `story.order.reorder.sku` and take the amount from `order.reorder.priceMicro` (W5 is told).

## w4-agents

- **Acceptance E1 reads the old clock deadline** (owner: the Coordinator, who regenerates acceptance). What: `acceptance/checks.mjs` E1 expects the run's deadline to contain `T23:59:00` (`order.deadlineLocal`); the request now says "delivered within an hour". Why: E1 would fail on every fresh run. Recommendation: expect the deadline one hour after the run's request, to the minute (`result.mandate.deadlineIso`); E1 needs a fresh `e2e:food` run anyway.

## frontend

- **/customer's "By 23:59" chip** (from w4-agents; owner: the frontend pass). What: `apps/web/components/customer-screen.tsx` shows `order.deadlineLocal`, but the request is now relative. Why: the chip and the request disagree. Recommendation: show "within an hour", or the run's deadline from the result frame (`result.mandate.deadlineIso`); no new route or event is needed.
- **The deck's errand text** (from w4-agents; owner: the frontend pass). What: `apps/web/public/deck/index.html` keeps a hand copy of the request that still says "by 11:59 pm". Recommendation: copy the new request from `packages/config/story.json` (`order.request`).
- **Re-order is "another coffee"** (from w3-payments; owner: the frontend pass). What: `POST /api/customer/reorder` (body `{ parentOrderId }`, unchanged) pays the story's re-order, the filter coffee at 0.80; the answer is `{ status: 'paid', orderId, parentOrderId, amountMicro, transaction }`, or `202` with `status: 'pending'`. Recommendation: label the button from `order.reorder.item` and `order.reorder.priceMicro`; no new event.
- **Pause and Resume on the tapped card** (from w5-ops; owner: the frontend pass). What: `/api/customer/pause` and `/api/customer/resume` now act on `{ agent: <ENS name> }`; with no agent they still mean the payer. `apps/phones/src/live-adapter.ts` `pauseAgent(ens)` and `resumeAgent(ens)` send `{}` and report every change as the payer's. Why: the W5 brief, "act on the agent whose card was tapped". Recommendation: send `{ agent: ens }`, and emit `agent.permission` for that agent. A card without a spending pass (Concierge, Analyst) gets HTTP 409, `reason: "NO_PASS"`, with an `error` sentence to show as it is; or hide Pause on those cards.
- **Self-healing on the phones** (from w5-ops; owner: the frontend pass). What: a paused agent resumes by itself after 2 minutes; a closed shop reopens after 5 (the cron `/api/cron/heal`). The pause answer carries `resumesAfterS`. `GET /api/state/heal` gives each pausable agent's `status`, `pausedAt` and `resumesAt`, and the shop's `open`, `openUntil`, `closedAt` and `reopensAt` (ISO times). Why: `/api/state/customer` covers only the payer, and the merchant phone keeps its own Open state, so it shows Closed after the cron reopens the shop. Recommendation: poll `/api/state/heal` with the customer state; show "resumes by itself at …" and "reopens at …".

## w5-ops

- **Presenter-only Pause** (owner: the founder; from Founder now). What: a visitor's Pause now heals itself after 2 minutes, and a Close after 5. Why: the open question was whether to make Pause presenter-only after a visitor paused the payer for 96 minutes. Recommendation: keep Pause public; self-healing bounds the damage.
- **W_DIRECTORY's tGLM** (owner: W5). What: the cron renews the shop's listing about every 5 minutes when no merchant page is open; W_DIRECTORY held 0.417 tGLM at 23:15 IST. Recommendation: W5 watches the balance overnight and tops it up from FUNDER (15.08 tGLM) if it runs low.
