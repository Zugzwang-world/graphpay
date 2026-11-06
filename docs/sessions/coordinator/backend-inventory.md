# Backend for the frontend: the sourced inventory

The research behind `docs/thinking-partner/BACKEND_FOR_FRONTEND.md`, kept for its file and line references. Read on `main` at 5d8f8c7 (01:22 IST, Sat 7 Nov); main then changed only the owner-cap route's wait (90 s, #204) and a comment in `packages/agents/src/buyer.mjs` before the close.

**What was read.** `origin/main` at **`5d8f8c7`** (`docs(records): 01:20: W1 done; the flip proven by a live errand through filter-and-fold (#203)`, 2026-11-06 19:52 UTC = 01:22 IST Sat 7 Nov). The first snapshot was `9faeeda` (#181); main then moved by five commits (#199, #200, #201, two records commits). None of them touches `apps/`, `integration/`, `packages/agents`, `packages/config` or `frontend/`: they change the Swarm menu code (`packages/money-graph/src/menu.mjs`, `scripts/menus.mjs`), `docs/sessions/arkiv/swarm-menus.json`, `arkiv/swarm.md` and the thinking-partner records. Every file:line below is at `5d8f8c7`.

**Production checks.** Read-only GETs on `https://graphpay-event.vercel.app` between 19:44 and 19:55 UTC (01:14 to 01:25 IST): `/api/state/customer`, `/api/state/heal`, `/api/customer/kill-disposable`, `/api/map`, `/api/status`, `/api/merchant/export.csv`, `/api/merchant/events` (8 s and 20 s), `/api/race` (one graph-side Q2, plus two refused queries), `/api/graphql` (one `handoffs` query), `/api/explain/<id>`, `/api/agents/run/<id>/events`. Marked **observed** below. Nothing was POSTed; no cron, facilitator, shop, recorder or MCP route was called.

**For whoever compiles the handover:** the thinking-partner folder forbids key-shaped strings. Full 64-hex hashes, entity keys and Swarm references appear below only inside URLs or shortened (`0x628f…04f8`); the full values are in the cited source files. Addresses (40 hex) are public contract and resolver addresses; the frontend should not hard-code them (ADR-0030: `pnpm check` fails on a known address literal in code).

---

## 1. HTTP routes

There are **32 route files** under `apps/web/app/api/**/route.ts`, giving **34 method + path rows** below (the three catch-alls counted once each). `apps/web/lib/routes.ts:18-44` is the code's own table of the website routes with their gates.

### 1.0 Behaviour shared by every route

| what | detail | source |
|---|---|---|
| JSON helper | every `json()` answer carries `cache-control: no-store` unless a route overrides it | `apps/web/lib/http.ts:6-10` |
| "Not live yet" | a route whose server key or setting is missing answers **503** `{ error: 'not live yet', waitingFor: '<sentence>' }`; the sentences are in the routes table | `apps/web/lib/http.ts:14-17`, `apps/web/lib/contracts.ts:143-147`, `apps/web/lib/routes.ts:18-44` |
| Bad input | **400** `{ error }` | `apps/web/lib/http.ts:19-21` |
| Body parsing | a JSON object of at most 4,096 bytes; an empty body reads as `{}`; an array, a non-object or a larger body is refused | `apps/web/lib/http.ts:24-36` |
| Public access gate | `requirePasscode` lets every request through while `site.publicAccess` is `true` (it is) and `GRAPHPAY_PUBLIC_ACCESS` is not `'0'`. When the gate is closed: header `x-demo-passcode`, **401** `{ error: 'passcode required' \| 'wrong passcode' }`, **503** `{ error: 'spending is off: no passcode is configured' }` | `apps/web/lib/passcode.ts:26-51`, `apps/web/lib/passcode-header.ts:2`, `packages/config/graphpay.config.json:160` |
| Read limiter | `allowed(request, max)`: max requests per minute per client IP (first `x-forwarded-for` hop) **per server instance**; default 60 | `apps/web/app/api/graphql/arkiv.server.ts:25-38` |
| Errors carry no internals | a chain or RPC failure is logged as its kind only; the browser gets one fixed sentence | e.g. `apps/web/app/api/customer/pause/route.ts:26-31` |

### 1.1 Public reads the frontend uses (all `GET`, open in every mode)

| method | path | query / body | 2xx response | errors | access | maxDuration | rate / cache | source |
|---|---|---|---|---|---|---|---|---|
| GET | `/api/state/customer` | none | `CustomerState`: `{ agent: { ens, status: 'ACTIVE'\|'PAUSED'\|'REVOKED'\|'EXPIRED'\|'UNKNOWN', epoch }, capMicro, spentTodayMicro, policyExpiresAt: ISO\|null, lastOrder: { orderId, shopEns, item: null, quantity: null, amountMicro, status: 'PAID'\|'DELIVERED'\|'REFUNDED'\|'PARTIALLY_REFUNDED'\|'FAILED', transaction } \| null, subscription: { subId, plan, period, priceMicro, nextChargeAt, renewals: [{ at, transaction }], active, status: 'ACTIVE'\|'LAPSED'\|'CANCELLED', cycle, periodSeconds, chargesLeft, item, shopEns } \| null }`. Payer agent only. `capMicro` is the **AgentPolicy's** daily cap on the checkout, not the ENS record | 429 `{ error: 'too many requests' }`; 502 `{ error: 'a source did not answer; try again in a moment' }` (any one source failing fails the answer; only the subscription may fail alone, to `null`) | open | 30 | 400/min/client; one shared read per 3 s per instance; the subscription read is cut at 8 s | route `apps/web/app/api/state/customer/route.ts:10-23`; shapes `apps/web/lib/contracts.ts:20-62`; assembly `apps/web/lib/customer-state.server.ts:60-98`; status rule `apps/web/lib/customer-state.ts:29-37` |
| GET | `/api/state/heal` | none | `{ healing, resumeAfterS: 120, reopenAfterS: 300, agents: [{ ens, status, pausedAt, resumesAt }], shop: { ens, open, openUntil, closedAt, reopensAt } \| null, at }`. Times are ISO strings. `agents` = the pausable agents (scout, payer); `status` is the **raw ENS text in lower case** (`'active'`, `'paused'`) or `'unknown'` on a failed read. `healing: false` and every `resumesAt`/`reopensAt` null when `GRAPHPAY_HEAL=0`. `shop` is null when the server has no W_DIRECTORY key | 502 `{ error: 'the state could not be read; try again' }` | open | 60 | no limiter; CDN `public, s-maxage=10, stale-while-revalidate=20` plus a 10 s server cache | `apps/web/app/api/state/heal/route.ts:9-31`; `apps/web/lib/heal.server.ts:142-163, 228-239` |
| GET | `/api/customer/kill-disposable` | none | `{ spare: { label, name, epoch } \| null, live, pool: number[] }`; without keys `{ spare: null, live: false, pool }` | 502 `{ spare: null, live: true, pool, error: 'the spare could not be read; try again' }` | open | 300 (file-wide) | no limiter | `apps/web/app/api/customer/kill-disposable/route.ts:17-27` |
| GET | `/api/map` | none | `MapData`: `{ box: { latMin, latMax, lngMin, lngMax } (micro-degrees), persona: { label, lat, lng }, neighbourhoods: [{ area, lat, lng, source }], shops: [{ ens, shopKey, name, area, lat, lng, synthetic, open }], agents: [{ key, ens, owner, role, session }], at }`. Shops = up to 100 real + 100 synthetic in the box; `open` = a live `shop_open` row; agents = live presence rows of the persona's and the merchant's agents | 429; 502 `{ error: 'the graph did not answer; try again in a moment' }` | open | 30 | 400/min/client; one shared read per 4 s per instance | route `apps/web/app/api/map/route.ts:9-21`; `apps/web/lib/map.ts:12-45`; `apps/web/lib/map.server.ts:14-77` |
| GET | `/api/status` | none | `StatusResponse`: `{ heads: { whitechain, sepolia, rabdi } (block numbers as strings, null if no RPC answered in 8 s), mirrorLagBlocks: null, relayerWbt: null, token: 'usdt'\|'standin', tokenAddress, checkout, notes: string[], at }` | none (missing values are null with a note) | open | default | CDN `public, max-age=0, s-maxage=2, stale-while-revalidate=8` | `apps/web/app/api/status/route.ts:8-43`; `apps/web/lib/contracts.ts:7-18` |
| GET | `/api/merchant/export.csv` | none | CSV, 13 columns `date_utc, date_local, order_id, kind, buyer_ens, payer_ens, shop_ens, amount_usdt, net_effect_usdt, token, tx_hash, explorer_link, ref`; headers `content-disposition: attachment; filename="<story shop key>-orders-from-<YYYY-MM-DD>.csv"`, `x-export-days`, `x-export-truncated`. Story merchant only; kinds order, pay, refund, deliver, subscribe, renew | 429; 502 `{ error: 'the graph did not answer; try again' }` | open | default | 100/min/client | `apps/web/app/api/merchant/export.csv/route.ts:11-30`; `apps/web/lib/merchant-feed.ts:127-176` |
| GET | `/api/explain/:id` | `id`: 12 lower-case hex | the explain trace: `{ explainId, backend, queries[], ms, bytes, entityKeys[], blockNumber, warnings[], notes[], truncated, calls, reads: [{ entity, query, owner, limit, offset, orderBy, rows, ms, bytes, entityKeys }] }` (keys **observed**) | 400 `{ error: 'an explain id is 12 hex characters' }`; 404 `{ error: 'no trace for this id on this instance (the last 200 are kept)' }` | open | default | `no-store` | `apps/web/app/api/explain/[id]/route.ts:6-13`; store size `apps/web/app/api/graphql/arkiv.server.ts:1-4` |
| GET | `/api/graphql` | `query`, `variables` (JSON string), `dataset` (`live` by default; `S` or `M` opt in to a synthetic city) | `{ data, errors?, extensions: { arkiv: { explainId, backend, blockNumber, bytes, calls, entityKeys, ms, notes, queries, truncated, warnings } } }` (extension keys **observed**) | 400 when `data` is undefined or `variables` is not JSON; 429 `{ errors: [{ message: 'too many requests' }] }` | open | default | 60/min/client; CDN `s-maxage=5, stale-while-revalidate=10` | `apps/web/app/api/graphql/route.ts:12-24`; `apps/web/app/api/graphql/arkiv.server.ts:20-23`; schema `packages/money-graph/src/graphql.mjs:17-117` |
| POST | `/api/passcode` | header `x-demo-passcode` | 204 (always, while public access is on) | 401 / 503 when the gate is closed | visitor | default | `no-store` | `apps/web/app/api/passcode/route.ts:5-11` |

The two GraphQL queries the frontend sends today: `handoffs(requestId)` for the lanes and the deck (`apps/web/lib/lanes.ts:29-34`) and `order(id)` for `/order/<id>` (`apps/web/lib/order-trail.ts:17-22`).

**Observed** (01:14 IST unless noted):
- `/api/state/customer`: `agent` `{ ens: 'payer.vitalik.graphpay.eth', status: 'ACTIVE', epoch: 0 }`, `capMicro: '300000000'`, `spentTodayMicro: '126800000'` (`'141200000'` at 01:24), `policyExpiresAt: null`, `lastOrder` at `filter-and-fold.graphpay.eth`, `amountMicro: '4800000'`, `status: 'DELIVERED'`, `item` and `quantity` null, `subscription: null`.
- `/api/state/heal`: `healing: true`; scout and payer `'active'` with null times; shop `filter-and-fold.graphpay.eth` open, `openUntil: '2026-11-06T19:53:40.000Z'` with `at: '2026-11-06T19:44:16.009Z'`.
- `/api/customer/kill-disposable`: `spare` `{ label: 'disposable-3', name: 'disposable-3.vitalik.graphpay.eth', epoch: 0 }`, `live: true`, `pool: [2, 3, 4, 5, 6, 7, 8, 9]`.
- `/api/map`: 16 shops (6 real: the three new names and the three old names, each pair with the same display name; 10 synthetic, one of them a probe row); only `filter-and-fold.graphpay.eth` open; 7 agents of one session. The answer also carries `persona.area` (null) and `neighbourhoods[].checked`, which the `MapData` type does not list (they pass through from `story.locations`).
- `/api/status`: three block heads, `mirrorLagBlocks: null`, `relayerWbt: null`, `token: 'usdt'`, the two "waiting for" notes.
- `/api/merchant/export.csv`: `filename="kesar-kingdom-orders-from-2026-10-06.csv"`, `x-export-days: 32`, `x-export-truncated: false`, 251 lines.

### 1.2 Actions (all `POST`, gate "visitor": open to everyone while public access is on)

Refusal answers are `{ error: '<CODE>' }` with the status shown, unless noted. 503 is always "not live yet" when the server lacks the keys named in `routes.ts`.

| path | body | 2xx response | refusals and errors | maxDuration | cooldown / concurrency | source |
|---|---|---|---|---|---|---|
| `/api/customer/pause` | `{}` (the payer) or `{ agent: '<ENS name or story key>' }` | 200 `{ changed, sepoliaTx, note, agent, effectiveWithinS: 20, resumesAfterS: 120 }` (`resumesAfterS` absent when `GRAPHPAY_HEAL=0`) | 400 `{ error: 'agent must be an ENS name' \| 'not an agent of this story', reason: 'NOT_AN_AGENT' }`; 409 `{ error: '<Name> has no spending pass, so there is nothing to pause or resume. Only Scout and Payer can be paused.', reason: 'NO_PASS' }`; 429 `{ error: 'another status change is still running; wait for it' }` (also returned inside the 20 s gap); 502 `{ error: 'the status could not be confirmed; check the status, then try again if it did not change' }` | 300 | **one change per 20 s per instance, any agent**, while public access is on; at most 2 changes in the owner's queue at once; the heal cron is exempt from the gap | route `apps/web/app/api/customer/pause/route.ts:15-33`; `apps/web/lib/owner-actions.server.ts:15, 35-58, 105-136`; cron exemption `apps/web/lib/heal.server.ts:131-132` |
| `/api/customer/resume` | as pause | 200 `{ changed, sepoliaTx, note, agent, effectiveWithinS: 20 }` | as pause | 300 | as pause (shares the 20 s gap) | `apps/web/app/api/customer/resume/route.ts:13-31` |
| `/api/customer/reorder` | `{ parentOrderId? }` (if given, must be the payer's newest order) | 200 `{ status: 'paid', orderId, parentOrderId, amountMicro, transaction }`; 202 `{ status: 'pending', … }` (the signature may still settle) | 409 `NO_ORDER`, `NOT_THIS_ORDER`, `NOT_OURS`, `NOT_REORDERABLE`, `PRICE_CHANGED`, `NOT_PAID`, or the buyer's own code (e.g. `OVER_DAILY_CAP`, `PASS_REVOKED`); 404 `NO_ORDER`; 429 `TOO_SOON`; 502 `{ error: 'the re-order could not be completed; check the last order before trying again' }` | 120 | 120 s per parent order and per payer agent, longer while a signature can still settle | `apps/web/app/api/customer/reorder/route.ts:14-31`; `apps/web/lib/reorder.server.ts:10-150` |
| `/api/customer/refund-request` | `{ orderId?, amountMicro: '<positive integer string>', reason: '<text>' }`; reason: 1–140 printable characters, no `@`, `/` or `:`, no run of 7 or more digits | 200 `{ orderId, amountMicro, arkivTx, entityKey }` | 400 `BAD_REASON`, `BAD_AMOUNT`; 404 `NO_ORDER`; 409 `NO_ORDER`, `NOT_THIS_ORDER`, `NOT_OURS`, `NOT_REFUNDABLE`, `OVER_REFUNDABLE`; 429 `TOO_SOON`; 502 `{ error: 'the request could not be recorded; try again once' }` | 120 | one per order per minute; at most 6 W_SYNC writes per minute per instance, shared with declines | `apps/web/app/api/customer/refund-request/route.ts:13-26`; `apps/web/lib/refund-request.server.ts:14-123`; `apps/web/lib/sync-writes.server.ts:3` |
| `/api/customer/subscribe` | `{}` or `{ plan }` (must be `renewal.plan`, `'sunday-box'`) | 200 `{ status: 'active', subId, plan, item, sku, shopEns, priceMicro, periodSeconds, period, maxCharges, allowanceMicro, firstChargeAt, nextChargeAt, transaction, firstCharge: { orderId, charged, failReason } }`; 202 with `status: 'pending'` | 400 `NOT_THIS_PLAN`; 409 `ALREADY_SUBSCRIBED` (+ `subId`), `PAYER_NOT_ACTIVE`, `PAYER_NOT_BOUND`, `OVER_PASS`, `BALANCE_LOW`, `PAYEE_MISMATCH`, `CHECKOUT_REFUSED` (+ `revert`); 429 `TOO_SOON`; 503 `RENEWER_LOW`, `PAYEE_UNRESOLVED`; 502 `{ error: 'the subscription could not be created; check the subscription before trying again' }` | 120 | 60 s per instance; none within 180 s of the newest subscription's start (read from chain); one live subscription at a time | `apps/web/app/api/customer/subscribe/route.ts:16-31`; `apps/web/lib/subscription.server.ts:13-225`; `apps/web/lib/subscription-live.server.ts:131, 145, 184, 196, 202, 218-222` |
| `/api/customer/unsubscribe` | `{}` or `{ subId }` (must be the payer's own) | 200 `{ status: 'cancelled', subId, transaction, effectiveAt }`; 202 `pending` | 404 `NO_SUBSCRIPTION`; 409 `NOT_THIS_SUBSCRIPTION`, `NOT_ACTIVE` (+ `subId`); 429 `TOO_SOON` (one at a time); 502 | 120 | one at a time per instance | `apps/web/app/api/customer/unsubscribe/route.ts:16-31`; `apps/web/lib/subscription.server.ts:168-173, 227-248` |
| `/api/customer/kill-disposable` | none | 200 `{ label, name, txs: [{ chain: 'sepolia'\|'whitechain', what: 'unregister'\|'revoke', hash }], revoked, payment: { outcome: 'refused'\|'paid'\|'unknown'\|'not-sent', http, reason, orderId, transaction } \| null, recorded: { ref } \| null, nextSpare, incomplete: 'revoke'\|'payment'\|null }` | 409 `{ error: '<message>' }` (a kill is running, or another request killed this spare first); 503 `{ error: '<message>' }` (no ready spare yet, no spare key, no item under the disposable cap) or not live; 502 `{ error: 'the kill could not be confirmed; check the spare (GET), then try again if it is still live' }` | 300 | one at a time; waits up to 75 s for the revoke and 30 s for the record. OPEN gives 40 to 110 s in all | `apps/web/app/api/customer/kill-disposable/route.ts:29-43`; `apps/web/lib/kill-disposable.server.ts:34-39, 73-102, 139-150` |
| `/api/customer/over-pass` | none | 200 `{ refused, reason, sent: false, request, item, quantity, attemptedMicro, passMicro, spentTodayMicro, leftMicro, orderId, arkiv: { ref, entityKey } \| null, repeated? }` | 409 `NOT_OVER_PASS`, `BALANCE_COVERS`, `QUOTE_CHANGED`; 502 `{ error: 'NO_DECISION', reason, signed, orderId, sent: false, verifiedOnly: true }`; 502 `{ error: 'the attempt could not be made; nothing was paid' }` | 120 | **a tap while one attempt runs, or within 60 s after it, gets that answer again with `repeated: true`**; a failure is never kept | `apps/web/app/api/customer/over-pass/route.ts:16-30`; `apps/web/lib/limits.server.ts:14-33, 93-174` |
| `/api/customer/raise-cap` | `{ capMicro? }` (positive integer string, at most 10^12; default double the ENS cap) | 200 `{ refused: true, sent: false, simulated: true, revert: 'EACUnauthorizedAccountRoles', agent, owner, key: 'graphpay.cap_micro', attemptedMicro, currentMicro, resolver, block, arkivTx, entityKey, repeated? }` | 400 `BAD_CAP`, `NOT_A_RAISE`; 500 `NOT_REFUSED`; 502 `{ error: 'the attempt could not be checked; nothing was sent' }` | 120 | as over-pass (60 s, `repeated: true`) | `apps/web/app/api/customer/raise-cap/route.ts:16-29`; `apps/web/lib/limits.server.ts:176-240` |
| `/api/customer/cap` | `{ capMicro: '<micro-USDT string>' }` | 200 `{ agent, owner, capMicro, configuredMicro, ens: { changed, beforeMicro, sepoliaTx }, policy: { capMicro \| null, applied }, effectiveMicro \| null, arkivTx \| null, entityKey \| null }` | 400 `BAD_CAP`; 409 `OVER_CONFIGURED`, `UNDER_FLOOR`; 429 `TOO_SOON`; 502 `{ error: 'the cap change could not be confirmed; check the cap, then try again if it did not change' }` | 300 | one change per 20 s per instance; waits up to 60 s for the policy | `apps/web/app/api/customer/cap/route.ts:16-29`; `apps/web/lib/owner-cap.server.ts:13-118` |
| `/api/merchant/open` | `{ on: boolean }` | 200 `{ open, openUntil: unix s \| null, entityKey \| null, renewEveryS: 300 }` | 400 `{ error: 'on must be true or false' }`; 502 `{ error: 'the shop list could not be updated; try again' }` | 60 | serial; an Open while the listing still has at least 14 of its 15 minutes left writes nothing (a double tap or retry); Close sets every live row's `open_until` to now | `apps/web/app/api/merchant/open/route.ts:12-27`; `apps/web/lib/open-toggle.server.ts:11-84` |
| `/api/merchant/dispatch` | `{ orderId: '0x' + 64 hex }` | 200 `{ transaction, status: 'confirmed' }`; 202 `pending` | 400 `{ error: 'orderId is 32-byte hex' }`; 403 `NOT_THE_STORY_BUYER`; 404 `NO_SUCH_ORDER`; 409 `NOT_OURS`, `NOT_DELIVERABLE`, `STILL_PENDING`, `GAS_LOW`; 429 `TOO_SOON` or `{ error: 'another signing is still running; wait for it' }`; 502 | 300 | 30 s per order (visitors); one send at a time, at most 2 requests in the queue | `apps/web/app/api/merchant/dispatch/route.ts:13-36`; `apps/web/lib/merchant-actions.server.ts:21-32, 78-93, 178-204` |
| `/api/merchant/refund` | `{ orderId, amountMicro: '<positive integer string>' }` or `{ orderId, full: true }` | 200 `{ transaction, status, amountMicro, full }`; 202 `pending` | 400 (order id, amount); 403; 404; 409 `NOT_OURS`, `NOT_REFUNDABLE`, `BAD_AMOUNT`, `OVER_REFUNDABLE`, `FLOAT_LOW`, `STILL_PENDING`, `GAS_LOW`; 429; 502 | 300 | as dispatch; the on-chain reason code is always 1 | `apps/web/app/api/merchant/refund/route.ts:14-41`; `apps/web/lib/merchant-actions.server.ts:17-19, 206-229` |
| `/api/merchant/refund-decline` | `{ orderId, note? }` (note: same rule as the refund reason) | 200 `{ orderId, decision: 'declined', amountMicro, requestRef, ref, note, arkivTx \| null, entityKey \| null }` (`arkivTx` null when this decline was already on the record) | 400 `BAD_ORDER`, `BAD_NOTE`; 403 `NOT_THE_STORY_BUYER`; 404 `NO_SUCH_ORDER`; 409 `NOT_OURS`, `NOT_REFUNDABLE`, `TRAIL_TOO_LONG`, `STILL_PENDING`, `NO_REQUEST`, `ALREADY_DECIDED`; 429 `TOO_SOON`; 502 | 120 | one per order per minute; shares the 6/min W_SYNC cap | `apps/web/app/api/merchant/refund-decline/route.ts:15-28`; `apps/web/lib/refund-decline.server.ts:17-157` |

### 1.3 Streams (details of their events in section 2)

| method | path | request | answer | errors | access | maxDuration | limits | source |
|---|---|---|---|---|---|---|---|---|
| POST | `/api/agents/run` | `{ request: string }`, 1–400 characters after trim | 200 `text/event-stream` (`no-store, no-transform`, `x-accel-buffering: no`): `started`, `trace`…, then `result` or `failed`; a `: keep-alive` comment every 5 s | 400 `{ error: 'request must be 1 to 400 characters' }`; **409 `{ error: 'busy: one errand at a time' }`**; 503 not live (`waitingFor: "the live runner's server settings (Join)"`) | visitor | 300 | one errand at a time per instance; the run is cut at 280 s | `apps/web/app/api/agents/run/route.ts:7-27`; `apps/web/lib/run-registry.server.ts:57-155` |
| GET | `/api/agents/run/:id/events` | `id`: a 36-character UUID | the same stream replayed from this instance's memory (frames kept 5 min after the run ends, at most 2,000) | 404 `{ error: 'no such run on this server' }` (**observed** for an unknown id; another instance also answers 404) | open | default | none | `apps/web/app/api/agents/run/[id]/events/route.ts:7-14`; `apps/web/lib/run-registry.server.ts:45, 57-75` |
| GET | `/api/merchant/events` | `?since=<unix seconds, 1–12 digits>` (else now − 30 s) | `text/event-stream`: `ready`, then `edge`s; polls the graph every 2.5 s; ends itself after 50 s | 429 `{ error: 'too many requests' }` | open | 60 | 300/min/client; the graph read is shared for 2 s per instance | `apps/web/app/api/merchant/events/route.ts:11-70`; `apps/web/lib/merchant-feed.server.ts:10-23` |
| GET | `/api/race` | `?question=Q1\|Q2\|Q5&mode=graph\|plain&size=S&inFlight=1\|4\|8\|16\|all` (`inFlight` only for plain) | `text/event-stream`: `call`… then `answer`, or `error` | 400 `{ error }` (**observed**: `size=M` → `'only the size S city is seeded'`; `question=Q9` → `'question is one of Q1, Q2, Q5'`); 429 `{ error: 'too many requests' }` or `{ error: 'a race is already running on this side' }` | open (gate "rate limit") | 60 | 20/min/client; one race per side per instance | `apps/web/app/api/race/route.ts:10-38`; `apps/web/lib/race.ts:18-41` |

### 1.4 Server-to-server, cron and agent routes: not for the frontend

| method | path | auth | answer | maxDuration | source |
|---|---|---|---|---|---|
| GET | `/api/cron/heal` | bearer `CRON_SECRET` (Vercel cron, every minute) | 200 `{ agents: [{ ens, status, pausedAt, resumesAt, action: 'none'\|'wait'\|'resume'\|'unsure', done, sepoliaTx, failed }], shop: { ens, open, openUntil, closedAt, reopensAt, action: 'none'\|'renew'\|'wait'\|'reopen', done, failed } \| null }` (unix seconds), or `{ off: 'GRAPHPAY_HEAL=0' }`, or `{ skipped: 'the previous run on this server is still going' }`; 401 `{ error: 'unauthorized' }`; 503 `{ error: 'the heal run failed' }` | 300 | `apps/web/app/api/cron/heal/route.ts:1-27`; `apps/web/lib/heal.server.ts:48-64, 165-226`; `apps/web/vercel.json:9-12` |
| GET | `/api/cron/renew` | bearer `CRON_SECRET` (every minute) | 200 `{ checked, renewed: [{ subId, tx }], skipped: [{ subId, reason }] }`; 401; 503 `{ error: 'renewals unavailable' }`; at most 3 renewals per run | 60 | `apps/web/app/api/cron/renew/route.ts:1-18`; `apps/web/lib/renew.server.ts:19-23, 46-50`; `apps/web/vercel.json:5-8` |
| GET, POST | `/api/facilitator/{verify,settle,supported,health}` | bearer `FACILITATOR_AUTH_TOKEN` for verify and settle; supported and health open | x402 facilitator; 503 `{ error: 'starting' }` while it builds, 500 `{ error: 'internal error' }` | 60 | `apps/web/app/api/facilitator/[...path]/route.ts:1-11`; `apps/web/lib/payments.server.ts:127-146` |
| GET, POST | `/api/recorder/attempts` | bearer `RECORDER_TOKEN` | writes one readonly `fail` edge on Arkiv as W_SYNC | 60 | `apps/web/app/api/recorder/[...path]/route.ts:1-11`; `packages/facilitator/src/recorder.mjs:67, 78-85` |
| GET, POST | `/api/shop/{catalog,quote,health}`, `/api/shop/orders/:id/pay`, `/api/shop/orders/:parentId/reorder` | catalog, quote, health open; pay and reorder take `X-Demo-Passcode` (server to server) | the shop's x402 API used by the agents; health `{ ok, startup }` | 120 | `apps/web/app/api/shop/[...path]/route.ts:1-20`; `packages/shop/src/api.mjs:5-6, 97, 271-276` |
| POST | `/api/mcp` | none, 120/min/client | the agents' MCP endpoint (Streamable HTTP, stateless, read-only tools schema, ask, graphql, explain); GET and DELETE answer 405 `{ jsonrpc: '2.0', error: { code: -32000, message: 'use POST' }, id: null }` | default | `apps/web/app/api/mcp/route.ts:1-19` |
| POST | `/api/graphql` | none, 60/min/client | as the GET, never cached (agents) | default | `apps/web/app/api/graphql/route.ts:26-37` |

### 1.5 Pages and static files (no other JSON routes)

- Pages: `/` (the stage, same as `/live`: `apps/web/app/page.tsx:1-4`), `/live` (`apps/web/app/live/page.tsx:12-55`: the customer phone iframe `/phones/customer.html`, the deck iframe `/deck/index.html?embed=1` via `apps/web/components/middle-switch.tsx:182`, the merchant phone iframe `/phones/merchant.html`), `/customer` and `/merchant` (T5's own screens, not linked from the stage), `/map`, `/race`, `/explain`, `/explain/[explainId]`, `/order/[orderId]`, `/how`.
- The phones are static pages built from `frontend/` by `apps/phones/build.mjs` into `apps/web/public/phones/` (git-ignored, `apps/web/.gitignore:1-2`) before `next build` (`apps/web/package.json` `build` script). Their story data is compiled in at build time from `packages/config/story.json` (`apps/phones/build.mjs:41-59`, `apps/phones/story-projection.mjs:18-98`); images are served from `/phones/grok/{agents,dishes,shops}/` (`apps/phones/build.mjs:81-82`).
- The deck has no network calls of its own: everything reaches it by `postMessage` from `/live` (section 2.4). Its story data is a hand copy (`apps/web/public/deck/index.html:409-438`).
- Every network call the phones make: `apps/phones/src/live-adapter.ts:61, 70, 143, 181, 210, 225, 254, 266, 292, 301, 304, 311, 325, 337, 428`. They never send the passcode header (`apps/phones/src/live-adapter.ts:334-344`).

---

## 2. Event streams

### 2.1 The errand stream (`POST /api/agents/run`; replay `GET /api/agents/run/:id/events`)

| event | payload | emitted by | consumed by |
|---|---|---|---|
| `started` | `{ runId }` (a UUID; also the errand's `runId` and its Arkiv `handoff.request_id`) | `apps/web/lib/run-registry.server.ts:83`; id passed on at `:22-26, 90` | phones `apps/phones/src/errand.ts:89-92` (kept for recovery, `apps/phones/src/live-adapter.ts:217-241`); `/live` `apps/web/components/live-run-bridge.tsx:25-28`; `/customer` `apps/web/components/customer-screen.tsx:72-75` |
| `trace` | one `TraceEvent`, `{ seq, type, … }` (types below) | the agents' run log, one frame per event (`packages/agents/src/runlog.mjs:18-36`; `apps/web/lib/run-registry.server.ts:90`) | phones (a subset, `apps/phones/src/errand.ts:134-190`); `/live` run state → explainer and deck (`apps/web/components/live-run-bridge.tsx:29-31`); `/customer` feed (every type, `apps/web/components/agent-feed.tsx:28-82`) |
| `result` | `RunResult`: `{ status: 'paid'\|'refused'\|'no-purchase'\|'unsettled', chosenShop, priceUsdt (6 decimals, e.g. '4.800000'), receipt: { success, transaction, network, payer, payTo, amountUsdt, asset, explorerUrl } \| null, orderId, arrivesAt, ranking: [{ ens, score, eligible, reasons[] }], explainId, refusals: [{ reason, detail, agent? }], narrative, modelChoice, mandate: { budgetUsdt, deadlineIso, hash } \| null, synthetic: true, error? }`; secrets scrubbed | `packages/agents/src/errand.mjs:59-81`; `apps/web/lib/run-registry.server.ts:47-55, 91`; type `apps/web/lib/contracts.ts:81-98` | phones `apps/phones/src/errand.ts:234-249`; `/live` `apps/web/components/live-run-bridge.tsx:32-35`; `/customer` `apps/web/components/customer-screen.tsx:79-82, 184-219` |
| `failed` | `{ error }`: one of `'the errand ran out of time'`, `'busy: the last errand is still finishing; try again in a minute'` (runner code `LIVE_RUNNER_BUSY`), `'the errand failed'` | `apps/web/lib/run-registry.server.ts:39-42, 92-97`; `integration/src/live-runner.mjs:94` | phones `apps/phones/src/errand.ts:95-99`; `/customer` `apps/web/components/customer-screen.tsx:83-85`; **not** `/live` (`apps/web/components/live-run-bridge.tsx:25-36` handles only started, trace, result) |
| comment | `: keep-alive` every 5 s | `apps/web/lib/run-registry.server.ts:138` (its comment at `:116-117` says 15 s) | skipped by every reader (`apps/web/lib/sse-client.ts:15`, `apps/phones/src/errand.ts:268`) |

`TraceEvent` types (`apps/web/lib/contracts.ts:64-72`; emitters in `packages/agents/src/runlog.mjs:38-62`):

| type | fields | notes | phones' use (`apps/phones/src/errand.ts`) |
|---|---|---|---|
| `message` | `from`, `to`, `text` | The lane (`step`) is **not** in the stream: it goes only to the activity observer, which writes the Arkiv `handoff` row (`packages/agents/src/runlog.mjs:42-46`, `packages/agents/src/activity.mjs:80-90`) | `agent.message` for a buyer-team sender (`:142-145`) |
| `agent.start` | `agent`, `role`, `task` | `packages/agents/src/agents.mjs:41, 62` | `agent.status` `thinking` (`:137-138`) |
| `agent.end` | `agent`, `role`, `output`, `usageTokens`, `model` (`'code'` for a code-run agent), `effort`, `calls[]`, `seconds?`, `modelError?`, `error?` | `packages/agents/src/agents.mjs:48-57`. The web type lists only `output`, `usageTokens?`, `model?`, `error?` | `agent.status` `refused` (with `error`) or `checked`; the payer's end is ignored (`:139-141`) |
| `tool.call` | `agent`, `tool`, `input` | `packages/agents/src/tools.mjs:17` | ignored |
| `tool.result` | `agent`, `tool`, `output`, `error?` | `packages/agents/src/tools.mjs:20-24` | `graphql` (adds `extensions.arkiv.calls`), `scout`/`catalog_read` (offers), `analyst` (ranking → `graph.read` + `shops.compared`), `get_quote` (`quote.created`), `pay_order` (`payment.settled` or `payment.refused`) (`:157-190`) |
| `guard` | `guard` (`G1`…`G16`, `HOOKS`, `ERRAND`), `ok`, `detail` | e.g. `packages/agents/src/errand.mjs:119, 124`; `packages/agents/src/payer.mjs:279` | only `G5` with "every check passed before signing" → `payment.signed` (`:146-149`) |

Refusal codes the phones map from guard or tool text (`apps/phones/src/errand.ts:30-42`): `CAP_EXCEEDED` → cap, `ENS_PAUSED` → paused, `ENS_EXPIRED_OR_REVOKED`/`AGENT_REVOKED` → revoked, `SHOP_NOT_ELIGIBLE` → trap_shop, `QUOTE_EXPIRED` → quote_expired, `OVER_BUDGET`/`OVER_APPROVED_PRICE`/`MISSES_DEADLINE` → budget.

### 2.2 The merchant stream (`GET /api/merchant/events`)

| event | payload | source | consumed by |
|---|---|---|---|
| `ready` | `{ shop, cursor }` (**observed** `{ shop: 'filter-and-fold.graphpay.eth', cursor: <unix s> }`) | `apps/web/app/api/merchant/events/route.ts:39` | phones reset the reconnect back-off (`apps/phones/src/live-adapter.ts:430-432`) |
| `edge` | `{ kind, from, to, amountMicro, orderId, ref, ts, entityKey: null, arkivTx: null, settlementTx }` | `apps/web/lib/merchant-feed.ts:96-111`; type `apps/web/lib/contracts.ts:107-121` | phones `apps/phones/src/live-adapter.ts:444-467`; `/merchant` `apps/web/components/merchant-screen.tsx:63` |
| comment | `: the graph window is full, newest edges may be missing`; `: the graph did not answer, retrying` | `apps/web/app/api/merchant/events/route.ts:46, 56` | skipped |

- Edge kinds sent: `order`, `pay`, `refund`, `deliver`, `fail`, `request`, `subscribe`, `renew` (`apps/web/lib/merchant-feed.ts:44`). The graph also has `owns`, `late`, `cancel`, `dispute` (`packages/money-graph/src/model.mjs:19`); those are dropped (`toEvent` answers null), so a subscription **cancel never reaches the stream**.
- `ref` formats: a chain event `1874:<tx>:<log index>` (`settlementTx` is that tx; `apps/web/lib/merchant-feed.ts:90-94`); refund request `req:<order>:<minute>` payer → shop (`apps/web/lib/refund-request.server.ts:109`); decline `dec:<order>:<minute>` shop → payer (`apps/web/lib/refund-decline.server.ts:129-130`); a refused attempt `att:<order>:<payer wallet address>:<8 hex>` payer → shop, kind `fail` (`packages/facilitator/src/recorder.mjs:67`); the cap raise `cap:<node16>:<minute>` (payer → persona; `apps/web/lib/limits-live.server.ts:250`) and the owner's cap `own:<node16>:<second>:<cap>` (persona → payer; `apps/web/lib/owner-cap-live.server.ts:94`) do not touch the shop, so they are not in this stream.
- The stream ends itself after 50 s and the client reconnects with `since` (`apps/web/app/api/merchant/events/route.ts:1-4, 18-21`). **Observed:** an 8 s connection received only `ready`; a 20 s connection received 4 edges (a `fail` with an `att:` ref, then `order`, `pay` and a fourth).

### 2.3 The race stream (`GET /api/race`)

| event | payload | source | consumed by |
|---|---|---|---|
| `call` | `{ call, ms, bytes }` | `apps/web/lib/race.server.ts:45`; type `apps/web/lib/contracts.ts:123-128` | `apps/web/components/race-view.tsx:74-76` |
| `answer` | `{ answer, correct, truthBasis: 'identity'\|'name', calls, bytes }` | `apps/web/lib/race.server.ts:47-50`; type `apps/web/lib/contracts.ts:130-136` | `apps/web/components/race-view.tsx:79-81` |
| `error` | `{ error: 'the race could not read Arkiv; try again' }` | `apps/web/app/api/race/route.ts:28-31` | `apps/web/components/race-view.tsx:77-78` |

**Observed** (graph side, Q2, 01:14 IST): three `call` frames (the first, `{ call: 1, bytes: 767 }`, has no `ms`), then `answer` with `calls: 2`, `bytes: 35372`, `correct: true`, `truthBasis: 'identity'`, ten rows.

### 2.4 Browser messages between the stage's frames (same-origin `postMessage`)

| `type` | from → to | payload | source |
|---|---|---|---|
| `graphpay.run-frame` | customer phone iframe → `/live` (`LiveRunBridge`) | `{ type, event, data }`, `data` the frame's raw JSON text | `apps/phones/src/live-adapter.ts:93-98, 190`; `apps/web/components/live-run-bridge.tsx:13-36` |
| `graphpay.phone-event` | either phone → `/live` (`MiddleSwitch`) | `{ type, key, chips: [{ label, href }] }`; keys sent: `refund-request`, `refund`, `paused`, `resumed`, `shop-open`, `renewal`; only `https://` chips are kept | `apps/phones/src/live-adapter.ts:100-109`; `apps/web/components/middle-switch.tsx:28-37, 131-155` |
| `graphpay.deck` | `/live` → deck iframe | `{ type, entries: [{ key, slide, title, step, from, errand?, label, chips }], key, go, home, live, of: 7, reached }` | `apps/web/components/middle-switch.tsx:107-129`; `apps/web/public/deck/index.html:1192-1231` |
| `graphpay.deck-replay` | deck → `/live` | `{ type }` ("Replay the last run"; `/live` steps the reached errand slides every 2.5 s) | `apps/web/public/deck/index.html:1183`; `apps/web/components/middle-switch.tsx:32, 157-178` |

### 2.5 The deck table (`apps/web/lib/deck-map.ts:36-51`)

`slide` is 1-based in `apps/web/public/deck/index.html`; a test holds each title equal to that slide's title (`apps/web/lib/deck-map.test.ts:12-21`). `step` is how far to reveal the slide (null = all); `from` is the first step at which a slide shared by two rows belongs to this row.

| key | errand step | slide | title (slide at `index.html` line) | step | from | strip label | moved by |
|---|---|---|---|---|---|---|---|
| `ask` | 1 | 5 | One message, a whole team (772) | null | 0 | The ask | the run has any trace event (`middle-switch.tsx:90`) |
| `team` | 2 | 4 | Two desks, two teams (759) | null | 0 | The team | a handoff row in lane `ask` (`middle-switch.tsx:31`) |
| `check` | 3 | 7 | The same receipts, as a graph (799) | null | 0 | The check | lane `check` |
| `check-back` | 4 | 9 | The shop checks the buyer back (821) | null | 0 | The check back | lane `check-back` |
| `quote` | 5 | 10 | The payment, step by step (829) | 2 | 0 | The 402 quote | lane `quote` |
| `payment` | 6 | 10 | The payment, step by step (829) | null | 3 | The payment | lane `pay` |
| `record` | 7 | 15 | How one payment is written (926) | null | 0 | The record on Arkiv | `result.status === 'paid'` (`middle-switch.tsx:95`) |
| `refund-request` | — | 11 | A refund, with proof (851) | 5 | 0 | Refund requested on the phone | phone event |
| `refund` | — | 11 | A refund, with proof (851) | 9 | 6 | Refunded by the shop | phone event |
| `paused` | — | 14 | Stopped, live (907) | 3 | 0 | Payer paused | phone event |
| `resumed` | — | 14 | Stopped, live (907) | 3 | 0 | Payer resumed (returns the deck to where it was) | phone event |
| `shop-open` | — | 4 | Two desks, two teams (759) | null | 0 | The shop’s Open switch | phone event |
| `renewal` | — | 12 | Every way a business gets paid (874) | 1 | 0 | A renewal | phone event |

Slides with no row: 1 GraphPay, 2 The problem, 3 Our solution, 6 Asking a plain Web3 database, 8 Refund rate, two ways, **13 Agents can’t raise their own limits**, 16 Arkiv, 17 ENS, 18 Whitechain, 19 the close (`index.html:711-1002`). The errand chips: handoff rows link to their Arkiv entity, `payment` adds the settlement, `record` links `/order/<orderId>`, `/explain/<explainId>` and the settlement (`middle-switch.tsx:58-85`). `/live` polls the handoffs every 3 s during a run and once more 4 s after the result (`middle-switch.tsx:43-55`).

### 2.6 How `apps/phones` consumes all this (`apps/phones/src/live-adapter.ts`)

- **Snapshot** (`:141-166`): `GET /api/state/customer`, `/api/map` and `/api/merchant/export.csv` in parallel. Only the paying agent's state is live (`:369-379`); `renewals` is always `[]` (`:162`) and `errandRunning` always `false` (`:163`).
- **Polls**: customer state every 15 s, map every 30 s (`:28-29, 381-385`). The merchant stream reconnects after 1.5 s, doubling to 30 s, with jitter (`:30-33, 426-442`); its cursor starts two days back (`:117-119`); only edges newer than the page ring the merchant phone (`:120-121, 456`).
- **Actions wired** (POST): errand (`:180-207`), re-order `{ parentOrderId }` (`:252-263`), refund request `{ orderId, amountMicro, reason }` (photo not sent, `:264-269`), pause/resume `{}` (`:276-282, 324-331`), Open `{ on }` re-sent every 300 s while on (`:290-298`), dispatch `{ orderId }` (`:300-302`), refund `{ orderId, amountMicro }` (`:303-306`). **Not wired** (an `error` event "This action is not available yet."): `startRenewal`, `cancelRenewal`, `revokeAgent`, `tryRaiseCap`, `declineRefund` (`:270-275, 283-288, 307-309, 346-349`); `setCap` is not implemented; nothing calls kill or over-pass.
- **Recovery** after a dropped stream: re-attach by run id up to 8 times, then read the payer's newest order every 4 s up to 45 times; never offers a second errand (`:217-250`).

DemoEvents of the team's contract (`frontend/src/demo/contract.ts:202-248`; 25 types) against what the live adapter emits and what the team's screens read:

| DemoEvent | emitted live by | read by a team screen |
|---|---|---|
| `agent.message`, `agent.status`, `graph.read`, `shops.compared`, `quote.created`, `payment.signed` | errand mapper (`apps/phones/src/errand.ts:129-216`) | yes (`frontend/src/apps/customer/journey.ts`; `agent.status` also `components/shared/Mascot.tsx`) |
| `payment.settled` | mapper (`errand.ts:218-224`) and re-order (`live-adapter.ts:256`) | yes |
| `payment.refused` | mapper (`errand.ts:226-232`) | yes |
| `error` | mapper and adapter (6 sites) | yes |
| `order.updated` | adapter (`live-adapter.ts:318, 455`) | yes (merchant screens, `demo/state.ts`) |
| `refund.requested` | adapter (`live-adapter.ts:267`) | **no screen reads it** (refunds arrive through `order.updated`) |
| `refund.settled` | adapter (`live-adapter.ts:464`) | yes (`components/shared/AppShell.tsx`) |
| `agent.permission` | adapter (`live-adapter.ts:329, 403`), always for the payer | yes (`apps/customer/CustomerAgents.tsx:56`, `AppShell`, `demo/state.ts`) |
| `merchant.notification` | adapter (`live-adapter.ts:457, 460`) | yes |
| `shop.status` | adapter (`live-adapter.ts:296, 420`) | yes |
| `agent.pass.period` | adapter (`live-adapter.ts:409`) | yes (`demo/state.ts`) |
| `renewal.created`, `renewal.charged`, `renewal.cancelled`, `cap.change.refused`, `agent.cap.changed`, `demo.reset` | **not emitted live** | yes (screens wait for them) |
| `ens.resolved`, `arkiv.write`, `race.result` | not emitted live (`arkiv.write` only by the mock) | **no screen reads them** |

### 2.7 Data that exists but no screen uses yet

- Run stream: `RunResult.arrivesAt`, `RunResult.mandate` (with `deadlineIso`), `RunResult.modelChoice`; `agent.end` fields `effort`, `calls`, `seconds`, `modelError`; `tool.call` frames on the phones (no screen in `apps/web/components`, `apps/phones/src` or `frontend/src/apps` reads `arrivesAt`, `deadlineIso`, `modelChoice` or `mandate`).
- `/live` ignores `failed` (`apps/web/components/live-run-bridge.tsx:25-36`).
- Action answers: pause's `effectiveWithinS` and `resumesAfterS`, Open's `renewEveryS`, the kill's `nextSpare`, heal's `resumesAt` and `reopensAt` are read by no screen.
- `GET /api/state/heal`, `GET /api/customer/kill-disposable`, `/api/customer/{subscribe,unsubscribe,over-pass,raise-cap,cap,kill-disposable}` and `/api/merchant/refund-decline` are not called by the phones. No web component calls `/api/state/heal` or the kill's GET; `/customer` calls refund-request, reorder, subscribe, unsubscribe, pause, resume and the kill's POST (`apps/web/components/customer-screen.tsx:222-283`).
- `customer-state.subscription` is read by `/customer` only, not by the phones.
- The merchant stream's `fail` (`att:`) and `dec:` rows are dropped by the phones' fold (`apps/phones/src/orders.ts:143-145`).

---

## 3. The errand's step frames (code mode, live preset)

The live runner forces `AGENT_PRESET=live`, `AGENT_MODE=live` (`integration/src/live-runner.mjs:78`) and the agents run with `steps: 'code'` by default (`packages/agents/src/errand.mjs:90-93`, ADR-0078): scout, payer, storefront and dispatch make no model call; the concierge (high), analyst and risk (low) make one each (`packages/agents/src/errand.mjs:42-43`; `packages/config/story.json:1516-1562` for the `live` preset).

### 3.1 The seven deck steps

| # | deck key | what happens | frames (in order) | emitted by (lane) | source |
|---|---|---|---|---|---|
| 1 | `ask` | the request and the mandate | `started` `{ runId }`; `message` persona → concierge (the request text); `guard` G1 (`mandate from the human's words: at most X USDT, by <deadlineIso> (hash …)`); `agent.start` concierge | run registry; the persona's message is no handoff (no lane) | `apps/web/lib/run-registry.server.ts:83`; `packages/agents/src/errand.mjs:116-124`; `packages/agents/src/buyer.mjs:391`; `packages/agents/src/activity.mjs:81` |
| 2 | `team` | the concierge hands out the job | `tool.call` concierge `scout` and `analyst` `{ need }` (at once); `message` concierge → scout `find N × item in city`; `message` concierge → analyst `rank shops for item in city by trust`; `agent.start` scout, analyst | concierge (lane `ask`) | `packages/agents/src/buyer.mjs:402-403, 110, 171, 215` |
| 3 | `check` | the scout lists shops and reads catalogs; the analyst reads the graph | scout: `tool.call`/`tool.result` `directory_list` → `{ shops, synthetic }`, `catalog_read` per shop → `{ offers: [{ shop, sku, item, quantity, priceUsdt, etaMinutes, distanceKm }], synthetic }`, `agent.end` (model `code`), `message` scout → concierge `N offers (SYNTHETIC)`; analyst: `tool.call`/`tool.result` `graphql` (code's ranking query; the answer carries `extensions.arkiv.calls` and `explainId`), `guard` G2 (`ranking recomputed in code …`), `agent.end`, `message` analyst → concierge `best eligible: <shop>`; then `tool.result` concierge `scout` and `analyst` (`{ ranking, explainId, … }`) | scout, analyst (lane `check`) | `packages/agents/src/buyer.mjs:112-165, 196-262` |
| 4 | `check-back` | the shop vets the buyer | `agent.start` risk; `tool.call`/`tool.result` risk `ens_check` `{ name }` and `ask` `{ intent: 'buyer_risk', … }`; `message` storefront → risk `vet <payer>`; `guard` G9 (`approved …` or `declined …`); `message` risk → storefront `approve` or `decline` | storefront, risk (lane `check-back`) | `packages/agents/src/shop.mjs:90-145` |
| 5 | `quote` | the payer asks for the binding quote; the 402 | `message` payer → storefront `quote N × item`; (step 4 runs inside it); `message` storefront → payer `quote X USDT, N min (SYNTHETIC)`; `tool.result` payer `get_quote` → `{ ok, shop, item, quantity, priceUsdt, etaMinutes, orderId, synthetic }`; later `message` storefront → payer `402 payment required` | payer, storefront (lane `quote`) | `packages/agents/src/payer.mjs:180-218, 234, 377-409` |
| 6 | `payment` | the concierge pays through the payer; signature, settlement, dispatch | `tool.call` concierge `pay_shop`; `guard` G2 (`<shop> is eligible … fits the budget and deadline`); `message` concierge → payer `pay <shop>: …, at most X USDT`; `agent.start` payer; `tool.call` payer `get_quote` (step 5); `tool.call` payer `pay_order`; `message` payer → storefront `pay order <id>`; `guard` G5 (`every check passed before signing: …`); `message` payer → storefront `payment signature`; dispatch `agent.start`/`agent.end` and `message` dispatch → payer `dispatched <id>, arrives <eta>`; `message` storefront → payer `settled <tx>`; `tool.result` payer `pay_order` → `{ status: 'paid', amountUsdt, transaction, explorerUrl, orderId, arrivesAt, synthetic }`; `agent.end` payer; `message` payer → concierge `paid`; `agent.end` concierge | concierge, payer, storefront, dispatch (lane `pay`) | `packages/agents/src/buyer.mjs:265-347, 452`; `packages/agents/src/payer.mjs:220-330, 410-415`; `packages/agents/src/shop.mjs:266-271` |
| 7 | `record` | the result | `result` (`RunResult`, section 2.1) | run registry | `packages/agents/src/errand.mjs:157-176`; `apps/web/lib/run-registry.server.ts:91` |

**Observed handoff order** on production (`/api/graphql` `handoffs`, run `cb48a0d3-4ddc-4722-9eb8-04c515c6f83f`, read 01:14 IST): ask, ask, check, check, **pay** (concierge → payer), quote, check-back, check-back, quote, pay, quote, pay, pay (dispatch → payer), pay (storefront → payer), pay (payer → concierge). The first `pay` row comes before every `quote` and `check-back` row.

Handoff rows are queued and written to Arkiv as W_DIRECTORY in batches every 2 s, held around the 402 step, and flushed at the end within 10 s (`integration/src/activity.mjs:12-35, 89-123`; `integration/src/live-runner.mjs:30-31, 113-128, 151-153`); they live 30 minutes (`arkiv/schema.md:28`).

### 3.2 Agent ends recorded on main

`docs/sessions/integration/hosted/site-*.json` keep each run's frame count, event counts per type and `agentEnds` (`{ agent, role, model, usageTokens, error, output }`). They predate code mode and the dosa story (the newest, `site-2026-11-06T16-30-50-105Z.json`, asked "… by 11:59 pm"). Output keys per role in the paid run `docs/sessions/integration/hosted/site-2026-11-06T08-00-37-874Z.json:16` onward: scout `offers`; analyst `ranking`, `recommendation`, `notes`; risk `decision`, `reasons`; storefront `quoteUsdt`, `etaMinutes`, `message`; dispatch `orderId`, `confirmed`, `etaIso`, `message`; payer `status`, `reason`, `receiptTransaction`; concierge `summary`, `chosenShop`. That run: 68 frames, 115.1 s (`:1-15`).

### 3.3 Timing (recorded runs only)

- **The code-mode production errand, 00:24 IST, 55.5 s, paid 4.80** (`docs/sessions/w4-agents/runs/2026-11-06T18-54-15-439Z-paid.json:1-19, 172`): timeline, seconds from the start: concierge, scout and analyst start 5.6; scout ends 7.6; analyst ends 12.9; payer starts 17.3; risk starts 18.4 and ends 23.8; storefront starts and ends 23.8; dispatch starts 52.6 and ends 52.7; payer and concierge end 52.7. Its `deadlineIso` was `2026-11-07T01:24:00+05:30` (`:15`), one hour after the request.
- **The same run's breakdown** from its stream timestamps (`docs/thinking-partner/relays/w4-agents.md:20`): the runner's start-up 5 s; the scout's and analyst's reads 2 s; the analyst's call 5.3 s; the concierge's choice 4.4 s; the quote with the risk check 6.5 s (its call 3.3 s); from "pay order" to the 402, 13.6 s; the pre-sign checks 1.9 s; from the signature to "settled", 13.3 s; the runner's last Arkiv flush 2.8 s.
- Per-agent seconds and model calls: the same file's `usage.agents` (`docs/sessions/w4-agents/runs/2026-11-06T18-54-15-439Z-paid.json:20` onward).
- Earlier runs, all-model: 91.4 s (23:30 IST) and 87.6 s (23:49 IST) (`docs/thinking-partner/OPEN.md:78, 81`); the calibration table is `docs/thinking-partner/OPEN.md:44-87`.

---

## 4. Swarm content

### 4.1 How menus are stored

- **On Swarm** (public gateway `https://api.gateway.ethswarm.org`, `packages/config/graphpay.config.json:155-157`; anonymous uploads with the all-zero batch id, never encrypted, ADR-0039 and ADR-0061): one `menu.json` per shop, uploaded as a one-file collection, and each image as its own file (`packages/money-graph/src/swarm.mjs:1-6, 27-58`).
- **The document** (`packages/money-graph/src/menu.mjs:46-57`): `{ schema: 'graphpay.menu.v1', synthetic, version, shop: { ens, name, image? }, items: [{ sku, name, unit, quantity, priceMicro, image? }] }`. Every `image` (a dish's, and since #201 the shop's storefront as `shop.image`) is `{ ref (64 hex), name (file name), contentType ('image/svg+xml'\|'image/png'\|'image/jpeg'\|'image/webp'), sha256, bytes }` (`packages/money-graph/src/menu.mjs:18-29`); at most 64 KiB each (`:19`).
- **On Arkiv** the `menu` entity (W_DIRECTORY, mutable, 14 days): `shop_key` (indexed key, `keccak256(abi.encode(node, uint32 epoch))`), `shop_ens`, `version` (u64), `swarm_ref` (64 hex, never a 128-hex encrypted reference), `content_hash` (sha-256 of the menu bytes), `size` (u64) (`packages/money-graph/src/menu.mjs:62-66`; `arkiv/schema.md:24, 29`). A changed menu patches the row to the next version (`packages/money-graph/src/menu.mjs:98-122`).
- **Link format:** `https://api.gateway.ethswarm.org/bzz/<ref>/<name>`. The name is required: a bare `/bzz/<ref>` redirects to a "forbidden" page (`packages/money-graph/src/swarm.mjs:35`; `arkiv/swarm.md:53`).
- **How to fetch a menu:** `readMenu(publicClient, swarm, { shopEns })` from `@graphpay/money-graph`: it finds the shop's `menu` row owned by W_DIRECTORY, reads `/bzz/<swarm_ref>/menu.json`, and checks its sha-256 against `content_hash`; it answers `{ row, document, link, reuploaded, verified, missing }` (`packages/money-graph/src/menu.mjs:124-147`). An image opens at `menuImageLink(swarm, image)` = `<gateway>/bzz/<image.ref>/<image.name>`; check its `sha256` (`packages/money-graph/src/menu.mjs:43`). The phones' build does exactly this keyless (`apps/phones/menu-images.mjs:1-23`).
- **No website route serves menus.** The phones' build gives a product the Swarm link only when the story has no image for it (`apps/phones/build.mjs:42-49`), and every product has one (`packages/config/story.json:119-256`), so the phones show the site's own copies from `/phones/grok/`. The build reads item images only, never `shop.image` (`apps/phones/menu-images.mjs:13-19`).

### 4.2 Storefront photos and refund photos

- **Storefront photos: on Swarm since #201** (merged at 19:49 UTC, 01:19 IST): `scripts/menus.mjs --storefronts <dir>` uploads `<label>.<ext>` per shop as `storefront-<label>.<ext>` and puts it in `shop.image` (`packages/money-graph/scripts/menus.mjs:10-11, 43-55, 84, 110-112`). The record lists one storefront per shop (`docs/sessions/arkiv/swarm-menus.json:15-20, 60-65, 105-110`). `arkiv/swarm.md` does not mention them yet (`arkiv/swarm.md:3, 9`).
- **Refund photos: not built, by decision.** "The encrypted refund photo was dropped on purpose: Swarm is first in the cut order (ADR-0053), and the refund request's photo stays on the phone" (`arkiv/swarm.md:3, 11, 54, 56`); `refund_evidence` "gets its row here when it ships" (`arkiv/schema.md:49`); the phone keeps the photo (`apps/phones/src/live-adapter.ts:264-266`). OPEN lists `refund_evidence` as dropped (`docs/thinking-partner/OPEN.md:118`). The deck still says otherwise (section 10).

### 4.3 The references on main

Current menus, all version 2, written 2026-11-06T19:41:54Z (`docs/sessions/arkiv/swarm-menus.json:1-6`); the record names each image's reference, link, sha-256 and size.

| shop | Arkiv `menu` entity | menu.json | storefront photo | dish photos (4 each) | source |
|---|---|---|---|---|---|
| Filter & Fold (`filter-and-fold.graphpay.eth`) | [0x628f…04f8](https://rabdi.explorer.arkiv.network/entity/0x628f9aeed5550c543ca17dbfc14b0f15e683114c556ea273bbfe753c635604f8) | [menu.json](https://api.gateway.ethswarm.org/bzz/3f26da16d819311ceca5fde8e4af8077b497c272292df78d7f3292433df2dc76/menu.json) | [storefront-filter-and-fold.jpg](https://api.gateway.ethswarm.org/bzz/2edb64a7735e6a123b638e402249e3e32d6977142550e0fab2c39d506738b7c7/storefront-filter-and-fold.jpg) (24,936 bytes) | [masala dosa combo](https://api.gateway.ethswarm.org/bzz/0f28013fa2f52285c954066fd6a4597106aabe6dfc1136ae1bd8028149406613/filter-and-fold-masala-dosa-combo.jpg), filter coffee, Sunday breakfast, podi idli | `docs/sessions/arkiv/swarm-menus.json:7-51` |
| Tawa Tangle (`tawa-tangle.graphpay.eth`) | [0xdb86…4eba](https://rabdi.explorer.arkiv.network/entity/0xdb8649b11eb5a7b9ab3a2f6e98effe3ea24caefc9928931510fa1dc2c0fc4eba) | [menu.json](https://api.gateway.ethswarm.org/bzz/cb37ab29d0297440b048fc4fc37d439c75d807f563c00c54f6d46d6f0ba5a24f/menu.json) | [storefront-tawa-tangle.jpg](https://api.gateway.ethswarm.org/bzz/bfec2002a8abb8c0bee9a78dd0246f1ce1e087bc6fafbe3ad2fa84da5b7ea10e/storefront-tawa-tangle.jpg) (32,024 bytes) | masala dosa combo, onion uttapam, lemon rice, filter coffee | `docs/sessions/arkiv/swarm-menus.json:52-96` |
| Idli Index (`idli-index.graphpay.eth`) | [0xd762…50b0](https://rabdi.explorer.arkiv.network/entity/0xd762c4cfffa6eb056ad8137e403d2535e957d9d823ca80ef7fe766e9b44550b0) | [menu.json](https://api.gateway.ethswarm.org/bzz/f81bafea0300e3b4944d3b9d426fc16f34be60dd377c336735143b58a1bb0c2c/menu.json) | [storefront-idli-index.jpg](https://api.gateway.ethswarm.org/bzz/13b59e76439760f98f18e9ba7dcbbfd48cdb4de7e06c38970977f56c100f11b0/storefront-idli-index.jpg) (29,248 bytes) | masala dosa combo, idli sambar, medu vada, rava upma | `docs/sessions/arkiv/swarm-menus.json:97-141` |

- Earlier menus under the old names (`previous`): kesar-kingdom v3, jamun-junction v2, syrup-street v2 (`docs/sessions/arkiv/swarm-menus.json:143-171`); `arkiv/swarm.md:21` links kesar-kingdom's.
- `arkiv/swarm.md:15-20` still gives Filter & Fold's **version 1** (reference `1e3d…389f`, 1,630 bytes), which is no longer the row's current reference and is not in the record's `previous` list.
- FACTS rows for the first menus and the fox image: `docs/technical/FACTS.md:318-319`.

---

## 5. ENS

### 5.1 Network, root and contracts

- Network: Ethereum **Sepolia**, chain id 11155111 (`packages/config/graphpay.config.json:28-40, 92-94`), "ENSv2 Sepolia (redeployed 2026-09-15)".
- Root name: `graphpay.eth` (`packages/config/graphpay.config.json:4-6`); registered until 1825315020 (2027-11-04) (`docs/technical/FACTS.md:34`; `docs/sessions/identity/namespace.json:727-732`).
- ENSv2 contracts (`packages/config/graphpay.config.json:95-108`): rootRegistry `0xb458d6a3a77919449d03e7a6903c26827c1ec43f`, ethRegistry `0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4`, ethRegistrar `0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3`, permissionedResolverImpl `0x115eb53f0c60696633855f90b138178fb40b2b2c`, universalResolverV2 `0x24e1d8e068620b647ca097f961a61055f4f42d72`, universalResolverProxy `0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe` (and the oracle, mock tokens, factory and helper).
- Every name has **its own registry and resolver** (deployed through the VerifiableFactory; salts `graphpay:v1:<registry|resolver>:<name>`, `packages/config/graphpay.config.json:125-131`). From the real namespace run (`docs/sessions/identity/namespace.json`, `mode: real`, updated 2026-11-06T17:48:09Z):

| name | registry | resolver | source |
|---|---|---|---|
| `graphpay.eth` | `0xbfcF13F0Cbc15dE5F7337e8CB69eeE2641407823` | `0x82d9bBf1a2D2726e649Ac985241ECfdeE802Fa8d` | `namespace.json:727-731` |
| `vitalik.graphpay.eth` (persona) | `0xc3E7e0CFFBc3fBeE3576F58c02d10BB2062a2efa` | `0x1481b23D86e4572F8Ab3aEb4af00718d4a98b924` | `:735-737` |
| `filter-and-fold.graphpay.eth` | `0x11a90816A90AfECA6015a62f05eDa63109265e09` | `0xEcC5040101201165323437aB43ec16BD61EdE04e` | `:759-761` |
| `tawa-tangle.graphpay.eth` | `0x22755E497c6CCc3941c52b89Ab5B6EA055f3C76B` | `0x7396d11cE4F34f1740e0aB28602f130c0949e4b6` | `:765-767` |
| `idli-index.graphpay.eth` | `0x425feA911b78c026a1e8D85f3559D82779A7d50d` | `0xF120F34F81df81CBDFE3E73186F7f18cE4f7aeBF` | `:771-773` |
| `concierge.vitalik.graphpay.eth` | persona's registry | `0x89837ADEfF65f7C8064cB885D009a2D9e257610F` | `:779-785` |
| `scout.vitalik.graphpay.eth` | persona's registry | `0x24aAc54692f3767B395586bf70Ddf7F7adB3B26c` | `:788-794` |
| `analyst.vitalik.graphpay.eth` | persona's registry | `0x8F44F2ad0Df573B09A7b2eF977dfbABaCb1Fd779` | `:797-803` |
| `payer.vitalik.graphpay.eth` | persona's registry | `0xA9fa007c96DD260aFED853B3BFc222caB8DE03d5` | `:806-812` |
| `{storefront,risk,dispatch}.filter-and-fold.graphpay.eth` | filter-and-fold's registry | `0x5F85…069e`, `0xf721…1c1F`, `0x3D9e…960f` | `:923-947` |

### 5.2 The names

Rule: persona `<persona.label>.<root>`; buyer and working agents `<label>.<persona>`; shops `<label>.<root>`; shop agents `<label>.<shop>`; disposables `disposable-<n>.<persona>` (`packages/config/index.mjs:25-53`). From `packages/config/story.json`:

- Persona `vitalik.graphpay.eth` (`:18`; wallet role VITALIK).
- Buyer team (`:22-57`): `concierge.vitalik.graphpay.eth` (does not pay), `scout.vitalik.graphpay.eth` (pays, cap 1 USDT, `:33-37`), `analyst.vitalik.graphpay.eth` (does not pay), `payer.vitalik.graphpay.eth` (pays, cap 300 USDT, `:50-54`). Working agents `rehearsal.…` and `acceptance.…` (`:58-75`). Disposables `disposable-<n>.vitalik.graphpay.eth`, cap 1 USDT, 14 days (`:76-81`); the current spare is `disposable-3` (**observed**, section 1.1).
- Shops (labels since the flip, #189): `filter-and-fold.graphpay.eth` (good, story key `kesar-kingdom`, `:104-107`), `tawa-tangle.graphpay.eth` (trap, key `jamun-junction`, `:160-163`), `idli-index.graphpay.eth` (runner-up, key `syrup-street`, `:216-219`). The old names `kesar-kingdom`, `jamun-junction` and `syrup-street` `.graphpay.eth` stay registered as history (`docs/thinking-partner/relays/w1-identity.md`; `docs/sessions/identity/namespace.json:741-755, 1008` `renamed`).
- Shop agents (`:82-101`): `storefront`, `risk`, `dispatch` under each shop.
- Synthetic shops: the wildcard label `sim` (`packages/config/graphpay.config.json:127`), e.g. `shop-001.sim.graphpay.eth` (**observed** on `/api/map`).

### 5.3 Text records and the payee

Keys (`packages/config/graphpay.config.json:114-124`, read as `KEYS` in `packages/ens/src/records.mjs:11`): `graphpay.status`, `graphpay.cap_micro`, `graphpay.principal`, `graphpay.kind`, `graphpay.synthetic`, `x-graphpay-accepts`, `agent-context`, `agent-endpoint[mcp]`, `agent-endpoint[web]`. The payee is the address record for coin type **2147485522** (ENSIP-11 of chain 1874; `packages/config/graphpay.config.json:26`, `packages/ens/src/records.mjs:13-14`). `graphpay.status` reads `active` or `paused`; the cron resumes only a `paused` record and the gate pays only an `active` one (`apps/web/lib/heal.ts:22-31`). Only the owner may write `graphpay.cap_micro` and `graphpay.status`; the agent's own key reverts `EACUnauthorizedAccountRoles` (`docs/technical/FACTS.md:283`).

### 5.4 How the frontend should read them (through routes, never ENS directly)

| value | route | notes | source |
|---|---|---|---|
| the payer's status | `GET /api/state/customer` → `agent.status` | REVOKED beats EXPIRED beats PAUSED beats ACTIVE; ACTIVE needs a policy; unreadable is UNKNOWN | `apps/web/lib/customer-state.ts:29-37` |
| the scout's and payer's status, pause and resume times | `GET /api/state/heal` → `agents[]` | lower-case ENS text or `'unknown'` | `apps/web/app/api/state/heal/route.ts:24` |
| the payer's cap and spend today | `GET /api/state/customer` → `capMicro`, `spentTodayMicro` | `capMicro` is the **policy** cap; the gate enforces min(ENS cap, policy cap) | `apps/web/lib/customer-state.server.ts:81-82`; `apps/web/lib/limits.server.ts:146` |
| the ENS cap itself | only inside action answers: `raise-cap` `currentMicro`, `cap` `ens.beforeMicro` and `effectiveMicro`, `over-pass` `passMicro` (the minimum) | no read-only route returns it; GraphQL `node(ens) { status capMicro }` returns the mirror's copy, which lags | `apps/web/lib/limits.server.ts:93-108, 185-201`; `apps/web/lib/owner-cap.server.ts:50-64`; `packages/money-graph/src/graphql.mjs:42-60` |
| the payee | no route; the shop reads it from ENS at pay time (20 s cache, ADR-0046), and the paid result carries it as `RunResult.receipt.payTo` | | `packages/shop/src/api.mjs:22, 67-83`; `apps/web/lib/contracts.ts:87` |
| the spare disposable agent | `GET /api/customer/kill-disposable` | set only while the spare's name and pass are both live | `apps/web/app/api/customer/kill-disposable/route.ts:1-27` |

A status change is seen by the gate within its 20 s cache (`apps/web/lib/owner-actions.server.ts:1-6, 15`).

---

## 6. Explorer link formats

Bases from the config; paths from `apps/web/lib/explorer.ts:14-21` (checked against each explorer, `docs/technical/FACTS.md:329-331`). A value that is not a well-formed hash, address, key or block gets no link (`apps/web/lib/explorer.ts:1-5, 25-55`).

| network | base (config) | tx | address | other | source |
|---|---|---|---|---|---|
| Whitechain Sepolia (1874, Blockscout) | `https://explorer.testnet.whitechain.io` | `/tx/<hash>` (lower-cased) | `/address/<addr>` | `/block/<n>`, `/token/<addr>` | `packages/config/graphpay.config.json:24`; `apps/web/lib/explorer.ts:18, 33-43` |
| Ethereum Sepolia (Etherscan) | `https://sepolia.etherscan.io` | `/tx/<hash>` | `/address/<addr>` | `/block/<n>` | `packages/config/graphpay.config.json:39`; `apps/web/lib/explorer.ts:19` |
| Arkiv Rabdi (7794095) | `https://rabdi.explorer.arkiv.network` | `/tx/<hash>` | `/address/<addr>` | entity `/entity/<key>` (lower-cased); blocks `/blocks` (no number in the path); query `/entity-explorer?q=<urlencoded query>` | `packages/config/graphpay.config.json:53`; `apps/web/lib/explorer.ts:20, 45-62` |
| Swarm (public gateway) | `https://api.gateway.ethswarm.org` | — | — | `/bzz/<ref>/<file name>` | `packages/config/graphpay.config.json:155-157`; `packages/money-graph/src/swarm.mjs:35` |

- The web site builds links with `txUrl`, `addressUrl`, `tokenUrl`, `entityUrl`, `blockUrl`, `arkivQueryUrl` (`apps/web/lib/explorer.ts:33-62`) over `siteModel().explorers` (`apps/web/lib/site.server.ts:152`).
- The phones: `txLink(tx)` → `<whitechain>/tx/<tx>` labelled with `copy.common.viewTxWhitechain` (`apps/phones/src/links.ts:6-8`); `sepoliaLink(tx)` → `<sepolia>/tx/<tx>` labelled `copy.common.viewOnEns` (`apps/phones/src/live-adapter.ts:52-54`). Their bases come from the projection: `explorers.whitechain`, `explorers.ens` (= Sepolia Etherscan, not the ENS app), `explorers.arkiv` (`apps/phones/story-projection.mjs:90-97`). The team's mock story's `explorers.ens` is `https://sepolia.app.ens.domains` (`frontend/src/data/story.json:44`); the build replaces it.
- The map's Arkiv queries: `shopQuery(shopKey)` and `presenceQuery(session)` (`apps/web/lib/map.ts:92-94`).

---

## 7. Constraints

### 7.1 One errand at a time

- Enforced per **server instance** in memory: the registry refuses a start while its active run is not done (`apps/web/lib/run-registry.server.ts:77-79`; one registry per process, `apps/web/lib/runs.server.ts:1-5`), and the runner keeps its own busy flag (`integration/src/live-runner.mjs:79, 93-101`). Two Vercel instances could each run one (ADR-0069 says "one at a time per server instance": `docs/decisions/ADR-0069-public-access-no-passcode-no-visitor-rate-limits.md:19`).
- A second caller gets **HTTP 409 `{ error: 'busy: one errand at a time' }`** (`apps/web/app/api/agents/run/route.ts:24-25`); if it slips past the registry, its stream ends with `failed` `'busy: the last errand is still finishing; try again in a minute'` (`apps/web/lib/run-registry.server.ts:39-42`). The phones say "Another errand is running right now. Try again in a minute." (`apps/phones/src/live-adapter.ts:184`).
- A run is cut at 280 s (`failed` "the errand ran out of time"), inside the route's 300 s (`apps/web/lib/run-registry.server.ts:57, 96`; `apps/web/app/api/agents/run/route.ts:9`).

### 7.2 Self-healing

- `RESUME_AFTER_S = 120`: a paused agent is resumed by its owner 120 s after the pause, dated by the status record's last `TextUpdated` log within 900 Sepolia blocks (about three hours); an older pause resumes at once (`apps/web/lib/heal.ts:8, 36-44`; `apps/web/lib/heal.server.ts:26-30, 92-121`).
- `REOPEN_AFTER_S = 300`: a closed shop is reopened 300 s after its close; `RENEW_BELOW_S = 600`: a live listing with under 10 min left is renewed (`apps/web/lib/heal.ts:9-13, 54-67`). The merchant page renews every 300 s; a listing lasts 15 min (`apps/web/lib/open-toggle.server.ts:12-13`).
- The cron runs every minute (`apps/web/vercel.json:9-12`), one run at a time per instance (`apps/web/lib/heal.server.ts:165-170`); its resume skips the visitors' 20 s gap (`:131-132`).
- `GRAPHPAY_HEAL=0` turns it off: the cron answers `{ off: 'GRAPHPAY_HEAL=0' }` (`apps/web/app/api/cron/heal/route.ts:17`), `/api/state/heal` says `healing: false` with no promised times (`apps/web/app/api/state/heal/route.ts:17-19`), and pause omits `resumesAfterS` (`apps/web/app/api/customer/pause/route.ts:25`).
- `GET /api/state/heal`: section 1.1. Proven live on the scout and the payer (`docs/thinking-partner/relays/w5-ops.md:13-16`).

### 7.3 The payer's daily pass

- 300 test USDT: `buyerAgents[payer].capMicro: 300000000` (`packages/config/story.json:50-54`); both the AgentPolicy and the ENS cap record were raised to it (`docs/thinking-partner/relays/w5-ops.md:6-8`). **Observed** `capMicro: '300000000'` at 01:14 and 01:24 IST; spent 126.8 and 141.2. NOW says the cap read 250 during W3's live test (`docs/thinking-partner/NOW.md:41`).
- Reset: the checkout counts spend per `block.timestamp / 1 days`, i.e. **00:00 UTC = 05:30 IST** (`packages/contracts/src/GraphPayCheckout.sol:530-531, 627`; `docs/decisions/ADR-0069-public-access-no-passcode-no-visitor-rate-limits.md:18`; `docs/thinking-partner/NOW.md:41`). The phones' pass period ends at the next UTC midnight or the policy's expiry (`apps/phones/src/live-adapter.ts:85-91`).
- Per-subscription charge limit: `renewal.demoPeriod.maxCharges: 3` on a 120 s demo period at 2.40 (`packages/config/story.json:295-312`); the payer signs a Permit2 allowance for price × maxCharges, and the cron sends no charge it no longer covers (`docs/thinking-partner/relays/w3-payments.md:7-10, 24`; `apps/web/lib/renew.server.ts:1-8, 27-30`). Subscribe is refused with `OVER_PASS` when today's spend plus the price exceeds the policy cap (`apps/web/lib/subscription-live.server.ts:221`).
- Over the pass: `POST /api/customer/over-pass` signs the story's `order.overPass` (100 × the 4.80 combo = 480; `packages/config/story.json:290-293`) only when it exceeds the whole pass and the payer's balance, sends it to the facilitator's verify step only, and records the refusal (`apps/web/lib/limits.server.ts:110-174`).
- The owner may lower the cap or restore it, never above 300, never below today's spend plus the errand budget (6 USDT, `packages/config/story.json:280`) (`apps/web/lib/owner-cap.server.ts:7-10, 69-76`).

### 7.4 Pause per agent

- Pausable agents are the buyer agents with `pays` and a `capMicro`: **scout and payer** (`apps/web/lib/owner-actions.server.ts:35-39`; `packages/config/story.json:28, 36, 45, 53`). Concierge and analyst get 409 `NO_PASS` with a sentence to show as it is (`apps/web/lib/owner-actions.server.ts:43-58`). No agent named means the payer (`:47`).
- The gap: one status change per 20 s per instance for any agent, under public access (`apps/web/lib/owner-actions.server.ts:113-125`).

### 7.5 Public access (ADR-0069)

- Visitors meet no passcode and no rate limits; the keys between our own servers stay (facilitator bearer, recorder token, cron secret, the shop's pay route, every wallet key) (`docs/decisions/ADR-0069-public-access-no-passcode-no-visitor-rate-limits.md:4-7, 22-29`; `apps/web/lib/passcode.ts:6-10`). The switch is `site.publicAccess: true` (`packages/config/graphpay.config.json:160`); `GRAPHPAY_PUBLIC_ACCESS=0` can only close it (`apps/web/lib/passcode.ts:38-43`). The site's own client sends no passcode while public (`apps/web/components/site-context.tsx:96-132`); the phones never send one.
- What still bounds visitors: per-instance read ceilings (section 1), the cooldowns of section 1.2, visitor guards on merchant actions (only the story persona's own orders, 30 s per order: `apps/web/lib/merchant-actions.server.ts:178-192`), and the on-chain pass.

### 7.6 The deadline: "delivered within an hour"

- The request is `order.request`: "Just landed in Mumbai. Get me the best masala dosa near BKC under 6 USDT, delivered within an hour." (`packages/config/story.json:274`); it is also the phones' quick prompt (`apps/phones/story-projection.mjs:87`).
- Code reads a relative span ("within an hour", "in 45 minutes", up to a day) from the request time, to the whole minute; a clock time ("by 8 pm") still works (`packages/agents/src/mandate.mjs:1-4, 19-53, 119-126`). The guard checks each shop's ETA against it at the choice, the quote and before signing (`docs/thinking-partner/relays/w4-agents.md:5`; `packages/agents/src/payer.mjs:212`). The run's own deadline is `RunResult.mandate.deadlineIso` (`packages/agents/src/errand.mjs:78`).
- `order.deadlineLocal: "23:59"` (`packages/config/story.json:281`) is still read by `/customer`'s chip (section 10).

---

## 8. OPEN's frontend list (verbatim)

Every item tagged for the frontend pass in `docs/thinking-partner/OPEN.md` at `5d8f8c7`: the whole `## frontend` section (`:198-225`), and the frontend items filed under `## w5-ops` (`:231-254`). Who added each line, from `git blame` on main:

| OPEN.md lines | item | added by (stream, PR) |
|---|---|---|
| 198-199 | the `## frontend` heading | W4 Agents, #153 |
| 200-206 | Kill a disposable agent | W1 Identity, #175 |
| 207-208 | /customer's "By 23:59" chip; the deck's errand text | W4 Agents, #153 |
| 209 | Re-order is "another coffee" | W3 Payments, #155 |
| 210-215 | Subscribe; Cancel; the subscription in the customer state | W3 Payments, #173 |
| 216-217 | Pause and Resume on the tapped card; self-healing on the phones | W5 Ops, #172 |
| 218-225 | the menus, dishes and storefronts on Swarm; the big city's shops not on the map; race mode's size and its 429 | W2 City, #201 |
| 231-236 (under `## w5-ops`) | Decline a refund request | W3 Payments, #163 |
| 237-246 (under `## w5-ops`) | Over the pass; the agent raises its own cap | W3 Payments, #169 (line 239 last edited by #190) |
| 247-254 (under `## w5-ops`) | The owner changes the payer's cap | W3 Payments, #179 |

Related items not tagged "frontend": the team's four asks (`docs/thinking-partner/OPEN.md:130-137`, `## phones`), and the website items (`:139-145`, `## website`: the read-limit ceiling, the deck's other slides, the refund-reason table, the demo store).

### 8.1 `## frontend` (`docs/thinking-partner/OPEN.md:198-225`)

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
- **The menus, the dishes and the storefronts on Swarm** (from w2-city; owner: the frontend pass). What: each shop's `menu` row on Arkiv points to its Swarm `menu.json`. Its `shop.image` is the storefront photo, and each item's `image` is that dish's photo. Each image is `{ ref, name, contentType, sha256, bytes }`, opened at `https://api.gateway.ethswarm.org/bzz/<ref>/<name>`. Read it with `readMenu` (`@graphpay/money-graph`), which checks every hash. The list is `docs/sessions/arkiv/swarm-menus.json`. Recommendation: open the photos from Swarm where the Swarm prize is shown; the phones' own copies are the same files.
- **The big city's shops are not on the map** (from w2-city; owner: the frontend pass). What: M's 120 synthetic places were held back from the W_DIRECTORY directory. `apps/web/lib/map.server.ts` reads up to 100 synthetic shops on every poll, and the stage's phones poll `/api/map`; Arkiv's keyless query window, shared with the live errand, cannot carry that. Recommendation: filter the map's synthetic query by dataset (`graphpay-city-v1-S`), or show M's places from `story.json` (`syntheticCity.places`) without reading Arkiv.
- **Race mode's size and its 429** (from w2-city; owner: the frontend pass). What:
  - `/api/race` reads any seeded size (`size`); without one it takes `syntheticCity.raceSize`, S until M has a plain store.
  - On a city of more than 1,000 payment rows a plain race starts once every 10 minutes per server, and inside that gap it answers 429 with `{ error }` saying when the next can start. `components/race-view.tsx` shows every 429 as "Another race is running".
  - The deck's "48 reads" is the lab's 10,000-event city; label it "lab", or show the measured S numbers (2 against 5).

  Recommendation: show the 429's `error` text.

### 8.2 Frontend items under `## w5-ops` (`docs/thinking-partner/OPEN.md:231-254`)

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
  - The owner's wallet writes the ENS record on Sepolia. The watcher on the Mac then writes the policy as min(ENS cap, configured cap) (ADR-0079; W1's change). The route waits up to 60 s for it.
  - Answer: `{ agent, owner, capMicro, configuredMicro, ens: { changed, beforeMicro, sepoliaTx }, policy: { capMicro, applied }, effectiveMicro, arkivTx, entityKey }`.
  - Refusals: `OVER_CONFIGURED`, `UNDER_FLOOR` (below today's spend plus the story errand's budget, `order.budgetMicro`, so the next errand always fits; a restore to the configured cap is always allowed), `BAD_CAP`, `TOO_SOON` (one change per 20 s per instance). `policy.capMicro` is null when the policy could not be read; `arkivTx` is null when the record could not be written. The ENS change stands either way.
  - Event: a `request` edge from the persona to the payer agent, ref `own:<node>:<second>:<cap>`, amount 0, the figures in its payload. The node row's `capMicro` follows through the mirror.
  - Recommendation: wire `setCap` to the route and emit `agent.cap.changed` with the Sepolia link and, once `policy.applied`, the new pass.

---

## 9. Race mode

- **Route:** `GET /api/race` (section 1.3). Questions `Q1`, `Q2`, `Q5` (`packages/money-graph/src/bench.mjs:20`); `mode` `graph` or `plain`; `inFlight` `1`, `4`, `8`, `16` or `all`, plain only (`apps/web/lib/race.ts:14, 18-28`). Each side is its own request and stream; the page runs both (`apps/web/components/race-view.tsx:59-91`, default `inFlight` 8). Live and uncached: a new Arkiv connection per race (`apps/web/lib/race.server.ts:1-4, 28-51`). The result is the number of reads, never a clock (ADR-0042; `apps/web/app/api/race/route.ts:1-3`).
- **Sizes.** The story defines S (about 1,000 edges, owner W_SEED_EVENT, the test cast) and M (about 10,000 edges, W_SEED_M_EVENT, the final cast, with places) (`packages/config/story.json:416-429`). **Main serves S only**: any other `size` is refused with 400 `'only the size S city is seeded'` (`apps/web/lib/race.ts:16-24`; **observed**). The truth for the "correct" badge is the S city generated from end day `2026-11-05` (`apps/web/lib/race.server.ts:11-23`). M as seeded: trimmed by the founder to its first 3,175 events, graph store only, no plain store and no directory rows, so race mode stays at S (`docs/thinking-partner/OPEN.md:189`; `docs/thinking-partner/relays/w2-city.md:17-25`).
- **Where the measured numbers are published for the site:** `bench/results/questions-S.csv`, read at build time by `apps/web/app/race/page.tsx:21-27` and parsed by `apps/web/lib/race.ts:54-85` (reads, bytes and correctness; times stay in the CSV). The harness `bench/run.mjs` writes `bench/results/questions-<size>.csv`, `q2-parallel-<size>.csv`, `writes-<size>.csv`, `http-<size>.csv` and `bench/BENCHMARK-LIVE.md` (`bench/run.mjs:5-6, 125, 144, 174`). There is no `questions-M.csv` on main, and the page reads only the S file.
- The page asks Q2, Q1 and Q5 (`apps/web/app/race/page.tsx:35-39`), labels the city "synthetic city, size S" (`:47-52`), and states "the city-wide top 10: 2 reads against 5 or 6" (`:94-96`).

**Measured numbers on main** (synthetic dataset `graphpay-city-v1-S`, Arkiv Rabdi blocks 265307-265376, commit `667b236`, run 2026-11-05T22:08:32Z; `bench/results/questions-S.csv:1-14`; reads = Arkiv JSON-RPC calls, 5 runs each):

| question | plain reads | plain bytes | Graph Arkiv reads | Graph Arkiv bytes | plain right by name | plain right by identity | Graph Arkiv right | CSV lines |
|---|---|---|---|---|---|---|---|---|
| Q1 the featured shop's refund rate and 90-day orders | 3 | 1,310 | 3 | 109,376 | yes | yes | yes | 3-4 |
| Q2 the top 10 shops by sales, city-wide | 5 | 135,088 | 2 | 35,378 | yes | no | yes | 5-6 |
| Q3 the persona's agents' spend by shop this week | 2 | 3,421 | 3 | 16,712 | yes | yes | yes | 7-8 |
| Q4 agents that paid a shop this week and later refunded someone else | 1 | 540 | 1 | 750 | yes | yes | yes | 9-10 |
| Q5 a payment path from the persona's paying agent to the trap shop, within 3 hops | 5 | 101,932 | 3 | 119,633 | yes | yes | yes | 11-12 |
| Q6 the featured shop's depth-2 neighbourhood over this week's payments | 2 | 15,726 | 2 | 55,342 | yes | yes | yes | 13-14 |

- Q2 with plain requests in flight (`bench/results/q2-parallel-S.csv:3-8`, 11 rounds): plain 1 in flight 5 reads; 4, 8, 16 and all in flight 6 reads (135,172 bytes); Graph Arkiv 2 reads (35,378 bytes); no non-200 answers and no 429s.
- Writes to seed S (`bench/results/writes-S.csv:3-5`): graph store 97 transactions, 0.494008 tGLM; plain 43, 0.181347; directory 1, 0.002242.
- The quotable line and the D6 table: `bench/BENCHMARK-LIVE.md:9, 15, 17-27` ("D7 (size M): blocked").
- **Observed live** (not a published number): one graph-side Q2 at 01:14 IST answered `calls: 2`, `bytes: 35372`, `correct: true`, after three `call` frames.
- **Not measured on main:** any M figure. W2 gives "2 against 14" for Q2 at M as the generator's count (`docs/thinking-partner/relays/w2-city.md:24`; `docs/thinking-partner/OPEN.md:189`); the deck's 48 plain reads is the pre-event lab's number (`apps/web/public/deck/index.html:409, 435`; `docs/thinking-partner/relays/w2-city.md:25`); TRACKER's "48 against 2" heading is the same lab figure (`docs/thinking-partner/TRACKER.md:15`).

---

## 10. Known issues

### 10.1 The phones (`apps/phones`, `frontend/`)

1. **Pause and Resume always act on the payer.** `pauseAgent()` and `resumeAgent()` ignore the tapped name and POST `{}`; every change is reported as the payer's `agent.permission` (`apps/phones/src/live-adapter.ts:276-282, 324-331`). The routes accept `{ agent }` (section 1.2). The team's card clears its pending state only on an `agent.permission` for its own name (`frontend/src/apps/customer/CustomerAgents.tsx:56, 66-67`), so a tap on Scout's card pauses the payer and, by that code, leaves Scout's card pending (inferred, not tapped). Sources: `docs/thinking-partner/OPEN.md:216`, `docs/thinking-partner/NOW.md:133`, `docs/thinking-partner/relays/w5-ops.md:12`, `docs/thinking-partner/TRACKER.md:11`.
2. **Unwired actions** answer an `error` event "This action is not available yet.": subscribe, cancel, revoke, the agent's cap raise and the decline (`apps/phones/src/live-adapter.ts:270-288, 307-309, 346-349`); `setCap` is not implemented (optional in the contract, `frontend/src/demo/contract.ts:268-269`); nothing calls the kill or over-pass routes. "The kill and the cap revert are not on the phones" (`docs/thinking-partner/TRACKER.md:43`).
3. **`story.demo` is missing from the build's projection** (`apps/phones/story-projection.mjs:36-98` against `frontend/src/data/story.ts:60-62`; also `buyerReputation` and `otherCustomer`, read only by the mock). The self-raise action reads `story.demo.capRaiseAttemptUsdt` before it calls the adapter, and the catch shows the raw error message (`frontend/src/apps/customer/CustomerAgents.tsx:64-75`). Inferred from code, not tapped.
4. `snapshot.renewals` is always `[]` and `errandRunning` always `false` (`apps/phones/src/live-adapter.ts:162-163`); the customer state's `subscription` is not read (`docs/thinking-partner/OPEN.md:215`).
5. `policyExpiresAt` is an ISO string (`apps/web/lib/customer-state.server.ts:83`) but the adapter reads it as `Number(…) * 1000` (`apps/phones/src/live-adapter.ts:88`), which gives NaN, so the pass always ends at the next UTC midnight. The value is `null` today (**observed**), so nothing shows wrong yet.
6. The merchant fold keeps only chain rows and `req:` requests (`apps/phones/src/orders.ts:143-145`): refused attempts (`fail`, `att:`) and declines (`dec:`) never show, and a refund's reason is always empty (`apps/phones/src/orders.ts:184`), since graph edges carry no payload (`docs/thinking-partner/OPEN.md:236`).
7. The merchant phone keeps its own Open state; it reads `/api/map` every 30 s but not `/api/state/heal` (`apps/phones/src/live-adapter.ts:29, 414-423`; `docs/thinking-partner/OPEN.md:217`).
8. `ShopChoice.repeatBuyers` shows a dash (`apps/phones/src/errand.ts:58-59`); the team's four asks are open (`docs/thinking-partner/OPEN.md:132-136`).
9. The quote's validity on the phones is now + 10 minutes, set on the client (`apps/phones/src/errand.ts:44, 180-181`); `graph.read.ms` is always 0 (`apps/phones/src/errand.ts:213`).
10. The projection's `renewal.productId` is `order.sku`, not `renewal.sku` (`apps/phones/story-projection.mjs:89`; `docs/thinking-partner/OPEN.md:213`).
11. The team's copy still tells the sweets story, e.g. "The syrup is warm" and gulab jamun lines (`frontend/src/copy.ts:238, 352-358, 428`; `docs/thinking-partner/TRACKER.md:29`).
12. The phones send no passcode header: if public access were closed, every phone POST would get 401 (`apps/phones/src/live-adapter.ts:334-344`; `apps/web/lib/passcode.ts:46-51`).
13. The deck can move twice for one refund: a request posts `refund-request` from the customer phone and again when its edge reaches the merchant phone; a refund posts `refund` on approve and again, with its link, when the edge lands (`apps/phones/src/live-adapter.ts:265-269, 303-306, 459-466`). Inferred from code.

### 10.2 `/customer` (T5's own screen, not linked from the stage)

14. **The "By 23:59" chip.** The screen computes and prints `order.deadlineLocal` (`apps/web/components/customer-screen.tsx:104, 164-167`; `packages/config/story.json:281`) while the request says "delivered within an hour" (`docs/thinking-partner/OPEN.md:207`).
15. It sends fields the routes ignore: `qty` to the re-order (`apps/web/components/customer-screen.tsx:237`; the route reads only `parentOrderId`, `apps/web/app/api/customer/reorder/route.ts:21`), and `period` to subscribe from a select that offers the weekly period (`apps/web/components/customer-screen.tsx:250-258`; the route reads only `plan`, `apps/web/app/api/customer/subscribe/route.ts:23`; the plan always uses the demo period, `apps/web/lib/subscription.server.ts:90-111`).

### 10.3 The deck (`apps/web/public/deck/index.html`)

16. **A hand copy of the old story** (`:409-438`): the errand text "… under 6 USDT by 11:59 pm." (`:425`; `docs/thinking-partner/OPEN.md:208`), `cap: 100` (`:426`; the pass is 300), the old shop labels `kesar-kingdom`, `syrup-street`, `jamun-junction` (`:428-430`), a sample order id and ETA (`:432`), sample `tx` and `swarmRef` (`:437`), and lab numbers (`:435-436`).
17. The refund slide says the photo is encrypted on the phone and stored on Swarm, with an Arkiv pointer (`:594, 852, 857-869`); that is not built (section 4.2).
18. Slide 13 "Agents can’t raise their own limits" (`:893`) has no row in the deck table and no phone event (`apps/web/lib/deck-map.ts:10-23`; `apps/phones/src/live-adapter.ts:105`).
19. **Possible jump past steps 4 and 5.** The errand's first `pay` handoff (concierge → payer, `packages/agents/src/buyer.mjs:283`) is written before the `quote` and `check-back` rows (`packages/agents/src/payer.mjs:181`; `packages/agents/src/shop.mjs:121`), as the production handoff order shows (section 3.1), and `/live` moves the deck to the furthest lane that has any row (`apps/web/components/middle-switch.tsx:87-97, 116-129`). The jump itself was not observed on the deck.
20. `/live` ignores `failed` frames (`apps/web/components/live-run-bridge.tsx:25-36`): after a failed errand the explainer and the deck keep a run with no result.
21. The non-demo slides were never checked one by one, and the sample sweets pictures are still in (`docs/thinking-partner/OPEN.md:142`; `docs/thinking-partner/TRACKER.md:28`).

### 10.4 Server, data and records

22. **The Arkiv read budget and the mirror lag.** The access key's quota is spent; reads use the keyless endpoint, whose window of about 10,000 rows every process on the Mac shares; the mirror can stall, and a re-adopt after an Arkiv timeout can delay an edge by minutes. So the merchant feed, the receipts, the customer state's `lastOrder` and the CSV can lag the chain (`docs/thinking-partner/NOW.md:43, 53`; `docs/thinking-partner/OPEN.md:10-12`; `docs/thinking-partner/relays/w2-city.md:38-41`; `docs/thinking-partner/relays/w5-ops.md:17-19`; `docs/thinking-partner/TRACKER.md:6`).
23. `/api/status` always answers `mirrorLagBlocks: null` and `relayerWbt: null`, with the notes "mirror lag: waiting for M11 mirror" and "relayer balance: waiting for M4 facilitator" (`apps/web/app/api/status/route.ts:32-33, 40`; **observed**); the top bar shows "—" (`docs/thinking-partner/TRACKER.md:22`). The mirror's `heartbeat` entity exists for this chip (`arkiv/schema.md:23`).
24. **Per-instance memory:** explain traces (the last 200; `apps/web/app/api/graphql/arkiv.server.ts:1-4`), run replays (`apps/web/app/api/agents/run/[id]/events/route.ts:7-8`), one errand at a time and every cooldown. The three explain links in `docs/thinking-partner/NOW.md:102, 107, 108` answered 404 at 01:14 IST (**observed**); "no fixed explain link is published" (`docs/thinking-partner/relays/w7-submission.md:51`).
25. The merchant stream drops `cancel`, `late` and `dispute` edges (`apps/web/lib/merchant-feed.ts:44` against `packages/money-graph/src/model.mjs:19`), although OPEN says a cancel is a `cancel` edge in the stream (`docs/thinking-partner/OPEN.md:215`).
26. The merchant stream's first edges can arrive more than 8 s after `ready` (**observed** once, section 2.2).
27. The map lists the old and the new shop rows under the same display names (**observed**: six real rows, two per name; `docs/thinking-partner/OPEN.md:190`), and the big city's 120 places are not on it (`docs/thinking-partner/OPEN.md:219`).
28. Race: `race-view` shows every 429 as "Another race is running" (`apps/web/components/race-view.tsx:88`; `docs/thinking-partner/OPEN.md:220-225`); the streamed `call` frames can outnumber `answer.calls` (**observed** 3 against 2), and the view shows the running maximum, then the answer's count (`apps/web/components/race-view.tsx:74-81`).
29. The CSV's file name uses the story key, not the label (**observed** `kesar-kingdom-orders-from-2026-10-06.csv`; `apps/web/app/api/merchant/export.csv/route.ts:25`).
30. Pause and resume answer the same 429 sentence for the 20 s gap and for a full queue (`apps/web/lib/owner-actions.server.ts:123-124`; `apps/web/app/api/customer/pause/route.ts:27`).
31. The read ceilings are still in code (map and customer state 400, merchant events 300, CSV 100, GraphQL 60, MCP 120, race 20 per minute per client per instance), against ADR-0069's "no ceilings" amendment (`docs/thinking-partner/OPEN.md:141`; `docs/decisions/ADR-0069-public-access-no-passcode-no-visitor-rate-limits.md:22-29`).
32. The refund reason on chain is always 1; there is no shared table (`apps/web/lib/merchant-actions.server.ts:17-19`; `docs/thinking-partner/OPEN.md:143`).
33. The demo store is not deployed (`docs/thinking-partner/OPEN.md:144`; `docs/thinking-partner/TRACKER.md:44`).
34. Records lag: `arkiv/swarm.md` cites Filter & Fold's menu version 1 and no storefront photos (section 4.3; `docs/thinking-partner/OPEN.md:191`); `docs/thinking-partner/TRACKER.md:18` calls the storefront photos "in PR (#201)", but #201 is on main.
35. Acceptance E1 still expects the 23:59 clock deadline (`docs/thinking-partner/OPEN.md:185`).
36. A comment says the run stream's keep-alive is every 15 s; the code sends one every 5 s (`apps/web/lib/run-registry.server.ts:116-117, 138`).

---

## Uncertain or not found

1. **ADR-0080** ("the big city trimmed to what was seeded") is cited by `docs/thinking-partner/OPEN.md:189` and `docs/thinking-partner/relays/w2-city.md:17`, but no `ADR-0080` file is in `docs/decisions/` on main.
2. **OPEN's "Race mode's size and its 429"** (`docs/thinking-partner/OPEN.md:220-225`) describes code that is not on main: `/api/race` reading any seeded size, a `syntheticCity.raceSize` default, and a 10-minute gap for plain races on a large city. On main `apps/web/lib/race.ts:23-24` still refuses any size but S, and `raceSize` appears nowhere in `packages/` or `apps/`. Most likely PR #186, which NOW lists as in review (`docs/thinking-partner/NOW.md:97`); not checked.
3. `bench/d7.mjs` (`docs/thinking-partner/relays/w2-city.md:48`) is not on main.
4. **No measured number for size M exists on main.** "2 against 14" is a generator count; "48" is the lab's.
5. The Swarm menu documents (version 2, with `shop.image`) were **not fetched**: only the production site was in scope. Their content is taken from `docs/sessions/arkiv/swarm-menus.json` and the code.
6. Per-name resolvers and registries come from the namespace run record (`docs/sessions/identity/namespace.json`, 2026-11-06T17:48Z); they were not re-read on chain. The record has no rows for `disposable-2` or `disposable-3`.
7. Which errand the production handoff rows belong to: run `cb48a0d3-4ddc-4722-9eb8-04c515c6f83f` had live presence at 01:14 IST, and the last payment was at 01:07:48 IST; that these are the same run (W1's proof errand) is likely but not confirmed.
8. Inferred, not observed: the deck jumping past steps 4 and 5 (10.3, item 19); Scout's card staying pending after a Pause (10.1, item 1); the self-raise TypeError (10.1, item 3); the double deck moves for a refund (10.1, item 13).
9. The payer's ENS cap now: `/api/state/customer` showed the **policy** cap at 300 at 01:14 and 01:24 IST, while NOW says the cap read 250 during W3's test (`docs/thinking-partner/NOW.md:41`). No read-only route returns the ENS cap alone.
10. Docs that disagree with code (the code is taken as true above): the owner-cap route waits up to 60 s for the policy (`apps/web/lib/owner-cap.server.ts:17`), not 45 s (`docs/thinking-partner/relays/w3-payments.md:39`); a reason or note is refused at 7 or more digits (`apps/web/lib/refund-request.server.ts:65-72`), not "six" (`docs/thinking-partner/OPEN.md:232`).
11. Whether Vercel runs several instances of a route at once (which would allow two errands, and make explain links and replays miss) was not checked.
12. The first-edge delay on the merchant stream was seen once (an 8 s connection with no edge); its cause was not established.
13. The deck's "sample sweets pictures" (`docs/thinking-partner/TRACKER.md:28`) were not checked by eye; the deck draws inline SVG placeholders for the order photo and the menu (`apps/web/public/deck/index.html:474-475`).
14. Nothing in `docs/sessions/arkiv/swarm-menus.json` (entity keys, transactions, references, hashes) was checked against Arkiv or the gateway in this pass.
