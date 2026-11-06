# Brief: the booth run

From the thinking partner (claude.ai), via the founder, Fri 6 Nov. For: one Booth session on Sonnet 5.5, High effort. File it in `docs/thinking-partner/briefs/` with your time prefix.

This brief replaces `booth-swap-brief.md` and includes it.

## Goal

Make the live site demo-ready for the booth tonight, with the simplest changes possible:
- the team's new pause and resume buttons;
- Grok's story on screen;
- the draft deck in the middle;
- one screen with no scrolling.

Build nothing heavy. The full presentation run comes after the 21:30 reset.

## Inputs, all in `~/Downloads`

- `graphpay-grok-pack-part1.zip` and `graphpay-grok-pack-part2.zip`.
- `GraphPay draft presentation (1).html`: the deck.
- The team's latest commits, on their fork and in their PR.

## Order

Do the steps in this order: cheapest and most valuable first. Merge each step only once the live site still works.

1. **The team's pause and resume.**
   - Squash-merge the team's PR, credited to them, once CI passes, and deploy.
   - Our live adapter already maps pause and resume to `/api/customer/pause` and `/resume`. Fix the mapping only if their new buttons need it.
   - Test pause, then resume, once from Vitalik's phone.
2. **The Grok swap,** on screen only:
   - Unzip both packs into `assets/grok/` and commit them as they are.
   - In `packages/config/story.json`:
     - the request line: "Just landed in Mumbai. Get me the best masala dosa near BKC under 6 USDT by 8 pm.";
     - Kesar Kingdom's slot becomes Filter & Fold (BKC), Syrup Street's becomes Idli Index (Bandra East), and Jamun Junction's becomes Tawa Tangle (Kalina). Take every name from `places/cast-shops.json`;
     - their products from `menus/*.json`, keeping every story price: the combo at 4.80, the coffee at 0.80 (for the refund and the re-order), and the Sunday breakfast at 2.40.
   - Keep every ENS label, wallet, stat and cap exactly as it is. The founder accepts the old ENS names until tonight.
   - Update the old names wherever the agents or phones still read them (for example, the shops' Arkiv directory rows) using the existing scripts.
   - Publish the new menus on Swarm with T3's menu script, with one dish image.
3. **The deck in the middle.**
   - Copy the deck into the site unchanged, for example as `apps/web/public/deck/index.html`.
   - Change only:
     - its `STORY` values, to the same story as step 2;
     - an embed mode that hides the deck's own phones and outer chrome, so only each slide's middle content shows, with Back and Next.
   - Frame it in the middle of the stage, in place of T5's explainer.
   - During a live errand, switch the middle to T5's live view, keeping its clickable explorer chips (such as "concierge to scout"). Switch back to the deck when the run ends. A simple "Story / Live run" switch is enough.
4. **One screen.**
   - On laptops and projectors the page never scrolls, and both phones are always fully visible.
   - Panels may scroll inside themselves.
   - On an actual mobile phone, keep one phone per page, as now.

## Check before you stop

On a laptop, in a private window at https://graphpay-event.vercel.app:
- The page doesn't scroll, and both phones and the deck are visible.
- The deck shows Vitalik, masala dosa and the three new shops, and Back and Next work.
- One live errand:
  - shows the new names on both phones;
  - vetoes Tawa Tangle;
  - pays 4.80 to the good shop's wallet;
  - switches the middle to the live view with working chips.
- Pause and resume work once from the team's buttons.

## Rules

- **Minimal usage.** Read only what you need. No redesign and no refactors.
- **At most two live errands.**
- **Usage line for this session (the founder's decision):** work until 98% plan usage, then end gracefully:
  - merge nothing half-done;
  - revert any merged step that broke the site;
  - leave the payer active and the shop open;
  - write `docs/sessions/booth/resume.md` and a short demo note: what works, and what not to tap (re-order).
- **Report** a short `booth` line in NOW and in LOG, and tell the founder when it's ready to demo.

## Not now (after 21:30)

- The deck following the live run, slide by slide.
- The real ENS names for the new shops, and moving their history.
- The big city.
- Grok's figurines and photos in the phones.
- The re-order fix.
- Polish.
