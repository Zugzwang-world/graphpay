# Booth demo note

Fri 6 Nov, about 18:45 IST. The live site https://graphpay-event.vercel.app is ready to demo on a laptop or projector (width 1200 or more).

## What works
- **One screen, no page scroll.** Vitalik's phone on the left, Filter & Fold's phone on the right, both fully visible; the middle is the draft deck. Panels scroll inside themselves. On a real mobile phone it is one phone per page, as before.
- **The middle has a Story / Live run switch.** Story is the draft deck with Back and Next (it has Vitalik, masala dosa, Filter & Fold, Idli Index and Tawa Tangle). Live run is the explainer with its explorer chips (concierge to scout and the rest). A request switches the middle to Live run; the deck returns 12 s after the run ends, or after 4 minutes if the run's stream drops. Tap Story or Live run to choose by hand.
- **The errand.** "Just landed in Mumbai. Get me the best masala dosa near BKC under 6 USDT by 8 pm." The analyst's ranking excludes Tawa Tangle (refund rate 18.5%, on-time 71.3%), then Filter & Fold is paid 4.80 USDT, no gas. Both errands today paid and were delivered (orders 0x52aa… and 0x37a3…).
- **The team's pause and resume.** Menu, then Agents and Spending Pass, then the Payer card: Pause sets the payer to PAUSED on Sepolia; Resume sets it back (about 35 s). Tested once on production; the payer is active.
- **Refund (Request refund on the customer phone; Refund on the shop phone), Open toggle, Mark dispatched.**

## What not to tap
- **Re-order.** Not retested since the story swap. In the story it is now one more masala dosa combo at 4.80 (it was 3 sweets at 1.20), so it would spend 4.80.
- **Revoke, Change cap, "Let the agent try to raise its own cap".** The team's buttons exist but the live adapter does not wire them yet; they show an error or do nothing.
- **Pause or Resume on Concierge, Scout or Analyst.** The live adapter acts on the payer only, whichever card you tap. Use the Payer card.
- **Subscribe and Cancel** (no hosted subscription endpoint).

## Things to know
- The phone's result frame can fail to arrive: in two tests the errand paid and was delivered, but the stream closed before its result (the phone then says "The errand stream ended before its result. Try again."). Do not tap Try again: the payment already happened. If it says "busy: one errand at a time", the first is still running; wait about 2 minutes.
- ENS names stay the old ones (kesar-kingdom, syrup-street, jamun-junction), so the traces and the deck's tables show them next to the new display names.
- The deck's sweets photo and menu pictures are still the sample sweets. The category in Arkiv is still "sweets".
- The Sunday breakfast box is shown at 2.40 in the deck and its menu; the phones' renewal line still shows 0.40, the price the live subscription was created with.
- The payer has spent 39.60 of its 100 USDT today (two errands today were mine: 9.60).
