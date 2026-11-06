# Relay: phones (the integration session)

Updated 17:05 IST, Fri 6 Nov.

## In plain words

The team's two phone apps now run on our real site, on real data, and they are the home page: https://graphpay-event.vercel.app. Nobody needs a login or a passcode.

- **Vitalik's phone:** his ask runs the real errand. The agents compare the three shops, and the trap shop is rejected for its refunds and late deliveries. The payer pays 4.80 to Kesar Kingdom, with a link to the real transaction. The first paid errand from the stage took about 107 seconds.
- **Kesar Kingdom's phone:** the order appears live. The shop's Open switch lists it as open on Arkiv.
- **The middle of the page:** T5's "What just happened" follows the same run, step by step.
- **Refunds:** a refund request from Vitalik's phone reaches the shop's inbox.
- **Pause and resume:** both work, through the site's own customer screen.
- **Not working yet:**
  - the shop's refund approval fails on the server;
  - the re-order is refused (`BAD_402`);
  - both are reported to their owners;
  - the Swarm image is ready in the data but waits for the team to draw product images.

The team's folder is untouched; their design is exactly theirs.

## What comes next

- The owners fix the refund approval and the re-order; then each is tried once from the phones.
- The team:
  - hides the actions that aren't built yet, using a flag the adapter fills;
  - draws product images;
  - adds a pause switch;
  - makes repeat buyers optional (OPEN).
- The story swap (dosa, BKC, new names, photos) is a config and asset change only.

## Technical

- **The build:** `apps/phones/build.mjs`, run by `apps/web`'s build.
  - It installs `frontend/` (`npm ci --include=dev`), type-checks our entry against their contract, and builds two pages with their Vite into `apps/web/public/phones/`.
  - Their `story.json` is replaced by a projection of `packages/config/story.json`.
  - Menu images come from Swarm through each shop's Arkiv menu row: `apps/phones/menu-images.mjs`, keyless, verified by hash, with a 20 s limit, falling back to no image.
- **The live adapter:** `apps/phones/src/live-adapter.ts`.
  - The snapshot comes from `/api/state/customer`, `/api/map` and `/api/merchant/export.csv`, then polls and the merchant stream from two days back, with backoff.
  - Actions POST our routes (public access, ADR-0069).
  - `errand.ts` maps the run's SSE frames to their events. It is tested against a recorded real paid run.
  - `orders.ts` folds ledger rows into orders. Chain events and `req:` requests are live; `hist:` rows are seeded history and stay out.
- **The stage:** `/` and `/live` frame the two pages in same-origin iframes. `LiveRunBridge` takes each frame the customer phone posts and feeds T5's explainer through `setRun`.
- **Public access:** `site.publicAccess` in the config makes `requirePasscode` a no-op. Server-to-server keys stay. Visitor guards apply to merchant refund and dispatch (the persona's orders only, 30 s per order) and to pause and resume (20 s).
- **Live errands so far:** 2 of 5. One was refused because the payer was paused by a visitor; one paid.
