# GraphPay front end (demo)

Two phone apps side by side on one website: the **customer app** (left) and the **merchant app** (right), fully interactive on **mock data**. The design source is [`Context/`](./Context): `DESIGN_INSTRUCTIONS.md` first, then `DESIGN_CUSTOMER_APP.md` and `DESIGN_MERCHANT_APP.md`. These design files win over every other document.

This folder is self-contained. It is not part of the repository's pnpm workspace, it calls no backend, chain or RPC, and it reads no `.env` file.

## Run it

Needs Node 22.12 or newer.

```powershell
cd frontend
npm install
npm run dev        # http://localhost:5180
npm run build      # typecheck + production build
npm test           # the seven journeys against the mock adapter (Vitest, fake timers)
```

Dev extras: `?debug` logs every mock event to the console, and in dev the mock adapter is available as `window.__demo`.

## How the mock engine works

- **One store for both phones.** `MockAdapter` (`src/demo/mock-adapter.ts`) holds the in-memory state. Both apps read it through `DemoProvider` and the same snapshot, so an action in one phone appears live in the other.
- **Events drive state.** `src/demo/state.ts` folds `DemoEvent`s into the snapshot. A status changes when its event arrives, never when a button is pressed. A test checks that replaying the events gives exactly the store's state, so a live adapter can replace the mock.
- **Scripted journeys** with delays from `src/demo/timing.ts` (agents think 1–3 s, settlement 2–4 s). Reset bumps an epoch, so steps still pending are dropped.
- **Shared rules** in `src/demo/rules.ts`: refundable maximum, refund eligibility, pass state (the worst state wins), renewal schedules and next charge dates in the city time zone.
- **Behaviour copied from the real system (Appendix D):**
  - The ENS gate refuses a paused or revoked agent before any quote.
  - A payment over the cap is refused (`cap`).
  - The trap shop is rejected for its refund rate.
  - A closed shop is not considered and takes no quote. Closing it with a quote open withdraws the quote.
  - A quote expiring before payment re-quotes silently.
  - A renewal due while the shop is closed is skipped and retried when it opens.
  - An agent can never raise its own cap.
  - The customer pays no gas.
- **Every explorer link is mock** (`mock: true`). Its hash is generated, and the UI must say so.
- **Story note:** the sample pass is 6.00 a day with 2.00 already used, so after the first 4.00 order the pass is used up. A second order or a reorder is refused for the cap until the cap is raised in C7. This makes journey 5 natural, but it is worth knowing during a demo.

## Structure

| path | what |
|---|---|
| `src/demo/contract.ts` | the `DemoAdapter` interface, events and data types (Appendix A plus proposed mock-only additions) |
| `src/demo/mock-data.ts` | the synthetic starting data the mock store resets to |
| `src/demo/links.ts` | mock explorer links (marked `mock: true`) |
| `src/data/story.json` | all story values: names, ENS names, shops, products, prices, prompts (Appendix B) |
| `src/data/story.ts` | typed access to the story |
| `src/copy.ts` | every caption, hint and funny line (several per situation) |
| `src/lib/` | money (integer-cent arithmetic, amount validation) and time (city time zone) helpers |
| `src/styles/index.css` | design tokens (Tailwind v4 `@theme`) |
| `src/components/shared/` | building blocks used by both apps |
| `src/components/stage/` | the dark stage and the phone frames |
| `src/apps/customer/`, `src/apps/merchant/` | the two apps' pages |

## Dependencies and why

| package | why |
|---|---|
| `react`, `react-dom` 19 | UI |
| `vite` 8, `@vitejs/plugin-react` | dev server and build (DESIGN_INSTRUCTIONS.md 2.2) |
| `typescript` 5.9 | types; 5.9 rather than 7.x, which is a new major the Vite/React tooling has not settled on |
| `tailwindcss` 4, `@tailwindcss/vite` | styling through design tokens |
| `lucide-react` | icons (ISC licence) |
| `motion` | layout and enter/exit animation (the successor of `framer-motion`) |
| `clsx` | conditional class names |
| `@fontsource-variable/baloo-2`, `@fontsource-variable/nunito` | self-hosted fonts (see below) |

Versions were checked on npm on 6 Nov 2026.

## Fonts

- **Headings and big numbers: Baloo 2** (variable, SIL OFL, via Fontsource). The slide-4 look uses it. It is rounded and friendly without looking childish, it reads well at 16–26 px, and it includes Devanagari for Mumbai content later.
- **Body: Nunito** (variable, SIL OFL, via Fontsource), instead of slide 4's Mukta. Nunito's rounded terminals match Baloo 2, so the pair feels like one family. It stays readable at 12–14 px on a small screen, has tabular figures (`tnum`) for money, and is not one of the overused product defaults (Inter, DM Sans). Mukta is narrower and has no tabular figures, which the brief asks for.
- **iOS system pieces** (keyboard, sheets, switches): `-apple-system, SF Pro, system-ui`, as section 4.1 asks.
- Sources: the Typewolf 2026 Google Fonts list, the FontAlternatives fintech guide (tabular figures are essential for money), and Refactoring UI and Practical Typography on pairing (one or two families, related shapes).
- Fallback: `system-ui`.

## Tokens, spacing and type

- **Colours:** the default Tailwind palette is removed, so components can only use the meaning tokens (`bg`, `surface`, `phone`, `ink`, `muted`, `line`, `soft`, `brand`, `info`, `ok`, `warn`, `bad`), the stage tokens (`stage*`), the iOS tokens (`ios-*`) and the agent ring colours (`agent-*`).
- **Spacing:** a 4 px base. Padding, margin and gap use only `1 2 3 4 6 8 12` (4, 8, 12, 16, 24, 32, 48 px). Screen margin and card padding are `4` (16 px). Tailwind's numeric sizes stay on so widths and heights (for example `h-11` = 44 px tap target) still work.
- **Type scale** (phone; at most four on one screen):

| token | size | use |
|---|---|---|
| `text-title` | 20 px / 1.2 | app title |
| `text-section` | 16 px / 1.3 | section title |
| `text-body` | 14 px / 1.45 | body |
| `text-caption` | 12 px / 1.4 | captions, chips |
| `text-amount` | 26 px / 1.15 | big amounts |

- **Shape:** cards `rounded-card` (16 px), inputs `rounded-input` (12 px), chips and buttons `rounded-full`, phone `rounded-phone` (55 px).
- **Money:** always `USDT` with two decimals and the `tabular` utility.

## Assumptions

- **Folder and stack:** `frontend/` with Vite, not `apps/demo-ui` with Next.js as `FRONTEND_HANDOVER.md` says. The design files win (DESIGN_INSTRUCTIONS.md 2.1, 3).
- **Scope:** no "under the hood" panel, race mode, graph view or full demo bar. Only two phones and a thin strip with the Mock badge, **Run next renewal now** and **Reset demo**.
- **Story data:** an own `src/data/story.json` in the Appendix B shape, not the repository's `packages/config/story.json`, which uses a different shape and a different test cast.
- **Package manager:** npm with its own `package-lock.json`, because this folder is outside the pnpm workspace and pnpm is not installed on the build machine.
- **Mascot:** an animated SVG fox redrawn from `Context/mascot/mascot-01.jpg`, with the five Rive artboards (Wave, Smile, Blink, Idle, Squint) as motion presets. Building the Rive `.riv` needs a Rive account and is watermarked on the free plan.
- **Composer placeholder:** "yap here, I'll make it a transaction" (mascot guide 3a), with "Ask your agents" as the visible label. C1's "Ask your agents…" placeholder is replaced.
- **Agent avatars:** the agent's initial on its ring colour, until artwork is supplied (section 15).
- **Quote expiry:** a quote that expires on screen re-quotes silently (C3). `quote_expired` stays in the contract but is never shown as a failure.
- **Spending pass:** one pass per paying agent. The desk subtitle shows the paying agent's pass (`spendingPass.payingRole`).
- **Reset demo** starts the shop Closed. The stage strip shows a hint to open the shop first.
- **Seed data:** the customer starts with no orders or renewals, so the empty states come first. The merchant has one synthetic daily renewal from another customer over the three previous days, so Renewals and Payouts are not empty.

## Proposed additions (mock only; not a backend request)

All are marked `PROPOSED (mock only)` in `src/demo/contract.ts`.

- `setCap(ens, cap)`: the customer changes an agent's cap herself (C7).
- `markOrderSeen(orderId)`: clears the merchant's "New" marker.
- `Refund.note`: the shop's decline note, so the customer can read it.
- `Link.mock`: marks a mock explorer link, so it is never shown as real.
- `RefusalReason` `shop_closed`; `payment.refused` with `agent`, `attempted`, `renewalId`.
- Events `shop.status` (the shared open flag), `agent.cap.changed`, `shops.compared` (shop choices for C2) and `demo.reset`.
- `startRenewal(orderId, schedule)` keeps its string signature; the mock encodes the schedule as JSON in it.

## Milestones

- [x] **F0** Foundations: project, tokens, fonts, story data, copy, contract, mock seed data, README
- [x] **F1** Mock engine: shared store, event bus, scripted journeys, reset (`npm test`: 22 journey tests)
- [x] **F2** Stage: dark stage, two iPhone frames, strip, narrow-width switch
- [ ] **F3** Shared components 1: header and coin hamburger, page strip, chips, sheets, states, dev state switcher
- [ ] **F4** Shared components 2: iOS keyboard, AmountEntry, StatusTracker, AgentAvatar, sounds, SVG fox
- [ ] **F5** Customer journey 1: desk, shop cards, quote and receipt
- [ ] **F6** Merchant journey 1: Shop Home, order detail
- [ ] **F7** Refund: orders, refund wizard, refund requests
- [ ] **F8** Renewals: customer and merchant
- [ ] **F9** Agents and spending pass
- [ ] **F10** Payouts and export, reorder, empty states
- [ ] **F11** Polish and QA
