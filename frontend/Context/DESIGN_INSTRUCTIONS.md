# GraphPay front-end: design instructions

This is the shared file. Read it first, then the file for the app you are building:

- **`DESIGN_CUSTOMER_APP.md`**: the customer app (left phone), page by page.
- **`DESIGN_MERCHANT_APP.md`**: the merchant app (right phone), page by page.
- **More files will be supplied separately** (section 15): the mascot, agent avatars, memes and icons, where each goes and how to make them.

**You are working in the same repository these files were written for**, though it may be a slightly different version, and you do not have the chat these files came from. The reference files mentioned here (the draft presentation, the front-end build guide, the handover and the planning documents) may sit in a different folder from the one named; look for them by name. The appendices at the end of each file also copy the key values from them, so they are a handy fallback if you cannot find a file.

**There are no hard rules in these three files.** Everything is a default or a recommendation written by the owner to get a consistent result. Use judgement: where a default does not fit your repository or a real constraint, do the sensible thing and note it in `frontend/README.md` under "Assumptions". Section 17 lists what is still open.

Each app file contains **instructions for that app only**. Things used by both apps (header, menu, keyboard, trackers, amount entry, avatars, sounds, colours, type) are defined once, here, and the app files only say where they use them.

## 1. Scope and goal

- **Goal now: a complete, interactive baseline.** Both phones fully working end to end on **mock data only**, every button doing something, and the customer-to-merchant flow complete (section 13). More design changes will follow, so build pages so they are easy to change; completeness matters more than polish.
- Build **two phone apps side by side on one website**: the **customer app on the left** and the **merchant app on the right**.
- **Left out for now:** any "under the hood" or backend-flow panel, race mode, a full demo bar, and any presentation slides. Only the two phones and the stage that holds them.
- The stage may have a thin top strip with the two app names, the Mock badge and, because some steps have no button inside the phones, two small demo controls: **Run next renewal now** and **Reset demo**. Nothing else.
- The backend is built by someone else. Nothing here asks for a backend change. Where a design needs something a backend contract does not have, it exists **only in the frontend mock** and is noted on the page.

## 2. Working defaults

1. **Keep your changes in one new front-end directory** (default name `frontend/` at the repo root, a self-contained project with its own `package.json`) and leave existing code as it is. If your repository needs a different place, use it and note it.
2. **Stack:** React with Vite and TypeScript, and Tailwind CSS. Add other libraries when a design needs them (for example `lucide-react` for icons, `framer-motion` for motion, `clsx`). Keep dependencies few and list each in `frontend/README.md` with the reason.
3. **Keep secrets out.** Avoid reading `.env*` files or putting keys, tokens or private URLs in the code. The baseline does not call any backend, chain or RPC.
4. **Data comes through one adapter.** Define a small `DemoAdapter` interface (Appendix A) and a **mock adapter** with scripted data. Every button calls the adapter. A live adapter will be swapped in later by someone else.
5. **Nothing story-specific inside components.** Names, ENS names, shops, products, prices, quick prompts and images come from one story data file (sample in Appendix B; if your repository already has a story config such as `packages/config/story.json`, read that instead). Placeholder names like Priya and Kesar Kingdom must be replaceable without touching components.
6. **Mock data is labelled** with a "Mock" badge, and nothing is presented as a real measurement. Say "tallies", not "rollups".
7. **Wording:** identify (ENS), remember (Arkiv), pay (Whitechain). Say "decentralized, secure and verifiable", not "hidden". Say receipts "cannot be edited", not "permanent". Revoked is final for an agent; paused can be resumed.
8. **Testnets only.** Any chain label shown is a testnet (Whitechain Sepolia, Ethereum Sepolia, Arkiv Rabdi); show no mainnet branding.
9. **Notes go in one place:** `frontend/README.md` (dependencies, fonts chosen and why, spacing scale, assumptions, anything added beyond the brief).
10. In the three design files, you may tick the progress checkboxes and fill the "Added beyond the brief" lists in the two app files. Leave the rest of them as they are.

## 3. Where to look when the design is uncertain

In this order:

1. **These design files.** They are the authority. If they conflict with any other document, **follow these files**. Example: a reference wireframe may show the new-order pop-up as its own screen; our design puts it inside the Shop Home log. Other documents fill gaps only.
2. **The appendices.** Appendix A (event and adapter contract), B (sample story data), C (look reference), and each app file's own appendix (reference wireframe values for its pages) are copies of what the owner's other documents contain.
3. **Reference files** (look for them by name if they are not at the path shown). `docs/GraphPay draft presentation (1).html` (open slide 4, "Two desks, two teams": the intended look of the two phones), `docs/GraphPay_ front-end build guide.html` (tab "Screens": a wireframe, calls, events and states for every screen), and `docs/FRONTEND_HANDOVER.md` (the full spec). Appendices A to C and the app appendices copy the key values from them.
4. **If still unclear,** choose the simplest option that matches the look in Appendix C, build it, and note the assumption in `frontend/README.md`. There is no need to stop and ask.

## 4. Stage and theme

### 4.1 Overall stage (the page around the apps): dark

- Full-viewport dark background so the light phones stand out with strong contrast. Use a deep blue-black, for example `#0B1017` to `#121922`, optionally with a very subtle radial glow behind each phone. No busy patterns.
- Two phone frames centred side by side, the customer on the left and the merchant on the right, with a clear gap. A small caption by each: "Customer app" and "Merchant app".
- **Both phones are simulated iPhones** (modern style): **390 × 844 logical px**, rounded corners (about 55 px), a thin dark bezel, a soft shadow, a **Dynamic Island** at the top, an iOS **status bar** (time, signal, Wi-Fi, battery) and a **home indicator** at the bottom. The frame scales down as one piece to fit the viewport height (CSS scale transform, same aspect ratio), so the page does not scroll on desktop.
- **iOS look for system pieces:** anything that is an operating-system control looks like iOS, not like a web page: the on-screen keyboard, action sheets, alerts and confirmation sheets, switches, segmented controls and pickers. Use the iOS system font stack (`-apple-system`, `SF Pro`, `system-ui`) for these. The app's own content keeps the chosen brand fonts (4.3).
- Desktop is 1440 px wide or more. At narrower widths, show **one phone at a time** with a two-option switch (Customer, Merchant) at the top. Each phone also works on its own at a real phone width.
- Stage text (captions, switch, badge) is light on dark.

### 4.2 Inside both apps: light theme only

- Both phones are light, even if the browser prefers dark.
- Define these as Tailwind theme tokens or CSS variables once, and use tokens in components instead of raw hex values.

| token | value | meaning and use |
|---|---|---|
| `bg` | `#EEF1EF` | app background |
| `surface` | `#FBFCFB` | cards, sheets |
| `phone` | `#FFFFFF` | phone screen base |
| `ink` | `#18212B` | primary text |
| `muted` | `#56606B` | secondary text |
| `line` | `#D3DAD6` | borders, dividers |
| `soft` | `#E3E8E5` | chips, input fills |
| `brand` | `#5B4FD6` | the one accent of both apps: primary buttons, selection, the hamburger coins (an indigo no status uses) |
| `info` | `#2F5BEA` | information, links, explorer links, quotes, money back, focus ring |
| `ok` | `#0B8A6C` | done, paid, active, money in, success |
| `warn` | `#B87400` | waiting, in progress, paused, time running out |
| `bad` | `#C0275D` | refused, failed, revoked, error, danger |

- **Colours carry meaning and are used the same way everywhere.** One colour stands for one idea across the whole app: green means done, amber means waiting or paused, pink-red means refused or failed, blue means information, grey (`muted`, `soft`) means not yet reached or inactive, and `brand` marks the primary action, selection and the app's identity. Avoid using a status colour for decoration, and avoid two colours for the same idea.
- Both apps share the one `brand` accent, which is deliberately different from every status colour, so a primary button never reads as "success" or "waiting".
- **When a colour or style is not specified,** choose it from these tokens by meaning. Add a new token (with its meaning) only if the idea is genuinely new.
- **Agent colours:** each agent has a fixed ring and dot colour (Appendix C), reused wherever that agent appears. These are the only per-agent colours.
- Keep contrast at WCAG AA or better (text 4.5:1). The slide-4 look (Appendix C) is warm and rounded; take its feel, but the token meanings above win.

### 4.2a Same app family

The two apps look like **one family, not two different apps**. They share the same header, hamburger menu and coin icon, cards, chips, buttons, inputs, switches, sheets, keyboard, trackers, spacing, fonts, motion and iOS look, and the same `brand` accent. They differ only in content. Build each visual piece once in `components/shared/` rather than writing a second copy for the other app.

### 4.3 Typography, spacing, shape, motion

- **Fonts are not decided. Research them, then record the choice.** Search the web for fonts that suit a friendly consumer payments app: easy to read on a small screen, not harsh or "tech-template" looking, not the overused AI-product defaults. Prefer well-made open-licence families (Google Fonts, Fontsource, Fontshare), and read what type designers and professional design sites (Material Design, Apple's Human Interface Guidelines, Refactoring UI, Practical Typography) say about pairing and legibility. Pick one family for headings and one for body (or one for both), with legible tabular numbers for money. Slide 4 uses Baloo 2 (headings, numbers) and Mukta (body); treat that as a starting point. Write the choice, where you found it and why in `frontend/README.md`. Self-host through Fontsource, with `system-ui` as the fallback.
- **Spacing and hierarchy follow professional principles** (research Material Design, Apple HIG, Refactoring UI, Laws of UX): one spacing scale on a 4 px base (4, 8, 12, 16, 24, 32, 48) as Tailwind tokens, and nothing off the scale; group related things closer than unrelated things; a 16 px screen margin and 16 px card padding; line height about 1.4 to 1.5 for body and 1.2 for headings; a clear size and weight hierarchy using the scale below (at most four of its sizes on any one screen); short line lengths; one left edge; generous whitespace between sections. Record the scale and the text styles in `frontend/README.md`.
- Type scale (phone): app title 20 px, section title 16 px, body 14 px, caption and chips 12 px, big amounts 26 px. These five sizes are the whole scale. Minimum tap target 44 × 44 px.
- Cards: radius 16 px, 1 px `line` border, very light shadow. Chips and buttons: fully rounded. Inputs: radius 12 px.
- Money: always `USDT`, two decimals everywhere including examples (`4.00 USDT`, `50.00 USDT`), tabular numerals. Where a deadline is shown, show the city's time zone label.
- Motion: short (150–250 ms), ease-out. Slide-in for the merchant's new-order row, a gentle pulse for "thinking", a smooth countdown. Respect `prefers-reduced-motion` everywhere (cross-fade or a static state instead of movement).

## 5. Shared building blocks (defined once, used by both apps)

Build these in `frontend/src/components/shared/`. The app files say where each is used and add nothing to how it looks.

- **PhoneFrame** (stage), **StatusBar**, **AppHeader** (with the coin hamburger and the page menu, section 5a).
- **AgentAvatar** (picture, ring colour, state animation, name and ENS tooltip, section 5d), **AgentTag**, **Mascot**, **Meme**.
- **StatusChip** (thinking, checked, quoted, paid, refused, idle, and the order and pass states Active, Paused, Revoked, Used up, Expired).
- **StatusTracker** (section 5b), **MoneyAmount**, **Countdown** (running, low, expired), **ExplorerLink** (small chip, opens in a new tab), **ReceiptCard**.
- **IosKeyboard** (section 5c), **IosActionSheet**, **IosPicker**, **BottomSheet / confirmation sheet** (every destructive or money action asks to confirm), **AmountEntry** (section 5e).
- **SoundProvider** (section 5f), **Toast / InlineBanner**, **EmptyState**, **ErrorState with Retry**, **Skeleton**, **MockBadge**.

### 5a. Header and hamburger menu (both apps, every page)

- **Header:** a hamburger icon at the **top left**, the page title next to it, the Mock badge at the top right, and the shared mute control (a small speaker icon). One `AppHeader` component; only the title and the page list change per app.
- **Hamburger icon:** three horizontal lines stacked like a hamburger, **each line is an Ethereum coin** (a flat coin-shaped pill with the Ethereum diamond), drawn as an inline SVG in `brand` and `ink`. 44 × 44 px tap target. On open, the three coins animate (a short spin and slide) into a close icon; on close they return.
- **Menu:** tapping the icon opens a **horizontal strip of page cards** under the header. The strip scrolls and swipes sideways, the current page is highlighted, and it closes on selecting a page, tapping outside, or the close icon. Pages **slide horizontally** when you move between them (a later page slides in from the right, an earlier one from the left; cross-fade under reduced motion).
- A dot on the hamburger icon, plus a toast, tells the user when something arrives for a page they are not looking at.
- Each app file lists its own pages for the strip.

### 5b. StatusTracker (order and refund progress, both apps)

- A row of circles joined by arrows, one circle per step. A step **not yet reached** is grayed out (muted outline circle, muted label, muted arrow).
- A **completed** step has a **hand-drawn, sketchy look with a green check mark** (`ok`): a slightly wobbly circle outline and a check drawn as if with a pen, as an inline SVG with a rough stroke. The check animates by drawing itself (stroke-dashoffset) the first time the step completes. The arrow after a completed step is also `ok`.
- The **current** step, if in progress, gently pulses in `warn`.
- A declined or failed step shows a `bad` marker and the tracker stops there.
- It takes an ordered list of steps, each `done`, `current` or `todo`, and holds no business logic.

### 5c. IosKeyboard (both apps)

- Both phones simulate an iPhone on a laptop, so **focusing a text or amount field opens a simulated iPhone keyboard** that slides up from the bottom of the phone. The page area shrinks above it and keeps the active field in view.
- **Text layout:** the iOS portrait keyboard: light grey translucent background, rounded white letter keys in QWERTY, a shift key, a delete key, a **123** key (numbers and symbols page), an emoji key, a wide space bar, and a return key. The return key's label and colour are set by the page (a blue **send** arrow on the chat, **Done** elsewhere); it is disabled when the page says the field is not valid yet. Uses the iOS system font stack and sits above the home indicator.
- **Numeric layout (amounts):** the iOS number pad: digits 0 to 9, one decimal point, a delete key and a **Done** key. Only digits and one decimal point are accepted, up to two decimals.
- **Behaves like on an iPhone:** pressing a key shows the **key-pop bubble** above the letter and **highlights the key**; shift turns on for the first letter of a sentence and double-tap on shift locks caps; delete repeats when held; the space bar and return key highlight on press. Mouse clicks type into the field.
- **The laptop keyboard also works:** pressing a physical key highlights the matching on-screen key and types the character; Enter acts as the return key.
- The keyboard hides on its return or Done key, on tapping outside the field, and when the page moves to its next step.
- On a real phone width on a touch device, do not draw the simulated keyboard; let the device's own keyboard open.
- Build it as one controlled component with the key maps kept in data, so layouts can change.

### 5d. AgentAvatar (both apps)

- Every agent has its **own profile picture**, the same everywhere it appears, with a ring in its fixed colour (Appendix C). The **name** sits above a message or on a card, and **hovering the name or avatar shows the full ENS name** and whether the agent is active (a tap does the same on touch). Names and ENS names come from the story data, never from components.
- **The roster is not final.** What is decided is only that there is **one main agent and other agents it manages**. Appendix B lists an example roster (concierge, scout, analyst, payer; shop side storefront, risk, dispatch) to show the design. Render whatever agents the data returns, and take which of them can spend from the data.
- Pictures come from the separately supplied asset files (section 15); until then use a placeholder (the agent's initial on its ring colour) behind this component, so a real image swaps in with one change.
- **States** (driven by status): **idle** still; **thinking or checking** a gentle bounce and a small rotating ring; **paid or success** a short happy pop; **rejected or refused** a **crying** animation (tears, drooping expression); **disappointed** a flat unimpressed face used for the "Come on bro" moments; **paused** a sleepy face; **revoked** greyed with a cross; **approving** a thumbs-up or nod; **declining** a head-shake or raised hand; **welcoming or shrugging** for empty states. Under reduced motion, use a static pose.

### 5e. AmountEntry (both apps)

One component for entering a money amount, used by the customer's refund wizard and cap change and by the merchant's partial refund.

- A field that opens the numeric `IosKeyboard`. **Enter or Done confirms** the amount, which is then shown as a line ("Amount 1.00 USDT") with an **Edit** button that reopens the field.
- **Validation:** an amount that is zero, negative, not a number, or above the allowed maximum is not accepted. The field shows a `bad` border and a one-line message, and the "Come on bro" moment appears: a small meme-style card with an agent in the disappointed pose, a short cheeky line ("Come on bro, you only paid 4.00 USDT.") and the allowed maximum in plain words. Confirmation stays blocked until the amount is valid. The maximum is given by the page.
- A **Full / Partial** mode is a separate, simple segmented control on the page: Full fills the maximum and locks the field (read-only); Partial shows the field.

### 5f. Sound (both apps)

- All sounds are **synthesised with the Web Audio API** (no audio files), each behind a small named function so a recorded file can replace it later: `playWee()` (a quick rising-then-falling glide, about 0.5 s, when a customer message flies), `playCashRegister()` (a short bell and drawer burst when the shop opens), `playChime()` (when a new order arrives).
- **One mute control** for both apps, in the shared header. When muted, nothing plays. Sounds start only after a user gesture (the browser requires it), are quiet by default, and are skipped when it would be silent anyway.

## 6. States every page must design

Each page section lists its page-specific states. In addition, **every page** has:

1. **Loading** (skeletons, not spinners only)
2. **Empty** (a friendly message and the next action)
3. **Success**
4. **Refused with a reason** (where an action can be refused: the reason in words, and the recorded link)
5. **Error with Retry** (recoverable errors only)
6. **Mock badge** visible whenever the adapter is in mock mode

Build a **dev-only state switcher** (a floating panel or a URL query such as `?state=empty`) so each state of each page can be previewed without running a journey. It should not appear in a production build.

## 7. Accessibility and responsiveness

- Semantic HTML, labelled buttons named by what they do ("Request refund", not "Submit"), a visible focus ring (`info`), keyboard reachable.
- Colour is never the only signal: pair every status colour with a word or an icon.
- No truncation of money amounts or ENS names (truncate the middle of long hashes and addresses only, and offer copy).
- Check at 1440×900, 1920×1080 (projector) and 390×844 (a single phone).

## 8. How to work through the files

1. Scaffold the front-end project (Vite, React, TypeScript, Tailwind). Add the tokens (4.2), the contract and mock adapter (Appendices A and B) and the shared components (section 5).
2. Build the stage with the two empty phone frames and the narrow-width switch.
3. For each app, go page by page in the order of its file: layout first, then all states, then wire it to the mock adapter.
4. After each page, tick that page's checklist.
5. Where something is unclear, follow section 3, point 4.

## 9. Definition of done (per page)

- [ ] Matches the look in Appendix C for phone chrome, bubbles and cards.
- [ ] Every state in the app file, plus the shared states in section 6, can be previewed.
- [ ] Light theme inside the phone, dark stage outside.
- [ ] No story values inside components; all text comes from the story data, `copy.ts` or the adapter.
- [ ] Works at the three widths in section 7.
- [ ] Existing code elsewhere in the repository is unchanged.

## 10. Completeness: add what the reference wireframes have and the brief missed

The page section in the app file is the owner's brief. The appendix at the end of that file lists the reference wireframe for the same page (blocks, calls, events, states). If the wireframe has a block, field, button or state that the page section does not mention:

1. Build it in the same style as the rest of the page.
2. List it in the page's **"Added beyond the brief"** list so the owner can see and overrule it.

If the page section and the wireframe conflict, the page section wins.

## 11. Backend-ready code

The UI will be connected to a real backend later without redesign.

- Components never talk to the network or fake backend events. They render state and call `DemoAdapter` methods.
- Page state is derived from the adapter's snapshot plus its event stream (one reducer per page area), so mock and live adapters are interchangeable. A status changes when its **event arrives**, not when a button is pressed (use a pending state in between).
- Identity, copy and numbers come from the story data, `frontend/src/copy.ts` or the adapter. All captions and funny lines, placeholder or not, live in `copy.ts` (several per situation, picked at random).
- Types for events, orders, renewals and agents live in one `contract.ts` that follows Appendix A. Anything the frontend needs that Appendix A lacks (for example `setCap`, an optional decline `note`, `shopOpen`) is added **to the mock only**, marked as a proposed addition, and noted in `frontend/README.md`. It is never a request for a backend change.
- Sounds, avatar images and animations are replaceable assets behind small wrapper components or functions.

## 12. Events: what each page listens to

Each page's "Adapter" line lists the calls it makes and the events it listens to (their shapes are in Appendix A).

- A page subscribes only to its listed events, through the adapter, and updates live when they arrive, including while another page is open (keep the result, and show a dot or toast on the hamburger if it affects a page the user is not looking at).
- If a page needs another event, add it to its Adapter line and say why.
- The mock adapter emits every event listed for the pages it feeds, in a realistic order with realistic delays, so each state can be seen without a backend.

## 13. The complete baseline flow (mock data only)

Build one **mock adapter** holding an in-memory store **shared by both phones**, so an action in one app appears in the other, live, as the real events will. Take names and numbers from the story data (Appendix B) and the wireframe values in the app appendices. Anything a journey needs that they do not give (more orders, notes, dates), invent plausible values, mark them synthetic, and keep them in one `mock-data` file.

These journeys run end to end, in order of importance:

1. **Ask and pay:** the customer sends a prompt (or taps a chip) → agents think and report step by step → shop cards, with the rejected trap shop → the shop's risk agent checks the buyer back → quote sheet with a countdown → the payer signs and pays → receipt → **merchant chime and new-order row** → the merchant opens the order and taps **Dispatch** → the customer's order timeline moves to Dispatched. Delivered follows by itself a few seconds later (there is no Mark delivered button).
2. **Refund:** the customer requests a refund (full or partial, reason, photo) → it lands in the **merchant's refund requests** → the merchant approves the amount, approves another amount, or declines with a note → the customer sees Accepted then Refunded with a link, or Declined with the note → both apps' orders update.
3. **Renewal:** the customer makes an order a renewal and sets how often → it shows under Renewals → **Run next renewal now** charges it → the merchant sees the renewal order → the customer can cancel it.
4. **Pause agent:** pause the agent → it tries to order again → refused with a reason and link → resume.
5. **Cap refusal:** the demo button → refused with the message and link. The customer can also change a cap herself.
6. **Export:** the merchant exports the CSV; a real file downloads with a link per row.
7. **Reorder and empty states:** reorder an order; every list has its friendly or funny empty state.

Rules for the flow:
- The shop's open/closed state is **one shared flag** in the store. The mock adapter checks it before the agents consider a shop and before it creates a quote or an automatic charge.
- **Reset demo** returns the store to its starting data (including the empty states) so it can be rerun. The shop starts **Closed**: the merchant must open it (ka-ching) before the customer's ask-and-pay journey can complete.
- Delays between events are realistic (a few hundred milliseconds to a few seconds) and set in one place.
- If a page, state or journey step is missing from the page sections, work out what it should be from the appendices and the project documents you have, build it, and record it.

## 14. Read the backend architecture, if you have it, and build what it mentions

Go through the project's backend and architecture documents (for example `planning/SPEC/ARCHITECTURE.md`, `AGENTS.md`, `PAYMENTS_WHITECHAIN.md`, `IDENTITY_ENS.md`, `ARKIV_GRAPH.md`, `planning/WEBSITE_SPEC.md`, `planning/EVENT_ADDENDUM.md`, `docs/plan/`, `docs/decisions/`), and read them to understand what happens under the hood on each user action. If you cannot find them, Appendix D has the essentials.

- If they describe a behaviour, state, field, error, refusal reason or step that touches a page but the page section and wireframes do not mention it, **implement it in the frontend mock and design**, in the same style as the page (for example the ENS gate refusing a paused agent before any quote, an expired quote, refusal reasons, a shop's reputation figures, the 15-minute quote validity, "gas paid by GraphPay").
- Mock it only. Keep each such behaviour small and isolated in the mock adapter and the page's own state, so it can be adjusted when the real backend is settled. List it under the page's **"Added beyond the brief"**.
- These design files still win on any conflict.

## 15. Separate asset files, and placeholders

More design files will be supplied separately. They will say:
- exactly **which meme goes where**, and its caption;
- what the **mascot** looks like, and how the agent avatars and icons look;
- **how to make** them, where that is described.

Rules:
1. When an asset file exists for something, follow it. Put images in `frontend/src/assets/` and reference them only through the small wrapper components (`Mascot`, `AgentAvatar`, `Meme`, icon components), so swapping an asset changes nothing else.
2. **Where a page asks for a meme, a funny line, a mascot, an avatar or an icon but does not say exactly what to show, add placeholder content of your own** (a simple placeholder image or coloured shape with the agent's initial, and a short placeholder caption). Do not stop and do not flag it as missing; it will be replaced later. Keep captions in `frontend/src/copy.ts` and placeholder images in `frontend/src/assets/placeholders/`.
3. If a document you have does describe the thing, use that instead of inventing.

## 16. Shared vocabulary (use the same words in both apps)

- **Order status steps:** Ordered → Paid → Dispatched → Delivered. The customer sees all four. A merchant's order only exists once paid, so the merchant tracker shows Paid → Dispatched → Delivered, and the merchant log chips are **Paid** (a new order arrives as Paid with a "New" marker that disappears once it is opened), Dispatched, Delivered, Refunded.
- **Refund status steps, in both apps:** Requested → Accepted → Refunded (or Declined).
- **Item line format, everywhere:** `<item name> × <quantity>`, for example "Gulab jamun × 6". A unit ("box of 6") belongs to the item name when there is one, never a second multiplier.
- **Buyer names:** the buyer **agent's** ENS name (for example `payer.priya.graphpay.eth`) is shown wherever an order or payment is shown (merchant log, order detail, refund requests, payout log). The **owner's** name (`priya.graphpay.eth`) is shown wherever the person is meant (the merchant's Renewals and Customers page, and the "owner" line on an order). Both come from the data.
- **Explorer link labels:** say which chain: "View transaction on Whitechain" for payments and refunds, "View on Ethereum Sepolia" for ENS actions (pause, revoke, a refused cap change). Shorten to "View transaction" only where the chain is obvious from the text beside it.
- **Closed shop:** one shared open/closed flag in the mock store, read by both phones. While it is closed the shop takes no orders and customers' agents do not consider it; skipped renewal charges retry when it opens. Each app file describes its own side.

## 17. What is still open

These are not blockers. Build with the stated default and note it in `frontend/README.md`.

- The final **agent roster** (one main agent plus the agents it manages). Default: the example roster in Appendix B.
- The final **fonts** (section 4.3) and the **mascot, memes and avatar pictures** (section 15).
- The **real backend**: how it will answer is not final, so the frontend's mock-only additions will be reconciled later.
- **A repository check on story names.** The repository has a hygiene check (`pnpm check`) that rejects story names (shop names, the customer's name) written inside code under `apps/`, `packages/` and `scripts/`, which is another reason to keep them in one story data file. If your repository has a similar check, keep story values in that one file and in `copy.ts`.

---

# Appendices (copies, so you do not need the owner's other documents)

## Appendix A. Event and adapter contract (the shape of the mock)

Follow these shapes in `contract.ts` and the mock adapter. They are a **proposal from the owner's handover**, not a promise from a backend; names may change later.

```ts
type Money    = { amount: string; currency: "USDT" };   // decimal string, e.g. "4.00"
type AgentRef = { ens: string; role: string; owner: string };
type ShopRef  = { ens: string; name: string };
type Link     = { label: string; url: string };           // explorer links (mock links are marked as mock)

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
  | { type: "merchant.notification"; kind: "new_order" | "refund_request" | "renewal"; orderId: string }
  | { type: "error"; message: string; recoverable: boolean };

interface DemoAdapter {
  mode: "mock" | "live";
  getSnapshot(): Promise<DemoSnapshot>;                   // orders, renewals, agents, balances at load
  subscribe(listener: (e: DemoEvent) => void): () => void; // live event stream
  // customer
  sendPrompt(text: string): Promise<void>;
  reorder(orderId: string): Promise<void>;
  requestRefund(orderId: string, input: { amount: Money; reason: string; photo?: File }): Promise<void>;
  startRenewal(orderId: string, schedule: string): Promise<void>;
  cancelRenewal(renewalId: string): Promise<void>;
  pauseAgent(ens: string): Promise<void>;
  resumeAgent(ens: string): Promise<void>;
  revokeAgent(ens: string): Promise<void>;
  tryRaiseCap(ens: string, newCap: Money): Promise<void>; // demo: always refused for the agent
  // merchant
  setShopOpen(open: boolean): Promise<void>;
  dispatch(orderId: string): Promise<void>;
  approveRefund(orderId: string, amount: Money): Promise<void>;
  declineRefund(orderId: string, note: string): Promise<void>;
  exportCsv(range: { from: string; to: string }): Promise<Blob>;
  // demo controls (stage only)
  runNextRenewal(): Promise<void>;
  resetDemo(): Promise<void>;
}
```

`Order`, `Renewal` and `DemoSnapshot` are plain data types you define with the fields the screens need (an order has an id, shop, items, total, status step, optional refund with its own status and note, links, buyer agent and owner; a renewal has an id, item, shop, schedule in words, next date, amount, status, paying agent).

**Mock-only additions** (not in the contract above, marked as proposed): `setCap(ens, cap)` so the customer can change a cap herself; an optional `note` on a refund so a decline note reaches the customer; `shopOpen` as a shared flag. Mock adapter rules: scripted, deterministic journeys with realistic delays (an agent thinking 1–3 s, settlement 2–4 s), links marked as mock.

**What the live system does under the hood**, in one paragraph, so the mock behaves believably: a prompt goes to the main agent, which hands work to helper agents (one finds shops and prices, one asks a money graph for each shop's reputation, one pays). Code ranks and guards; the model only proposes. The payer gets a quote from the shop (valid 15 minutes), the shop's risk agent checks the buyer's ENS name and standing, the payer signs once with no gas, GraphPay's facilitator checks that the agent is active in ENS and within its cap, then settles on Whitechain and records an edge in the money graph. Pausing or revoking an agent writes its ENS status, and the gate refuses it before any quote. A change to an agent's own cap is refused; only its owner can change it.

## Appendix B. Sample story data (copy this into the front-end project as `story.json`)

Placeholder names that will change. Values are synthetic sample data. Keep everything story-specific here and in `copy.ts`, never in components.

```json
{
  "city": { "name": "Mumbai", "timeZone": "Asia/Kolkata", "currency": "USDT" },
  "customer": { "name": "Priya", "ens": "priya.graphpay.eth" },
  "agents": [
    { "role": "concierge", "label": "Concierge", "ens": "concierge.priya.graphpay.eth", "pays": false, "capUsdt": "0.00" },
    { "role": "scout",     "label": "Scout",     "ens": "scout.priya.graphpay.eth",     "pays": true,  "capUsdt": "1.00" },
    { "role": "analyst",   "label": "Analyst",   "ens": "analyst.priya.graphpay.eth",   "pays": false, "capUsdt": "0.00" },
    { "role": "payer",     "label": "Payer",     "ens": "payer.priya.graphpay.eth",     "pays": true,  "capUsdt": "6.00" }
  ],
  "shop": { "name": "Kesar Kingdom", "ens": "kesar-kingdom.graphpay.eth", "area": "Dadar",
            "agents": [ { "role": "storefront", "label": "Storefront" }, { "role": "risk", "label": "Risk" }, { "role": "dispatch", "label": "Dispatch" } ] },
  "shops": [
    { "name": "Kesar Kingdom",  "storyRole": "good",      "priceUsdt": "4.00", "distanceKm": 1.2, "paidOrders": 1204, "refundRate": "1%",  "open": true },
    { "name": "Syrup Street",   "storyRole": "runner-up", "priceUsdt": "4.20", "distanceKm": 1.4, "paidOrders": 1204, "refundRate": "3%",  "open": true },
    { "name": "Jamun Junction", "storyRole": "trap",      "priceUsdt": "3.20", "distanceKm": 0.9, "paidOrders": 2190, "refundRate": "18%", "open": true, "rejectedBecause": "18% of orders refunded" }
  ],
  "products": [ { "id": "gulab-jamun-6", "shop": "Kesar Kingdom", "name": "Gulab jamun", "unit": "box of 6", "priceUsdt": "4.00" },
                { "id": "kaju-katli-250", "shop": "Kesar Kingdom", "name": "Kaju katli 250 g", "priceUsdt": "6.00" } ],
  "quickPrompts": [ "Best gulab jamun under 6 USDT by 8 pm", "Re-order my usual" ],
  "spendingPass": { "capUsdt": "6.00", "period": "day", "usedTodayUsdt": "2.00" },
  "renewal": { "item": "Gulab jamun × 6", "schedule": "every Sunday", "amountUsdt": "4.00" },
  "buyerReputation": { "orders": 42, "refunds": 0, "since": "2025", "riskVerdict": "safe to accept" },
  "otherCustomer": { "ens": "vikram.graphpay.eth", "schedule": "Daily" },
  "explorers": { "whitechain": "https://explorer.testnet.whitechain.io", "ens": "https://sepolia.app.ens.domains" }
}
```

## Appendix C. Look reference (the "slide 4" look)

The intended look of the two phones comes from slide 4 of the owner's presentation ("Two desks, two teams"). If you do not have that file, use this description. It is a feel to copy, not a pixel spec.

- Two phone frames side by side, rounded, with a dynamic island and a status bar. The presentation draws them dark; **ours are light inside** (section 4.2).
- **Chat:** an agent message is a row with a **round avatar on the left** and, to its right, the agent's **name above** a rounded bubble (square top-left corner, rounded elsewhere). The customer's own message is **right-aligned** in the accent colour (square bottom-right corner). A compose bar sits at the bottom with a text box and a send control.
- **Result cards** inside the thread: a rounded card with a thin coloured edge, a large amount (headline type), small grey key lines, and links in blue underlined text. Two small action buttons in a row at the bottom of a card: one filled (primary), one soft.
- **Agent colours** (rings and dots): concierge `#F2A43A`, scout `#9B7BFF`, analyst `#EF6F8E`, payer `#4FD1C5`; shop side storefront `#F6AD55`, risk `#E86A6A`, dispatch `#7FB0FF`.
- Warm, friendly, rounded: generous padding, soft shadows, short entrance animations (a message pops up with a small rise).
- Fonts used there: Baloo 2 for headings and numbers, Mukta for body. Treat as a starting point (section 4.3).

## Appendix D. If you do not have the backend documents

Use Appendix A's under-the-hood paragraph. In addition, make these behaviours believable in the mock, because the real system does them:
- A paused or revoked agent is refused before any quote, with a reason and an Ethereum Sepolia link.
- A quote is valid for 15 minutes and re-quotes by itself when it expires.
- A payment is refused when it would exceed the agent's cap, when the shop is rejected for a high refund rate, when the budget is exceeded, or when the shop is closed.
- The customer pays **no gas**: "Gas paid by GraphPay, you paid 0".
- A shop's reputation shows paid orders, a refund rate and on-time rate, and these come from the money graph.
- Receipts and records "cannot be edited".
