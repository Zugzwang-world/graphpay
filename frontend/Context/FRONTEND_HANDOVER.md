# GraphPay demo website — front-end handover

**For:** the UI team. **Repo:** `github.com/Zugzwang-world/graphpay`. **Your folder:** `apps/demo-ui` (a new Next.js app you create). Claude Code is building its own version in `apps/web` at the same time; leave that folder alone. We compare both and combine the best later.
**Visual guide:** the interactive build guide that accompanies this file (wireframes, journeys, contract).
**Written:** Fri 6 Nov 2026, during the hackathon. Everything you build is new work made at the event.

---

## 1. What we are building

One public website (hosted on Vercel) that judges can **use themselves**. It is not a video and not a slideshow.

Three parts sit side by side on a desktop screen:

```
┌──────────────────────────── Demo bar: guided steps · Reset · Mock/Live badge ────────────────────────────┐
│ ┌──────────────┐   ┌──────────────────────────────────────┐   ┌──────────────┐                           │
│ │  CUSTOMER    │   │        UNDER THE HOOD (explainer)     │   │  MERCHANT    │                           │
│ │  phone app   │   │  live timeline of what really happens │   │  phone app   │                           │
│ │  (chat desk, │   │  ENS · Arkiv reads · x402 · Whitechain│   │  (orders,    │                           │
│ │  orders,     │   │  tx links · race mode · graph view    │   │  refunds,    │                           │
│ │  refunds,    │   │                                       │   │  payouts)    │                           │
│ │  agents)     │   │                                       │   │              │                           │
│ └──────────────┘   └──────────────────────────────────────┘   └──────────────┘                           │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

On a phone, show one app at a time with a switch: Customer, Merchant, Under the hood.

- **Customer app:** the customer (placeholder name: Priya) talks to her AI agent team in a chat desk. The agents find a shop, check it, and pay in USDT. She can see orders, request a refund (with a photo), set up a renewal, and pause or revoke an agent.
- **Merchant app:** the shop (placeholder: Kesar Kingdom) gets orders with a sound, sees who is buying (the buyer agent's ENS name and reputation), dispatches, refunds fully or partly, sees renewals, and exports a CSV for the accountant.
- **Under the hood:** every real step shows up live with a link to its explorer page: the ENS lookup, the Arkiv reads, the payment request, the signature, the Whitechain transaction, the Arkiv record.

**Every button must work.** Today it works against a **mock adapter** with scripted data. Later the backend team swaps in the **live adapter**, and the same buttons trigger real agents and real transactions. You never call the backend directly.

## 2. Rules (please read)

1. **One contract.** The UI talks only to the `DemoAdapter` interface (section 7). No `fetch` calls to backend routes from components. This is what lets us switch from mock to live in one line.
2. **Nothing story-specific in code.** Names, ENS names, shops, products, prices, quick prompts and images come from `story.json` (section 8). The story will change on Friday morning; your UI must not.
3. **Own designs only.** You may borrow *patterns* from familiar apps (an Amazon-style order timeline, a refund wizard), but copy no code, assets or screens from Amazon, Stripe, Privy or anyone else.
4. **Honest states.** In mock mode show a small "Mock data" badge. Never show a fake transaction link as if it were real.
5. **No secrets in the browser.** No keys, no `NEXT_PUBLIC_` secrets. Spending actions sit behind the demo passcode (the backend enforces it).
6. **Event rules.** Each team member must be on our team in the ETHGlobal dashboard and commit from their own GitHub account. If you use AI tools, your prompts are logged (the repo does this automatically in Claude Code); that is part of our AI disclosure.
7. **Small pull requests.** One screen or one journey per PR. CI must pass. Don't edit files outside `apps/demo-ui` unless asked.

## 3. Layout and design direction

- **Canvas:** desktop 1440 px wide or more. Two phone frames (390 × 844 logical, scaled to fit the viewport height) and a middle panel about 520 px wide. Demo bar across the top.
- **Phone frames:** generic rounded rectangles drawn in CSS. No real device images or brand frames.
- **Tone:** clean consumer commerce, Mumbai flavour (food photography, warm but not cliché). High contrast, large touch targets, readable at a distance on a projector.
- **Status colours** (keep consistent across all three panels):
  - paid / settled → green
  - pending / thinking → amber
  - refused / declined → red
  - refunded → blue
  - mock → grey badge
- **Motion:** only where it explains something: a new order sliding in with a chime, a step lighting up in the explainer, a counter in race mode. Respect reduced-motion settings.
- **Accessibility:** keyboard focus visible, buttons named by what they do ("Request refund", not "Submit"), colour never the only signal.

## 4. Customer app screens

| # | Screen | What it shows | Actions (adapter calls) | Reacts to events |
|---|---|---|---|---|
| C1 | **Agent desk** (home, chat-style) | Header with the customer and her agents' status; quick-prompt chips; chat thread with messages from each agent (concierge, scout, analyst, payer), each tagged with its ENS name and a status chip; result cards appear inside the thread | `sendPrompt` | `agent.message`, `agent.status`, `graph.read`, `quote.created`, `payment.*` |
| C2 | **Shop choice card** (inside C1) | 2–3 shops with price, distance, and reputation from the graph (paid orders, refund rate, repeat buyers); the trap shop shown as rejected with the reason | none (display) | `agent.status` (reason), `graph.read` |
| C3 | **Quote and receipt card** (inside C1) | Line items, total in USDT, payee ENS name, a 15-minute validity countdown; then a "Paid" receipt with the explorer link and "Gas paid by GraphPay, you paid 0" | none (the agent pays within the spending pass) | `quote.created`, `payment.signed`, `payment.settled`, `payment.refused` |
| C4 | **Orders** (list and detail) | Amazon-style list; detail with a status timeline (Ordered, Paid, Dispatched, Delivered, Refunded), receipt links | `reorder`, `startRenewal`, open refund wizard | `order.updated`, `refund.*` |
| C5 | **Refund wizard** | Full or partial amount, reason, optional photo, then a status view (Requested, Accepted, Refunded) | `requestRefund` | `refund.requested`, `refund.settled` |
| C6 | **Renewals** | Active renewals: item, schedule, next date, amount, cap usage | `cancelRenewal` | `renewal.*` |
| C7 | **Agents and spending pass** | Each agent: ENS name, role, status (Active, Paused, Revoked), what it may do; the spending pass (cap, used, remaining, expiry); buttons Pause, Resume, Revoke; demo button "Let the agent try to raise its own cap" | `pauseAgent`, `resumeAgent`, `revokeAgent`, `tryRaiseCap` | `agent.permission`, `cap.change.refused`, `payment.refused` |

## 5. Merchant app screens

| # | Screen | What it shows | Actions | Reacts to events |
|---|---|---|---|---|
| M1 | **Shop home** | "Open shop" toggle (also turns on sound), today's sales, live order feed | `setShopOpen` | `merchant.notification`, `order.updated` |
| M2 | **New order pop-up** | Slides in with a chime: buyer agent's ENS name, owner, reputation summary (orders, refunds, account age), the shop's risk agent verdict, items, amount, payment link | `dispatch` | `merchant.notification` (new_order), `payment.settled` |
| M3 | **Order detail** | Timeline, payment and refund links, buttons Dispatch, Refund full, Refund partial | `dispatch`, `approveRefund` | `order.updated`, `refund.settled` |
| M4 | **Refund requests** | Inbox: reason, photo, amount asked; Approve full, Approve partial (amount stepper), Decline with a note | `approveRefund`, `declineRefund` | `refund.requested` |
| M5 | **Renewals and customers** | Customers with active renewals, next charge, history | none | `renewal.*` |
| M6 | **Payouts and export** | Received, refunded, net, each with links; Export CSV for a date range | `exportCsv` | `payment.settled`, `refund.settled` |
| M7 | **Shop desk** (optional) | Chat with the shop's own agents ("Why did you flag this buyer?") | `sendMerchantPrompt` | `agent.message` |

## 6. Under the hood panel and demo bar

- **Live timeline (U1):** one row per event, newest at the bottom, each with an icon for its system (ENS, Arkiv, Whitechain, agent) and a link to its explorer page when there is one. Grouped by journey.
- **Race mode (U2):** the same question answered two ways: "Plain Arkiv: 48 reads" against "GraphPay: 2 reads", with the same answer shown. Show **reads needed**, not "slow vs fast".
- **Graph view (U3, Friday):** dots for people, shops and agents, lines for payments; a new line appears after each payment.
- **Mumbai map (U4, Friday, optional):** shops as dots by area.
- **Demo bar (D1):** guided steps (Ask and pay, Refund, Renewal, Pause agent, Cap refusal, Race, Export), "Run next renewal now", Reset demo, Mock/Live badge, passcode entry.

## 7. The contract: `DemoAdapter`

The single interface between the UI and everything else. Put it in `apps/demo-ui/src/demo/contract.ts`. The backend team implements the live version; you build against the mock. Changes to this file go through a PR that both sides approve.

```ts
type Money = { amount: string; currency: "USDT" };          // amount as a decimal string, e.g. "4.00"
type AgentRef = { ens: string; role: string; owner: string };
type ShopRef  = { ens: string; name: string };
type Link     = { label: string; url: string };              // explorer links come from the backend

type DemoEvent =
  | { type: "agent.message"; agent: AgentRef; text: string; at: number }
  | { type: "agent.status"; agent: AgentRef; status: "thinking" | "checked" | "quoted" | "paid" | "refused" | "idle"; reason?: string }
  | { type: "graph.read"; question: string; reads: number; ms: number; links: Link[] }
  | { type: "ens.resolved"; name: string; address: string; links: Link[] }
  | { type: "quote.created"; orderId: string; shop: ShopRef; items: { name: string; qty: number; price: Money }[]; total: Money; validUntil: number }
  | { type: "payment.signed"; orderId: string }
  | { type: "payment.settled"; orderId: string; total: Money; links: Link[] }
  | { type: "payment.refused"; orderId?: string; reason: "cap" | "paused" | "revoked" | "trap_shop" | "budget" | "quote_expired"; links: Link[] }
  | { type: "order.updated"; order: Order }
  | { type: "refund.requested"; orderId: string; amount: Money; reason: string; photoUrl?: string }
  | { type: "refund.settled"; orderId: string; amount: Money; links: Link[] }
  | { type: "renewal.created" | "renewal.charged" | "renewal.cancelled"; renewal: Renewal; links: Link[] }
  | { type: "agent.permission"; agent: AgentRef; change: "paused" | "resumed" | "revoked"; links: Link[] }
  | { type: "cap.change.refused"; agent: AgentRef; attempted: Money; links: Link[] }
  | { type: "arkiv.write"; kind: "payment" | "refund" | "quote" | "renewal"; links: Link[] }
  | { type: "race.result"; question: string; plain: { reads: number }; graph: { reads: number }; sameAnswer: boolean }
  | { type: "merchant.notification"; kind: "new_order" | "refund_request" | "renewal"; orderId: string }
  | { type: "error"; message: string; recoverable: boolean };

interface DemoAdapter {
  mode: "mock" | "live";
  getSnapshot(): Promise<DemoSnapshot>;                       // orders, renewals, agents, balances at load
  subscribe(listener: (e: DemoEvent) => void): () => void;    // live stream of events
  // customer
  sendPrompt(text: string): Promise<void>;
  reorder(orderId: string): Promise<void>;
  requestRefund(orderId: string, input: { amount: Money; reason: string; photo?: File }): Promise<void>;
  startRenewal(orderId: string, schedule: string): Promise<void>;
  cancelRenewal(renewalId: string): Promise<void>;
  pauseAgent(ens: string): Promise<void>;
  resumeAgent(ens: string): Promise<void>;
  revokeAgent(ens: string): Promise<void>;
  tryRaiseCap(ens: string, newCap: Money): Promise<void>;     // demo: always refused for the agent
  // merchant
  setShopOpen(open: boolean): Promise<void>;
  dispatch(orderId: string): Promise<void>;
  approveRefund(orderId: string, amount: Money): Promise<void>;
  declineRefund(orderId: string, note: string): Promise<void>;
  exportCsv(range: { from: string; to: string }): Promise<Blob>;
  sendMerchantPrompt?(text: string): Promise<void>;
  // demo
  runRace(question: string): Promise<void>;
  runNextRenewal(): Promise<void>;
  resetDemo(): Promise<void>;
}
```

`Order`, `Renewal` and `DemoSnapshot` are plain data types; define them in the same file with the fields the screens need. Names are a proposal; the backend team may rename in the contract PR.

**Mock adapter rules:** scripted, deterministic journeys with realistic delays (agent thinking 1–3 s, settlement 2–4 s), driven by `story.json`, links marked as mock. Every journey in section 9 must run end to end on the mock.

## 8. `story.json` (display data only)

```json
{
  "customer": { "name": "Priya", "ens": "priya.graphpay.eth", "avatar": "/story/priya.png" },
  "agents": [
    { "role": "concierge", "ens": "concierge.priya.graphpay.eth" },
    { "role": "scout",     "ens": "scout.priya.graphpay.eth" },
    { "role": "analyst",   "ens": "analyst.priya.graphpay.eth" },
    { "role": "payer",     "ens": "payer.priya.graphpay.eth" }
  ],
  "shops": [
    { "name": "Kesar Kingdom", "ens": "kesar-kingdom.graphpay.eth", "area": "Dadar", "image": "/story/kesar.jpg" }
  ],
  "products": [
    { "id": "gulab-jamun-6", "shop": "kesar-kingdom.graphpay.eth", "name": "Gulab jamun, box of 6", "price": "4.00", "image": "/story/gj.jpg" }
  ],
  "quickPrompts": [ "Best gulab jamun under 6 USDT by 8 pm" ],
  "spendingPass": { "cap": "6.00", "period": "day" },
  "explorers": { "whitechain": "https://explorer.testnet.whitechain.io", "arkiv": "https://rabdi.explorer.arkiv.network", "ens": "https://sepolia.app.ens.domains" }
}
```

All values above are **placeholders**. The final story arrives Friday morning; only this file changes.

## 9. Journeys (what must work end to end)

1. **Ask and pay:** Priya taps a quick prompt → agents plan, ask GraphPay (2 reads), reject the trap shop, pick a shop → the shop's risk agent checks her back → quote card with countdown → payment signed and settled (no gas for her) → merchant chime and pop-up → Dispatch → her order timeline updates.
2. **Refund:** Orders → order → Request refund (partial, reason, photo) → merchant's refund inbox → Approve partial → refund settles → both apps update; the shop's refund count moves in the explainer.
3. **Renewal:** order → "Make it a renewal" → schedule → Demo bar "Run next renewal now" → renewal charged → merchant sees it → Priya can cancel.
4. **Pause agent (kill switch):** Agents → Pause payer → the agent tries to order again → refused with reason, recorded link → Resume.
5. **Cap refusal:** Agents → "Let the agent try to raise its own cap" → refused: "Only Priya can change this cap", with the link.
6. **Race:** Demo bar → Race → 48 reads against 2, same answer.
7. **Export:** Merchant → Payouts → Export CSV → file downloads with explorer links per row.

## 10. Build plan (Friday)

| Phase | What | Time | Done when |
|---|---|---|---|
| 1 Setup | GitHub access; create the Next.js app in `apps/demo-ui`; copy this file in as `apps/demo-ui/HANDOVER.md`; read the guide; agree tokens | 30 min | App runs locally; tokens file exists |
| 2 Shell | Demo bar, two phone frames, explainer panel, phone-width switch; `contract.ts`, mock adapter skeleton, `story.json` loader | 1 h | Empty shell renders; mock events print in the explainer |
| 3 Customer app | C1–C7 against the mock | 2–2.5 h | Journeys 1, 4, 5 run on the mock |
| 4 Merchant app | M1–M6 (M7 optional) | 2 h | Journeys 2, 3, 7 run on the mock |
| 5 Under the hood | Timeline, race widget, explorer links; graph view if time | 1 h | Journey 6 runs; every row has the right icon and link slot |
| 6 Test | Playwright: click through all seven journeys on the mock | 45 min | Test passes in CI |
| 7 Go live | Backend team plugs in the live adapter; joint run on real networks | 1–2 h | Same seven journeys pass live |
| 8 Polish | Motion, sound, empty and error states, projector check | rest of the time | Feature freeze at 18:00 |

## 11. Working with Claude (or any AI coding tool)

**How to work**
- Use Claude Code inside the repo, in your own session and branch, working only in `apps/demo-ui`. Point it at this file, `contract.ts` and `story.json` at the start of each session.
- **One screen or one journey per request.** Ask for presentational components plus a hook that reads from the adapter. Never let it invent backend calls.
- **Ask for every state:** loading, empty, success, refused with reason, error with retry, mock badge.
- **Close the loop visually:** run the app, take a screenshot (or let Claude use the browser tools), and ask for specific fixes ("the receipt card wraps at 390 px; keep the total on one line").
- **Keep PRs small** and let CI run. If Claude proposes changing `contract.ts`, stop and agree it with the backend team first.

**Example requests** (adapt freely)
- "Read apps/demo-ui/HANDOVER.md, apps/demo-ui/src/demo/contract.ts and story.json. Build the demo shell: demo bar, two phone frames and the explainer panel, responsive down to a phone with a three-way switch. Use the mock adapter only."
- "Build screen C1, the agent desk. Messages come from adapter events agent.message and agent.status. Each message shows the agent's ENS name and a status chip. Include loading, refused and error states."
- "Build the refund wizard C5 and the merchant refund inbox M4, wired to requestRefund and approveRefund on the mock adapter, then make journey 2 run end to end."
- "Write a Playwright test that runs all seven journeys on the mock adapter and fails if any button does nothing."

**Review checklist for every PR**
- No names, prices or addresses typed into components; all from `story.json` or events.
- No direct network calls; only the adapter.
- Every button does something visible on the mock.
- Works at 390 px and on the projector layout.
- Keyboard focus visible; buttons say what they do.
- Mock badge visible in mock mode.

## 12. Handoff to the backend

- Claude Code is building its own website and backend in parallel (`apps/web`). After both are ready, we compare, keep the best of each, and connect your UI to the live backend through the adapter.
- The live adapter (real agents, ENS, Arkiv, Whitechain events) is implemented against `contract.ts` during that merge; agree any contract changes with the founder.
- Switching is one setting (`NEXT_PUBLIC_DEMO_MODE=mock|live`, a mode flag, not a secret).
- Questions about data or events: ask the founder; he routes them to the right session.
