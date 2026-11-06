# Booth demo note

Fri 6 Nov, about 18:45 IST (updated 20:25 IST, sync). The live site https://graphpay-event.vercel.app is ready to demo on a laptop or projector (width 1200 or more).

## What works (updated 19:20 IST, part 2)
- **One screen, no page scroll.** Vitalik's phone on the left, Filter & Fold's phone on the right, both fully visible; the middle is the draft deck. Panels scroll inside themselves. On a real mobile phone it is one phone per page, as before.
- **The middle is the deck, and it follows the run.** During an errand the deck moves to the matching slide at each step (the ask, the team, the check, the check back, the 402 quote, the payment, the record on Arkiv). A strip at its bottom shows "step n of 7" and that step's explorer chips (the handoff records, the settlement, the order's trail on Arkiv, exact reads). After the run it stays on the last slide with the real links. Back, Next and "Replay the last run" work at any time; there is no Live run tab any more.
- **Grok's figurines and photos in the phones.** Each agent shows its figurine for its state (idle, thinking, talking, success, refused; a bob while thinking); dish photos and storefront photos are on the shop comparison cards, the quote sheet and the order cards. The customer phone has no menu screen, so the menu shows no photos. Photos are served from our site (`/phones/grok/`).
- **A dropped stream no longer offers Try again.** The phone re-attaches to the run by its id, then reads the payer's newest order, and shows the paid card. If both fail it says the errand may have paid and offers no retry.
- **The errand.** "Just landed in Mumbai. Get me the best masala dosa near BKC under 6 USDT by 11:59 pm." The analyst's ranking excludes Tawa Tangle (refund rate 18.5%, on-time 71.3%), then Filter & Fold is paid 4.80 USDT, no gas. Both errands today paid and were delivered (orders 0x52aa… and 0x37a3…).
- **The team's pause and resume.** Menu, then Agents and Spending Pass, then the Payer card: Pause sets the payer to PAUSED on Sepolia; Resume sets it back (about 35 s). Tested once on production; the payer is active.
- **Refund (Request refund on the customer phone; Refund on the shop phone), Open toggle, Mark dispatched.**

## What changed in sync (20:25 IST)
- **The phones drive the deck.** Each errand step moves the deck to its slide (the ask, the team, the check, the check back, the quote, the payment, the record). So does each phone event: a refund request and the shop's refund go to "A refund, with proof" (the refund shows its Whitechain link); Pause goes to "Stopped, live" with its Sepolia link and Resume returns the deck to where it was; the shop's Open switch goes to "Two desks, two teams"; a renewal goes to "Every way a business gets paid". The strip under the deck shows the slide's own title, so the two always agree. Back and Next only browse (the strip follows); the deck never acts on a phone; "Replay the last run" replays the deck only. The table is `apps/web/lib/deck-map.ts`.
- **Figurines** are large, with no ring, crop or badge; the state image carries the status, with a bob while thinking.
- **No QR codes.** The deck has that height.
- **The deadline.** The request now says "by 11:59 pm". "By 8 pm" made every errand after 19:15 IST end with "No purchase this time": the good shop needs 45 min, so the guard refused every shop. It works again until about 23:14 (and again after midnight).
- A refund needs a photo on the phone (the Add a photo step); on a laptop pick any image file.

## What not to tap
- **Re-order.** Not retested since the story swap. In the story it is now one more masala dosa combo at 4.80 (it was 3 sweets at 1.20), so it would spend 4.80.
- **Revoke, Change cap, "Let the agent try to raise its own cap".** The team's buttons exist but the live adapter does not wire them yet; they show an error or do nothing.
- **Pause or Resume on Concierge, Scout or Analyst.** The live adapter acts on the payer only, whichever card you tap. Use the Payer card.
- **Subscribe and Cancel** (no hosted subscription endpoint).

## Things to know
- The stream that dropped in part 1 (the browser pane at about 25 s, curl at 111 s) did not drop in a normal Chrome window: the live errand of part 2 ran its full length with the result on both phones. The cause is not proven (the keep-alive is now every 5 s; the run lives in one server instance's memory, so a replay by id can miss on another instance, which is why the phone also reads the newest order). If "busy: one errand at a time" shows, the first errand is still running; wait about 2 minutes.
- ENS names stay the old ones (kesar-kingdom, syrup-street, jamun-junction), so the traces and the deck's tables show them next to the new display names.
- The deck's sweets photo and menu pictures are still the sample sweets. The category in Arkiv is still "sweets".
- The good shop's combo is "Ghee roast masala dosa + filter coffee" on the phones and the menu; the agents and the quote call it "masala dosa" (a `short` field), so the traces still say masala dosa.
- The Sunday breakfast box shows 2.40 on the phones and in the deck (display only: the live subscription keeps its on-chain amount).
- The payer has spent 49.20 of its 100 USDT today (three errands today were mine: 14.40).
