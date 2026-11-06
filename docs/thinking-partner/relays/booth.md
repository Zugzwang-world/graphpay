# Relay: booth (Booth), 22:30 IST, Fri 6 Nov

## In plain words

- The Booth session made the stage ready to demo on a laptop or a projector: https://graphpay-event.vercel.app.
- **The story is on screen** (ADR-0073): "Get me the best masala dosa near BKC under 6 USDT by 11:59 pm." Filter & Fold is paid 4.80. Tawa Tangle is rejected for its refunds and late deliveries. Idli Index is the runner-up.
- **One screen:** Vitalik's phone on the left, Filter & Fold's on the right, the deck in the middle (ADR-0074).
- **The deck follows the live run** slide by slide, with explorer links for each step, and Replay.
- **Grok's figurines and photos** are in the phones.
- **A dropped stream never offers Try again,** so a run that may have paid is never paid twice.
- **The team's Pause and Resume** work from the Payer card.
- Only the screen changed. The ENS names, wallets, caps and the Arkiv category behind the shops are still the test cast's.
- What not to tap is in the demo note: Re-order (it now spends 4.80), Revoke, Change cap, the cap-raise button, Pause on any card but the Payer's, Subscribe and Cancel.

## Technical

- [#132](https://github.com/Zugzwang-world/graphpay/pull/132): the team's pause and resume, credited to ajatshatru01.
- [#135](https://github.com/Zugzwang-world/graphpay/pull/135): the Grok swap: `packages/config/story.json`, the directory names on Arkiv, new menus on Swarm with one dish image. Assets in `assets/grok/`, kept out of deployments.
- [#136](https://github.com/Zugzwang-world/graphpay/pull/136): the deck in the middle (`apps/web/public/deck/index.html`), one screen.
- [#138](https://github.com/Zugzwang-world/graphpay/pull/138): a dropped run is recovered by its id, then from the payer's newest order.
- [#139](https://github.com/Zugzwang-world/graphpay/pull/139): the deck follows the run (`apps/web/components/middle-switch.tsx`).
- [#140](https://github.com/Zugzwang-world/graphpay/pull/140): figurines and photos; the renewal shown at 2.40; the combo's short name.
- Records: [#137](https://github.com/Zugzwang-world/graphpay/pull/137), [#141](https://github.com/Zugzwang-world/graphpay/pull/141). Briefs: `docs/thinking-partner/briefs/1850-booth-run.md` and `1900-booth-run-part2.md`.
- Checked on production: three live errands paid 4.80 to Filter & Fold.
- Open (the Booth's list):
  - real ENS names for the new shops, and their history; the Arkiv category still says "sweets";
  - the big city;
  - the re-order's own item: the story wants another coffee at 0.80, and the config has 1 × 4.80 (`reorder.sku`);
  - caps, the kill and subscriptions;
  - the deck's non-demo slides, not checked one by one;
  - animation beyond the state images.

## State

- **Idle since 19:12 IST.** Session `local_ffc009c6-4d90-4c88-a063-8453a1e2f37b`, with forks `local_1befae03-4060-4318-9f6b-3b873ae30638` and `local_37caa2e0-2eaa-4dea-b7df-53c65fbcd8da`.
- Resume file: `docs/sessions/booth/resume.md`; demo note: `docs/sessions/booth/demo-note.md`.
- Next step: the founder's demo check; the open list waits for the founder's choice.
