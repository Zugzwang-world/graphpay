# Relay: phones (the integration session)

Updated 13:05 IST, Fri 6 Nov.

## In plain words

The team built two phone apps (the customer's and the shop's) that ran only on made-up data. Since this step they run on our real site, on real data, at https://graphpay-event.vercel.app/live. Vitalik's phone shows his agents, the payer's daily pass as the contract holds it, and every real order with a link to its transaction on the Whitechain explorer. Kesar Kingdom's phone shows today's orders, and a new order appears on its own when it is paid. The middle of the page is T5's explainer, unchanged.

Nothing is spent yet: the buttons say they are connected in the next step. The team's folder is untouched; their design is exactly theirs.

## What comes next

1. Vitalik's ask runs the real errand: the agents compare the shops, veto the trap and pay; both phones and the explainer follow it.
2. The money buttons that already exist on our side (refund request, refund, re-order, dispatch, pause and resume, the Open switch), each used once live.
3. One menu image from Swarm, `/live` becomes the home page, and a click-by-click script for the founder's run.

## Technical

- `apps/phones/build.mjs` runs from `apps/web`'s build, before `next build`. It installs `frontend/` with its own lockfile (`npm ci`), type-checks our entry against their contract with their TypeScript, and builds two pages with their Vite 8, React plugin and Tailwind 4 into `apps/web/public/phones/` (git-ignored).
- The story swap: a Vite plugin serves `apps/phones/story-projection.mjs`'s projection of `packages/config/story.json` in place of `frontend/src/data/story.json`. No story value is written in code; `pnpm check` is clean.
- The live adapter (`apps/phones/src/live-adapter.ts`) implements their `DemoAdapter`: the snapshot from `/api/state/customer`, `/api/map` and `/api/merchant/export.csv`; then polls state (15 s) and the map (30 s), and follows `/api/merchant/events`, reconnecting from the last edge. `apps/phones/src/orders.ts` folds ledger rows into their `Order`, with tests (`apps/phones/test/`, run by `apps/web`'s test script).
- Rows with no settlement transaction are the seeded history; they are left out until the phones can label them (OPEN).
- `/live` (`apps/web/app/live/page.tsx`) frames each phone page in a same-origin iframe; on a phone the menu links straight to the phone pages.
- Checks: `pnpm check` clean, the team's 40 tests, `apps/web` 186 tests, typecheck, and the full web build pass on Node 22.23.4.
