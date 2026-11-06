# OPEN

The founder's to-dos and open questions. Each item says what, where, why and what we recommend. "Founder now" is kept by the Coordinator; every session keeps its own section below.

## Founder now (Coordinator only)

Updated 10:40 IST, Fri 6 Nov, at the Coordinator handover (`docs/sessions/records/resume.md`). **Standing rule (ADR-0066): no target times.** Every task starts the moment it's given and is reported when it's done. Only the submission (Sat 09:00 IST) and the presentation (Sat 09:30 IST) are fixed.

1. **Lock the story.**
   - **What:** send the final story.
   - **Why:** the moment it locks, the demo cast is set up (T2 names, T1 policies, Join's bootstrap, T3's `shop` rows) and the large city starts seeding (100–130 minutes). Rehearsal 1 runs once the demo cast is in.
2. **Top up Kimi.**
   - **What:** add credit on the Kimi platform. $1 or more unlocks K3.1 Pro; $10 reaches Tier 1 (15 concurrent requests, 100 a minute).
   - **Why:** the agents run on Kimi (ADR-0067). The prepaid balance is also the spending cap for the live runner.
   - **Recommendation:** $10.
3. **The team's site, PR #70** (ADR-0068).
   - **What:** T5's review says do not merge yet. The team must:
     - (a) move it into `apps/demo-ui` as a pnpm workspace app, with no npm lockfile;
     - (b) read the story and the explorer links from `@graphpay/config`;
     - (c) remove the middle dots and the uppercase labels;
     - (d) add the passcode to the adapter contract;
     - (e) add a CI step for `demo-ui`.
   - **Also:** confirm every committer is on the ETHGlobal team.
   - **Next:** T5 re-reviews as soon as the team pushes.
4. **Start the Submission session** (its gate, CP4, is met).
   - **What:** start it from `docs/plan/sessions/README.md` (Sonnet 5.5, high).
   - **Why:** the sponsor files and the submission text.
   - **Recommendation:** start it once the story work no longer needs the remaining plan usage, or at the latest after the 21:30 reset.
5. **Plan usage: 86%.** Every session pauses gracefully at 92% (ADR-0062). The weekly window resets at 21:30 IST.
6. **The written pre-event disclosure:** send it to ETHGlobal if you haven't yet (`docs/plan/DISCLOSURE_MESSAGE.md`).
7. **Keep the charger in and the lid open** until the presentation.

**Closed 10:47:** both SDKs are on npm: `@graphpay_ethglobal/agentpay` 0.1.0 (published 10:40) and `@graphpay_ethglobal/arkiv-graph` 0.1.0. Both quickstarts pass from the registry.

**Closed 10:31:**
- The Kimi key: stored with the hidden prompt (the scan recognises it) and on Vercel Production as Sensitive (#89).
- Anthropic credit is no longer needed (ADR-0067).

**Closed 10:1x:** the npm login, and `@graphpay_ethglobal/arkiv-graph` 0.1.0 published.

**Closed 09:30:** "ADR-0059 appears twice" was a wrong reference (the npm publish is ADR-0063).

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

## Kickoff rules and booth questions (closed; rolled up 06:55 IST)

The kickoff rules (the deadline Sat 09:00 IST; AI use documented; spec files in the repo; pre-event work disclosed in writing; the video in the founder's own voice) are in `planning/` and ADR-0028. The organiser said "go all out, use AI the best you can", and we keep full AI disclosure (ADR-0028). Every booth question is closed with the founder's defaults (ADR-0038 to ADR-0044). Prize tracks: ADR-0051; Swarm: ADR-0039 and ADR-0061.

## foundation

- Nothing waiting on the founder beyond "Founder now".

## payments

- **F3 done (T1):** the relayer floor is enforced. The production build of `apps/web` was run locally with the hosted environment and `MIN_RELAYER_BALANCE_WBT` raised to 1001 WBT, above the relayer's 0.795. A signed 0.40 payment sent to `/settle` was refused as `relayer_floor`, no transaction was sent (relayer nonce 13 before and after), and health showed the floor and the balance. Record: `docs/sessions/payments/f3.json`. This was run locally, not on a preview: a preview would need the relayer key in the preview environment, and the hosted URLs are pinned to the production facilitator. Join reads the record.
- **For the Coordinator (CI), still open:** only `ci` is a required check, so the `contracts` job (forge build, ABI check, fork tests) does not gate a merge. Recommendation: an aggregator job named `ci` that needs every job and fails unless all succeeded (`needs` alone passes on a skipped job). Until then T1 enables auto-merge on contract PRs only after `contracts` is green.
- **For every session (keys, settled):** real payments go through the hosted facilitator only (`/api/facilitator/{verify,settle}`, bearer `FACILITATOR_AUTH_TOKEN`); RENEWER belongs to the hosted cron. No local script sends as FACILITATOR or RENEWER during the demo (M4 pitfall). Join has switched.
- **For the Coordinator (config, before M4):** ADR-0030 and the M5 amendment say `ALLOWED_MERCHANTS` and `SHOP_MERCHANTS` are built from the config, but the config holds no Whitechain role addresses (the shops' merchant wallets are only in `docs/technical/WALLETS.md`). Recommendation: add the public role addresses (`wallets.addresses`, role → address) to `packages/config/graphpay.config.json`; T1 then checks both env values against it at start-up. Safe default until then: both are env values that M4's env script derives from the role keys (never typed in), validated as addresses, and the shop's payee must still equal its ENS address.
- Nothing for the founder in M3. Gas on the real chain (04:13 IST): a first payment with its approval 309,483 gas, about 0.0015 WBT; FACILITATOR still holds about 0.79 WBT, far above its 0.3 WBT floor.

## identity
- **Nothing needs the founder.** Defaults taken: non-paying agents publish a zero cap in ENS (ADR-0059; recommendation: keep). The agent record `agent-endpoint[mcp]` points at the hosted MCP and B8's MCP call now passes (closed 2026-11-06, `scripts/ens/acceptance.mjs`).
- **For Join (the watcher):** host `createEnsWatcher` from `@graphpay/ens` in the workers process: `watcher.start()`, then `watcher.run()`. Give it `sink = { updatePolicy: createPolicySink({ configured, readPolicy, writePolicy }).updatePolicy, patchNode }` (POLICY_WRITER signs `writePolicy`; one nonce stream: only the watcher writes policies after M2's setup). A persistent `checkpoint` ({ get, set }) is optional: without it the watcher starts at the head and catches up from chain state. `node scripts/ens/watch.mjs` shows it running with logging sinks.
- **For the Coordinator (only when the kill demo needs a fresh label):** `DISPOSABLE_2` has a key and no funds; it needs 0.005 WBT and 1 test USDT (`pnpm funding`) before `node scripts/ens/owner.mjs disposable --real`. `disposable-1` is the first kill target.
- **Decision for the founder (low stakes):** `ens_check` says ACTIVE for any status other than `paused` (the agents spec), while the gate refuses anything but exactly `active`. Recommendation: keep the spec wording.

## arkiv

- **What:** the story's re-registered shop epoch. **Where:** `packages/config/story.json` `syntheticCity.reRegisteredShop.epoch` (2). **Why:** fresh ENSv2 names start at epoch 0 and a re-registration goes up by one (`planning/SPEC/ARKIV_GRAPH.md` §8), so 1 would match the spec; 2 copies the lab. The S city uses the story's value; nothing is wrong by identity either way. **Recommendation:** the Coordinator sets it to 1 in the final story before M.
- **What:** T3 added two blocks to the story config. **Where:** `story.json` `syntheticCity.generator` (generator inputs; the spec's values, the rest labelled as T3's choices) and `locations.neighbourhoods` (8 OpenStreetMap places with links). **Why:** ADR-0047 says every city parameter and place lives there. **Recommendation:** the Coordinator keeps them when the final story replaces the cast.
- **What:** publish `@graphpay_ethglobal/arkiv-graph` 0.1.0 (ADR-0063). **Where:** `packages/arkiv-graph`; the Coordinator runs `pnpm publish` after the founder's npm login. **Why:** the package, README quickstart, CHANGELOG, FEEDBACK and licence are ready (09:50 IST, PR below); versions freeze after the submission. **Recommendation:** re-check the name is free right before publishing (`npm view @graphpay_ethglobal/arkiv-graph name version`); the full API reference follows in 0.1.x, after the submission only if the rules allow it.
- **What:** the GitHub labels and issue template. **Where:** the labels `arkiv-graph` and `feedback`, and `.github/ISSUE_TEMPLATE/arkiv-graph-feedback.yml` (Coordinator). **Why:** the README, FEEDBACK.md and `package.json` `bugs` point at that template. **Recommendation:** merge the template before publishing so the links work.
- **What:** where race mode gets its truth. **Where:** `apps/web/app/api/race` (T5) calling `raceQuestion` from `@graphpay/money-graph`. **Why:** the "correct" badge needs the generator's truth, which comes from `@graphpay/city` (pure, a few milliseconds at S); the web app does not depend on it yet, and adding it changes the lockfile. **Recommendation:** T5 adds the workspace dependency in its next dependency PR (usage in `docs/sessions/arkiv/README.md`, "Race mode"); until then the race still shows reads and bytes, with `correct: null`.
- **What:** wiring the activity rows. **Where:** the Open toggle (T5's merchant route) calls `openShop` every few minutes while on and `closeShop` when off; the agent run route passes `hooks: activityHooks(directoryConn)` to `runErrand` (T4/T5); usage in `docs/sessions/arkiv/README.md` ("Activity"). **Why:** the rows exist only when something writes them; acceptance D11 reads them. **Recommendation:** the Coordinator asks T5 and T4 to wire them before CP6; both are additive and no-op until called.
- **What:** acceptance D7 (the benchmark at size M). **Where:** `bench/run.mjs` refuses M. **Why:** M waits for the founder's final story (ADR-0049). **Recommendation:** after the M seed, run `node bench/run.mjs --size M --end <date>` once the size guard is lifted; T3 does it.
- **What:** Graph Arkiv's bytes on window questions. **Where:** `packages/arkiv-graph/src/engine.mjs` reads every column (`select('*')`). **Why:** Q1's 90-day window adds up one day-tally row per active day (70 rows, about 107 KB, against plain's 1.3 KB); the reads are equal (3 against 3), and reads are the result (ADR-0042). **Recommendation:** leave it for the event; projections in the engine's reads would cut it, after the Friday items if time allows.
- **What:** two writer limits the reviewer noted (no action needed tonight). **Where:** `packages/arkiv-graph/src/writer.mjs`. **Why:** a foreign transaction of another shape at a pinned nonce stops the write loudly (`WriteUncertainError`) rather than being judged not ours; `writeShop` passes no ownership check, which is safe only while W_DIRECTORY scripts never run with the site live (ADR-0033). **Recommendation:** keep ADR-0033's rule; T3 revisits it after the Friday items if time allows.
- Closed: the explorer's entity page (`/entity/<key>`, verified by the website session; `arkiv/schema.md` updated); Join's `$attributes` finding (PR #25); the W_DIRECTORY top-up (it holds 0.50 tGLM); the i32 box (ADR-0058).
- **What:** the Arkiv drafts need a final pass. **Where:** `arkiv/friction.md`, `how-you-use-arkiv.md`, `swarm.md` (drafts, 10:40 IST). **Why:** Submission (M17) finishes them; the judges read them. Open items inside: the `agent_presence` and `handoff` rows are built but no agent run calls them (T4/T5); `swarm.md` still lists `refund_evidence` as not built; the friction rows list only what we reproduced at the event. **Recommendation:** after the last live run, re-check each repro and the numbers against `docs/technical/FACTS.md`, and add anything the founder's own run turns up.
- **Closed (Coordinator, Fri):** `refund_evidence` (the encrypted refund photo on Swarm) is dropped: first in the cut order, and the demo's refund request carries no photo. `arkiv/swarm.md` says so.
- **What:** the Swarm gateway keeps data "for a limited time". **Where:** `arkiv/swarm.md`, `readMenu`. **Why:** a menu the gateway has lost is uploaded again under the same reference on the next read that passes the menu document; the Arkiv rows live 14 days. **Recommendation:** re-run `pnpm -s --filter @graphpay/money-graph menus --execute` once the founder's final story is locked and again before the video.

## agents

- Nothing waiting on the founder. Open for Join: the config's `whitechain.contracts` is empty, so the payer refuses every real 402 (`UNKNOWN_CONTRACT`) until T1's checkout address is in the config (recommendation: T1 adds it at M2; the payer reads every address in that section).

## integration

Updated 09:47 IST, Fri 6 Nov. Nothing for the founder now. M13 is done; the two checks left are T2's (below). Closed: F3 (T1's record, PR 78). Closed: C4(a) (passed 05:38 IST with the workers paused, Coordinator's go).

- **Keep the lid open (watch).** What: the workers process runs on this Mac under `caffeinate -ims`. Where: this Mac. Why: caffeinate does not stop a closed lid from sleeping the Mac; the mirror then resumes from Arkiv on wake (D15), but the site's scores lag until then. Recommendation: keep the lid open and the charger in until Saturday's submission.
- **B7: the re-registration fork test (T2): closed 2026-11-06 05:00 IST.** `packages/ens/test-fork/gate.fork.test.mjs`, test "B7: the epoch after re-registering…": a new registration after an unregister or a lapse gets e + 1; the AVAILABLE view after an unregister shows 0 → 2. Needs a fork with `disposable-2` and `disposable-3` provisioned (`real-run.mjs --fork … --disposable n`); the check reads the title through `acceptance/tracks.mjs`.
- **B9 (a): the payee comparison (T2): done 2026-11-06 05:15 IST for the shop with a settled payment.** `scripts/ens/acceptance.mjs` now compares the merchant of each cast shop's last settled order with the shop's `addr(2147485522)`: Kesar Kingdom passes (order paid the ENS address; settlement transaction in the script output). The other two shops have no settled payment yet and are skipped, not failed; re-run `node scripts/ens/acceptance.mjs` after more payments.
- **Ask of T3: the reputation's synthetic label (open since 03:29 IST).** What: `Reputation.synthetic` in `packages/money-graph/src/graphql.mjs` comes from the node row only, so scores built from the labelled history say `synthetic: false`. Recommendation: true when the node or any tally row read is synthetic.

## website

- **Open (default taken):** the kill button (`/api/customer/kill-disposable`) still says "not live yet": it needs T2's `provisionDisposable` plus a funded disposable wallet, which are not wired yet.

- **Founder to-dos:** none now. Friday: the final story config goes to the Coordinator, as before.
- **Ask of T3 (default taken):** the GraphQL `Edge` has no Arkiv entity key, no Arkiv transaction and no `payload` (item, order kind), so the merchant stream sends them as `null` and the accountant CSV has no "item", "kind (one-off, re-order, renewal)" or "Arkiv entity key" column; the settlement tx comes from the edge ref. Why: `WEBSITE_SPEC.md` §4 lists them. Recommendation: add `entityKey` and an `orderKind` to `Edge` if cheap; the CSV and pop-up pick them up with a one-line change. Not needed for the demo to work.
- **Ask of the Coordinator or the founder (to put the store online):** (1) create the Vercel project `graphpay-store` from `apps/store` (a login step, I do not touch Vercel projects); (2) set its env as Sensitive values: `MERCHANT_ADDRESS` (the shop's payout address, from `docs/technical/WALLETS.md`, SHOP_KESAR), `DEMO_PASSCODE` (24+ characters), `FACILITATOR_AUTH_TOKEN` (the hosted facilitator's bearer token, the same name as in `env.example`), `FACILITATOR_URL` (default `https://graphpay-event.vercel.app/api/facilitator`), and for dispatch and refunds `SHOP_KESAR_PRIVATE_KEY`; (3) the shop's payout wallet needs a bounded USDT float approved to the checkout for refunds. Why: M16's done-when ("a human pays in the store with a browser wallet and no gas") needs T1's hosted facilitator (M4) and a wallet on Whitechain Sepolia (chain 1874) that holds test USDT. Recommendation: set the env when M4 lands, then one real purchase from a browser wallet before rehearsal 1; the wallet signing path is tested in code through a mock EIP-1193 provider, not yet in MetaMask itself.
- **Dependency (told T6 at 04:30 IST, agreed by the Coordinator):** `packages/checkout-kit` uses only the public exports of `@graphpay_ethglobal/agentpay` (renamed from `@graphpay/agentpay`, ADR-0063): `createMerchant`, `httpFacilitator`, `whitechainNetwork`, `decodeHeader` (and in tests `signOrderPayment`, `buildRequirement`, `createOrder`, `nodeOf`). Recommendation: T6 keeps them stable or says before changing them.
- **Open (default taken):** the store's Sunday box (subscribe and cancel) is not built: the kit's merchant has it (`shop.merchant`, agentpay's `signSubscription`) but the button offers one-off orders and re-orders only. Recommendation: after the video-critical items, if time.
- **Ask of T3 (default taken):** the GraphQL `Shop` has no Arkiv entity `key`, so a map dot opens the explorer's query page for its directory row (`project = str('graphpay') AND type = str('shop') AND shop_key = key(0x...)`) rather than its entity page. UNVERIFIED that the explorer's query page accepts this text (the spec marks it so). Recommendation: add `key` to `Shop` (agent presence rows already have one) so a dot opens `/entity/<key>`; the map picks it up with a small change.
- **Ask of Join (M12 wiring of the website's runner):** `ErrandInput` (in `apps/web/lib/run-registry.server.ts`) now carries `runId`, the id the website knows the run by. Pass it on as the errand's `runId` (`runErrand({ ..., runId: input.runId, hooks: activityHooks(dir) })`): the agents write their handoff and presence rows under it, and the explainer's lanes and the map query by it. Why: with a different id the lanes stay empty ("No handoff records for this run"). Recommendation: do it in the same PR that sets the runner in `apps/web/lib/agents-live.server.ts`.
- **Closed by T6's #64 (merged):** `merchant.exportCsv` of `@graphpay_ethglobal/agentpay` now reads logs in chunks the public RPCs accept. Still to do on my side: rerun the store's export once and note the row for the kit payment (order `0x0864…05f0`).
- **Ask of the Coordinator (Mark dispatched and Refund on the event site):** the shop's key (`SHOP_KESAR_PRIVATE_KEY`, from the story's wallet role) must be in Vercel Production for `graphpay-event`; the hosted shop already uses it for deliveries, so it is probably set. For a refund the shop wallet must hold test USDT and have approved the checkout (the route says so if not: "The shop wallet lacks the balance or the approval"). Recommendation: one dispatch and one partial refund from the stage before rehearsal 1, with the passcode.
- **Ask of T1 (default taken):** a shared table of refund reason codes. The contract takes a `uint8` and only emits it; the merchant phone sends `1` ("the merchant's own refund", `MERCHANT_REFUND_REASON` in `apps/web/lib/merchant-actions.server.ts`), the customer's request uses "2 squashed" in the story. Recommendation: one table in `@graphpay/contracts` so the mirror, the export and the phones read a code the same way.
- **Ask of the Coordinator (Request refund on the event site):** set `W_SYNC_PRIVATE_KEY` in Vercel Production for `graphpay-event` (the recorder's key; the hosted recorder route uses the same one, so it is probably set). Without it `POST /api/customer/refund-request` answers "not live yet". Recommendation: one Request refund from the stage with the passcode before rehearsal 1.
- **Note (default taken):** Request refund's one-per-minute and six-per-minute limits live in each server instance's memory, so a passcode holder who fans out can still write more than that. Recommendation: acceptable behind the passcode; if W_SYNC's nonce is ever starved, check the order's trail for a recent request before writing.
- **Ask of T1 (default taken):** the hosted shop has `/catalog`, `/quote` and `/orders/:id/{pay,reorder}` only. Subscribe and Cancel on the customer phone need a hosted endpoint pair (agentpay's `merchant.subscriptions(plan)` and `cancellations()`) over a facilitator that creates subscriptions (`facilitator.subscribe`, `cancelSubscription`); the hosted facilitator has neither. Until then both buttons say "not live yet". Recommendation: only if the Sunday box is on the video's script.
- **Ask of the Coordinator (Re-order on the event site):** `PAYER_PRIVATE_KEY` in Vercel Production, funded with test USDT and bound to the payer agent by an active spending pass (the story's daily cap is 6.00 USDT; a re-order is 1.20). Without it the button says "not live yet". Then one real re-order from the stage; tell Join first (one sender at a time on the hosted facilitator).
- **Known limit (default taken, reviewer-flagged):** Re-order's guard against a double tap lives in each server instance's memory (the payer agent is held until a signature can no longer settle, about 11 minutes after an unclear outcome, 2 minutes after a paid one). Two taps landing on two different instances at the same moment would each sign. The pass's daily cap (enforced by the contract) bounds the loss to what is left under 6.00 USDT that day. There is no database to close it (ADR-0003). Recommendation: accept; one person taps one button.

## agentpay

- **The examples' story values (for the Coordinator).** What: a new `agentpayExamples` section in `packages/config/story.json`: the ride (operator name, from and to neighbourhoods, a 1.50 fixed fare, synthetic) and `testAmountMicro` (0.01, the real test payment's operational amount, never a story price). Where: the story config, which you own. Why: the brief says names come from the story config, and the ride had none. Recommendation: keep the section in the final story, or tell T6 to move it.
- **A real ride payment needs a ride merchant in the cast (for the Coordinator, T2 and Join).** What: a real payment to a merchant the mirror does not know is parked, and the mirror's checkpoint never passes a parked event. Where: `packages/mirror/src/mirror.mjs`. Why: one test ride would stall the money graph's mirror. Recommendation: keep the ride on the fork (as now). If the founder wants a real ride, add the operator to the cast (story, ENS name, mirror actor) first.
- **RENEWER has a second use (for the Coordinator, `docs/technical/WALLETS.md`).** What: AgentPay's real test payment settled through the reference relayer on the RENEWER key (one `settleOrder`, 309,451 gas); RENEWER now holds about 0.098 WBT. Why: the wallet record should say so, and T1's renewals share its gas. Recommendation: note it in WALLETS.md; top up RENEWER before the M4 renewals run; T6 makes no further real payments with it tonight.
- **Closed 04:20 IST: T1's facilitator adapter (A4).** `packages/agentpay/test-fork/t1-facilitator.test.mjs` pays the SDK merchant through T1's `createGraphPayFacilitator` both in process (`inProcessFacilitator` over an `x402Facilitator`) and over `facilitatorHandler` (`httpFacilitator`). Nothing was missing from T1's public exports, and no wire change was needed. For T1, no action: the test stubs the ENS gate (the fork has no ENS), as T1's own fork e2e does.
- **T5's checkout kit depends on AgentPay's public exports (for T6, kept).** What: `packages/checkout-kit` (T5, M16) uses `createMerchant` (route, exportCsv, deliver, refund, the 402 flow), `httpFacilitator`, `whitechainNetwork` and `decodeHeader`, plus four helpers in its tests. T6 keeps them stable and tells T5 before any change. T5's note, no action: the SDK imports Node modules, so a browser bundle cannot use it; a browser-safe signer subpath is a V2 idea.
- **Closed 05:30 IST: the export failed on the real chain (T5's report).** What: `exportCsv`, `chargeDueRenewals` and `watchRenewals` searched logs 50,000 blocks at a time; Whitechain's RPC refuses over 10,000 (-32602) and the public Ankr endpoint over about 1,000 (-32062), measured 05:00 IST. Now: 10,000 by default, a tenth after a range refusal, kept for that merchant; new option `logChunk`. Checked read-only on both public RPCs: 15 orders each (6 and 42 calls).
- **FUNDER's test USDT is down to 15.54 (for the Coordinator).** What: the fork tests drew their test USDT from FUNDER by impersonation and began to fail once it fell under 20. They now write the balance on the fork, so they no longer need it. Recommendation: nothing for T6; check FUNDER before the next real payments and top-ups.
- **Closed 04:35 IST: a flaky fork test was an SDK bug.** `exportCsv` read the chain head through viem's cached `eth_blockNumber` (kept for the polling interval, about 4 s), so a refund mined in the last seconds could be left out of the CSV. It now reads the head uncached (also in the renewal charge and watch). The CSV fork test failed 2 of 3 runs before and passed 3 of 3 after. No action.
- **Outside developers cannot settle on our deployed checkout (for the Coordinator, 0.1.0 publish).** What: `GraphPayCheckout.settleOrder` is `onlyRelayer`, so only GraphPay's granted relayers can settle there. Where: the README, "Using it on the real Whitechain Sepolia". Why: the founder's rule is that nobody else can spend our gas or break the demo. Now: the 5-minute quickstart runs on a local anvil fork with the developer's own checkout (`@graphpay_ethglobal/agentpay/sandbox`, needs Foundry's `anvil`), and on the real testnet a developer deploys their own with `deployCheckout` and their own relayer. Recommendation: say this when you ask developers at the venue to try it.
- **Publish notes (for the Coordinator).** Publish with `pnpm publish --access public` from `packages/agentpay`. `devDependencies` still name the private workspace packages (tests only; npm does not install them). The files list is checked: no secret, no keyed URL (`pnpm check` over the unpacked tarball is clean). `scripts/check.mjs` has one new exemption, the generated `packages/agentpay/src/vendor/defaults.mjs`, backed by a sync test.
- **Feedback.** Label `agentpay` and `feedback`, template `.github/ISSUE_TEMPLATE/agentpay-feedback.yml`; `packages/agentpay/FEEDBACK.md` is the log (date, who, what they asked, outcome). T6 fills it as issues arrive.

## records

- **npm login for the publish (ADR-0063, item 18).** What: your `npm login` and go-ahead when both SDKs are ready (about 12:00). Where: a Terminal-panel tab the Coordinator opens; npm's sign-in and the 2FA happen there and Claude never sees them. Why: publishing needs your account, and a publish can't be undone after 72 hours. Recommendation: nothing now; the Coordinator asks.
- **Prompt logs land in the main checkout** (P-records-1). What: the prompt-log hook writes every session's log to `~/graphpay/prompts/raw/`, not to the session's worktree, so track PRs do not carry their logs. Recommendation: the Coordinator changes the hook to write into the session's own checkout and sweeps the logs written so far into a records PR. No founder action.

## submission
