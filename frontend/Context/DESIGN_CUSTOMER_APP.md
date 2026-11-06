# Customer app: page-by-page design

This file is for the **customer app only** (the left phone). The merchant app has its own file. Everything shared by both apps (header and hamburger, keyboard, status tracker, avatars, amount entry, sounds, colours, type, states, the mock flow, sample data) is defined once in **`DESIGN_INSTRUCTIONS.md`**; read that first. This file says only where the customer app uses those pieces and what each customer page contains.

**There are no hard rules in this file;** everything is a default from the owner (see `DESIGN_INSTRUCTIONS.md`).

- The customer app is the **left phone**. Light theme inside the phone; the stage behind it is dark.
- If something is uncertain, use `DESIGN_INSTRUCTIONS.md` section 3, then this file's appendix (the reference wireframe values for each page).
- The customer's name (Priya in the sample data) comes from the story data and will change. Do not put it in components.
- Accent: the shared `brand` colour. Navigation: the hamburger menu on every page. There is no bottom tab bar.

Each page section has: **Purpose**, **Content** (the owner's brief), **States to design**, **Adapter** (calls and events) and **Open questions**, plus **Added beyond the brief** where something was filled in from the reference wireframes.

---

## Header and hamburger menu (customer pages)

The header and the coin hamburger are the shared component in `DESIGN_INSTRUCTIONS.md` section 5a. On the customer app the page title is the customer's name on the desk, and the page cards in the strip are, in this order:

1. **Orders** (C4)
2. **Refund Wizard** (C5)
3. **Renewals** (C6)
4. **Agents and Spending Pass** (C7, one page)

The agent desk (C1) is the home page, reached by the app title or a "Desk" card at the start of the strip. The Refund Wizard needs an order: opened from the menu with no order chosen, it first shows an order picker (paid orders that are not fully refunded), then the wizard.

---

## C1. Agent desk (home, chat-style)

**Purpose:** the customer's home. She talks to her agent team; agent replies and result cards appear inside the thread, step by step.

**Layout, top to bottom:**
1. **Header** (shared). Title: the customer's name from the story data, with the subtitle "Agents active, pass 6.00 USDT a day" (values from the adapter snapshot).
2. **Quick-prompt chips** from the story data's `quickPrompts` (for example "Best gulab jamun under 6 USDT by 8 pm", "Re-order my usual"). Tapping a chip sends it as if typed. Chips hide once the thread has messages, and return when it is cleared.
3. **Thread area** (scrolls). With no messages it shows the **mascot centred** in the area; what the mascot looks like and does comes from the separately supplied asset files (`DESIGN_INSTRUCTIONS.md` section 15); use a placeholder until then. Once the first message is sent, the mascot shrinks and docks at the top of the thread area (default; confirm in the mascot file).
4. **Composer** pinned at the bottom: a **text box** with a **Send button** right next to it (placeholder "Ask your agents…"). Enter sends. Send is disabled while the box is empty. The composer stays disabled with a "waiting" hint while an errand is running only if the adapter says so; otherwise the customer can keep typing.

**On-screen keyboard:** tapping the text box opens the shared iOS text keyboard (`DESIGN_INSTRUCTIONS.md` 5c) with a blue send arrow as its return key, disabled while the box is empty. On send, the keyboard hides automatically, the blob animation runs from the composer, and the full chat is shown. Tapping the thread area also hides the keyboard.

**Customer message and the blob animation:**
- When she sends, her message text **turns into a blob**, which **travels** from the composer to the spot where the message lands in the thread (the top of the visible thread, or the end of the thread if it is already full), then **unfolds into her message bubble** (right-aligned, `brand`).
- While the blob travels, `playWee()` plays (shared sound, `DESIGN_INSTRUCTIONS.md` 5f; silent when muted). With reduced motion there is no blob and no sound: the bubble just fades in.
- The blob takes the `brand` colour and a small stretch-and-squash while it moves (about 600–900 ms total).

**Agent messages (arrive one by one):**
- Each agent reply is a left-aligned row: **the agent's avatar on the left** (a round profile picture, 36 px) and the message bubble to its right.
- Each agent shows its own avatar (the shared `AgentAvatar`, `DESIGN_INSTRUCTIONS.md` 5d, which also defines the hover tooltip with the full ENS name and the roster rules). The agents on this page are whichever the data returns (the sample roster is concierge, scout, analyst, payer).
- **The agent's name sits above the message** (for example "Scout"), with its **status chip** next to the name (thinking, checked, quoted, paid, refused, idle).
- Hovering the name or avatar shows the full ENS name (for example `scout.priya.graphpay.eth`), as in 5d.
- Messages arrive step by step, driven by adapter events (`agent.message`, `agent.status`). A new message appears with a short slide-up and the agent's avatar pops in.

**Agent states and their animations:**
- **Thinking / checking:** the agent's bubble shows a lively animated "working" state that says what it is doing in words (for example "Scout is checking shops near Dadar…", "Analyst is reading shop records…", "Payer is getting ready to pay…"), with typing dots and an avatar animation (a gentle bounce and a small rotating ring). It resolves into the final message when the next event arrives.
- **Rejected (a shop rejected, or a payment was refused):** the agent that got the rejection plays a **crying animation** on its avatar (tear drops, drooping eyes) and its bubble states the reason in words, for example "Rejected: 18% of orders refunded", with the recorded link when the event carries one. Status chip: `refused`.
- **Done well:** `checked` and `quoted` chips use `info`, `paid` uses `ok`, `thinking` uses `warn`, `refused` uses `bad`, `idle` is grey, and the avatar does a short happy pop on `paid`.
- **Idle:** the avatar is still, chip `idle`.

**What shows in the thread (what the agents have found and are doing):**
- **Plain agent messages** with status chips, as above.
- **Graph read line:** "Asked GraphPay: 3 shops, answered in 2 reads" with explorer links (from `graph.read`).
- **Shop choice cards** (C2): each shop shows its **price**, distance, and reputation (paid orders, refund rate); the rejected shop is marked as rejected with its reason.
- **Quote and receipt** (C3): opens by itself as a sheet when the quote arrives; the thread keeps a small card that reopens it.
- **Refused payment card** with its reason in words and the recorded link.
- Everything here is **mock data** for now and labelled with the Mock badge; no number is a real measurement.

**States to design:** Agents thinking · Shop rejected with its reason · Payment refused with its reason · Error with retry · Mock badge. Plus the shared states (loading, empty with the mascot, success).
- **Error with retry:** an inline banner above the composer ("Something went wrong. Try again") with a Retry button; only for recoverable errors (`error` with `recoverable: true`).
- **Empty:** the centred mascot with a short greeting and the quick-prompt chips.

**Adapter:** calls `sendPrompt`. Listens to `agent.message`, `agent.status`, `graph.read`, `quote.created`, `payment.signed`, `payment.settled`, `payment.refused`, `error`.

**Backend-ready structure:**
- The thread is a pure function of the event stream: one reducer turns `DemoEvent`s into thread items. Components only render items and call `sendPrompt`; they never fake events or hold timers for agent steps.
- The **mock adapter** scripts the journey with realistic delays between events (concierge, then scout, then analyst, then payer). The live adapter will emit the same events, so nothing in the UI changes.
- Agent identity (name, ENS name, avatar key, colour) comes from one `agents` lookup built from the story data, so a new agent or story needs no component change.

**Added beyond the brief (from the reference wireframe for C1, see the Appendix):**
- Quick-prompt chips (above).
- Header subtitle with agent status and the daily pass amount.
- Inline result cards in the thread and the "Asked GraphPay" line with links.

**Open questions:**
- Where the mascot lives once the chat has started (default: docks small at the top of the thread).
- Which agent cries when a payment is refused (default: the agent that reported it, usually the payer).

- [ ] Layout · [ ] All states · [ ] Wired to mock adapter

---

## C2. Shop choice card (inside C1)

**Purpose:** 2–3 shops compared inside the thread, so the customer sees what the agents found. Display only.

**Content:**
- One card per shop, stacked in the thread right after the "Asked GraphPay" line. Per shop: name, **price** in USDT, distance, and reputation from the graph (paid orders, refund rate, repeat buyers).
- A **good shop** has an `ok` accent edge. The **rejected trap shop** has a `bad` accent edge, a "Rejected" chip and the reason in words (for example "Rejected: 18% of orders refunded"). The agent that rejected it shows the crying animation described in C1.
- The chosen shop is marked "Chosen" and the payer's next message refers to it.
- **Closed shops are not shown.** A shop that is closed is not considered or listed. If no open shop fits, there are no cards; the agents say so in words instead (see "When the shop is closed" below).
- Mock data only, with the Mock badge.

**States to design:** Choices shown · Trap shop rejected with reason · Loading (skeleton cards while the graph is read).

**Adapter:** none (display). Listens to `agent.status` (reason) and `graph.read`.

**Open questions:** none yet.

- [ ] Layout · [ ] All states · [ ] Wired to mock adapter

---

## When the shop is closed (customer side)

Whether a shop is open is one shared flag in the mock store (`DESIGN_INSTRUCTIONS.md` section 13). From the customer's side a closed shop behaves like this:

- **Not considered:** the agents do not consider it, it does not appear in the shop choices (C2), and no quote is created for it. If it is the only shop that fits, the thread shows a refused-style note ("Kesar Kingdom is closed right now") in which the responsible agent looks disappointed, and the agents offer to try later or pick another shop.
- **Closes while a quote is open:** the quote is withdrawn and the quote sheet (C3) shows the payment-failed state with the reason "shop closed". Nothing is charged.
- **Reorder:** if the shop is closed, no quote is made and the same refused-style note appears on the desk.
- **A renewal that falls due:** see C6 ("Skipped, shop closed").
- Orders already paid are unaffected.
- The mock adapter checks the flag before the agents consider a shop and before it creates a quote.

---

## C3. Quote and receipt (auto-opens from the agent desk)

**Purpose:** the quote the payer agent accepted from the shop, the payment happening, then the paid receipt (or a failure).

**When it opens (not in the hamburger menu):**
- It **opens by itself** over the agent desk when `quote.created` arrives, meaning the shop's agent has sent the quote and the customer's **payer agent** is about to pay. It is a full-height sheet that slides up over the desk (same header, hamburger still visible). The customer does not start it; the payer agent pays within the spending pass, so there is no pay button.
- It closes back to the desk by the close icon or when "View order" is used. The desk keeps a small card in the thread that reopens it.

**Layout, top to bottom (one scrolling sheet):**
1. **Bar:** "Order with <shop name>" and the quote countdown ("Quote valid for 14:52", a 15-minute validity, from `validUntil`).
2. **Quote card** (`info` accent): the shop's quote: line items with quantities ("Gulab jamun, box of 6 × 1"), the **total in USDT**, and "Pay to <shop ENS name>". Shows the shop agent (storefront) avatar and name as the sender, using the same avatar rules as C1.
3. **Payment step row:** "Signed by payer agent" with a tick once `payment.signed` arrives.
4. **Paying animation** (while signed and waiting for settlement): the **payer agent's avatar** is shown paying. Animate money moving from the payer toward the shop: coin and dollar-sign icons floating along a path from the payer's avatar to the shop's, with a pulsing "Paying 4.00 USDT…" label. Keep it light and loopable until `payment.settled`; skip the motion under `prefers-reduced-motion` and show a static arrow instead.
5. **Paid card** (`ok` accent), after `payment.settled`: a clear "Paid" state with a short success animation, the amount ("4.00 USDT on Whitechain"), "Gas paid by GraphPay, you paid 0", and a **View transaction** explorer link (opens in a new tab).
6. **View order** button (primary, `brand`), shown once paid: closes the sheet and **navigates to the Orders page (C4)**, opening the detail of this order. It uses the same horizontal page slide as the menu.

**Payment failed (from `payment.refused`):**
- Replace the paying animation with the **payer agent's avatar in its crying state** and the heading **"Payment failed"**.
- Below it, the reason in words (for example over cap, agent paused or revoked, quote expired, budget, shop closed) and the recorded link when the event carries one. No "View order" button; show **Close**. A quote that expires while the customer is still on the sheet is not a failure: it re-quotes by itself (see the countdown note). The failure state is for refused payments only.

**States to design:** Countdown running · Quote expired, re-quoting · Signed, waiting for settlement (paying animation) · Paid with link and View order · Payment failed (crying payer, reason, link). Plus the shared states (loading skeleton, error with retry).
- **Countdown:** changes to `warn` colour in the last minute; at zero it shows "Quote expired, getting a new one…" and the card is replaced when a new `quote.created` arrives.

**Adapter:** no action (the agent pays within the pass). "View order" is navigation only. Listens to `quote.created`, `payment.signed`, `payment.settled`, `payment.refused`, `order.updated`.

**Backend-ready structure:** the sheet is driven only by the latest quote and payment events for one `orderId`; its phase (quote, signed, paying, paid, failed) is derived by a reducer, never by timers in the component. Amounts, names, ENS names and links come from the events.

**Added beyond the brief (from the reference wireframe for C3, see the Appendix):**
- The quote validity countdown and the "Quote expired, re-quoting" state.
- The "Signed by payer agent" row.
- "Gas paid by GraphPay, you paid 0" on the receipt.

**Open questions:** none yet.

- [ ] Layout · [ ] All states · [ ] Wired to mock adapter

---

## C4. Orders (list and detail)

**Purpose:** all of the customer's past orders, and for each one its progress and the actions that start the other journeys. Opened from the hamburger menu, or from "View order" on the receipt (C3), which lands on that order's detail.

**Order list:**
- One card per order, newest first (Amazon-style): item summary (for example "Gulab jamun × 6"), shop name, total in USDT, date, and a status chip (Ordered, Paid, Dispatched, Delivered, Refunded). Tapping a card opens the order detail.
- **Empty state (no orders):** an **agent's avatar** (default: the concierge, in a friendly or shrugging pose) with a speech bubble in a light, funny tone, for example "I checked every single corner for an order. Maybe you should start ordering." A button "Ask your agents" returns to the agent desk (C1). Vary the line from a small set kept in `copy.ts`, not in the component.

**Order detail:**
- Header: item lines, shop name and ENS name, total, order date, and the **View transaction** explorer link.
- **Order status tracker:** four circles connected by arrows: **Ordered → Paid → Dispatched → Delivered**.
  - A step not yet reached is **grayed out** (muted outline circle, muted label, muted arrow).
  - A completed step has a **hand-drawn, sketchy look with a green check mark** (`ok` colour): a slightly wobbly circle outline and a check drawn as if with a pen. Build it as an inline SVG with a rough stroke, and animate the check drawing itself (stroke-dashoffset) the first time a step completes. The arrow after a completed step is also drawn in `ok`.
  - The current step, if in progress, gets a gentle pulse in `warn`.
  - Use the same tracker component for both statuses (shared `Timeline`/`StatusTracker`).
- **Refund status tracker** (only when a refund exists): the same style, three steps: **Requested → Accepted → Refunded**. It sits under the order tracker with the heading "Refund" and the refund amount and reason. A declined refund shows the shop's note and the tracker stops at Requested with a `bad` marker. When Refunded, show the **View transaction** link for the refund.
- **Buttons:**
  - **Request refund** (primary): opens the **Refund Wizard page (C5)** for this order. Hidden or disabled with a reason when the order is not yet paid, or when it is already fully refunded.
  - **Reorder** (secondary): calls `reorder` for this order, then shows the new order's quote on the desk (the C3 sheet opens when its quote arrives). Shows a loading state while it waits. If the shop is closed, no quote is made and the customer sees the refused-style note "<shop> is closed right now" on the desk.
  - **Make this order a renewal** (secondary): opens the **Renewals page (C6)** with this order carried over (`orderId`). C6 shows the "Set up renewal" form for it, where the customer enters how often it repeats and confirms.

**States to design:** Empty: no orders yet (agent avatar and funny line) · Each tracker stage (Ordered, Paid, Dispatched, Delivered, each as the current step) · Refund in progress (Requested, Accepted) · Refunded with link · Refund declined with the shop's note. Plus the shared states (loading skeletons, error with retry, Mock badge).

**Adapter:** calls `reorder`; opens the refund wizard and the renewal setup (both navigation only, passing an `orderId`). Listens to `order.updated`, `refund.requested`, `refund.settled`.

**Backend-ready structure:** the list and the trackers render from `Order` records (status, refund status, links) in the snapshot, kept current by `order.updated` and `refund.*` events. The tracker component takes an ordered list of steps with a done/current/todo state; it holds no business logic. Navigation to C5 (refund) and C6 (renewal setup) passes only an `orderId`.

**Added beyond the brief (from the reference wireframe for C4, see the Appendix):**
- The "Refunded, with link" state and the explorer link on each order.
- The order detail shows the shop name and the order total.

**Open questions:**
- The reference wireframe for this page also shows Orders, Renewals and Agents as tabs at the top. Default: not built, because the hamburger menu replaces them.

- [ ] Layout · [ ] All states · [ ] Wired to mock adapter

---

## C5. Refund wizard

**Purpose:** request a full or partial refund for one order, step by step, then follow its status until it settles. Opened from "Request refund" on an order (C4) or from the hamburger menu. From the menu with no order chosen, it first shows an order picker (only paid, not fully refunded orders), then the wizard.

**Layout, top to bottom (one scrolling page). Every step is compulsory, and each later step stays completely hidden (not rendered, not grayed out) until the step before it is done:**
1. **Bar:** "Request a refund" with the order summary ("Gulab jamun × 6, 4.00 USDT" as the amount paid).
2. **Refund status tracker at the top:** three steps **Requested → Accepted → Refunded**, in exactly the same hand-drawn, green-check style as the order tracker in C4 (same shared component). Before a refund is sent, all three are grayed out. It advances from `refund.requested`, then the shop's acceptance, then `refund.settled`.
3. **Full or partial choice:** a two-option segmented control, **Full** and **Partial**.
   - **Full:** the amount is filled in automatically with the amount paid and **cannot be edited** (shown as a locked, read-only field).
   - **Partial:** an amount input appears. The customer types an amount and presses **Enter** (or Return on the iOS keyboard); the amount is then **shown as a confirmed line** ("Refund amount 1.00 USDT") with an **Edit** button that puts it back into the input.
4. **Reason box** (opens below once the amount is set, which is immediately for Full, or after Enter for Partial): a text field ("Reason: two pieces were squashed"). Pressing Enter confirms the reason; it is then shown as text with an **Edit** button.
5. **Add a photo card** (**hidden until the reason is confirmed**, then it appears): "Add a photo", with the note "Stored privately, shared with the shop only". Tapping it opens the iOS-style upload sheet (see below). After a photo is chosen, show its thumbnail with Replace and Remove.
6. **Request refund button** at the bottom: **grayed out (disabled) until the amount, the reason and a photo are all set**, then it becomes a normal primary button (`brand`). Tapping it calls `requestRefund` and moves to the status view.
   - The amount, the reason and the photo are **all required** (the reference wireframe marks the photo optional; the owner has overruled that). Keep the rule in one `canSubmit` function.

**Keyboards on this page:** the shared `IosKeyboard` (`DESIGN_INSTRUCTIONS.md` 5c). The amount field opens the numeric layout (its Done key confirms the amount like Enter). The reason box opens the text layout with the return key labelled **Done**, which confirms the reason. The keyboard hides on Done, on tapping outside, and when the next step opens; Edit buttons reopen the matching layout.

**iOS-style upload sheet (for the photo):**
- Tapping "Add a photo" opens a **bottom action sheet that looks like iOS** (rounded translucent sheet, a separate Cancel button below it, blur behind, slides up), with the options **Choose from Photos** and **Choose from Files**. (Optionally **Take Photo**, shown but disabled on a laptop.)
- Both options open the real file picker of the laptop through a hidden `<input type="file">`. Choose from Photos accepts images only; Choose from Files accepts any image or PDF. The picker is the browser's own and starts wherever the browser decides (often Downloads); the design cannot force the folder, only the sheet around it is iOS-styled.
- Validation: image or PDF only, up to a sensible size (default 10 MB); a rejected file shows an inline `bad` message. The chosen file is held in state and passed to `requestRefund` as `photo`.
- This is the shared `IosActionSheet` (`DESIGN_INSTRUCTIONS.md` section 5).

**Amount entry and validation:** the Full / Partial choice and the amount use the shared `AmountEntry` (`DESIGN_INSTRUCTIONS.md` 5e). The maximum is the amount paid minus anything already refunded. An amount above it, zero, negative or not a number is refused with the "Come on bro" moment: the payer agent (or the refund agent, if the data has one) in the disappointed pose, a cheeky line from `copy.ts` ("Come on bro, you only paid 4.00 USDT."), and the allowed maximum in words.

**After sending (status view):**
- The form turns read-only (amount, reason and photo shown as a summary) and the status tracker at the top animates.
- **Waiting for the shop:** tracker at Requested, a "Waiting for the shop to accept" line with a soft pulse.
- **Accepted:** Accepted step gets its sketchy green check; line "The shop accepted. Your refund is on its way."
- **Refunded with link:** all three steps checked, a success animation, the refunded amount and a **View transaction** explorer link. A "Back to orders" button returns to C4.
- **Declined with the shop's note:** the tracker stops at Requested with a `bad` marker, and a card shows **the shop's note** in full (from the event), the shop name, and a "Back to orders" button.

**States to design:** Validation: amount above paid (the "Come on bro" moment) · Waiting for the shop · Declined with the shop's note · Refunded with link. Plus: Full chosen (locked amount), Partial chosen (input with the number keypad open, then confirmed amount with Edit), Reason step with the text keyboard open, Reason confirmed with Edit, Photo card hidden until the reason is done, Photo added, Request button disabled and enabled, upload sheet open, rejected file, and the shared states (loading, error with retry, Mock badge).

**Adapter:** calls `requestRefund(orderId, { amount, reason, photo })`. Listens to `refund.requested`, `refund.settled`, `order.updated`.

**Backend-ready structure:** the wizard is a small step machine (amount, reason, photo, submitted) whose output is exactly the `requestRefund` input. After submit, the status view is derived only from the refund and order events for that `orderId`; the shop's note comes from the event payload. If the contract has no event field for the decline note yet, add an optional `note` to the mock refund event only (not to any backend contract) and mention it in `frontend/README.md`.

**Added beyond the brief (from the reference wireframe for C5, see the Appendix):**
- The order summary and amount paid in the bar.
- The privacy note on the photo card ("Stored privately, shared with the shop only").

**Open questions:** none yet.

- [ ] Layout · [ ] All states · [ ] Wired to mock adapter

---

## C6. Renewals

**Purpose:** the customer's active renewals: what repeats, when, and how each one fits inside the spending pass. Opened from the hamburger menu.

**Where renewals come from:** a renewal is created from an order (C4, "Make this order a renewal"). When `renewal.created` arrives, the new renewal **appears on this page**, even if the page is not open at the time. A small dot on the hamburger icon and a toast ("Renewal set up for Gulab jamun") tell her it was added.

**Set up renewal (opens when arriving from "Make this order a renewal"):** a form card at the top of the page for that one order.
- Shows the order being repeated (item, quantity, shop, price).
- **How often:** a choice of frequency (Daily, Weekly, Every 2 weeks, Monthly), then the detail that goes with it (for example the weekday for Weekly: "every Sunday"; the date for Monthly), and a start date (default: the next occurrence). The weekday and date pickers use iOS-style pickers (wheel or compact list in an `IosActionSheet`).
- **Fit check:** shows "4.00 USDT per charge, within your pass" using the paying agent's spending pass from C7. If one charge would exceed the pass, show it as a refused-style warning and disable the confirm button.
- **Start renewal** button (primary): calls `startRenewal(orderId, schedule)`. On `renewal.created` the form closes, the new renewal card appears in the list with a short highlight, and a toast confirms it. **Cancel** closes the form without creating anything.
- The amount input, if any, uses the iOS numeric keypad as in C5.

**Renewal list:** one card per renewal, in order of next charge date. Each card (`ok` accent for active) shows all of its details:
- The item and quantity with its schedule in words, for example **"Gulab jamun × 6, every Sunday"**.
- The shop name and ENS name.
- **Next charge:** the date ("Next: Sun 9 Nov").
- **Amount:** "4.00 USDT within your pass", showing how it fits the spending pass (cap usage: this amount against the remaining pass).
- Which agent pays it (avatar and name, hover for ENS name, as in C1).
- Status chip: Active, Charged, Cancelled.
- A **Cancel renewal** button (ghost style). It asks for confirmation in an iOS-style confirmation sheet ("Cancel this renewal? It will not charge again."), then calls `cancelRenewal`.

**Empty state (no renewals):** an **agent's avatar** (default: the concierge) with a speech bubble: **"You haven't set up a renewal. You want to go to the orders page to set one up."** and a button "Go to Orders" that opens the Orders page (C4). Keep the line in the copy config, not in the component.

**Charged, with link:** when `renewal.charged` arrives, the card shows a "Charged" chip with the amount, the date charged, a **View transaction** explorer link, and the next charge date moves forward. A short success animation plays once.

**Shop closed when a renewal is due:** the charge is refused with the reason "shop closed". The card shows a "Skipped, shop closed" chip (`warn`) and the line "We'll try again when the shop opens"; the charge is retried automatically when the shop opens. Nothing is charged while it is skipped.

**Cancelled:** when `renewal.cancelled` arrives, the card turns muted with a "Cancelled" chip and no Cancel button; it moves to the bottom of the list under a "Cancelled" heading.

**States to design:** Empty: set one up from an order · Set up renewal form (and its over-the-pass warning) · Active renewal · Charged, with link · Cancelled · Cancel confirmation sheet · New renewal just added. Plus the shared states (loading skeletons, error with retry, Mock badge).

**Adapter:** calls `startRenewal` (from the setup form) and `cancelRenewal`. Listens to `renewal.created`, `renewal.charged`, `renewal.cancelled` (and `payment.refused` for a charge that was refused, shown on the card with its reason and link).

**Backend-ready structure:** the list renders from the `Renewal` records in the snapshot, kept current by the three renewal events. The setup form outputs exactly the `startRenewal` input. The schedule text, next date, amount and cap usage come from the `Renewal` record, never composed in the component from hard-coded values. Starting and cancelling are the only actions on this page.

**Added beyond the brief (from the reference wireframe for C6, see the Appendix):**
- Cap usage ("4.00 USDT within your pass") on each card.
- The "Charged, with link" state.

**Open questions:** none yet.

- [ ] Layout · [ ] All states · [ ] Wired to mock adapter

---

## C7. Agents and spending pass (one page)

**Purpose:** who can act for the customer, what each agent may do, the spending pass limits, and the controls that stop them. This page is the home of the kill switch (pause, resume, revoke) and the cap controls. Opened from the hamburger menu.

**Layout:** a page titled "Your agents" with the customer's agents as a vertical list of cards, the **main agent first** and the agents it manages below it, one card per agent, all read from the agent roster in the snapshot.

**Roster:** the cards show whichever agents the data returns, the main agent first and the agents it manages below it, with which of them can spend taken from the data (see `DESIGN_INSTRUCTIONS.md` 5d). The concierge, scout, analyst and payer are only the sample roster.
- **Avatar on the left**, the same picture, ring colour and animations as on the agent desk. The avatar reflects the state (still when active, a sleepy or paused face when paused, greyed with a cross when revoked).
- **Name** (for example "Payer") with a **status chip** (Active, Paused, Revoked, Used up, Expired). **Hovering over the name or the avatar shows the full ENS name** (for example `payer.priya.graphpay.eth`) and whether it is active, in a tooltip; on touch, a tap does the same.
- **What it may do** in one line ("Pays within your pass", "Finds shops", "Checks shop records").
- **Spending pass block (only for agents that can spend):** "2.00 of 6.00 USDT used today", a progress bar (used, remaining), the period (per day), the expiry, and the pass state. An agent that cannot spend shows "Cannot spend" and no money controls.
- **Action buttons next to the avatar area:** **Pause** (primary), **Revoke** (danger style), and for spending agents **Change cap**. Paused agents show **Resume** instead of Pause. Revoked agents show no buttons.

**Controls and what they do:**
- **Pause:** calls `pauseAgent`. The card flips to Paused (chip, muted card, sleepy avatar) and the payment pass shows Paused. The agent cannot pay until resumed; if it tries, the attempt shows as a refused attempt (below). Pause is reversible.
- **Resume:** calls `resumeAgent`; back to Active.
- **Revoke:** calls `revokeAgent`. It asks for confirmation first in an iOS-style sheet that says it is **final** ("This agent can never pay again. This cannot be undone."). Once revoked, the card shows **Revoked (final)**, with no Resume button and no cap controls.
- **Cap (spending agents only):**
  - The customer, and only the customer, can **change the cap** (raise or lower it). **Change cap** opens an amount entry (iOS number pad, as in C5, with the same amount validation and "Come on bro" tone for an invalid value), then a confirmation sheet. The pass block updates to the new cap.
  - **Let the agent try to raise its own cap** (a demo button, ghost style): the agent attempts to raise its cap (for example to 50.00 USDT) and it is **always refused**. A refused card appears: "Cap change refused: the agent tried to raise its cap to 50.00 USDT. Only Priya can change this cap" (the customer's name from the story data), with a **View on Ethereum Sepolia** explorer link and the agent's avatar in the disappointed or crying pose.
- Every control shows a loading state while its call is in flight and an error with retry on failure.

**Status on each agent (whether it happened):** after any action, the card's chip shows the real outcome from the event: **Active**, **Paused**, **Revoked**, or a **Refused attempt** badge that stays on the card with its reason and recorded link. A stopped agent never reads Active. Pass-state wording: Active, Used up, Expired, Paused, Revoked; the worst state wins.

**Refused attempts:** `payment.refused` (reasons: cap, paused, revoked, budget and so on) and `cap.change.refused` add a refused-attempt entry under the agent's card: reason in words, the amount attempted, time, and the recorded link.

**States to design:** Active · Paused, with Resume · Revoked (final) · Refused attempt with link. Plus: non-spending agent (no money controls), pass states (Active, Used up, Expired, Paused, Revoked), Change cap entry and confirmation, invalid cap amount, revoke confirmation sheet, and the shared states (loading, error with retry, Mock badge).

**Adapter:** calls `pauseAgent`, `resumeAgent`, `revokeAgent`, `tryRaiseCap`. Listens to `agent.permission`, `cap.change.refused`, `payment.refused`.

**Backend-ready structure:**
- The cards render from the `agents` data in the snapshot (ENS name, role, status, pass: cap, used, period, expiry) and stay current from `agent.permission`, `payment.refused` and `cap.change.refused`. Buttons only call the adapter; the status changes when the event arrives, not when the button is pressed (use a pending state in between).
- **Note (not a backend change):** the reference contract (`DESIGN_INSTRUCTIONS.md` Appendix A) has no call for the customer to change a cap (only `tryRaiseCap`, which the agent always loses). For now `setCap(ens, cap)` exists **only in the frontend mock adapter** so the design works end to end. Nothing is requested from the backend; once the backend is finished, this call will be reconciled with whatever it offers.

**Added beyond the brief (from the reference wireframe for C7, see the Appendix):**
- The "Cap change refused" card with the "View on Ethereum Sepolia" link and the demo button "Let the agent try to raise its cap".
- "Revoked (final)" with no way back.
- The pass block ("2.00 of 6.00 used today") per spending agent.

**Open questions:**
- The roster of agents is not final (see `DESIGN_INSTRUCTIONS.md` 5d); revisit this page when the backend defines it.

- [ ] Layout · [ ] All states · [ ] Wired to mock adapter

---

# Appendix: reference wireframe values for the customer pages

These are the values from the owner's reference wireframes (a build guide's "Screens" tab) so you do not need that file. They are **sample data for layout and copy**, not a spec; where they differ from the page sections above, the page sections win. "Calls" are `DemoAdapter` methods and "events" are `DemoEvent` types (both in `DESIGN_INSTRUCTIONS.md` Appendix A).

**C1 Agent desk.** Bar: "Priya", subtitle "Agents active, pass 6.00 USDT a day". Chips: "Best gulab jamun under 6 USDT by 8 pm", "Re-order my usual". Customer message: "Best gulab jamun under 6 USDT by 8 pm". Messages: concierge.priya.graphpay.eth "On it. Scout is checking shops near Dadar." (thinking, amber); scout.priya.graphpay.eth "Asked GraphPay: 3 shops, answered in 2 reads." (checked, blue). Cards: Jamun Junction "3.20 USDT, Rejected: 18% of orders refunded" (red); Kesar Kingdom "4.00 USDT, 1.2 km, 1,204 paid orders, 1% refunded" (green). Message: payer.priya.graphpay.eth "Paying Kesar Kingdom 4.00 USDT within your pass." (paid, green). Input: "Ask your agents…". Calls: `sendPrompt`. Events: `agent.message`, `agent.status`, `graph.read`, `quote.created`, `payment.settled`, `payment.refused`. States: agents thinking; shop rejected with its reason; payment refused with its reason; error with retry; mock badge.

**C3 Quote and receipt.** Bar: "Order with Kesar Kingdom", "Quote valid for 14:52". Quote card (blue): "Gulab jamun, box of 6 × 1", "Total 4.00 USDT", "Pay to kesar-kingdom.graphpay.eth". Row: "Signed by payer agent" with a tick. Paid card (green): "4.00 USDT on Whitechain", "Gas paid by GraphPay, you paid 0", "View transaction". Button: "View order". No call (the agent pays within the pass). Events: `quote.created`, `payment.signed`, `payment.settled`, `payment.refused`. States: countdown running; quote expired, re-quoting; signed, waiting for settlement; paid with link.

**C4 Orders.** Rows: "Gulab jamun × 6" (Paid), "Kaju katli 250 g" (Refunded). Timeline: Ordered ✓, Paid ✓, Dispatched ✓, Delivered (not yet). Buttons: "Request refund" (primary), "Re-order", "Make it a renewal". Calls: `reorder`, `startRenewal`, opens the refund wizard. Events: `order.updated`, `refund.settled`. States: empty, no orders yet; each timeline stage; refunded with link.

**C5 Refund wizard.** Bar: "Request a refund", "Gulab jamun × 6, 4.00 USDT". Tabs: Full, Partial (Partial selected). Row: "Amount 1.00 USDT". Input: "Reason: two pieces were squashed". Card (blue): "Add a photo", "Stored privately, shared with the shop only". Button: "Request refund". Timeline: Requested ✓, Accepted, Refunded. Call: `requestRefund`. Events: `refund.requested`, `refund.settled`, `order.updated`. States: validation, amount above paid; waiting for the shop; declined with the shop's note; refunded with link.

**C6 Renewals.** Bar: "Renewals". Card (green): "Gulab jamun × 6, every Sunday", "Next: Sun 9 Nov", "4.00 USDT within your pass". Button: "Cancel renewal". Call: `cancelRenewal`. Events: `renewal.created`, `renewal.charged`, `renewal.cancelled`. States: empty, set one up from an order; charged with link; cancelled.

**C7 Agents and spending pass.** Bar: "Your agents". Card (green): "payer.priya.graphpay.eth", "Pays within your pass", "Active". Row: "Spending pass", "2.00 of 6.00 used today". Buttons: "Pause agent", "Revoke agent" (danger). Card (red): "Cap change refused", "The agent tried to raise its cap to 50.00 USDT", "Only Priya can change this cap", "View on Ethereum Sepolia". Button: "Let the agent try to raise its cap". Calls: `pauseAgent`, `resumeAgent`, `revokeAgent`, `tryRaiseCap`. Events: `agent.permission`, `cap.change.refused`, `payment.refused`. States: active; paused, with resume; revoked (final); refused attempt with link.

**Story journeys** that touch the customer app are in `DESIGN_INSTRUCTIONS.md` section 13. The shop's side of each journey is in `DESIGN_MERCHANT_APP.md`.
