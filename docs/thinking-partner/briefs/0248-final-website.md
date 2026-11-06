# Brief: the final website, one story on one screen

From the thinking partner, via the founder, Sat 7 Nov. For: one new Claude Code session in its own worktree, Opus 5.5 Max. File it in `docs/thinking-partner/briefs/` with your time prefix.

This brief merges the backend's final input with the founder's screen-by-screen walk. It is the last build before the video. When you finish, stay open: the founder refines the site with you in this chat.

## 1. Goal

The stage at https://graphpay-event.vercel.app tells one story in eleven scenes, numbered 0 to 10 (section 5).
- The middle is the pitch. Vitalik's phone and Filter & Fold's phone are the live demo. All three move together, as one screen.
- Every payment is a real transaction, and every claim links to a public record.
- Nothing outside the story stays on the stage.
- Few words, top-quality motion, nothing clipped.

## 2. Read first

- **`docs/thinking-partner/BACKEND_FOR_FRONTEND.md`** is the contract. Read its sections 1 (routes), 3 (events), 4 (the errand's step frames), 5 (Swarm), 6 (race numbers), 7 (ENS names and link formats), 8 (constraints) and 10 (known issues). Then read only the files you need.
- **`docs/submission/VIDEO.md`:** its rules stand (the founder's own voice, 2 to 4 minutes, never sped up, every party shown). Its shots table is replaced by section 5 (the task is in section 10).
- **For the Proofs list (section 4):** the links are in `docs/thinking-partner/NOW.md` and the w1-identity, w3-payments and w4-agents relays.

## 3. Hard rules

- **Restyle and wire only.** The backend is closed: no route, contract or data change.
  - The one new write is the refund photo to Swarm's public gateway (scene 5).
  - If a must-have truly needs a backend change, report it to the founder instead of making it.
- **Story values come from `packages/config/story.json`** through the phones' projection. Never hard-code a name, price or address, and that includes the agents' line templates.
  - If a value you need is missing, add it to `story.json` in its own small PR and tell the Coordinator.
- **You may edit `frontend/`, the team's app,** tonight. Keep their components and visual language, and credit the team's design in PR descriptions.
- **One screen at 1440×900 and 1920×1080:**
  - no page scroll;
  - both phones and the middle always fully visible;
  - panels may scroll inside themselves;
  - nothing clipped at the bottom, no text overlapping anywhere.
- **The phones drive the middle.**
  - After the demo, arrow keys (or a clicker) only browse.
  - The middle never acts on the phones.
  - The stage paces what is displayed, but it never triggers a request or a payment.
- **Public access:** no passcode anywhere.
- **Claim only what is live:**
  - race mode is at size S, 2 reads against 5;
  - the 48-against-2 figure is labelled "lab";
  - the big city M is not raced;
  - the demo store is not deployed, so don't link it;
  - nothing says "mock";
  - no raw error reaches the screen.
- **Our honesty rules:**
  - no "encrypted photo";
  - no claim that the Arkiv request points to the photo;
  - lead with reads, not speed;
  - show a record link only once that record exists.
- **The live errand works after every merge.** If a merge breaks it, revert first, then fix.
- **Copy:**
  - the dosa story only: no sweets, no "Ask before you pay" anywhere (the header included);
  - sentence case and plain verbs;
  - errors say what happened and what to do, in plain words.

## 4. The frame, on every scene

### Top bar

Left to right:
1. The GraphPay wordmark, with no tagline.
2. Labelled links to GraphPay's own public records:
   - **ENS:** the graphpay.eth name page.
   - **Whitechain:** the checkout contract's transactions.
   - **Arkiv:** our writer wallets' entities (the mirror, the directory, the sync writer).
   - **Swarm:** the three menus.
   - **Facilitator:** its health page, linked only if it answers without a token.
3. **Proofs:** a list that opens on click, with each live feature labelled by its activity and its links:
   - the kill;
   - over the pass ("Dosas for everyone");
   - the agent's own cap raise;
   - the owner's cap change;
   - the Sunday box: subscribe, renew, cancel;
   - another coffee;
   - a declined refund;
   - the first errand under the new name, and W4's three errands in a row.
4. **This run:** chips added as the demo happens, each with its activity, network and age, for example "Paid 4.80: Whitechain, 12 s ago". Show the latest few, with the rest one click away.
5. **Top right:** the GitHub repo link only.

Remove from the top bar: the chain heights, Mirror lag, Relayer, the USDT pill, Sound, Map, Race mode and How it works.

### Navigation

- No bottom strip and no Back, Next or Replay buttons, on any scene.
- Arrow keys or a clicker browse scenes 7 to 10, and go back.
- Esc returns the stage to scene 0. It changes the display only.

### Vitalik's phone (one screen, no menus, no chat box)

- **Header:** name, live status and pass. Status comes from `/api/state/customer`; fix "Agents active" showing while the payer is paused.
- **The conversation:** agent lines with inline cards (shops, menu, bill, receipt, refund, the payer's switch). The panel auto-scrolls to the newest line.
- **An activity row:** Find, Pay, Refund, Pause. Each item lights green when it happens, and turns red when blocked.
- **Pause and Resume** sit on the tapped card, for the payer and scout only. They are hidden on the other agents. Show the self-healing time from `/api/state/heal`.

### Filter & Fold's phone (one screen, no order log)

- **Header** with the Open switch.
- **Its three agents as a team:** storefront, risk, dispatch.
- **Its own conversation and cards:** the bill, the refund request, the refused payment.
- **Today's earnings,** small.
- **The merchant fold:** add the `dec:` branch in `apps/phones/src/orders.ts`, and show refused attempts (`att:`) and declines. Make repeat buyers optional.

### Agent messages, on both phones

- Larger type and clean formatting. Lines appear one at a time, in order.
- Dish and storefront photos sit inside the messages where they are named.
- No raw hashes: write "Order #4B28" and give a link.
- No "Thinking…" states. An agent's line appears the moment its scene starts.

### Every chain link

- Shows its network and how long ago it happened, from the event's own timestamp, for example "Whitechain, 1 min ago". Refresh the ages.

### Design

- Keep the stage's palette, typefaces and the team's phone style.
- Spend the boldness on motion: the scene 0 film and the scene transitions.
- Avoid template tells: all-caps eyebrow labels, middle-dot meta strings, arrows appended to links, identical card kits.
- Respect reduced motion.

## 5. The scenes: the sync contract

### How the sync works

- **One scene table.** Keep one table, like `apps/web/lib/deck-map.ts` today, as the single source: scene, beat, trigger, minimum dwell, and what each pane shows. Give it a test.
- **The 11 scenes replace the 19-slide deck.** The deck's hard-coded story object goes; every value comes from the projection or from live data.
- **A director on `/live`:**
  - It reads the errand frames (`graphpay.run-frame`), the phone events (`graphpay.phone-event`) and the merchant stream.
  - It queues them in errand-step order, not lane order, so it cannot jump past the check back or the quote.
  - It enters a scene only when its trigger has fired and the previous scene's minimum dwell has passed.
  - Tune the dwell so the whole pitch fits four minutes: about 25 s for scene 0 if not tapped sooner, about 75 s for scenes 1 to 4, about 25 s each for 5 and 6, and about 20 s each for 7 to 10.
- **Two new messages:**
  - `graphpay.scene` (stage to both phones): the current scene and beat, for display only.
  - `graphpay.relay` (stage to the shop's phone): the real data a customer-side response just returned.
- **Instant, then confirmed:**
  - Show each result the moment its real answer arrives, from a run frame or a route's answer.
  - Add its Arkiv link when the merchant stream's edge lands, which can lag minutes while the Arkiv key's quota is spent.
  - Until then, say "writing to Arkiv".
- **Each phone event moves the middle exactly once.** Today a refund moves it twice.
- **A `failed` frame shows the failure in plain words,** never a stale run.
- **"Busy: one errand at a time"** shows as "Another errand is running. Try again in a minute."
- **Timing:** an errand takes about 45 s on production, mostly the 402 write and the settlement. The scenes' dwell fills that time. Never show a spinner.

### Scene 0: Opening film

- **Trigger:** page load. It loops, and a tap on the bubble stops it at any moment.
- **Vitalik's phone:** his desk at rest. The story's request (`story.json` `order.request`) sits as one big bubble that floats and pulses, with "Live demo" under it. The tap sends it: POST `/api/agents/run`.
- **Middle:** a 20 to 30 second film with Grok's figurines and almost no words, built in code from the figurine images:
  1. Agents on two sides pass coins in a fast zigzag.
  2. Vitalik's concierge, the green-caped smiley, zooms in big with a "?": who is it, and who controls it?
  3. Zoom out: every payment drops a row into a database that keeps growing.
  4. A question arrives, and a pointer crawls through the pile.
  5. Three words land: Identify (ENS), Remember fast (Arkiv), Pay (Whitechain). Then "GraphPay".
- **Filter & Fold's phone:** storefront, risk and dispatch idle; the shop open; today's earnings.

### Scene 1: Two teams

- **Trigger:** `started`, then the concierge's messages to the scout and the analyst.
- **Vitalik's phone:**
  - The bubble becomes the sent message.
  - The concierge is shown large while it speaks; the others are small.
  - Find turns green.
- **Middle:**
  - The ENS hierarchy as a drawn tree, not a list: graphpay.eth splits into vitalik.graphpay.eth with four agents, and filter-and-fold.graphpay.eth with three.
  - Each node opens its ENS page.
  - Each node lights up as its agent wakes.
- **Filter & Fold's phone:** its three agents as a team, idle.

### Scene 2: Finding the best shop

Three beats, each a complete screen, with no clicks.

**2a: the plain way**
- **Trigger:** the scout's `directory_list` and `catalog_read` results.
- **Vitalik's phone:** three shop cards slide in, each with its storefront photo in full, from Swarm, with its Swarm link, and its price.
- **Middle:**
  - The receipts as a plain table, four columns: key, payer to shop (ENS names), USDT, type.
  - Rows link to their Whitechain transaction (from the edge `ref`), and names link to ENS.
  - The header links the Arkiv explorer query for these rows.
  - A read pointer pages down the table while counters climb: reads, receipts, KB.
  - Seeded rows carry a "Sample data" mark.
- **Filter & Fold's phone:** unchanged.

**2b: two queries**
- **Trigger:** the analyst's `graphql` result.
- **Vitalik's phone:** each card gains its scoreboard: orders, refund rate, on time.
- **Middle:**
  - Plain Arkiv, side by side with GraphPay. Plain Arkiv pages through every receipt and adds them up in the app, every time. GraphPay reads each shop's scoreboard, which is kept current in the same write as each payment.
  - Show this run's real GraphQL query, its read count and its entity keys, from its explain trace. Fetch `/api/explain/<id>` at once, because ids live in one server instance only.
  - The plain side's count is the measured race: 5 reads at size S.
- **Filter & Fold's phone:** unchanged.

**2c: the graph**
- **Trigger:** the analyst's "best eligible" message.
- **Vitalik's phone:**
  - The ranking: the best shop first, the trap rejected in red with its refund rate.
  - The chosen shop's menu opens, with dish photos from Swarm and each photo's Swarm link.
  - The chosen item lights up.
  - Find is done; Pay turns on.
- **Middle:**
  - The same receipts as a graph: ENS names are the nodes, payments are the lines, refunds are red.
  - Every node carries its scoreboard, Vitalik's payer included, and opens its Arkiv entity.
  - The three story shops are drawn large, the trap in red.
- **Filter & Fold's phone:** the storefront wakes, and the quote request arrives.

### Scene 3: The shop checks the buyer back

- **Trigger:** the risk agent's `ens_check` and `ask` results, guard G9, and its approve or decline.
- **Vitalik's phone:** the payer asks for the bill and waits.
- **Middle:** one simple picture, "Who is this buyer?", with two answers. Each answer sits inside its own node, and the links sit inside the nodes, not as chips below:
  - from Arkiv: the payer's scoreboard;
  - from ENS: its owner and its status.
  - Then the real verdict.
- **Filter & Fold's phone:** its agents talk like Vitalik's do: storefront to risk, risk with the graph's numbers and ENS's answer, then the verdict, then "Sending the bill".

### Scene 4: The bill and the payment (x402)

- **Trigger:** `get_quote`, the 402, guard G5, the signature, "settled", `pay_order`, then `result`.
- **Vitalik's phone:**
  - The bill card: dish photo, price, pay to the shop's ENS name.
  - The payer checks the pass and signs once.
  - Then the receipt card (keep the current one): paid, the Whitechain link with its age, "Gas paid by GraphPay, you paid 0".
  - Pay is done.
- **Middle:** the x402 sequence lane by lane: payer, shop, our facilitator, ENS, Whitechain, Arkiv.
  - Each arrow that has a frame appears on that frame.
  - The facilitator's verify and its ENS check have no frame of their own. They play between the signature and the settlement, drawn as the protocol's steps.
  - The settle arrow carries the Whitechain link. The Arkiv arrow gets its link when the edge lands.
  - The sequence plays only when the payment really happens.
- **Filter & Fold's phone (instant, via `graphpay.relay`):**
  - A full bill is created: order number, item with photo, amount, from the payer's ENS name, and "Received" with its Whitechain link.
  - The receiving agent pops; dispatch says it is on its way.
  - Earnings update.

### Scene 5: The refund, with a photo on Swarm

- **Trigger:** the presenter taps Refund on Vitalik's phone, then Accept on the shop's phone.
- **Vitalik's phone:**
  - One refund card: the story's reason and amount (the coffee), and one tap to attach the photo.
  - The photo is the filter-coffee dish photo the phones already serve.
  - **Upload it from the browser** to Swarm's public gateway, the way the menus were uploaded: `POST /bzz?name=<file>`. Then show "On Swarm" with its link, `/bzz/<ref>/<file>` (a bare `/bzz/<ref>` redirects to a forbidden page). If the browser cannot upload, use that same photo's existing Swarm reference from `docs/sessions/arkiv/swarm-menus.json`, and say "On Swarm", not "uploaded". Report which one you used.
  - Then POST `/api/customer/refund-request`.
  - Then "Refunded 0.80" with its Whitechain link.
  - Refund turns green.
- **Middle:** one continuous flow, no step clicks, every hop with its network and link:
  - the photo to Swarm;
  - the request to Arkiv (its `arkivTx` and `entityKey`);
  - the shop's acceptance;
  - the money back on Whitechain;
  - the shop's scoreboard, refunds +1, once its edge lands.
- **Filter & Fold's phone:**
  - The request pops up instantly, with the photo loaded from Swarm (the reference arrives via `graphpay.relay`).
  - It is confirmed by the `req:` edge.
  - Accept and Decline:
    - Accept calls POST `/api/merchant/refund`;
    - Decline calls POST `/api/merchant/refund-decline` and works off camera.
  - Earnings update.

### Scene 6: The renewal and the off switch (the demo ends here)

The stage cannot force a renewal on cue: the cron renews on its own 2-minute clock, at most 3 charges, and the backend is closed. So this scene shows the last real renewal, the live pause, and the payer's next payment refused live.

- **Trigger:** the presenter flips the payer's switch.
- **Vitalik's phone:**
  - The payer is large, the others small.
  - A notice: "Sunday breakfast box renewed: 2.40", the latest real renewal from `/api/state/customer`, with its Whitechain link and age.
  - The switch calls POST `/api/customer/pause` with the payer's ENS name, and shows the Sepolia link.
  - Show "Paused" only once `/api/state/customer` reports PAUSED (it takes up to 20 s), with "Resumes by itself at …" from `/api/state/heal`.
  - **Only after PAUSED,** the phone itself tries the payer's next payment: the story's re-order, POST `/api/customer/reorder` with the newest order.
  - Show its real refusal in plain words, for example "Refused: the payer is paused on ENS", with its link if the refusal was recorded.
  - Pause turns red.
  - **Never try this payment while the status is ACTIVE: it would pay.**
- **Middle:**
  - The payer's ENS card: payer.vitalik.graphpay.eth, its owner, its own resolver, the status record flipping from active to paused live (Sepolia link), and the cap, which only the owner can change.
  - Then the attempt's path: the check asks ENS, the answer is "paused", the payment is refused and nothing is sent.
- **Filter & Fold's phone:** "Payment from payer.vitalik.graphpay.eth refused: payer paused. Nothing received."
- **Verify this path once on production before it goes on camera.** If it does not give a clean refusal, keep the pause, drop the attempt, and report.

### Scene 7: What we proved, Arkiv

- **Trigger:** the arrow key.
- **Middle:**
  1. One payment written: one transaction writes the line, both scoreboards, the pair link and an anchor (about 0.00031 tGLM, lab). The shop's scoreboard ticks.
  2. **The race, live:** GET `/api/race?question=Q2&mode=…&size=S`.
     - Say what Q2 is: the top shops by sales, synthetic city, size S.
     - Plain Arkiv's pointer crawls the pages; GraphPay reads two scoreboards.
     - The counters come from the real `call` frames. Skip the first `call` frame without `ms`.
  3. **Bold metrics:** reads 5 to 2 (live, size S); 48 to 2 (lab, 9,612 payments); bytes. Speed is not the headline.
  4. **The arkiv-graph card,** like a real npm page: the name, the version read from the npm registry, `npm i @graphpay_ethglobal/arkiv-graph`, one line on what it does, and links to npm and its README.
- **Phones:** Vitalik shows his payer's scoreboard; Filter & Fold shows its scoreboard (orders, refunds, refund rate).

### Scene 8: What we proved, ENS

- **Middle:**
  - The point: every agent has its own name, an owner and an off switch.
  - The ENSv2 features we use, each with its proof link:
    - **the hierarchy:** graphpay.eth, then the owners, then the agents, on both sides;
    - **our own subname registry;**
    - **access control:** an agent edits its own description, and its own cap raise reverts with `EACUnauthorizedAccountRoles`;
    - **a resolver per agent;**
    - **the off switches:** pause (this run's link), and the kill (unregister, revoke, refused);
    - **the owner's cap change;**
    - **names as keys:** every payment names the shop by its namehash (the 01:07 errand), and the graph's nodes are ENS names, so agents and shops are found and retrieved by name.
- **Phones:** each agent with its ENS name and its switch.

### Scene 9: What we proved, Whitechain

- **Middle:**
  - Two columns:
    - **What people see:** pay, refund, re-order, renew, cancel, export. Each is one tap, with no wallet and no gas.
    - **What runs underneath:** USDT on Whitechain Sepolia, one checkout contract, gas paid by our relayer, identity from ENS, memory on Arkiv.
  - **Proof links:** this run's payment and refund; the subscription (subscribe, renew, cancel); another coffee; the declined refund; and the checkout contract on the explorer.
  - **The agentpay card,** like scene 7's: `npm i @graphpay_ethglobal/agentpay`, with the version read from npm.
  - No store link.
- **Phones:**
  - Vitalik: a plain payment history (paid, refunded, renewal, refused).
  - Filter & Fold: a plain merchant view (received, refunded, renewals, an export that retries once).

### Scene 10: Close

- **Middle:**
  - "Agents that decide fast, pay safely, and can be stopped."
  - Told with the figurines and three small graphs, not paragraphs: reads (5 to 2 live, 48 to 2 lab), 0 gas for the payer, one tap to stop.
  - The GitHub repo and both npm names.
  - **Builder photos:** add a strip only if `~/Downloads/GraphPay-builders/` holds photos; the founder confirms each person's consent.
- **Phones:** both replay this run's real steps in fast motion, in step (order, bill, paid, refund, refused), with the real links.

## 6. The agents' lines

The lines are templates in code, with every value taken from the frames or `story.json`. The model's own wording never shows. Keep each line short:

| agent | line |
|---|---|
| Concierge | "On it. Scout: find {dish} near {area}. Analyst: check their records. Payer: stand by." |
| Scout | "{n} shops near {area}." (with storefront photos) |
| Analyst | "{best}: {orders} orders, {refundRate} refunds, {onTime} on time. {trap}: {trapRefundRate} refunds, rejected." |
| Concierge | "Order 1 × {item} from {best}, at most {budget} USDT, within the hour." |
| Payer | "Bill: {price} USDT, inside today's pass. Signing once." Then "Paid {price}. Arrives by {eta}." |
| Storefront | "New buyer: {payerEns}. Check them?" |
| Risk | "Graph: {paid} paid orders, {refunds} refunds. ENS: owned by {owner}, {status}. {verdict}." |
| Storefront | "Sending the bill: {price} USDT." |
| Dispatch | "On its way, arriving by {eta}." |

Write the refund and pause lines in the same style.

## 7. Work order

Risk first, so that an early stop still leaves a working demo. Merge each step and check it live before the next.

1. **The frame:** the one-screen layout, the top bar, no strip, the larger message type, the hygiene.
2. **The director and scenes 1 to 4,** the errand: both phones and the middle together.
3. **Scene 5.**
4. **Scene 6,** including its one production check.
5. **The scene 0 film.**
6. **Scenes 7 to 10.**
7. **Polish:**
   - hide everything not in the story;
   - the team's copy in the dosa story;
   - null values show nothing rather than "—";
   - the CSV export retries once.

## 8. Execution and token discipline

- Sized for about one hour, unattended, with no stops between steps.
- **Models:** Opus 5.5 Max for the main agent only. Sub-agents only for mechanical work (searching, copy swaps, tests, screenshots), on a lower model or effort.
- **Develop on the team's mock adapter.** Use live errands only to prove a step, about five at most. Each costs Kimi credit and 4.80 test USDT, and only one runs at a time.
  - The payer's pass is 300 a day and resets at 05:30 IST.
- **Keep Arkiv reads light.** No polling loops in tests until the fresh Arkiv key is in. Payments always settle, but the feed can lag.
- **Small PRs with auto-merge.** Run the reviewer agent on anything that calls a money route: scene 5's refund calls and scene 6's attempt.
- **Do not touch** the contracts, the payment routes, the mirror, or the workers that W5's watchdog runs on the founder's Mac.
- **Visual QA in Chrome at 1440×900 and 1920×1080:**
  - a screenshot of every scene, and of each beat of scene 2;
  - fix anything clipped, overlapping or stale before you stop;
  - save the 1440×900 set in `docs/sessions/website/qa/`.

## 9. Done when

On the production URL, in Chrome at 1440×900 (and checked at 1920×1080), with no login:
- One screen, no scroll. Both phones and the middle are fully visible on every scene, with nothing clipped or overlapping.
- Scene 0 loops, and a tap on the bubble starts the demo at any moment.
- One live errand, in which:
  - the middle follows scenes 1 to 4 in order, in step with both phones;
  - every chain link opens a real explorer page;
  - the shop's phone shows the bill.
- The refund (the photo on Swarm, with an opening link, then the shop's acceptance) works once, moving the middle once. Decline works once, off camera.
- The pause, with its Sepolia link and self-healing time, and the refused payment each work once.
- Scenes 7 to 10 show live or labelled numbers and both npm cards at the registry's version.
- Every word comes from the dosa story: nothing stale, nothing "mock", no tagline.
- Every link in the top bar and the Proofs list opens.

## 10. End gracefully

- Everything merged and live: the payer active, the shop open, the stage on scene 0.
- **`docs/sessions/website/video-script.md`:** one page, for the founder's clicks, with no narration:
  - the setup checklist, including how to get a fresh Sunday box renewal minutes before recording, from `/customer`, not from the stage;
  - then, per scene: what to tap, what to wait for, and what it proves.
- **`docs/submission/VIDEO.md`:** replace its shots table with scenes 0 to 10 (time, on screen, proves). Drop the "say" column, because the founder writes his own words. Keep its rules.
- **An ADR, "The stage tells one story":**
  - scenes 0 to 10 replace the deck's 19 slides;
  - the extra live features become proof links;
  - the agents' lines are templates filled with live values.
- **One line in `AI_USAGE.md`:** the phones show fixed agent lines filled with live values, while the three model calls still make the decisions.
- **Records:**
  - `docs/thinking-partner/relays/website.md` (under 800 words);
  - NOW and LOG lines;
  - a resume file, `docs/sessions/website/resume.md`.
- **Tell the founder the website is final.** Then stay open for his refinements, and keep the relay current after each merge.
