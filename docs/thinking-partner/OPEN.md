# OPEN

The founder's to-dos and open questions. Each item says what, where, why and what we recommend. "Founder now" is kept by the Coordinator; every session keeps its own section below.

## Founder now (Coordinator only)

Updated 02:15 IST, Sat 7 Nov (night Coordinator). **The backend is closed.** Only the submission (09:00 IST) and the presentation (09:30 IST) remain.

1. **The Arkiv key's quota.** The new key is in `.env` and in Vercel Production, the site is redeployed and the workers restarted, but Arkiv answers it 429 QUOTA_EXCEEDED, the same as the old one. Reads use the keyless endpoint and work now that the big readers have stopped. Ask the Arkiv team to check the key. With a working key, run `pnpm -s secrets:set ARKIV_ACCESS_KEY --overwrite` in the main checkout and tell the Coordinator.
2. **The video,** in your own voice: the shot list is `docs/submission/VIDEO.md`.
3. **Review the README** and the team list (W7's items below).
4. **The ETHGlobal disclosure** (`docs/plan/DISCLOSURE_MESSAGE.md`), and confirm every team member is registered.
5. **Submit by 08:00 IST** from `docs/submission/ETHGLOBAL.md`; the form closes at 09:00.
6. **"Everyone" for "Dosas for everyone":** 100 by default (synthetic, `order.overPass`); change it only if you want another headcount.
7. **Keep the charger in and the lid open** until the presentation: the workers, the watchdog and the mirror run on this Mac.

**Closed tonight:**
- the night run: W1 to W7 landed and stopped; the backend closed at the founder's word (01:30 IST);
- npm's web approval: both SDKs at 1.0.0;
- the big city: trimmed by the founder at 00:52 IST to what is seeded; W2 finishes race mode on it;
- race mode: kept at S by the founder (01:24 IST);
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

The rows before the night run (Thursday's probes to Friday 23:00 IST) are in [`docs/archive/preset-calibration-before-the-night.md`](../archive/preset-calibration-before-the-night.md).

| time (IST) | run | preset | model, effort | seconds per errand | API cost per errand | notes |
|---|---|---|---|---|---|---|
| 23:30 | W4 baseline: one live errand on the production site (`scripts/agents/site-errand.mjs`), payer | live | `kimi-k3.1-pro-highspeed`, high (every role) | 91.4 | $0.1455 (the sum of the agents' own call costs) | **paid** 4.80 to kesar: https://explorer.testnet.whitechain.io/tx/0xeac35d0ad3cfd0ed77f51bfd76974b545b973d1be69e13b1edb535d48e76abe6 ; 19 calls, 33,287 tokens (29,050 in, 14,592 of them cached; 4,237 out, 2,187 reasoning); 62.6 s of model time; per call in `docs/sessions/w4-agents/runs/` |
| 23:45 | W4 code mode on mock services (`AGENT_MODE=live AGENT_PRESET=live pnpm agents:errand --runs 2`), before the analyst went to low | live | `kimi-k3.1-pro-highspeed`, concierge and analyst high, risk low; scout, payer, storefront and dispatch in code | 18.2, 27.4 | $0.0359, $0.0530 | paid the good shop, the concierge's own choice; 3 calls, 3,352 and 4,396 tokens; nothing paid on chain (mocks) |
| 23:47 | W4 code mode on mock services, the analyst at low | live | `kimi-k3.1-pro-highspeed`, concierge high, analyst and risk low; the rest in code | 13.8, 14.3 | $0.0267, $0.0271 | paid the good shop, the concierge's own choice; 3 calls, 2,927 and 3,043 tokens; nothing paid on chain (mocks) |
| 23:49 | W4 first cut (#162) live on the production site, payer | live | `kimi-k3.1-pro-highspeed`, concierge and analyst high, the rest low | 87.6 | $0.1435 | **paid** 4.80 to kesar: https://explorer.testnet.whitechain.io/tx/0xd4fd98b7e85fb5af7cd661fb58bac2d6fd89b5fd467f476a81eca363bff69d2f ; 19 calls, 33,346 tokens (29,251 in, 14,592 cached; 4,095 out, 2,098 reasoning); only 4% faster than the baseline: each call costs 1.5 to 4 s even at low, so the number of calls is what counts |
| 00:10 | W4 code mode live, before merging: Join's live runner run locally with this branch's agents, over the production shop, facilitator, ENS and Arkiv | live | `kimi-k3.1-pro-highspeed`, concierge high, analyst and risk low; the rest in code | 57.3 (the runner's own clock) | $0.0358 | **refused before signing, correctly:** the payer was PAUSED again (`ENS_PAUSED` at the gate); scout, analyst, risk, storefront, quote and 402 all ran; 3 calls, 3,282 tokens; the analyst's one call took 20.5 s for 608 tokens (its answers are now kept short) |
| 00:11 | W4 code mode on mock services, short answers | live | the same | 15.6, 11.7 | $0.0266, $0.0227 | paid the good shop, the concierge's own choice; 3 calls, 2,887 and 2,839 tokens |
| 00:14 | W4 code mode live, local runner (as at 00:10) | live | the same | 22.0 | $0.0265 | refused at G8, the shop's re-check before the 402: the buyer-standing read failed (`fetch failed`), so the guard failed closed; now a read that throws is tried once more |
| 00:15 | W4 code mode live, local runner, after that fix | live | the same | 55.2 | $0.0247 | **paid** 4.80 to kesar: https://explorer.testnet.whitechain.io/tx/0xfe0a4327fb7dca69d7363f05c73a8cc15b486b57184fc2f1e72c6812785070d5 ; 3 calls, 2,886 tokens (1,884 in, 768 cached; 1,002 out, 605 reasoning); 13.6 s of model time; the payer's 41.7 s is the quote, the 402, the checks, the signature and the settlement |
| 00:24 | W4 code mode (#182) live on the production site, payer | live | `kimi-k3.1-pro-highspeed`, concierge high, analyst and risk low; the rest in code | 55.5 | $0.0269 | **paid** 4.80 to kesar: https://explorer.testnet.whitechain.io/tx/0x194b7bc4dac70c36e55ca140a7e3ea477853d8938f3885fb94d95bff9c32f0e5 ; 3 calls, 2,852 tokens; models 13 s; the two longest waits are the 402 step (13.6 s: the hosted shop's quote write) and the settlement (13.3 s: our facilitator and the chain) |
| 01:16 | W4 item 4, three in a row (1 of 3), after the shop-name flip and W5's restart, payer | live | `kimi-k3.1-pro-highspeed`, concierge high, analyst and risk low; the rest in code | 54.2 | $0.0293 | **paid** 4.80 to filter-and-fold: https://explorer.testnet.whitechain.io/tx/0x32bbd598de36731532da5a3d3927d355aab62b27fcd743d1fd62dc0c09c66b5e ; 3 calls, 2,963 tokens; models 14.6 s |
| 01:17 | W4 item 4, three in a row (2 of 3) | live | the same | 45.4 | $0.0270 | **paid** 4.80 to filter-and-fold: https://explorer.testnet.whitechain.io/tx/0xdedadeb8be1ee53cc6428a845024fd8052c4e734dcc4e844a227410638f15742 ; 3 calls, 2,995 tokens; models 15.6 s |
| 01:18 | W4 item 4, three in a row (3 of 3) | live | the same | 42.6 | $0.0247 | **paid** 4.80 to filter-and-fold: https://explorer.testnet.whitechain.io/tx/0x128517cae8acca9ac1cc229ddda5fd0ae1a63065788ad487eac24b0e9d80a238 ; 3 calls, 2,877 tokens; models 14.0 s |

## Kickoff rules and booth questions (closed; rolled up 06:55 IST)

The kickoff rules (the deadline Sat 09:00 IST; AI use documented; spec files in the repo; pre-event work disclosed in writing; the video in the founder's own voice) are in `planning/` and ADR-0028. The organiser said "go all out, use AI the best you can", and we keep full AI disclosure (ADR-0028). Every booth question is closed with the founder's defaults (ADR-0038 to ADR-0044). Prize tracks: ADR-0051; Swarm: ADR-0039 and ADR-0061.

## the day sessions (retired; condensed at the backend's close, 01:55 IST Sat 7 Nov)

**Closed tonight by the night streams:**
- **W3:** subscribe and cancel, the renewals on the cron, the refund decline, the cap actions ("Dosas for everyone", the agent's own raise, the owner's change) and the 0.80 coffee re-order.
- **W1:** the dosa shops' ENS names and the kill.
- **W2:** the dosa shops' history and category.
- **The founder:** the big city M, trimmed to what was seeded, and race mode kept at S.
- **W5:** the mirror's write under the new names.
- **W6:** the SDK READMEs' demo link and the feedback log.

The day's closed items are in `git log` and the archived relays (`docs/archive/thinking-partner-relays/`).

**Still open:**
- **The CI gate** (owner: Coordinator). The `contracts` job does not block a merge; only `ci` is required. Next: an aggregator job after the event.
- **The website's GraphQL asks** (owner: frontend pass, default taken): `Shop` has no Arkiv entity `key`, and `Edge` has no `entityKey` or `orderKind`.
- **The team's four asks** (owner: the team, through the frontend pass):
  - a receipt card for a paid re-order;
  - `ShopChoice.repeatBuyers` optional;
  - a "Sample data" chip for seeded orders;
  - hiding unbuilt buttons.
- **The website** (owner: frontend pass):
  - the read-limit ceilings still in code, against ADR-0069's amendment;
  - the deck's non-demo slides, never checked one by one;
  - one refund-reason table (the chain always gets 1);
  - the demo store, not deployed (https://graphpay-store.vercel.app answers "deployment not found").
- **Keep the stage ready** (owner: Coordinator, until the presentation): payer ACTIVE, shop open, the workers under the watchdog; push a new Arkiv key to Vercel when the founder has one.

## w7-submission

Updated 01:35 IST, Sat 7 Nov (W7 Submission, final).
- **Submit by 08:00 IST** (what: the title, the descriptions, the links and three partner prizes; where: [`docs/submission/ETHGLOBAL.md`](../submission/ETHGLOBAL.md), one block per form field, final at the close; why: the form closes at 09:00 IST; recommendation: paste the blocks as they are, then tick its "Before you press Submit" list).
- **The video** (what: 2 to 4 minutes in your own voice, every party shown; where: the shot list [`docs/submission/VIDEO.md`](../submission/VIDEO.md), and the link in the form's video field; why: Whitechain's qualification and ETHGlobal's rules; recommendation: record with the payer active and the shop open; an errand takes about 47 s now).
- **Review the README and the partner files** (what: the "verify each claim" table, the persona note, the Team section, `arkiv/`, `WHITECHAIN_FEEDBACK.md`, `docs/submission/ENS.md`; why: judges open them first; recommendation: a 10-minute read before submitting).
- **The team list** (what: the README names `Zugzwang-world` and `ajatshatru01` by GitHub handle; why: no other member is recorded in the repo; recommendation: add names or anyone missing, and confirm each is on the ETHGlobal project).
- **The disclosure** (what: the written pre-event disclosure; where: [`docs/plan/DISCLOSURE_MESSAGE.md`](../plan/DISCLOSURE_MESSAGE.md); recommendation: paste it into the Hacker Dashboard if it was not sent).
- Closed: the README, AI_USAGE.md, the Arkiv files, the Whitechain and ENS notes, the form text, the shot list and the checklist (#154 to #211, and this final PR).

## w3-payments

- **The "everyone" quantity** (owner: founder; default taken). What: `order.overPass.quantity` is 100, a synthetic story value labelled as such; the brief gives no headcount. Why: any figure above the pass is refused the same way. Recommendation: keep 100, or set the real headcount in `story.json`.
- **A reconcile at the watcher's start** (owner: W1; not needed tonight). What: a cap the owner sets while the workers are down reaches the policy only with the owner's next change (ADR-0079, known gap). Recommendation: after the event, read each paying agent's ENS cap at start and apply min(ENS cap, configured cap).
- Closed tonight:
  - the 0.80 re-order (#155);
  - subscribe, renew and cancel (#173);
  - the refund decline (#163);
  - over the pass and the refused cap raise (#169, #190);
  - the owner's cap change in both records (#179, #191, ADR-0079), proven live 300 → 250 → 300;
  - acceptance C3 on the re-order's own item (W5).

## w4-agents

- Closed 01:20 IST: acceptance E1 and the relative deadline (W5's #188 updated E1); the brief's four items (#153, #157, #162, #182; three live errands in a row paid at 01:16 to 01:18 IST).

## w2-city

- **Race mode at M needs M's plain store** (owner: the founder). What: the big city M is trimmed to what was seeded (ADR-0081): 3,175 events, graph store only. Race mode's plain side reads the plain store, which was never written for M, so race mode stays at S and D7 stays blocked. Why: writing it is M seeding (about 140 transactions, about 0.5 tGLM, about 13 minutes, write-only after two small reads), which the founder stopped. Recommendation: yes if race at M matters for the pitch. W2 then writes it, measures D7 (Q2: 2 against 14, from the generator), and switches race mode to M with the measured reads. Otherwise race mode stays at S (2 against 5, measured).
- **After the flip, delist the old shops' directory rows** (owner: W2). What: kesar-kingdom, syrup-street and jamun-junction stay listed under their new display names, so the map shows each name twice. Why: acceptance D8 still runs at S, where they are the cast. Recommendation: delist them once D8 moves off S (`node packages/city/scripts/cast.mjs --execute --store delist-test`, in #186).
- **`arkiv/swarm.md` names the old menus** (owner: W7). What: its worked example is Kesar Kingdom's menu. The final cast's menus, now version 2 with their storefront photos, are in `docs/sessions/arkiv/swarm-menus.json`: entity, transaction, reference, link, and each image's reference and hash. Recommendation: use Filter & Fold's as the example ([menu.json](https://api.gateway.ethswarm.org/bzz/3f26da16d819311ceca5fde8e4af8077b497c272292df78d7f3292433df2dc76/menu.json)).
- Closed 00:31 IST: W1's flip changed the labels and the category together, after the history and the workers' restart (#189).

## w6-sdk

- Closed 01:30 IST: npm's web approval. Both SDKs are on npm at 1.0.0, and the founder approved the sign-in and the two publishes.
- **For W7** (owner: W7, via the Coordinator). What: the root README's agentpay row (line 123) still says 0.1.1. Why: agentpay is on npm at 1.0.0 since 01:30 IST (ADR-0080). Recommendation: change it to 1.0.0, as the arkiv-graph row and `arkiv/reach.md` already say.

## frontend

Folded into [`BACKEND_FOR_FRONTEND.md`](BACKEND_FOR_FRONTEND.md) at the backend's close (01:55 IST, Sat 7 Nov): every route and event, with what each screen should do (its section 9). The frontend items filed under `## w5-ops` below are folded there too.

## w5-ops

- **Presenter-only Pause** (owner: the founder; from Founder now). What: a visitor's Pause now heals itself after 2 minutes, and a Close after 5. Why: the open question was whether to make Pause presenter-only after a visitor paused the payer for 96 minutes. Recommendation: keep Pause public; self-healing bounds the damage.
- **W_DIRECTORY's tGLM** (owner: W5). What: the cron renews the shop's listing about every 5 minutes when no merchant page is open; W_DIRECTORY held 0.417 tGLM at 23:15 IST. Recommendation: W5 watches the balance overnight and tops it up from FUNDER (15.08 tGLM) if it runs low.
- **A fresh Arkiv access key** (owner: the founder). What: this Mac's free Arkiv query allowance (10,000 per minute) runs out. The mirror then waits, or re-reads from Arkiv and re-scans, and once took 9 minutes to show a paid order. Why: the access key's quota has been spent since 21:36. Recommendation: a new key from hub.arkiv.network: `pnpm -s secrets:set ARKIV_ACCESS_KEY`, then `pnpm -s secrets:vercel` and a redeploy; W5 restarts the workers.
- **The payer top-up's one runner** (owner: W5). What: `scripts/ops/payer-topup.mjs` refills PAYER from the shop's takings or FUNDER. Why: two sessions running it at once, one per source, would each pass its nonce check. Recommendation: only W5 runs it tonight; ask W5 for a top-up.
- **Decline a refund request** (from w3-payments; owner: the frontend pass).
  - What: `POST /api/merchant/refund-decline`, body `{ orderId, note? }`. The note is plain text, at most 140 characters, with no `@ / :` and no run of six digits (no contact details on a public graph). The request's reason follows the same rule now.
  - Answer: `{ orderId, decision: 'declined', amountMicro, requestRef, ref, note, arkivTx, entityKey }`. `arkivTx` is null when the decline was already on the record.
  - Refusals: `NO_REQUEST`, `ALREADY_DECIDED`, `STILL_PENDING` (the chain shows a refund the graph does not yet), `NOT_REFUNDABLE`, `NOT_THE_STORY_BUYER`, `NOT_OURS`, `NO_SUCH_ORDER`, `BAD_ORDER`, `BAD_NOTE`, `TRAIL_TOO_LONG`, `TOO_SOON`.
  - Event: a `request` edge in `/api/merchant/events` *from the shop to the payer agent*, ref `dec:<orderId>:<the request's minute>`, one per request. A refund request is the same kind the other way round (payer to shop, ref `req:`). The note is in the route's answer only; the graph's edges carry no payload.
  - Recommendation: wire `declineRefund` to the route. In `apps/phones/src/orders.ts`, `isLive` drops `dec:` rows today, so nothing changes on the phones yet. When it is widened, add a `dec:` branch where `request` rows are folded (refund status `declined`), or the decline becomes a second pending request and rings `refund_request`. The `/order/<id>` page already words it "Refund declined" (`lib/order-trail.ts`). The unlinked `/merchant` page still says "Refund requested by" the shop.
- **Over the pass, "for everyone"** (from w3-payments; owner: the frontend pass).
  - What: `POST /api/customer/over-pass`, empty body. The payer agent signs the story's `order.overPass` order: 100 of the combo, 480 test USDT. The signed attempt goes to our facilitator's verify step only, which never sends. It refuses (`CAP_EXCEEDED`, the lower of the ENS cap and the policy cap), and its recorder writes the refusal to Arkiv. Only an attempt above the whole pass is ever signed.
  - Answer: `{ refused, reason, sent: false, request, item, quantity, attemptedMicro, passMicro, spentTodayMicro, leftMicro, orderId, arkiv: { ref, entityKey }, repeated? }`. A second tap within a minute gets the same answer with `repeated: true`, and no new record. `NOT_OVER_PASS` means the order fits the pass, so nothing is signed. `BALANCE_COVERS` means the payer could pay it, so nothing is signed (a second belt). Without a decision on the payer (no answer, the facilitator's own read failure, or a failed step before verify) the route returns 502 `NO_DECISION` with `reason`, `signed` and `orderId`. It is never reported as a refusal, and nothing is sent, since the attempt is only verified.
  - Event: a `fail` edge from the payer agent to the shop, ref `att:<orderId>:…`, in the merchant stream.
  - Recommendation: a "Dosas for everyone" chip (its text is `order.overPass.request`) that calls the route and shows a refused attempt (`RefusedAttempt` kind `payment`, reason `cap`) with the Arkiv entity link.
- **The agent tries to raise its own cap** (from w3-payments; owner: the frontend pass).
  - What: `POST /api/customer/raise-cap`, body `{ capMicro? }`; the default is double the ENS cap. The route simulates `setText(graphpay.cap_micro)` from the payer agent's address on Sepolia, at a stated block, and the resolver reverts `EACUnauthorizedAccountRoles`. Nothing is sent, and only that revert is recorded.
  - Answer: `{ refused: true, sent: false, simulated: true, revert, agent, owner, key, attemptedMicro, currentMicro, resolver, block, arkivTx, entityKey, repeated? }`.
  - Event: a `request` edge from the payer agent to the persona, ref `cap:<node>:<minute>`, amount 0 (the figure is in its payload). It is not in the shop's stream.
  - Recommendation: wire `tryRaiseCap` to the route and show `cap.change.refused` with the revert reason and the Arkiv link.

- **The owner changes the payer's cap** (from w3-payments; owner: the frontend pass).
  - What: `POST /api/customer/cap`, body `{ capMicro }`, a micro-USDT string, at most the configured cap (`buyerAgents.payer.capMicro`, 300 tonight).
  - The owner's wallet writes the ENS record on Sepolia. The watcher on the Mac then writes the policy as min(ENS cap, configured cap) (ADR-0079; W1's change). The route waits up to 90 s for it.
  - Answer: `{ agent, owner, capMicro, configuredMicro, ens: { changed, beforeMicro, sepoliaTx }, policy: { capMicro, applied }, effectiveMicro, arkivTx, entityKey }`.
  - Refusals: `OVER_CONFIGURED`, `UNDER_FLOOR` (below today's spend plus the story errand's budget, `order.budgetMicro`, so the next errand always fits; a restore to the configured cap is always allowed), `BAD_CAP`, `TOO_SOON` (one change per 20 s per instance). `policy.capMicro` is null when the policy could not be read; `arkivTx` is null when the record could not be written. The ENS change stands either way.
  - Event: a `request` edge from the persona to the payer agent, ref `own:<node>:<second>:<cap>`, amount 0, the figures in its payload. The node row's `capMicro` follows through the mirror.
  - Recommendation: wire `setCap` to the route and emit `agent.cap.changed` with the Sepolia link and, once `policy.applied`, the new pass.
