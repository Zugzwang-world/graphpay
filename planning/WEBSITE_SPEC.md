# WEBSITE SPEC (the founder's design)

One website on Vercel shows GraphPay working, live: Vitalik's phone on the left, Kesar Kingdom's phone on the right, and a live explainer in the middle that animates every step. Race mode puts plain Arkiv and Graph Arkiv side by side. **The website doubles as the demo video.** It was not built in the lab; every data source behind it was (`SPEC/*`).

## 1. Rules

1. **Every on-chain action opens its explorer page** (a link on the row, and a "view on explorer" chip that opens in a new tab).
2. **Nothing is simulated.** Every number, event and receipt comes from a live call or a live chain. Development may use fakes with the exact response shapes; the shipped site has no fake path.
3. **Spending is behind the passcode.** Every route that makes the relayer, the merchant or an owner sign is server-side and needs `X-Demo-Passcode`. The passcode is typed once per browser session (kept in memory or `sessionStorage`), never in a URL.
4. **Labels:** a persistent "synthetic demo data" chip on the shop history and the city; the token chip says **USDT** only for the real test USDT and **"stand-in (not USDT)"** otherwise; model text is shown as speech, never as a figure (prices, receipts and rankings come from tool data).
5. **Pseudonymous, not private:** "known by name, not by data". No personal data collected; no analytics that identify a viewer.
6. Plain words, sentence case, no hype words (deck tone rules).

## 2. Layout

| viewport | layout |
|---|---|
| desktop (≥ 1200 px) | three columns on one stage: **customer phone** (left, about 390 × 844), **explainer** (middle, flexible), **merchant phone** (right, about 390 × 844). A top bar with live chips: Whitechain block, Sepolia block, Rabdi block, mirror lag, relayer balance, token mode, the passcode lock, a sound toggle, and a link to race mode |
| tablet (768–1199 px) | the two phones side by side, the explainer below |
| phone (< 768 px) | each screen opens on its own: `/customer`, `/merchant`, `/explain`, `/race`; the home page offers the three |

Routes: `/` (the stage), `/customer`, `/merchant`, `/explain`, `/explain/:explainId` (one answer's reads), `/order/:orderId` (an order's trail from Arkiv), `/race`, `/how` (how it's built, with the architecture and the checkout-kit lines).

## 3. Customer screen (Vitalik)

**Header:** avatar, `vitalik.graphpay.eth`, the payer agent's status chip (`active` / `paused` from ENS), and today's spend against the daily cap (`spentToday` / `dailyCapMicro` from the AgentPolicy).

**Prompt box:** prefilled *"Just landed in Mumbai. Get me the best gulab jamun near me under 6 USDT by 8 pm."* Send runs the agents. Under the box, the mandate **as code read it** (budget 6.00, deadline 20:00 IST); a red note if the model's reading disagreed.

**Live feed of the agents** (streamed run-log events, `SPEC/AGENTS.md` §9), each row with the speaking agent's tiffin-bot avatar and ENS name:
- messages between agents (`concierge.vitalik.graphpay.eth` → `scout.vitalik.graphpay.eth`), shown as speech;
- tool calls with their cost: "graphql · 2 Arkiv calls · explain ab12cd…" (tap → `/explain/:id`), "catalog_read × 3 (parallel)", "ens_check payer.vitalik.graphpay.eth: active";
- guard events: green ticks, and **red vetoes** ("jamun-junction.graphpay.eth excluded: refund rate 18.4% over 10%");
- the shop side's risk decision as it arrives.

**Result card:** the chosen shop (`kesar-kingdom.graphpay.eth`), 12 gulab jamun, **4.80** (from the quote tool), ETA, the ranking of all three shops with score and reasons (jamun-junction struck through with its reason), the receipt chip (Whitechain tx → explorer), "you paid no gas" (the payer's WBT before and after), and the mandate hash.

**Buttons** (all passcode-gated, each shows its transaction and explorer link when it lands):

| button | what happens | chain |
|---|---|---|
| Request refund | sends a refund request for the last order (default 0.80, reason "2 squashed") to the merchant. Recommended: a `request` edge on Arkiv written by the recorder route from W_SYNC (gasless, on-chain, moves no tally). Alternative: the payer's `openDispute` on the contract (proven in Foundry only; costs the payer a little gas; counts as a dispute) | Arkiv (or Whitechain) |
| Re-order | the payer agent re-orders 3 more for 1.20 from the same shop (`kind = REORDER`, parent = the last order) | Whitechain |
| Sunday sweets box | subscribe (0.40 a box, weekly; or the labelled **2-minute demo period** so a renewal happens on stage) or cancel. Subscribing signs the `Subscribe` terms and a Permit2 `PermitSingle`; cancelling signs `Cancel` (gasless). Shows the next charge time and each renewal as it lands | Whitechain |
| Pause my agent | the owner sets `graphpay.status=paused` on `payer.vitalik.graphpay.eth` (the ENS kill switch's soft form). A countdown runs from the Sepolia receipt through the gate cache (20 s); the next payment attempt is refused `ENS_PAUSED`, shown in the feed and on the merchant screen. The button turns into **Resume** | Ethereum Sepolia |

An "advanced" drawer has **Kill a disposable agent**: provisions `disposable-<n>.vitalik.graphpay.eth` if needed, pays 0.40 with it, unregisters it, and shows the next payment refused `ENS_EXPIRED_OR_REVOKED` (one-shot per label).

## 4. Merchant screen (Kesar Kingdom)

**"Open shop" tap:** a full-screen button; tapping it enables sound (browsers need a user gesture for Web Audio) and starts listening for the shop's events.

**Order pop-up** (when the mirror writes a `pay` edge for this shop): a "cha-ching" sound, the buyer agent's ENS name (`payer.vitalik.graphpay.eth`) and its **reputation** (`ask(buyer_risk)`: status, orders, cancellations, disputes, spend today against its cap, principal `vitalik.graphpay.eth` verified), the item, quantity and amount, the settlement tx (explorer link), the Arkiv write (tx link), and the shop's risk agent's decision with reasons.

**Buttons** (passcode-gated; merchant key server-side, `DECISIONS.md` E-3):

| button | what happens | chain |
|---|---|---|
| Mark dispatched | `markDelivered(orderId)`; the `deliver` edge appears and on-time ticks | Whitechain |
| Partial refund | amount input (default 0.80); `refund(orderId, amount, reason)`; pre-checks the merchant's balance and approved float | Whitechain |
| Full refund | refunds what is left; order shows REFUNDED | Whitechain |
| Download accountant export | a CSV built from GraphQL: date (UTC and IST), order id, kind (one-off, re-order, renewal), buyer ENS, payer ENS, item, amount, refunds, net, token (USDT or stand-in), tx hash, explorer link, Arkiv entity key | read only |

Also on the screen: today's tallies and the 90-day reputation with its source badge (`TALLY` or `RAW_VERIFIED`) and explain link; open refund requests; subscribers to the Sunday box with next charge and renewals; a "paused / refused" toast when a paused or killed buyer is refused.

## 5. The middle explainer

A stepper that animates each live step of the current run, driven by real events; it can replay the last run. Each step shows its real data and a link.

| step | what it shows | data |
|---|---|---|
| 1. The agents think | the buyer team's pulses between ENS names; scout and analyst in parallel; the analyst's one GraphQL call (2 Arkiv calls); red vetoes | agent run events |
| 2. x402: the 402 | the decoded `PAYMENT-REQUIRED`: scheme `graphpay-order`, network `eip155:1874`, asset, amount 4,800,000, payTo, order terms | shop response |
| 2b. The signature | the Permit2 witness fields being signed (order id, merchant, amount, deadline, mandate hash) and the gasless approval; "signed, no gas" | payer tool output |
| 2c. The settlement | facilitator checks (signature, ENS gate, prediction), `settleOrder` sent by the relayer, gas used, the relayer paid | facilitator response, receipt |
| 3. The contract event | `PaymentSettled` with its arguments, block and explorer link | receipt logs |
| 4. The Arkiv write | records becoming dots and lines: the `pay` edge appears between the two ENS nodes, the tally counters tick (orders +1, paid +4.80), the pair link thickens, the checkpoint moves; Arkiv tx link, gas | mirror `/status` and writes |
| 5. The GraphQL answer | the query, the answer, and its **exact reads** from the explain trace: each Arkiv call with its query text, rows, ms and bytes; the entity keys behind the answer highlighted in the graph | `extensions.arkiv`, `/api/explain/:id` |

The graph view (Sigma 3 + graphology, versions to verify) shows the neighbourhood of kesar-kingdom from `neighborhood(ens, depth: 2)`; the synthetic city is visibly labelled.

## 6. Race mode

Plain Arkiv against Graph Arkiv, side by side, **live and uncached**.
- Pick a question (default **Q2 top 10 shops by sales**; also Q1 and Q5) and a city size (S, and M if seeded). The city's size and "synthetic data" are always on screen.
- Press start: both sides run against Rabdi at once. Each side shows a running timer, an Arkiv read counter that ticks per call, bytes moved, and the answer when done.
- Plain side: a fan-out selector (one page at a time, 8 in flight, every page at once), so plain gets its best shot.
- Correctness badges: Graph Arkiv "correct"; plain "right by name, wrong by identity" when it credits the re-registered shop's previous holder.
- Under the race, the committed benchmark table from the event (`SPEC/BENCHMARK.md` §7) with its date. **Live numbers only**; never the lab's.
- One race at a time, globally rate-limited (Arkiv quota is 5,000 calls per 10 s per key; a plain M race costs 48). Reads cost no money, so no passcode, but a rate limit.

## 7. Server routes (interfaces)

| method, path | gate | request → response |
|---|---|---|
| `POST /api/agents/run` | passcode | `{ request }` → `{ runId }`; one errand at a time (busy → 409) |
| `GET /api/agents/run/:id/events` | — | SSE of `TraceEvent` and a final `result` (`SPEC/AGENTS.md` §9) |
| `GET /api/state/customer` | — | `{ agent: { ens, status, epoch }, capMicro, spentTodayMicro, lastOrder, subscription }` |
| `POST /api/customer/reorder` | passcode | `{ parentOrderId, qty }` → `{ orderId, transaction }` |
| `POST /api/customer/refund-request` | passcode | `{ orderId, amountMicro, reason }` → `{ arkivTx }` (calls the recorder route `/api/recorder/requests`) |
| `POST /api/customer/subscribe`, `/unsubscribe` | passcode | `{ plan: 'sunday-box', period: 'weekly' | 'demo-2min' }` → `{ subId, transaction }`; `{ subId }` → `{ transaction }` |
| `POST /api/customer/pause`, `/resume` | passcode | `{}` → `{ sepoliaTx, effectiveWithinS: 20 }` |
| `POST /api/customer/kill-disposable` | passcode | `{}` → `{ label, txs[] }` |
| `GET /api/merchant/events` | — | SSE of the shop's new edges (order, pay, refund, deliver, fail, request, subscribe, renew), polled from GraphQL every 2–3 s |
| `POST /api/merchant/dispatch`, `/refund` | passcode | `{ orderId }`, `{ orderId, amountMicro, full? }` → `{ transaction }` |
| `GET /api/merchant/export.csv` | — | the CSV of §4 |
| `GET /api/race` | rate limit | `?question=Q2&size=S&mode=plain|graph&inFlight=1|8|all` → SSE of `{ call, ms, bytes }` then `{ answer, correct, truthBasis }` |
| `GET` / `POST /api/graphql`, `GET /api/explain/:id` | — | `SPEC/ARKIV_GRAPH.md` §5 |
| `GET /api/status` | — | `{ heads: { whitechain, sepolia, rabdi }, mirrorLagBlocks, relayerWbt, token: 'usdt' | 'standin', checkout }` |
| existing | | `/api/shop/*`, `/api/facilitator/*` (`SPEC/PAYMENTS_WHITECHAIN.md` §8), `/api/recorder/*` (`SPEC/INTEGRATION_AND_MIRROR.md` §2); the mirror itself is the one workers process on the founder's Mac, not a route |

## 8. Live data and links

- Agent events over SSE (the Node runtime streams; Vercel's default function timeout is 300 s; the lab's errand used about 66k tokens and 13 tool calls).
- The workers process mirrors each settle within about 10–15 s (2 s polling, 2 confirmations, a 5–8 s Rabdi write); the UI polls GraphQL (GET, `s-maxage=5`) for tallies and edges and shows the mirror's lag from its heartbeat row.
- Explorer links: Whitechain `https://explorer.testnet.whitechain.io/tx/<hash>` and `/address/<addr>`; Sepolia `https://sepolia.etherscan.io/tx/<hash>`; Arkiv `https://rabdi.explorer.arkiv.network` (**verify its transaction and entity URL patterns at 9 pm**; the indexer API has `/api/transaction/<hash>` and `/api/entity/<key>`).
- Every chip that shows a number links to where it came from (explorer, explain trace, or the CSV).

## 9. Visual system (from the deck brief)

| token | value | use |
|---|---|---|
| Night | `#17143D` | background |
| Surface | `#221E55` | panels, phone frames |
| Varq | `#DADCE8` | text and outlines (muted text at 60%) |
| Kesar | `#F5A524` | payments, primary accent |
| Gulab | `#EC5B86` | buyer team |
| Pista | `#4CC38A` | shop team, "settled" |
| Chilli | `#FF5D4D` | refunds, red flags, revoked, paused |

- Type: Baloo 2 (700, 800) for display; Mukta (400, 600) for text; `font-variant-numeric: tabular-nums` on every number; monospace only for GraphQL and hashes. Sentence case; left-aligned; no all-caps labels; no middle-dot strings.
- Motion grammar: a Kesar coin along an edge = a payment; a Chilli particle backwards = a refund; a silver dashed pulse = a query; an expanding ring on a node = a record written to Arkiv; a node greying out with its name struck through = paused or revoked; a 2 px bob = idle. Moves 600–900 ms; staggers 40–80 ms; `prefers-reduced-motion` jumps to end states.
- Avatars: original "tiffin-bots" (stacked steel tiffin head, two dot eyes, antenna), ring Gulab (buyer) or Pista (shop), role badge (concierge sparkle, scout magnifier, analyst bars, payer coin, storefront awning, risk shield, dispatch box), ENS name tag underneath. Humans are a plain silhouette in a Varq circle.
- Sound (Web Audio, synthesised, no files; off until "Open shop"): cha-ching (settled), wah-wah (refund), soft blip (query), low "game over" (paused or revoked).
- Do not recreate sponsor logos; sponsor names as plain text.

## 10. Checkout kit and the demo store (Whitechain Operate)

**The kit** (`packages/checkout-kit`), interface only:
- server: `createGraphPayShop(config: { shopEns: string; merchant: Address; catalog: CatalogItem[]; facilitatorUrl: string; facilitatorToken: string; token: { address: Address; name: string; version: string }; passcode?: string }) → { catalog, quote, pay, reorder }` (route handlers for a Next.js app);
- client: `graphpayCheckout(opts: { shopUrl: string; item: string; qty: number; wallet: WalletClient }) → Promise<Receipt>` and a button component `GraphPayButton({ shopUrl, item, qty, onPaid })` that connects a browser wallet on chain 1874, signs the witness and the gasless approval, and shows the receipt with its explorer link.

**The demo store** (`apps/store`, Vercel project `graphpay-store`): kesar-kingdom's sweets with a customer view (buy, re-order, the Sunday box subscribe and cancel) and a merchant view (orders from Graph Arkiv, dispatch, partial and full refunds, subscriptions, the accountant export). It integrates the kit in **about 20 lines** (import, configure, mount the routes, place the button), shown on screen on its "How it's built" panel and in the README.

## 11. Video (2–4 minutes; record from the website)

| time | shot | proves |
|---|---|---|
| 0:00–0:20 | the stage; one line: "Your next customer is an agent. Ask before you pay." | the pitch |
| 0:20–1:10 | Vitalik's request; the team fans out; the analyst's one GraphQL call (2 reads); jamun-junction vetoed in red; kesar-kingdom chosen | agents, guards in code, Graph Arkiv |
| 1:10–1:45 | the 402, the signature, the settlement; "you paid no gas"; explorer page opens | x402 on Whitechain, our facilitator |
| 1:45–2:10 | the merchant's phone rings; the buyer's ENS name and reputation; mark dispatched | ENS identity, merchant view |
| 2:10–2:35 | the Arkiv write as dots and lines; the GraphQL answer with its exact reads | Arkiv as the memory |
| 2:35–3:00 | refund request → partial refund; re-order; Sunday box renewal (demo period) | refunds, renewals |
| 3:00–3:25 | pause my agent → refused within 20 s of the Sepolia receipt; resume | the ENS kill switch |
| 3:25–3:50 | race mode at the largest seeded city: 2 calls against 48 | the benchmark |
| 3:50–4:00 | the demo store's 20 lines; links | drop-in checkout |

## 12. Performance and accessibility

Server-render the shell; stream events; no layout shift when events arrive; every control reachable by keyboard with visible focus; colour is never the only signal (vetoes also carry a cross and text); captions for sounds; works with sound off.

## 13. Done when

- [ ] The stage renders at desktop, tablet and phone widths; each screen opens on its own on a phone.
- [ ] A full customer run (request → paid) on the real chain, with every step's explorer link working.
- [ ] Refund request → partial refund; full refund; re-order; subscribe (demo period) → a renewal lands → cancel.
- [ ] Pause → refused `ENS_PAUSED` within 20 s of its Sepolia receipt (25 s with RPC lag) → resume → paid again (within the daily cap).
- [ ] The merchant pop-up shows the buyer's ENS name and reputation with sound after "Open shop".
- [ ] The explainer shows the five steps with real data and the exact reads.
- [ ] Race mode runs live at S (and M if seeded) with ticking counters.
- [ ] The accountant export downloads and matches the chain.
- [ ] Every spending route returns 401 without the passcode.
- [ ] The token chip and every receipt say "stand-in (not USDT)" unless the real test USDT is used.
