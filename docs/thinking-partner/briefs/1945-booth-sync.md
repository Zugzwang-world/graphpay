# Brief: phones and deck in sync

A booth fix. From the thinking partner (claude.ai), via the founder, Fri 6 Nov. For: a new Sync session on Sonnet 5.5, High effort. File it in `docs/thinking-partner/briefs/` with your time prefix.

**Read first:** `docs/sessions/booth/resume.md` and `docs/sessions/booth/demo-note.md`. They describe what the Booth session built: the deck in the middle, its seven-step strip, the figurines, and the run-id bridge.

## Goal

When the founder works the phones at the booth, the deck in the middle shows exactly what is happening, step by step.

Run unattended, with no stops between steps. Stop at 98% plan usage, or when everything is done.

## Steps

0. **The no-purchase errand.** The founder's latest errand ended with "No purchase this time" on Vitalik's phone.
   - Read its run log and report why it stopped.
   - Fix it only if it is a bug and the fix is cheap.
1. **The phones drive the deck.**
   - **What moves the deck:** every action and event on either phone moves the deck to its slide and lights that step with its explorer link:
     - the errand's seven steps;
     - a refund request, and the shop's refund ("A refund, with proof");
     - pause and resume ("Stopped, live");
     - the shop's Open switch;
     - a renewal ("Every way a business gets paid").

     Use the deck's slide titles. Where there's no exact slide, pick the closest one.
   - **How:** the phones already post the run id to the page. Post their other events the same way, with same-origin `postMessage`, and map them in one table on the page.
   - **One mapping for the strip and the slide,** so they always agree. Today the strip can say "The check, step 3 of 7" while the slide shows "The shop checks the buyer back".
   - **Back and Next only browse the deck,** and the strip follows the slide. The deck never acts on the phones, because the phones hold real money. "Replay the last run" replays the deck only.
2. **Figurines without circles.**
   - Show each agent's full figurine, larger, with no ring, crop or check badge around it.
   - Its state image (idle, thinking, talking, success or refused) carries the status, and it bobs while thinking.
   - Use a transparent background. If an image has a flat background colour, key it out with a script.
3. **No QR codes.** Remove the QR strip under the deck, and give its height back to the deck so nothing in the middle is squeezed. The page stays one screen, with no scroll.

## Check before you stop

In Chrome on a laptop, at https://graphpay-event.vercel.app:
- **One live errand:** the deck moves through its seven steps in sync with the phones, with the strip and the slide agreeing.
- **A refund:** request it on Vitalik's phone, then refund it on Filter & Fold's phone. The deck shows the refund slide with its links.
- **Pause, then Resume, on the Payer card:** the deck shows "Stopped, live", then returns.
- **The look:** the figurines are large and circle-free, there are no QR codes, and nothing in the middle is squeezed.

## Rules

- **Minimal usage.** Read only what you need, and redesign nothing beyond these changes. You may edit `frontend/` for steps 1 and 2.
- **At most one live errand.**
- **End gracefully:**
  - merge nothing half-done;
  - revert anything that broke the site;
  - leave the payer active and the shop open;
  - update `docs/sessions/booth/resume.md` and the demo note.
- **Report** a short `sync` line in NOW and in LOG, and tell the founder when it's ready.

## Not now (after 21:30)

- Highlighting the matching part of a phone when the deck moves.
- Animation beyond the state images.
- The real ENS names and the big city.
- Re-order, caps, the kill and subscriptions.
