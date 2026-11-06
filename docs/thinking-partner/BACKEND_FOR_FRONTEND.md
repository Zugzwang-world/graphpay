# Backend for the frontend

Written 01:55 IST, Sat 7 Nov, by the night Coordinator, from what is merged on `main` (b3890e9), with read-only checks of the live site between 01:14 and 01:50 IST. It is the one file the frontend pass needs: every route and event the phones and the deck can use, the errand's step frames, the Swarm content, the race numbers, the ENS names, the link formats, the constraints and the known issues. OPEN's frontend list is folded in (section 9).

**Ground rules**
- **Restyle only.** The backend is closed. Every route and event below is live; nothing here needs a backend change.
- **Base URL:** `https://graphpay-event.vercel.app` (config `site.url`). Use relative paths on the site, never `VERCEL_URL`.
- **Public access** (ADR-0069): no passcode for visitors. The keys between our own servers stay, and section 1.4 lists those routes.
- **Story values** come from `packages/config/story.json` through the phones' build projection (`apps/phones/story-projection.mjs`). Never hard-code a name, price or address (ADR-0030, ADR-0047).
- **Read ENS and Arkiv through these routes,** not from the browser. The exceptions are Swarm images and explorer links, which are plain URLs.

## 1. Routes

Shared behaviour (`apps/web/lib/http.ts`):
- every answer is `cache-control: no-store` unless noted;
- a route whose server key is missing answers **503** `{ error: 'not live yet', waitingFor }`;
- bad input is **400** `{ error }`;
- a body is a JSON object of at most 4 KiB (empty reads as `{}`);
- a chain failure reaches the browser as one fixed sentence, never the RPC's text.

### 1.1 Reads (GET)

| path | answer | notes |
|---|---|---|
| `/api/state/customer` | `{ agent: { ens, status: ACTIVE\|PAUSED\|REVOKED\|EXPIRED\|UNKNOWN, epoch }, capMicro, spentTodayMicro, policyExpiresAt, lastOrder: { orderId, shopEns, amountMicro, status: PAID\|DELIVERED\|REFUNDED\|PARTIALLY_REFUNDED\|FAILED, transaction } \| null, subscription: { subId, plan, period, priceMicro, nextChargeAt, renewals: [{ at, transaction }], active, status: ACTIVE\|LAPSED\|CANCELLED, cycle, periodSeconds, chargesLeft, item, shopEns } \| null }` | The payer agent only. `capMicro` is the spending policy's cap; the gate enforces min(ENS cap, policy cap). 429 above 400/min/client; 502 if a source fails. `lastOrder` comes from Arkiv, so it can lag the chain (section 10). |
| `/api/state/heal` | `{ healing, resumeAfterS: 120, reopenAfterS: 300, agents: [{ ens, status, pausedAt, resumesAt }], shop: { ens, open, openUntil, closedAt, reopensAt } \| null, at }` | Self-healing's plan, ISO times. `status` is the raw ENS text (`active`, `paused`) or `unknown`. Cached 10 s. |
| `/api/customer/kill-disposable` | `{ spare: { label, name, epoch } \| null, live, pool }` | The ready spare for the kill. Show the kill button only while `spare` is set. |
| `/api/map` | `{ box, persona, neighbourhoods: [{ area, lat, lng, source }], shops: [{ ens, shopKey, name, area, lat, lng, synthetic, open }], agents: [{ key, ens, owner, role, session }], at }` | Micro-degrees in `box`. Lists up to 100 real and 100 synthetic shops; `open` means a live listing; `agents` are live presence rows. |
| `/api/status` | `{ heads: { whitechain, sepolia, rabdi }, mirrorLagBlocks: null, relayerWbt: null, token, tokenAddress, checkout, notes, at }` | `mirrorLagBlocks` and `relayerWbt` are always null today (section 10). |
| `/api/merchant/export.csv` | CSV, 13 columns (`date_utc, date_local, order_id, kind, buyer_ens, payer_ens, shop_ens, amount_usdt, net_effect_usdt, token, tx_hash, explorer_link, ref`) | The story merchant's orders. Headers `x-export-days`, `x-export-truncated`. |
| `/api/explain/:id` | `{ explainId, backend, queries, ms, bytes, entityKeys, blockNumber, warnings, notes, truncated, calls, reads }` | 12 hex characters. Each server instance keeps its last 200, so an old or foreign id answers 404. |
| `/api/graphql` | `{ data, errors?, extensions: { arkiv: { explainId, calls, bytes, queries, … } } }` | `?query=&variables=&dataset=live\|S\|M`. 60/min/client. The phones use `handoffs(requestId)` (lanes and deck) and `order(id)` (`/order/<id>`). |
| `/api/race` | a stream (section 3.3) | `?question=Q1\|Q2\|Q5&mode=graph\|plain&size=S&inFlight=1\|4\|8\|16\|all`. Main serves S only; another size answers 400 `only the size S city is seeded`. |

### 1.2 Actions (POST, open to every visitor)

| path | body | success | refusals worth a screen | waits and limits |
|---|---|---|---|---|
| `/api/agents/run` | `{ request }` (1–400 chars) | a stream (section 3.1) | **409 `busy: one errand at a time`**; 400 | One errand at a time per server; cut at 280 s. |
| `/api/customer/pause` | `{}` (the payer) or `{ agent: '<ENS name>' }` | `{ changed, sepoliaTx, note, agent, effectiveWithinS: 20, resumesAfterS: 120 }` | 409 `NO_PASS` with a sentence to show as it is (Concierge, Analyst); 429 during the 20 s gap or a full queue | One status change per 20 s per server, any agent. |
| `/api/customer/resume` | as pause | `{ changed, sepoliaTx, note, agent, effectiveWithinS: 20 }` | as pause | Shares the 20 s gap. |
| `/api/customer/reorder` | `{ parentOrderId }` (the payer's newest order) | `{ status: 'paid', orderId, parentOrderId, amountMicro, transaction }`, or 202 `pending` | 409 `NOT_REORDERABLE`, `PRICE_CHANGED`, `OVER_DAILY_CAP`, `PASS_REVOKED`; 429 `TOO_SOON` | 120 s per order; pays the story's re-order (the filter coffee, 0.80). |
| `/api/customer/refund-request` | `{ orderId, amountMicro, reason }` (1–140 printable chars, no `@ / :`, no run of 7+ digits) | `{ orderId, amountMicro, arkivTx, entityKey }` | 400 `BAD_REASON`, `BAD_AMOUNT`; 409 `OVER_REFUNDABLE`; 429 | One per order per minute. The photo stays on the phone (section 5). |
| `/api/customer/subscribe` | `{}` or `{ plan: 'sunday-box' }` | `{ status: 'active', subId, plan, item, sku, shopEns, priceMicro, periodSeconds, period, maxCharges, allowanceMicro, firstChargeAt, nextChargeAt, transaction, firstCharge }`, or 202 | 409 `ALREADY_SUBSCRIBED` (with `subId`), `OVER_PASS`, `BALANCE_LOW`, `PAYER_NOT_ACTIVE`; 429 `TOO_SOON`; 503 `RENEWER_LOW` | 2.40 a box on the labelled 2-minute demo clock, at most 3 charges; one live subscription at a time; none within 3 min of the last. |
| `/api/customer/unsubscribe` | `{}` or `{ subId }` | `{ status: 'cancelled', subId, transaction, effectiveAt }`, or 202 | 404 `NO_SUBSCRIPTION`; 409 `NOT_ACTIVE` | The payer agent's own signature, gasless. |
| `/api/customer/kill-disposable` | none | `{ label, name, txs: [{ chain, what: unregister\|revoke, hash }], revoked, payment: { outcome: refused\|paid\|unknown\|not-sent, http, reason, orderId, transaction }, recorded, nextSpare, incomplete }` | 409 while another kill runs; 503 no spare ready | Takes 40–110 s. The beat: `payment.outcome` `refused`, `reason` `ENS_EXPIRED_OR_REVOKED`, plus `recorded`. Each tap ends one name for good. |
| `/api/customer/over-pass` | none | `{ refused, reason, sent: false, request, item, quantity, attemptedMicro, passMicro, spentTodayMicro, leftMicro, orderId, arkiv, repeated? }` | 409 `NOT_OVER_PASS`, `BALANCE_COVERS`; 502 `NO_DECISION` (never shown as a refusal) | "Dosas for everyone": 100 combos, 480 against the 300 pass. It goes to the facilitator's verify step only, so it can never settle. A repeat within 60 s returns the last answer with `repeated: true`. |
| `/api/customer/raise-cap` | `{ capMicro? }` (default double the ENS cap) | `{ refused: true, sent: false, simulated: true, revert: 'EACUnauthorizedAccountRoles', agent, owner, key, attemptedMicro, currentMicro, resolver, block, arkivTx, entityKey, repeated? }` | 400 `BAD_CAP`, `NOT_A_RAISE` | The agent's own attempt, simulated on Sepolia; nothing is sent. |
| `/api/customer/cap` | `{ capMicro }` | `{ agent, owner, capMicro, configuredMicro, ens: { changed, beforeMicro, sepoliaTx }, policy: { capMicro, applied }, effectiveMicro, arkivTx, entityKey }` | 409 `OVER_CONFIGURED`, `UNDER_FLOOR`; 429 `TOO_SOON` | The owner's change, ENS first; the watcher on the Mac then sets the policy to min(ENS, 300). Waits up to 90 s for it (ADR-0079). It never goes below today's spend plus one errand's budget. |
| `/api/merchant/open` | `{ on: true\|false }` | `{ open, openUntil, entityKey, renewEveryS: 300 }` | 502 | A listing lasts 15 min; the merchant page renews it every 300 s, and the heal cron also keeps it. |
| `/api/merchant/dispatch` | `{ orderId }` | `{ transaction, status: 'confirmed' }`, or 202 | 409 `NOT_DELIVERABLE`, `STILL_PENDING`, `GAS_LOW`; 429 | 30 s per order for visitors. |
| `/api/merchant/refund` | `{ orderId, amountMicro }` or `{ orderId, full: true }` | `{ transaction, status, amountMicro, full }`, or 202 | 409 `OVER_REFUNDABLE`, `FLOAT_LOW`; 429 | As dispatch. |
| `/api/merchant/refund-decline` | `{ orderId, note? }` (same text rule as the reason) | `{ orderId, decision: 'declined', amountMicro, requestRef, ref, note, arkivTx, entityKey }` | 409 `NO_REQUEST`, `ALREADY_DECIDED`, `STILL_PENDING` | One per order per minute. |

### 1.3 Streams

| method and path | events | notes |
|---|---|---|
| POST `/api/agents/run` | `started`, `trace`…, then `result` or `failed`; a keep-alive comment every 5 s | Section 3.1. |
| GET `/api/agents/run/:id/events` | the same frames, replayed | Same server only; kept 5 min after the run; else 404. |
| GET `/api/merchant/events?since=<unix s>` | `ready`, then `edge`… | Polls the graph every 2.5 s, ends itself after 50 s; reconnect with `since`. |
| GET `/api/race` | `call`…, then `answer` or `error` | Section 3.3. |

### 1.4 Not for the frontend

Server-to-server and cron routes: `/api/cron/heal` and `/api/cron/renew` (CRON_SECRET, every minute); `/api/facilitator/*` (bearer token); `/api/recorder/attempts`; `/api/shop/*` (the agents' x402 shop); POST `/api/mcp` (the agents' MCP endpoint); POST `/api/graphql` (agents). Pages: `/` and `/live` (the stage: customer phone, deck, merchant phone), `/map`, `/race`, `/explain`, `/explain/<id>`, `/order/<id>`, `/how`; `/customer` and `/merchant` are T5's own screens, not linked from the stage.

## 2. What the phones do today

`apps/phones/src/live-adapter.ts`:
- **Snapshot:** `GET /api/state/customer`, `/api/map` and `/api/merchant/export.csv` together.
- **Polls:** the customer state every 15 s and the map every 30 s.
- **The merchant stream** reconnects from 1.5 s, doubling to 30 s with jitter.
- **Wired:** the errand, re-order, refund request, pause and resume (as the payer), Open (re-sent every 300 s), dispatch and refund.
- **Not wired** (they answer "This action is not available yet."): subscribe, cancel, revoke or kill, the cap raise, the decline, the over-pass and the owner's cap.
- **After a dropped errand stream:** the phones re-attach by run id up to 8 times, then read the payer's newest order every 4 s; they never offer a second errand.

## 3. Events

### 3.1 The errand stream

| event | payload |
|---|---|
| `started` | `{ runId }`, a UUID that is also the Arkiv `handoff.request_id` |
| `trace` | `{ seq, type, … }`, typed below |
| `result` | `{ status: paid\|refused\|no-purchase\|unsettled, chosenShop, priceUsdt, receipt: { success, transaction, network, payer, payTo, amountUsdt, asset, explorerUrl } \| null, orderId, arrivesAt, ranking: [{ ens, score, eligible, reasons }], explainId, refusals: [{ reason, detail, agent? }], narrative, modelChoice, mandate: { budgetUsdt, deadlineIso, hash }, synthetic: true }` |
| `failed` | `{ error }`: `the errand ran out of time`, `busy: the last errand is still finishing; try again in a minute`, or `the errand failed` |

Trace types:
- `message` `{ from, to, text }`;
- `agent.start` `{ agent, role, task }`;
- `agent.end` `{ agent, role, output, usageTokens, model ('code' for a code-run agent), effort, calls, seconds }`;
- `tool.call` `{ agent, tool, input }`;
- `tool.result` `{ agent, tool, output, error? }`;
- `guard` `{ guard: G1…G16, ok, detail }`.

The lane is not in the stream: it goes to the Arkiv `handoff` row, which `/live` polls.

Refusal codes the phones map: `CAP_EXCEEDED` (cap), `ENS_PAUSED` (paused), `ENS_EXPIRED_OR_REVOKED` and `AGENT_REVOKED` (revoked), `SHOP_NOT_ELIGIBLE` (trap shop), `QUOTE_EXPIRED`, and `OVER_BUDGET`, `OVER_APPROVED_PRICE` or `MISSES_DEADLINE` (budget).

### 3.2 The merchant stream

- **`ready`** carries `{ shop, cursor }`. **`edge`** carries `{ kind, from, to, amountMicro, orderId, ref, ts, settlementTx }`.
- **Kinds sent:** `order`, `pay`, `refund`, `deliver`, `fail`, `request`, `subscribe`, `renew`. `cancel`, `late` and `dispute` exist in the graph but are dropped from this stream.
- **`ref` tells the kinds apart:**
  - a chain event is `1874:<tx>:<log>`;
  - a refund request is `req:<order>:<minute>` (payer to shop);
  - a decline is `dec:<order>:<minute>` (shop to payer);
  - a refused attempt is `att:<order>:…` (payer to shop, kind `fail`).
- **Not in the shop's stream:** the cap raise (`cap:`) and the owner's cap (`own:`), because they do not touch the shop.
- **Payloads:** edges carry none, so a refund's reason or a decline's note is only in the action's answer.

### 3.3 The race stream

`call` `{ call, ms, bytes }`…, then `answer` `{ answer, correct, truthBasis: identity|name, calls, bytes }` or `error`. The result is a count of reads, never a clock (ADR-0042). One race per side per server; 20/min/client.

### 3.4 Messages between the stage's frames (same-origin `postMessage`)

- `graphpay.run-frame`: customer phone → `/live`, carrying each errand frame.
- `graphpay.phone-event` `{ key, chips: [{ label, href }] }`: either phone → `/live`. The keys are `refund-request`, `refund`, `paused`, `resumed`, `shop-open` and `renewal`; only `https://` chips are kept.
- `graphpay.deck`: `/live` → deck `{ entries, key, go, home, live, of: 7, reached }`.
- `graphpay.deck-replay`: deck → `/live`.

### 3.5 The deck's table (`apps/web/lib/deck-map.ts`; a test keeps each title equal to its slide)

| key | errand step | slide | moved by |
|---|---|---|---|
| `ask` | 1 | 5 One message, a whole team | any trace event |
| `team` | 2 | 4 Two desks, two teams | a handoff in lane `ask` |
| `check` | 3 | 7 The same receipts, as a graph | lane `check` |
| `check-back` | 4 | 9 The shop checks the buyer back | lane `check-back` |
| `quote` | 5 | 10 The payment, step by step (step 2) | lane `quote` |
| `payment` | 6 | 10 (from step 3) | lane `pay` |
| `record` | 7 | 15 How one payment is written | `result.status === 'paid'` |
| `refund-request`, `refund` | — | 11 A refund, with proof | phone events |
| `paused`, `resumed` | — | 14 Stopped, live | phone events |
| `shop-open` | — | 4 | phone event |
| `renewal` | — | 12 Every way a business gets paid | phone event |

Slides 1–3, 6, 8, 13 ("Agents can't raise their own limits") and 16–19 have no row.

### 3.6 The team's contract events (`frontend/src/demo/contract.ts`)

- **Emitted live:** `agent.message`, `agent.status`, `graph.read`, `shops.compared`, `quote.created`, `payment.signed`, `payment.settled`, `payment.refused`, `error`, `order.updated`, `refund.requested`, `refund.settled`, `agent.permission` (always for the payer today), `merchant.notification`, `shop.status`, `agent.pass.period`.
- **Not emitted yet**, though the team's screens wait for them: `renewal.created`, `renewal.charged`, `renewal.cancelled`, `cap.change.refused`, `agent.cap.changed`, `demo.reset`. The routes in 1.2 give everything they need.

## 4. The errand's step frames (code mode, ADR-0078)

The scout, payer, storefront and dispatch run in code. The concierge (high), the analyst and the risk agent (low) each make one Kimi call.

| # | deck key | what happens | main frames |
|---|---|---|---|
| 1 | `ask` | the request and its mandate | `started`; `message` persona → concierge (the request); `guard` G1 (budget, deadline, hash); `agent.start` concierge |
| 2 | `team` | the concierge hands out the job | `message` concierge → scout ("find …") and → analyst ("rank shops …"); `agent.start` scout, analyst |
| 3 | `check` | the scout lists shops and reads catalogs; the analyst reads the graph | `tool.result` `directory_list`, `catalog_read` (offers with price, ETA, distance); `tool.result` `graphql` (with `extensions.arkiv.calls`, `explainId`); `guard` G2; `message` analyst → concierge "best eligible: …" |
| 4 | `check-back` | the shop vets the buyer | `agent.start` risk; `tool.result` `ens_check`, `ask`; `message` storefront → risk "vet …"; `guard` G9; `message` risk → storefront approve or decline |
| 5 | `quote` | the binding quote; the 402 | `message` payer → storefront "quote …"; `tool.result` `get_quote` (price, ETA, `orderId`); `message` storefront → payer "402 payment required" |
| 6 | `payment` | signature, settlement, dispatch | `guard` G2; `message` concierge → payer "pay …"; `guard` G5 "every check passed before signing"; `message` "payment signature"; dispatch "dispatched …, arrives …"; storefront "settled <tx>"; `tool.result` `pay_order` `{ status: 'paid', amountUsdt, transaction, explorerUrl, orderId, arrivesAt }` |
| 7 | `record` | the result | `result` |

**Measured timing** (W4, three errands after the flip, 01:16–01:18 IST):
- **Per errand:** 47.4 s on average, 3 model calls, about 2,950 tokens and $0.027.
- **One run's breakdown (00:24 IST, 55.5 s):**
  - start-up 5 s;
  - scout and analyst reads 2 s;
  - analyst 5.3 s;
  - concierge 4.4 s;
  - quote with risk 6.5 s;
  - "pay order" to the 402, 13.6 s;
  - pre-sign 1.9 s;
  - signature to "settled", 13.3 s.
- **Handoff rows:** they are written in batches, and the first `pay` row lands before the `quote` and `check-back` rows (section 10).

## 5. Swarm content

- **Storage:**
  - Each shop has one `menu.json` on Swarm, and each image is its own file. They sit on the public gateway `https://api.gateway.ethswarm.org`, anonymous and never encrypted (ADR-0039, ADR-0061).
  - The menu document: `{ schema: 'graphpay.menu.v1', synthetic, version, shop: { ens, name, image }, items: [{ sku, name, unit, quantity, priceMicro, image }] }`.
  - Every `image` is `{ ref, name, contentType, sha256, bytes }`, at most 64 KiB.
- **On Arkiv:** a `menu` entity (W_DIRECTORY, 14 days) with `shop_key`, `shop_ens`, `version`, `swarm_ref`, `content_hash` (sha-256 of the menu) and `size`.
- **Link format:** `https://api.gateway.ethswarm.org/bzz/<ref>/<file name>`. The file name is required, because a bare `/bzz/<ref>` redirects to a forbidden page.
- **Fetching:** `readMenu` from `@graphpay/money-graph` finds the row, reads the menu and checks its hash. The phones' build reads the dish images keyless (`apps/phones/menu-images.mjs`). No website route serves menus; the phones show the same files from `/phones/grok/`.

| shop | menu (Arkiv) | menu.json | storefront photo | dishes |
|---|---|---|---|---|
| Filter & Fold | [entity](https://rabdi.explorer.arkiv.network/entity/0x628f9aeed5550c543ca17dbfc14b0f15e683114c556ea273bbfe753c635604f8) | [menu.json](https://api.gateway.ethswarm.org/bzz/3f26da16d819311ceca5fde8e4af8077b497c272292df78d7f3292433df2dc76/menu.json) | [storefront](https://api.gateway.ethswarm.org/bzz/2edb64a7735e6a123b638e402249e3e32d6977142550e0fab2c39d506738b7c7/storefront-filter-and-fold.jpg) | masala dosa combo ([photo](https://api.gateway.ethswarm.org/bzz/0f28013fa2f52285c954066fd6a4597106aabe6dfc1136ae1bd8028149406613/filter-and-fold-masala-dosa-combo.jpg)), filter coffee, Sunday breakfast, podi idli |
| Idli Index | [entity](https://rabdi.explorer.arkiv.network/entity/0xd762c4cfffa6eb056ad8137e403d2535e957d9d823ca80ef7fe766e9b44550b0) | [menu.json](https://api.gateway.ethswarm.org/bzz/f81bafea0300e3b4944d3b9d426fc16f34be60dd377c336735143b58a1bb0c2c/menu.json) | [storefront](https://api.gateway.ethswarm.org/bzz/13b59e76439760f98f18e9ba7dcbbfd48cdb4de7e06c38970977f56c100f11b0/storefront-idli-index.jpg) | masala dosa combo, idli sambar, medu vada, rava upma |
| Tawa Tangle | [entity](https://rabdi.explorer.arkiv.network/entity/0xdb8649b11eb5a7b9ab3a2f6e98effe3ea24caefc9928931510fa1dc2c0fc4eba) | [menu.json](https://api.gateway.ethswarm.org/bzz/cb37ab29d0297440b048fc4fc37d439c75d807f563c00c54f6d46d6f0ba5a24f/menu.json) | [storefront](https://api.gateway.ethswarm.org/bzz/bfec2002a8abb8c0bee9a78dd0246f1ce1e087bc6fafbe3ad2fa84da5b7ea10e/storefront-tawa-tangle.jpg) | masala dosa combo, onion uttapam, lemon rice, filter coffee |

- **Every dish's link,** with its sha-256 and size, is in `docs/sessions/arkiv/swarm-menus.json`. The menus are version 2, written 01:11 IST, and the storefront photos landed with #201.
- **Refund photos are not built, by decision** (ADR-0053: Swarm is first in the cut order). The refund request's photo stays on the phone and is not uploaded. The deck's refund slide still describes an encrypted photo on Swarm (section 10).

## 6. Race mode: measured numbers

- **What the site shows:**
  - Race mode is at **size S**, the founder's decision at 01:24 IST.
  - `/race` and `/api/race` read the synthetic city `graphpay-city-v1-S`. The page labels it "synthetic city, size S" and reads its numbers from `bench/results/questions-S.csv` at build time.
- **The measured run** (Arkiv Rabdi, run at 03:38 IST on Fri 6 Nov, 5 runs each; reads are Arkiv JSON-RPC calls):

| question | plain reads | GraphPay reads | both right |
|---|---|---|---|
| Q1 the featured shop's refund rate and 90-day orders | 3 | 3 | yes |
| Q2 the top 10 shops by sales, city-wide | 5 (6 with 4+ in flight) | **2** | GraphPay right; plain right by name, wrong by identity |
| Q3 the persona's agents' spend by shop this week | 2 | 3 | yes |
| Q4 agents that paid a shop this week and later refunded someone else | 1 | 1 | yes |
| Q5 a payment path to the trap shop within 3 hops | 5 | 3 | yes |
| Q6 the featured shop's depth-2 neighbourhood | 2 | 2 | yes |

- **The headline is Q2:** 2 reads against 5 or 6. A live graph-side Q2 at 01:14 IST answered with 2 calls, correct.
- **The big city M:** M is what was seeded, 3,175 of its 9,996 events (123 shops, labelled synthetic), with no plain store, so it is not raced. **No M number exists.**
  - "2 against 14" is the generator's count, not a measurement.
  - The deck's "48 reads" is the pre-event lab's 10,000-event city. Label it "lab", or show the S numbers.

## 7. ENS names and explorer links

- **Network:** Ethereum Sepolia (11155111). The root is `graphpay.eth`. Every name has its own registry and resolver; the addresses are in `packages/config/graphpay.config.json` and `docs/sessions/identity/namespace.json`.
- **Persona:** `vitalik.graphpay.eth`.
- **Buyer agents:**
  - `concierge.vitalik.graphpay.eth` (no pass);
  - `scout.vitalik.graphpay.eth` (1 USDT a day);
  - `analyst.vitalik.graphpay.eth` (no pass);
  - `payer.vitalik.graphpay.eth` (300 a day).
- **Spare disposable agents:** `disposable-<n>.vitalik.graphpay.eth` (1 USDT a day); the current spare is from GET `/api/customer/kill-disposable`.
- **Shops:**
  - `filter-and-fold.graphpay.eth` (good);
  - `idli-index.graphpay.eth` (runner-up);
  - `tawa-tangle.graphpay.eth` (trap).

  Each has `storefront.`, `risk.` and `dispatch.<shop>`. The old names (`kesar-kingdom`, `syrup-street`, `jamun-junction`) stay registered as history, and their payments stay under them.
- **Synthetic shops:** `shop-NNN.sim.graphpay.eth`.
- **Text records:** `graphpay.status` (`active`/`paused`), `graphpay.cap_micro`, `graphpay.principal`, `graphpay.kind`, `graphpay.synthetic`, `x-graphpay-accepts`, `agent-context`, `agent-endpoint[mcp]`, `agent-endpoint[web]`.
- **The payee** is the address record for coin type 2147485522 (ENSIP-11 for chain 1874). Only the owner can write status and cap. Read them through `/api/state/customer` and `/api/state/heal`, never from ENS directly.

| network | base | formats |
|---|---|---|
| Whitechain Sepolia (1874) | `https://explorer.testnet.whitechain.io` | `/tx/<hash>`, `/address/<addr>`, `/block/<n>`, `/token/<addr>` |
| Ethereum Sepolia | `https://sepolia.etherscan.io` | `/tx/<hash>`, `/address/<addr>`, `/block/<n>` |
| Arkiv Rabdi (7794095) | `https://rabdi.explorer.arkiv.network` | `/tx/<hash>`, `/address/<addr>`, `/entity/<key>`, `/entity-explorer?q=<query>` |
| Swarm | `https://api.gateway.ethswarm.org` | `/bzz/<ref>/<file name>` |

The site builds links in `apps/web/lib/explorer.ts`, and the phones in `apps/phones/src/links.ts`. The phones' "View on ENS" link opens Sepolia Etherscan.

## 8. Constraints

- **One errand at a time,** per server instance. A second caller gets 409 `busy: one errand at a time`, and the phones say "Another errand is running right now. Try again in a minute." A run is cut at 280 s.
- **Self-healing** (W5, the heal cron, every minute):
  - a paused agent resumes 120 s after its pause;
  - a closed shop reopens 300 s after its close;
  - a listing with under 10 min left is renewed.

  `GET /api/state/heal` gives the plan, so show "resumes by itself at …" and "reopens at …". `GRAPHPAY_HEAL=0` turns it off.
- **The payer's pass:**
  - 300 test USDT a day (`buyerAgents.payer.capMicro`), in the policy and the ENS record. It resets at 00:00 UTC, which is 05:30 IST.
  - A subscription signs for at most 3 charges of 2.40.
  - The owner can lower the cap, never above 300 and never below today's spend plus one errand's budget (6).
- **Pause per agent:** only the scout and the payer can be paused. Status changes keep a 20 s gap per server, but the cron is exempt.
- **The deadline is relative:** "delivered within an hour" (`order.request`). The run's own deadline is `result.mandate.deadlineIso`.
- **Public access:** visitors meet no passcode, and the on-chain pass is the real limit. The read ceilings per client are still in code (section 10).

## 9. OPEN's frontend list (folded in)

1. **Kill a disposable agent** (W1):
   - Show the button only while GET's `spare` is set, on Vitalik's phone, in an "advanced" corner, because each tap ends one name for good.
   - POST takes 40–110 s: show a countdown, then three links (the Sepolia unregister, the Whitechain revoke and the refusal on Arkiv).
2. **The "By 23:59" chip on `/customer`** (W4): show "within an hour", or `result.mandate.deadlineIso`.
3. **The deck's errand text** (W4): copy `order.request` from the story; the deck's hand copy still says "by 11:59 pm".
4. **Re-order is "another coffee"** (W3): label the button from `order.reorder.item` and `order.reorder.priceMicro`.
5. **Subscribe** (W3): wire `startRenewal` to POST `/api/customer/subscribe` and emit `renewal.created` with the first charge's link. Use `renewal.sku`; the projection still uses `order.sku`.
6. **Cancel** (W3): wire `cancelRenewal` to POST `/api/customer/unsubscribe` and emit `renewal.cancelled`.
7. **The subscription in the customer state** (W3):
   - Fill `snapshot.renewals` from `subscription`.
   - Each charge is a `renew` plus a `pay` edge in the merchant stream.
   - When `active` and `chargesLeft` is 0, offer Cancel.
8. **Pause and Resume on the tapped card** (W5): send `{ agent: <ens> }` and emit `agent.permission` for that agent. On Concierge and Analyst, show the 409 sentence, or hide Pause.
9. **Self-healing on the phones** (W5): poll `/api/state/heal` with the customer state, and show the resume and reopen times. The merchant phone keeps its own Open state today.
10. **Menus, dishes and storefronts on Swarm** (W2): where the Swarm prize is shown, open the photos from Swarm (section 5). The phones' own copies are the same files.
11. **The big city's shops are not on the map** (W2): M's 120 places were held back, because `/api/map` reads every synthetic shop on each poll. Filter the map by dataset, or show them from `story.json` (`syntheticCity.places`) without reading Arkiv.
12. **Race mode** (W2): show the 429's `error` text instead of "Another race is running". Label the deck's 48 reads "lab", or show the S numbers.
13. **Decline a refund request** (W3):
   - Wire `declineRefund` to POST `/api/merchant/refund-decline`.
   - In `apps/phones/src/orders.ts`, add a `dec:` branch (refund status `declined`). Otherwise a decline would show as a second pending request.
14. **Over the pass, "Dosas for everyone"** (W3): a chip whose text is `order.overPass.request`. Show a refused attempt (kind `payment`, reason `cap`) with the Arkiv link.
15. **The agent raises its own cap** (W3): wire `tryRaiseCap` to POST `/api/customer/raise-cap` and show `cap.change.refused` with the revert reason and the Arkiv link. The deck's slide 13 has no row yet.
16. **The owner changes the cap** (W3): wire `setCap` to POST `/api/customer/cap`. Emit `agent.cap.changed` with the Sepolia link and, once `policy.applied`, the new pass.

The team's four older asks stay in OPEN under `## phones`: product images, hiding unbuilt actions, a pause switch, repeat buyers.

## 10. Known issues

**Phones**
- Pause and Resume always act on the payer (item 8). A tap on Scout's card pauses the payer and may leave Scout's card pending; this is inferred from the code.
- `story.demo` is missing from the build's projection, so the self-raise button may show a raw error. This is inferred from the code.
- `snapshot.renewals` is always `[]`, and `errandRunning` is always `false`.
- `policyExpiresAt` is read as a number, though it is an ISO string. It is null today, so nothing shows wrong yet.
- The merchant fold drops refused attempts (`att:`) and declines (`dec:`). A refund's reason is always empty, because edges carry no payload.
- The deck can move twice for one refund: once from each phone. This is inferred from the code.
- The team's copy still tells the sweets story (`frontend/src/copy.ts`).
- The phones send no passcode, which is fine while public access is on.

**Deck**
- Its hand copy of the story is old: the "by 11:59 pm" request, cap 100 where the pass is 300, the old shop labels, and the lab's numbers.
- The refund slide describes an encrypted photo on Swarm, which is not built.
- `/live` moves the deck to the furthest lane with any row, and the first `pay` handoff lands before `quote` and `check-back`. So the deck may jump past steps 4 and 5; this has not been seen.
- `/live` ignores `failed` frames, so after a failed errand the deck keeps a run with no result.
- The non-demo slides were never checked one by one.

**Server and data**
- **Arkiv lag:**
  - The Arkiv access key's quota is spent. Every process on this Mac shares the keyless window, so the mirror can stall, and an edge can land minutes late.
  - That makes the merchant feed, the receipts, `lastOrder` and the CSV lag the chain. Payments themselves always settle.
  - A fresh access key ends this.
- `/api/status` answers `mirrorLagBlocks` and `relayerWbt` as null, so the top bar shows "—".
- Explain traces, run replays, the one-errand rule and every cooldown live in one server instance's memory. An explain link from another instance or an older run answers 404.
- The map lists old and new shop rows under the same display names, two per name.
- The CSV's file name uses the story key (`kesar-kingdom-…`), not the new label.
- Pause's 429 sentence is the same for the 20 s gap and a full queue.
- Read ceilings per client are still in code (map and state 400, merchant events 300, CSV 100, GraphQL 60, race 20 per minute), against ADR-0069's amendment.
- The refund reason on chain is always 1.
- The demo store is not deployed.
- Acceptance E1 still expects the old 23:59 deadline.
- **The race stream's call counter:** it opens with one `call` frame without `ms`, before the counted reads. So a live counter shows 3 (plain: 6) until `answer.calls` sets 2 (plain: 5). Skip `call` frames without `ms`, or show `answer.calls`.
- **`/api/merchant/export.csv` reads Arkiv live and is intermittent:** at 02:03 IST it answered 502 "the graph did not answer; try again" twice, then 200 after 45 s. Retry once before showing an error.
- **Big city M:** recorded as seeded and not raced (ADR-0081). `/api/race` refuses `size=M`, and `/api/graphql?dataset=M` reads its graph store only.

**Sources:** every fact here comes from the Coordinator's inventory of `main`, which gives each row its file and line: [`docs/sessions/coordinator/backend-inventory.md`](../sessions/coordinator/backend-inventory.md). Items inferred from code but never seen on a screen are marked as such above.
