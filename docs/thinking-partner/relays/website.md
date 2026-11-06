# Relay: website (T5 Web)

Updated 10:45 IST, Fri 6 Nov. Latest step: **the customer phone's Re-order** (branch `web/reorder-live`; Request refund merged in #73). Older per-step detail is in the PRs and `docs/sessions/website/resume.md`.

## In plain words

The website is live at https://graphpay-event.vercel.app: Vitalik's phone on the left, Kesar Kingdom's phone on the right, the explainer in the middle (five agent lanes: Ask, Check, Check back, 402 quote, Pay), race mode, the Mumbai map and a top bar of live chips. On a phone each screen opens on its own page and the stage QR codes point to them. Nothing is faked: a button that would spend money asks for the passcode, then either works or says "not live yet" and names what it waits for.

**Working now**
- Customer phone: live status, cap and spend read from the chains and the money graph; Pause my agent and Resume (the owner wallet sets the ENS status); and, new in this step, **Request refund**. It writes a refund request to Arkiv (a record that moves no money; the merchant decides). The order is always the payer agent's newest payment, checked on the chain: it must be this shop's, paid, with enough left to refund. One request per order per minute.
- Re-order (in a PR): the payer agent signs one 1.20 USDT payment for the story's re-order of its newest order through the hosted shop, gasless, under its on-chain spending pass. The order, price, item and shop come from the chain and the story, never from the page; the quote's own terms are checked before anything is signed; and the payer agent is held until a signature can no longer settle (about 11 minutes after an unclear answer), so a second tap cannot pay twice on one server. Needs `PAYER_PRIVATE_KEY` in Vercel; until then "not live yet". Not paid for real from here yet.
- Fixed (integration audit): the merchant feed and the accountant CSV asked the graph for 50 and 100 rows, and the graph hands back a shop's oldest rows first and cuts the rest without saying so, so new payments stopped appearing in the feed after four more, and the CSV held only the October history. Both now ask for the largest honest answer (500 rows per direction), say when it is full, and shorten the window until it fits. Read live: feed window 60 edges, CSV 295 rows up to today's newest, nothing flagged.
- Merchant phone: live feed of orders, payments and refunds; the accountant's CSV; the Open toggle (lists the shop on Arkiv, renewed every 5 minutes); Mark dispatched and Refund, signed with the shop's own key behind the passcode, with a lock against a second send.
- Race mode (reads, not speed), the order trail page, the explain page, the map, the agent lanes.
- Checkout kit and the separate demo store: one real 4.80 USDT payment went through the kit on the chain (order `0x0864…05f0`, block 12326025).

**Not live yet, and why**
- Subscribe and Cancel subscription: the hosted shop only takes first orders and re-orders through its 402 route; it has no subscribe or cancel endpoint, and the hosted facilitator does not create subscriptions. That is T1's side.
- Kill a disposable agent: waits for T2's provisioning.
- The agent lanes and the map's agent glow have not filled from a real run: the errand runner (Join's wiring) is not set on the site yet.

**What the founder or Coordinator must do**
- Set in Vercel Production: `W_SYNC_PRIVATE_KEY` (Request refund), `SHOP_KESAR_PRIVATE_KEY` (Mark dispatched, Refund; the shop wallet also needs a refund float approved to the checkout), `PAYER_PRIVATE_KEY` (re-order, funded with test USDT and bound to the payer agent by a pass). The founder holds the passcode; a stage rehearsal of Open, Pause and Resume needs it.
- Create the Vercel project `graphpay-store` for the demo store.

## Technical

- Pages in `apps/web/app`, components in `apps/web/components`, pure code in `apps/web/lib`. Story and addresses come only from `@graphpay/config`; `pnpm check` is clean. Spending routes call `requirePasscode` first (`X-Demo-Passcode`, SHA-256 compared with `timingSafeEqual`); `lib/routes.test.ts` (F2) imports every route file and checks the route table against the disk.
- Refund request: `POST /api/customer/refund-request` → `lib/refund-request.server.ts`. Writes a `request` edge (payer agent to shop, ref `req:<orderId>:<ts>`, payload `{orderId, amountMicro, reason}` as hex) through `recordEdge` on the W_SYNC connection shared with the facilitator's refusal recorder. Returns `{orderId, amountMicro, arkivTx, entityKey}`. 503 until W_SYNC's key is set. Reason is at most 140 plain characters (the graph is public). The merchant phone does not list open requests yet.
- Re-order: `POST /api/customer/reorder` → `lib/reorder.server.ts` (all decisions, injected signer, 12 tests) and `lib/reorder-live.server.ts` (the only file importing `@graphpay_ethglobal/agentpay`: quote from `${site}/api/shop/quote`, exact pay URL, terms and wallet checked, `createBuyerAgent(...).pay` with a 90 s fetch cut-off). Two taps on two instances at once are bounded only by the pass's daily cap (OPEN).
- Merchant actions: `lib/merchant-actions.server.ts` reads the order from the checkout first (this shop's, status, amount left, float), checks `eth_chainId` before signing, queues sends one at a time and locks an order whose receipt is late.
- Streams are read with `fetch` so a 503 JSON refusal stays visible; polling pauses on hidden tabs (ADR-0055). Live events poll over HTTPS; agent events stream over SSE.
- Gaps recorded in `OPEN.md` (website): an entity key on the GraphQL `Shop` (T3), a shared table of refund reason codes (T1; the phone sends 1), `runId` passed to the runner (Join), the explorer query-link format unverified, the store's CSV row for the kit payment waiting on the log-range fix being redeployed.
- Checks on Node 22.23.4: 171 tests in `apps/web`, `typecheck` clean. Reviewer agent has run on every signing or key route; its blocking findings were fixed in each PR.
