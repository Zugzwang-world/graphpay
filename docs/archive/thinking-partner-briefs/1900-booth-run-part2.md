# Brief: the booth run, part 2

From the thinking partner (claude.ai), via the founder, Fri 6 Nov. For: the Booth session (Sonnet 5.5, High effort), continuing from part 1. File it in `docs/thinking-partner/briefs/` with your time prefix.

## How to run it

- **Unattended.** Do every step below in order, without stopping to ask between steps.
- **Stop only** at 98% plan usage, or when everything is done.
- **End gracefully, as in part 1:**
  - merge nothing half-done;
  - revert any merged step that broke the site;
  - leave the payer active and the shop open;
  - update `docs/sessions/booth/resume.md` and the demo note.
- **At most two live errands** in this part.

## Steps

1. **No double payment when the stream drops.** In part 1, the phone's live stream ended mid-errand and offered "Try again", which would start a second errand and pay again.
   - When the stream drops, the phones must not offer "Try again" for a run that may have paid. Instead, they recover the result by the run id, by polling the run's status or reading the order from the chain or the graph, and show the paid order.
   - Find why the stream drops after about 25 seconds in a browser (keep-alive, proxy buffering, Vercel streaming). Fix it if the fix is cheap.
   - Prove it with one live errand from a normal browser.
2. **The deck follows the live run.** Replace the switch to T5's live view:
   - During an errand, the middle stays on the deck and moves to the matching slide at each step: the ask, the team, the check, the check back, the quote, the payment, and the record on Arkiv.
   - Each slide highlights its step and shows that step's live explorer chips, taken from the data T5's live view already uses.
   - After the run, the deck stays on the last slide with the real links.
   - Keep Back, Next and "Replay the last run". Remove the "Live run" tab once the deck covers it.
3. **Grok's visuals in the phones.** You may edit `frontend/` for this; keep it small.
   - **Agent avatars:** use Grok's figurines from `assets/grok/agents/`; the concierge is the caped smiley figure.
     - Show the state image that matches each agent's status: idle, thinking, talking, success or refused.
     - Add a gentle bob while an agent is thinking.
   - **Photos:**
     - dish photos from `assets/grok/images/dishes/` in the shop comparison cards, the quote and order card, and the menu;
     - storefront photos in the shop cards.
   - **Delivery:** resize the images with a script, serve them from our site, and route them through the story projection, so tonight's ENS swap needs no code change.
4. **Small fixes from part 1,** only if cheap:
   - The phones' renewal line should show the Sunday breakfast at 2.40.
   - The good shop's combo should read "Ghee roast masala dosa + filter coffee". The agents still need to match it, so match by SKU or a short name field rather than by the display name.

## Check before you stop

On a laptop, in a normal browser, at https://graphpay-event.vercel.app, one live errand shows:
- the deck following each step, with working explorer chips;
- the figurines changing state;
- dish photos on the cards;
- the paid result on both phones, with no "stream ended".

## Not now (after 21:30)

- Real ENS names for the shops, and moving their history.
- The big city.
- Re-order, caps, the kill and subscriptions.
- Animation beyond the state images.
- The video and the presentation.
