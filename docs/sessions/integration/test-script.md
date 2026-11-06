# The founder's run: click by click

The whole cycle on the production site, in a private window with no login. Testnets only; every amount is test USDT. Times are typical, not promises.

Before you start:
- The payer agent must be **active**, not paused. Check https://graphpay-event.vercel.app/api/state/customer: `"status":"ACTIVE"`.
- The payer's pass is 100 test USDT a day; it resets at 05:30 IST.
- One errand runs at a time. If someone else's is running, the phone says so; wait a minute.

## 1. Open the stage

1. Open https://graphpay-event.vercel.app in a private window. The home page is the stage: Vitalik's phone on the left, Kesar Kingdom's phone on the right, "What just happened" in the middle.
2. Check: no passcode is asked for anywhere, and nothing on screen says "mock".

## 2. Open the shop (the Open switch)

1. On Kesar Kingdom's phone, tap the **Shop closed** switch.
2. Expect within a few seconds: the switch reads open, and the shop's home is no longer dimmed.
   - The shop is listed as open on Arkiv for 15 minutes and renewed every 5 minutes while the page stays open.

## 3. The errand: Vitalik's ask

1. On Vitalik's phone, tap the purple prompt "Just landed in Mumbai. Get me the best gulab jamun…".
2. Watch Vitalik's phone (about 2 minutes):
   - the Concierge, Scout and Analyst say what they are doing;
   - "Asked GraphPay: 3 shops, answered in N reads", with **See every Arkiv read**;
   - three shop cards: **Kesar Kingdom, Chosen**; Syrup Street; **Jamun Junction, Rejected**: its refund rate is above 10% and its on-time rate below 80%;
   - the quote sheet opens: 4.80 USDT, then signed, then **paid**, with **View transaction on Whitechain Sepolia**.
3. Watch the middle: the steps light up in order (the agents think, the 402, the signature, the settlement, the contract event, the Arkiv write, the GraphQL answer) and the agent lanes fill.
4. Watch Kesar Kingdom's phone: the new 4.80 order appears in today's log with a **New** marker, the buyer's ENS name and its record.
5. Tap **View transaction**: the Whitechain explorer opens on the real transaction.

## 4. Dispatch

The shop dispatches a paid order on its own about 6 seconds after payment, so a fresh order already reads **Delivered** on both phones. The Dispatch button appears only on an order that is still waiting.

## 5. Refund request, then refund

1. On Vitalik's phone, open the menu, then **Orders**, then the newest order (4.80), then **Request refund**.
2. Choose an amount below 4.80 (for example 0.80), type a reason, and send. Only the newest order can be refunded from here.
3. On Kesar Kingdom's phone, open **Refund requests**: the request shows as waiting. Tap **Approve**, then **Confirm**.
4. Expect: both phones show the refund as Refunded, with its transaction link.
   - **Known issue (16:50 IST):** the approval answered "the refund could not be sent" twice, and nothing was sent. The route's owner is on it. Skip this step until OPEN says it is fixed.
   - Refunds and dispatches act only on Vitalik's orders, and one order can be changed at most once every 30 seconds.

## 6. Re-order

1. On Vitalik's phone, in Orders, open the order and tap **Re-order**.
2. Expect: a paid re-order of 3 pieces (1.20) with its transaction link, and a new order on the shop's phone.
   - **Known issue (16:55 IST):** the re-order was refused with `BAD_402`, and nothing was paid. The route's owner is on it.

## 7. Pause and resume

The team's phone has no pause button yet; use the site's own customer screen.
1. Open https://graphpay-event.vercel.app/customer and tap **Pause my agent**. Expect a Sepolia transaction link; the status reads Paused.
2. Tap **Resume my agent** (wait 20 seconds between the two). Expect Active again.
   - While paused, an errand is refused before any payment ("The agent is paused").

## 8. The menu image (Swarm)

Kesar Kingdom's gulab jamun has an image on Swarm (the team's fox), read through the shop's menu row on Arkiv: https://api.gateway.ethswarm.org/bzz/c58e8183bd299aedf9212284e47986626c6d580657aa416ea2c2dd924f51163b/menu-image-fox.svg. The phones carry it as the product's image; it shows on Vitalik's phone once the team's order and quote screens draw product images (OPEN, phones section).

## If something goes wrong

- **"Another errand is running right now"**: wait a minute and tap again.
- **"The agent is paused"**: resume it (step 7).
- **The errand stops with an error**: tap **Try again** once. Each errand costs real model credit, so don't loop it.
- **An order doesn't appear on the shop's phone**: it arrives from the money graph within about 10 seconds; reload the page once.
