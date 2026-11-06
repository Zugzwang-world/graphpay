# Booth session: resume

Updated 19:20 IST, Fri 6 Nov, after part 2 (`docs/thinking-partner/briefs/1900-booth-run-part2.md`). Part 2 is all merged; the part 1 text below stays as it was.

## Part 2: done and merged
1. **No double payment** (#138): `apps/phones/src/errand.ts` and `live-adapter.ts` recover a dropped run by its id (replay `/api/agents/run/<id>/events`, skipping applied frames), then poll `/api/state/customer` for the payer's newest order; no "Try again" for a run that may have paid. Keep-alive every 5 s. Cause of the drop not proven; it did not happen in Chrome.
2. **The deck follows the live run** (#139): `apps/web/components/middle-switch.tsx` posts the stage, slide and chips to the deck (`apps/web/public/deck/index.html`, embed mode); Replay the last run; the Live run tab is gone.
3. **Grok's visuals** (#140): `apps/phones/grok-images.mjs` (macOS `sips`) writes `apps/phones/static/grok/`; the build copies it to `/phones/grok/`; `story.json` carries `avatar` and `image`; `AgentAvatar` and `components/shared/Photo.tsx` in `frontend/`.
4. **Small fixes** (#140): renewal 2.40; the good shop's combo name by a `short` field (`packages/shop`, `packages/agents/mocks`); `castMenus` drops the site image path.

Checked in Chrome on production, one live errand (the second and last of part 2 was not needed): the deck went through all 7 steps and stayed on the record slide with the links; Tawa Tangle rejected; the dish photos on the cards; the paid card on Vitalik's phone (4.80, order #4020 on the shop's phone); no "stream ended". Payer active, shop open.

Still open after 21:30: the real ENS names and history, the big city, re-order (1 x 4.80 now) and caps and kill and subscriptions, the menu photos (no menu screen), animation beyond the state images, the deck's non-demo slides checked one by one, the Arkiv category ("sweets").

---

Booth session (Sonnet 5.5, High), started Fri 6 Nov about 18:00 IST from `docs/thinking-partner/briefs/1850-booth-run.md`. Worktree `.claude/worktrees/booth-session-work-0975ee`. Usage line: stop at 98% of "Weekly · all models" (read 94% throughout); the weekly reset is 21:30 IST.

## Done and merged
1. **The team's pause and resume:** PR #132 (credited to ajatshatru01), squash-merged, deployed. Tested on production: Pause, then Resume, from Vitalik's phone (Payer card). The live adapter's `pauseAgent` and `resumeAgent` ignore the agent and act on the payer, so no mapping change was needed.
2. **The Grok swap on screen:** PR #135. `assets/grok/part1` and `part2` as delivered (kept out of deployments by `.vercelignore`); `packages/config/story.json` has the new request, the three shops and their menus. Every ENS label, wallet, stat, cap and price is unchanged. The first product of each shop is named "masala dosa" (the agents match the order item to each shop's first product by exact name; the menu detail "ghee roast" is lost). Re-order is now quantity 1 at 4.80. Refund reason "coffee arrived cold" (0.80). The Sunday breakfast box (renewal item) keeps priceMicro 0.40. Live: `packages/money-graph/scripts/directory-names.mjs --execute` patched the three directory rows' names (tx 0x6967fc4d…); `menus.mjs --execute --image` published the new menus on Swarm with one dish image (the combo of Filter & Fold, downscaled to 28 KB); `docs/sessions/arkiv/swarm-menus.json` has the references.
3. **The deck in the middle and one screen:** PR #136. `apps/web/public/deck/index.html` (the draft deck, `?embed=1` mode, its `STORY` values and the few story words outside it changed; `scripts/check.mjs` exempts that one page from the story-literal rule), `apps/web/components/middle-switch.tsx`, and the stage CSS in `apps/web/app/site.css`.

## Checked on production
Laptop, 1440 x 900: no page scroll, both phones and the deck visible, new names on both phones. Two live errands (the most the brief allows): both vetoed Tawa Tangle (G2, excluded: refund rate 18.5%, on-time 71.3%), paid 4.80 to kesar-kingdom's wallet (orders 0x52aa418804e9… and 0x37a384e3eb89…, transaction of the first 0x62a8417b2f24…), and were delivered; the middle switched to Live run with working chips. In both, the stream closed before its `result` frame (pane at about 25 s, curl at 111 s); see the demo note.

## Left for after 21:30 (not done)
- The deck following the live run, slide by slide; the deck's non-demo slides (title, problem, solution, partners, close) were adapted only by CSS and not checked one by one.
- Real ENS names for the new shops and moving their history; the Arkiv category is still "sweets" for the cast (the graph's shop rows carry it too, so changing it needs the directory rows and the graph nodes together).
- The big city; Grok's figurines and photos in the phones; the re-order fix (the 1.20 coffee re-order needs a separate `reorder.sku`); polish.
- A re-run check that the phone receives the errand's `result` frame (the server side finishes: orders delivered).

## State at the end
Payer active. Shop open. No errand running. Branch `claude/booth-records` carries the records PR.
