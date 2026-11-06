# Merchant app: page-by-page design

This file is for the **merchant app only** (the right phone). The customer app has its own file. Everything shared by both apps (header and hamburger, keyboard, status tracker, avatars, amount entry, sounds, colours, type, states, the mock flow, sample data) is defined once in **`DESIGN_INSTRUCTIONS.md`**; read that first. This file says only where the merchant app uses those pieces and what each merchant page contains.

**There are no hard rules in this file;** everything is a default from the owner (see `DESIGN_INSTRUCTIONS.md`).

- The merchant app is the **right phone**. Light theme inside the phone; the stage behind it is dark.
- If something is uncertain, use `DESIGN_INSTRUCTIONS.md` section 3, then this file's appendix (the reference wireframe values for each page).
- The shop's name (Kesar Kingdom in the sample data) comes from the story data and will change. Do not put it in components.
- Accent: the shared `brand` colour. It looks like the customer app: same header, menu, cards, chips, buttons, spacing, fonts and iOS pieces; only the content differs.
- Navigation: the hamburger menu on every page. It opens **four pages**; the **Order detail** page (M3) opens from Shop Home and is not in the menu. The new-order pop-up lives inside Shop Home. There is no bottom tab bar.
- Buttons that move money (dispatch, refund) may later be protected by a passcode; in the mock they just work. If you add a passcode prompt, make it a shared bottom sheet.
- **M1 to M6 are written below.** Anything a page leaves open, fill from this file's appendix and the journeys in `DESIGN_INSTRUCTIONS.md` section 13. M7 is not built for now.

Each page section has: **Purpose**, **Content** (the owner's brief), **States to design**, **Adapter** (calls and events) and **Open questions**, plus **Added beyond the brief** where something was filled in from the reference wireframes.

---

## Header and hamburger menu (merchant pages)

The header and the coin hamburger are the shared component in `DESIGN_INSTRUCTIONS.md` section 5a. On the merchant app the page title is the shop's name on Shop Home, and the page cards in the strip are, in this order:

1. **Shop Home** (M1, the default page the app opens on)
2. **Refund Requests** (M4)
3. **Renewals and Customers** (M5, one complete page)
4. **Payouts and Exports** (M6)

A dot on the hamburger icon, and a toast, tell the merchant when something arrives on a page they are not looking at, for example a new refund request.

---

## M1. Shop Home (includes the new-order pop-up M2)

**Design decision:** the reference wireframes show the **new-order pop-up (M2)** as a separate screen. In our design the pop-up is **not a separate page**: it arrives as a row inside the day's log on Shop Home. The **order detail (M3) is its own page**, opened from that row (see M3). It is not in the hamburger menu. Where the reference wireframes and this file differ, this file wins.

**Purpose:** the shop's day at a glance, the switch that opens the shop, the live log of the day's orders, and the actions on each order.

**Layout, top to bottom:**
1. **Header** (shared): hamburger on the left, the shop name from the story data, subtitle "Open, sound on" or "Closed", Mock badge on the right.
2. **Meme banner at the top**, which depends on the shop state:
   - **Shop open:** a cheerful meme card (the shop's own agent in a happy, busy pose with a short caption such as "Doors open. Let the orders roll in.").
   - **Shop closed:** a sleepy or sad meme card (caption such as "Closed. Even the gulab jamun is taking a nap.").
   - The shop agent avatar, poses and the exact memes come from the separately supplied asset files (`DESIGN_INSTRUCTIONS.md` section 15); use placeholders until then. The captions live in a small copy list in config (several per state, picked at random), not in the component. The banner swaps with a soft cross-fade when the shop opens or closes.
3. **Shop Open / Shop Closed toggle** (large, iOS-style switch with the label): calls `setShopOpen`.
   - **Opening the shop plays the cash-register "ka-ching"** (`playCashRegister()`, shared sound, `DESIGN_INSTRUCTIONS.md` 5f). The switch click is the user gesture that unlocks audio for later chimes. Closing the shop makes no sound.
   - Sound uses the **shared mute control in the header**; there is no second toggle here. When muted, no sounds play.
4. **Day at a glance** (three stat cards in a row): **Earned today** (USDT), **Orders** (count), **Refunds** (count, and the refunded amount in small text). They update live as events arrive. Numbers animate (count up) when they change.
5. **Today's log:** a vertical list, newest at the top, of **one-line summaries** for every order that has come in or is coming in today. Each row: a kind icon (New order, Renewal, Refund request, Dispatched, Refunded), "from <buyer agent ENS name, shortened>" with the buyer agent's avatar, the amount in USDT, the time, and a status chip (Paid, Dispatched, Delivered, Refunded). A freshly arrived order is Paid with a "New" marker that disappears once it is opened. Renewal rows say "Renewal from <name>".

**New-order pop-up (inside the log):**
- When `merchant.notification` (`new_order`) arrives, the new order **slides in at the top of the log** as a highlighted row (accent edge, a "New" chip, a gentle pulse), and **a chime plays**. It also nudges the stats. No separate screen or modal opens. The chime is synthesised with Web Audio behind `playChime()`, and plays only when the shop is open and the sound toggle is on.
- It starts **collapsed as the one-liner** and shows a one-line risk verdict ("Risk agent: safe to accept") or a warning ("Risk agent warns: …", `warn` or `bad` colour) from the shop's risk agent.

**Order summary (inside the same row, expands in place):**
- **Tapping a log row expands it in place** into a quick summary on the home page (it slides open inside the log; the rest of the log moves down). Tapping again, or another row, collapses it.
- The summary shows: who is buying (buyer agent and its owner, reputation: "42 orders, 0 refunds, since 2025", and the risk verdict), the items, the **transaction amount**, and one line saying **what can be done** with the order right now ("Can dispatch", "Dispatched", "Refund requested", "Refunded").
- **At the very bottom of the summary there is a "View order details" button.** It opens the **Order detail page (M3)** for that order. Dispatch is done on that page, and Refund starts there (its Refund button opens Refund Requests, M4), not here.

**Shop closed:** the toggle reads "Shop Closed", the meme is the sleepy one, and the log still shows the orders already received earlier today. **A closed shop takes no new orders and is not considered at all** (see "Closed shop is out of the flow (merchant side)" below). So no new-order row, chime or stat change happens while it is closed.

**Closed shop is out of the flow (merchant side):**
- A closed shop takes no new orders and is not considered by the customer's agents (that side is described in the customer file). So while it is closed there is no new-order row, no chime and no change to the stats.
- Orders already paid stay in the log and can still be opened, dispatched and refunded.
- A renewal that fell due while the shop was closed shows on the Renewals and Customers page (M5) as "Skipped, shop closed" with its next attempt as "When the shop opens". **When the shop opens, the skipped charges are retried automatically**: the chime plays and a log row appears for each retried charge.
- **Reset demo starts the shop Closed**, so the demo begins with the closed-shop meme and the ka-ching moment when the merchant opens it. Until the merchant opens the shop, a customer prompt gets the "shop is closed" answer.

**Empty day:** no orders yet today. An **agent avatar** (the shop's storefront agent) with a friendly line such as "No orders yet. Open the doors and I'll ring the bell when one comes in." and stats at 0.00, 0, 0.

**States to design:** Closed · Open with sound · Empty day · New order arriving (chime, highlighted row) · Risk agent warns · Row collapsed and expanded (with View order details) · Dispatched · Refunded. Plus the shared states (loading skeletons, error with retry, Mock badge).

**Adapter:** calls `setShopOpen`. Listens to `merchant.notification` (`new_order`, `refund_request`, `renewal`), `order.updated`, `payment.settled`, `refund.requested`, `refund.settled`, `renewal.charged`.

**Backend-ready structure:** the day's totals and the log are derived from the orders in the snapshot and the events (`order.updated`, `merchant.notification`); no totals are kept as separate state. The log row and its summary render from one `Order` record. Sounds, memes and captions are replaceable assets and copy.

**Added beyond the brief (from the reference wireframe for M1, see the Appendix):**
- The risk agent's verdict on each new order and the "Risk agent warns" state.
- The buyer's owner and reputation line ("42 orders, 0 refunds, since 2025").
- The renewal rows in the log.

**Open questions:**
- Reset demo starts the shop **Closed** (decided).

- [ ] Layout · [ ] All states · [ ] Wired to mock adapter

---

## M2. New order pop-up (merged into M1)

Not a separate page. Everything for it is in **M1, "New-order pop-up (inside the log)"**. Build it as a row in the log, not as a separate screen or modal.

---

## M3. Order detail (own page, opened from Shop Home)

**Purpose:** the full order with its payment link, its status and the actions after payment.

**How it opens:** from the **"View order details"** button at the bottom of an order's summary on Shop Home (M1). It is **not in the hamburger menu**. The header shows a **back arrow** next to the hamburger so the merchant returns to Shop Home. The page slides in from the right.

**Layout, top to bottom:**
1. **Header** (shared), title "Order <number>" with the buyer's name ("Priya, via payer agent").
2. **Status tracker** with three steps: **Paid → Dispatched → Delivered**, using the shared `StatusTracker` (`DESIGN_INSTRUCTIONS.md` 5b). If a refund exists, a second tracker beneath it shows **Requested → Accepted → Refunded**.
3. **Buyer and order card:** buyer agent (avatar, name, ENS on hover), its owner, reputation line and the risk verdict, the items and quantities, and the total in USDT.
4. **Payment row:** the amount paid and a **View transaction** link (the customer's payment on the explorer, opens in a new tab).
5. **Action buttons (only these two for now):**
   - **Dispatch** (primary, `brand`): shown when the order is Paid and not dispatched; calls `dispatch`. After it, the tracker moves to Dispatched, the button is hidden or disabled ("Already dispatched"), and Delivered follows by itself in the mock a few seconds later (there is no Mark delivered button).
   - **Refund** (secondary): opens the **Refund Requests page (M4)** for this order, which shows the refund options, Full and Partial. The reference wireframe's separate "Refund full" and "Refund partial" buttons are **not** shown here. Hidden or disabled with a reason when the order is not paid or already fully refunded.
6. A refunded order shows the refunded amount and a **View transaction** link for the refund.

**States to design:** Each stage (Paid, Dispatched, Delivered) · Dispatching (loading) · Refund requested by the customer (badge on the Refund button) · Refunded, with link · Error with retry · Mock badge.

**Adapter:** calls `dispatch`. Listens to `order.updated`, `payment.settled`, `refund.requested`, `refund.settled`. The Refund button is navigation only; the refund itself is made on M4.

**Added beyond the brief (from the reference wireframe for M3, see the Appendix):**
- The buyer and risk summary on the page, and the refund tracker.

**Open questions:** none yet.

- [ ] Layout · [ ] All states · [ ] Wired to mock adapter

---

## M4. Refund Requests

**Purpose:** where the merchant deals with refunds. Each request shows what the customer sent, and the merchant either approves it (fully or for another amount) or declines it with a note. Opened from the hamburger menu, or from the **Refund** button on an order's detail page (M3).

**Entry points:**
- **From the menu:** the inbox of refund requests, newest first, with a "N waiting" count in the header. Each card shows the buyer, the item, the amount paid, the amount asked for, the reason, a photo thumbnail, the time and a status chip (Requested, Accepted, Refunded, Declined). Tapping a card opens that request.
- **From an order's Refund button (M3):** opens that order's request directly. If the customer has not asked for a refund, the page shows the order's refund options without request details, so the merchant can still refund on their own.

**Request view (one request), top to bottom:**
1. **Refund and transaction details, at the top:** the order (number, items, shop), the buyer agent and its owner, the amount paid with a **View transaction** link, the amount the customer is asking for, the date, and the refund status tracker (**Requested → Accepted → Refunded**, same sketchy green-check style as elsewhere).
2. **What the customer sent:** the **reason** in the customer's words and the **photo** (large, tap to open full screen), plus anything else the request carries (full or partial request, amount). The note "Stored privately, shared with the shop only" appears under the photo.
3. **Decision area:**
   - **Approve [amount] USDT** (primary, `ok` colour): approves the amount the customer asked for. Calls `approveRefund(orderId, amount)`.
   - **Approve another amount** (secondary): switches to the shared `AmountEntry` (`DESIGN_INSTRUCTIONS.md` 5e) with a **Full** and **Partial** choice. Full is the amount paid, locked. Partial takes an amount that cannot exceed the amount paid minus anything already refunded; an over-amount gets the same "Come on bro" moment with the shop agent in the disappointed pose. After the amount is confirmed, an **Approve [amount] USDT** button appears for it.
   - **Decline with a note** (secondary, `bad` text): opens a note box (an iOS-style bottom sheet with a text area and the shared iOS text keyboard). The note is **required**. **Send decline** calls `declineRefund(orderId, note)`. A **Cancel** closes the sheet.
   - Every approval and decline asks for confirmation in an iOS-style sheet that repeats the amount or the note.

**Agent gestures on hover:** a shop agent (default: the storefront agent; use the shop's front agent in the data) sits beside the decision buttons, and **reacts when the pointer hovers over a button** (on touch, while the button is pressed):
- Hovering **Approve** (either approve button): the agent does an **approving gesture** (thumbs up or a nod with a smile).
- Hovering **Decline with a note**: the agent does a **no gesture** (shaking its head, or a raised hand).
- When the pointer leaves, the agent returns to idle. The reaction is purely visual and never triggers the action. Under `prefers-reduced-motion`, swap the motion for a static approving or declining pose. The poses and exact artwork come from the separately supplied asset files; use placeholders until then (`DESIGN_INSTRUCTIONS.md` 15).

**After deciding:**
- **Approved, settling:** the tracker moves to Accepted, a "Sending the refund…" line with a soft pulse. Then **Refunded** with the amount and a **View transaction** link. Both apps' orders update, and the customer sees Accepted then Refunded.
- **Declined:** the card shows Declined with the note that was sent. The customer sees the same note in the refund wizard.
- A short success animation plays on approval; the request moves down the inbox under a "Done" heading.

**Empty inbox:** an agent avatar with a friendly line (placeholder text, for example "No refund requests. Nobody is unhappy today."), and a button back to Shop Home.

**States to design:** Empty inbox · Inbox with requests (waiting) · Request view with photo · Approve the asked amount · Approve another amount: Full (locked) and Partial (input, validation) · Decline note sheet (empty, filled) · Approved, settling · Refunded with link · Declined · Hover gestures (approve, decline) · Order opened with no customer request. Plus the shared states (loading skeletons, error with retry, Mock badge).

**Adapter:** calls `approveRefund` and `declineRefund`. Listens to `refund.requested`, `refund.settled`, `order.updated`, `merchant.notification` (`refund_request`).

**Backend-ready structure:** the inbox and the request view render from the refund requests and orders in the snapshot, kept current by the events. The decision area outputs exactly the `approveRefund` and `declineRefund` inputs. The decline note travels on the refund data so the customer app can show it (if the contract has no field for it, add an optional `note` to the mock event only).

**Added beyond the brief (from the reference wireframe for M4, see the Appendix):**
- The "N waiting" count and the request cards in the inbox.
- "Approve another amount" next to the primary approve button.
- The empty inbox state.

**Open questions:** none yet.

- [ ] Layout · [ ] All states · [ ] Wired to mock adapter

---

## M5. Renewals and Customers (one complete page)

**Purpose:** who keeps coming back, and when the next renewal charges. This page follows the reference wireframe for M5 (see the Appendix) as written, in the shared look of the app. Opened from the hamburger menu.

**Layout, top to bottom:**
1. **Header** (shared), title "Renewals".
2. **Renewals list:** one row per customer who has a renewal with the shop, showing the **customer's name** (the owner's ENS name, for example `priya.graphpay.eth`: the person, not the agent), with their buyer agent's avatar, the **schedule** in short form (for example "Sun" for every Sunday, "Daily"), the item, the amount, and the **next charge date**. Rows are ordered by next charge date. Customers who keep coming back (several orders) show a small "Regular" chip with their order count.
3. **Hint line:** "Tap a customer to see their history".
4. **Customer history:** tapping a customer expands their row in place into a history panel: every order and every renewal charge from that customer in order (date, item, amount, status chip, **View transaction** link), their refund count, and when they first ordered. Tapping again collapses it. The panel is read only; there are no actions on this page (the reference wireframe lists none).
5. **When the next renewal changes:** the next charge date on a row updates live when `renewal.charged` arrives (it moves forward by one period), with a short highlight on the row.

**Live behaviour (events):**
- `renewal.created`: a new row appears with a brief highlight, and a dot on the hamburger icon and a toast tell the merchant if they are on another page.
- `renewal.charged`: the row shows a **Charged** chip with the amount and a View transaction link, and the next date moves forward. A renewal that was charged **today** is grouped at the top under "Charged today".
- A renewal skipped because the shop was closed shows a "Skipped, shop closed" chip (`warn`) and its next attempt as "When the shop opens".
- `renewal.cancelled`: the row turns muted with a Cancelled chip and moves to the bottom under "Cancelled", with no next date.

**Empty:** no renewals yet. An agent avatar with a friendly placeholder line (for example "No regulars yet. Give it time; good gulab jamun builds loyalty.") and the hint that renewals appear when a customer sets one up.

**States to design:** Empty · Renewals list · Charged today · Customer history open · Cancelled. Plus the shared states (loading skeletons, error with retry, Mock badge).

**Adapter:** no actions. Listens to `renewal.created`, `renewal.charged`, `renewal.cancelled`, and `merchant.notification` (`renewal`).

**Backend-ready structure:** the list and each customer's history are derived from the `Renewal` records and the orders in the snapshot, kept current by the three renewal events. No customer data is stored in the page.

**Added beyond the brief (from the reference wireframe for M5, see the Appendix):**
- The whole page, as written there: renewals, returning customers, next charge dates, tap a customer for history, and the Empty and Charged today states.

**Open questions:** none yet.

- [ ] Layout · [ ] All states · [ ] Wired to mock adapter

---

## M6. Payouts and Exports

**Purpose:** the shop's money in, money back and net, a log of every payment and refund with a link to its transaction, and a CSV for the accountant. Opened from the hamburger menu.

**Layout, top to bottom:**
1. **Header** (shared), title "Payouts".
2. **Period selector:** a compact control for the period (Today, This week, This month, Custom range with two iOS-style date pickers). It filters everything below and sets the CSV range.
3. **Three summary cards in a row**, each with its own icon and meaning-based colour:
   - **Received** (money in): total of settled payments, with a money-in icon (an arrow into a wallet or coin stack), `ok` colour.
   - **Refunded** (money back): total refunded, with a money-back icon (a return or counter-clockwise arrow with a coin), `info` colour (money back is neutral information, not a warning).
   - **Net**: Received minus Refunded, with a balance icon (a scale or a coin stack with an equals mark), the `brand` colour (it is a total, not a status); negative shows in `bad`.
   - Amounts in USDT, two decimals, count up when they change.
4. **Export CSV** button (primary, `brand`): calls `exportCsv({ from, to })` for the chosen period and downloads a real `.csv` file made in the browser from the mock data. Columns: date, type (Order or Refund), order number, buyer ENS name, amount in USDT, status, transaction link. Shows a loading state while it builds and an **Export ready** confirmation (file name and row count) when done. Disabled with a hint when the period is empty.
5. **Log (at the bottom):** a vertical list, newest first, of **every order payment and every refund** in the period. Each row: a type icon (Order in `ok`, Refund in `info`), "Order 1042" or "Refund 1042", the buyer, the date and time, the amount (plus or minus), a status chip, and a **View transaction** link that opens the explorer in a new tab. Tapping the row (not the link) opens that order's detail page (M3).

**Empty period:** when there is no transaction in the period, the summary cards show 0.00, the log is replaced by an empty state with an **icon and a meme** (an agent avatar with a funny placeholder caption, for example "Nothing here. Even the cash register is bored."), Export CSV is disabled, and a "Choose another period" hint shows.

**States to design:** Empty period (with meme and icon) · Period with transactions · Export building · Export ready · Negative net · Error with retry · Loading skeletons · Mock badge.

**Adapter:** calls `exportCsv`. Listens to `payment.settled`, `refund.settled`, `order.updated`.

**Backend-ready structure:** the cards and the log are derived from settled payments and refunds in the snapshot and the events, filtered by the period; nothing is stored separately. The CSV is built from the same derived rows, so it always matches the screen. The period and the file name come from the page state.

**Added beyond the brief (from the reference wireframe for M6, see the Appendix):**
- The "Export ready" state and the explorer link on every row of the CSV.
- The period selector (needed to define the export range).

**Open questions:** none yet.

- [ ] Layout · [ ] All states · [ ] Wired to mock adapter

---

## M7. Shop desk (not in the menu; not built for now)

**Purpose:** chat with the shop's own agents (storefront, risk, dispatch), for example "Why did you flag this buyer?".

**Content:** TBD

**States to design:** the shared states only (this page is not built for now).

**Adapter:** calls `sendMerchantPrompt`. Listens to `agent.message`.

**Open questions:** none yet.

- [ ] Layout · [ ] All states · [ ] Wired to mock adapter

---

# Appendix: reference wireframe values for the merchant pages

These are the values from the owner's reference wireframes (a build guide's "Screens" tab) so you do not need that file. They are **sample data for layout and copy**, not a spec; where they differ from the page sections above, the page sections win. "Calls" are `DemoAdapter` methods and "events" are `DemoEvent` types (both in `DESIGN_INSTRUCTIONS.md` Appendix A).

**M1 Shop home.** Bar: "Kesar Kingdom", "Open, sound on". Toggle: "Shop open". Stats: Today 36.00, Orders 9, Refunds 1. Rows: "New order from payer.priya…" 4.00; "Renewal from vikram…" 4.00. Call: `setShopOpen`. Events: `merchant.notification`, `order.updated`. States: closed; open with sound; empty day.

**M2 New order pop-up** (merged into M1 in our design). Bar: "New order", "Just now". Card (green): "payer.priya.graphpay.eth", "Owner: priya.graphpay.eth", "42 orders, 0 refunds, since 2025", "Risk agent: safe to accept". Rows: "Gulab jamun × 6" 4.00 USDT; "Payment" with "View transaction". Button: "Dispatch". Note: plays a chime when it arrives. Call: `dispatch`. Events: `merchant.notification`, `payment.settled`. States: arriving (chime); risk agent warns; dispatched.

**M3 Order detail.** Bar: "Order 1042", "Priya, via payer agent". Timeline: Paid ✓, Dispatched ✓, Delivered (not yet). Row: "Payment" with "View transaction". Buttons: "Dispatch", and in the wireframe "Refund full" and "Refund partial" (our design shows a single "Refund" button instead). Calls: `dispatch`, `approveRefund`. Events: `order.updated`, `refund.settled`. States: each stage; refunded with link.

**M4 Refund requests.** Bar: "Refund requests", "1 waiting". Card (amber): "Order 1042, asks 1.00 USDT", "Two pieces were squashed", "Photo attached". Buttons: "Approve 1.00 USDT", "Approve another amount", "Decline with a note". Calls: `approveRefund`, `declineRefund`. Events: `refund.requested`, `refund.settled`. States: empty inbox; approved, settling; declined.

**M5 Renewals and customers.** Bar: "Renewals". Rows: "priya.graphpay.eth" Sun; "vikram.graphpay.eth" Daily. Note: "Tap a customer to see their history". No calls. Events: `renewal.created`, `renewal.charged`, `renewal.cancelled`. States: empty; charged today.

**M6 Payouts and export.** Bar: "Payouts". Stats: Received 36.00, Refunded 1.00, Net 35.00. Rows: "Order 1042" with "View transaction"; "Refund 1042" with "View transaction". Button: "Export CSV". Call: `exportCsv`. Events: `payment.settled`, `refund.settled`. States: empty period; export ready.

**M7 Shop desk (not built for now).** Chat with the shop's own agents, for example "Why did you flag this buyer?". Call: `sendMerchantPrompt`. Event: `agent.message`.

**Story journeys** that touch the merchant app are in `DESIGN_INSTRUCTIONS.md` section 13. The customer's side of each journey is in `DESIGN_CUSTOMER_APP.md`.
