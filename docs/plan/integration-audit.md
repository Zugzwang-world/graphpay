# Integration audit: the team's phones and our back end

Fri 6 Nov, 11:45 IST, by the Coordinator. This is a read-only audit for the integration brief (`docs/thinking-partner/briefs/1115-integration-audit.md`).

Three read-only sub-agents read the team's fork at `bef8862`, our `main` at `29daec5`, and production by GET requests only. I added the Vercel variable names and the wallet balances. Nothing was changed, merged, deployed or sent.

## 1. The team's front end

- **PR #70 is open, not merged** (GitHub API: `merged: false`).
  - Its head, the fork's `main` at `bef8862` (11:07 IST), is 10 commits ahead of ours. All are by ajatshatru01 and all are inside `frontend/`.
  - What looked like a merge: "referenced" entries from our own commits (#72, #90), and GitHub's test-merge ref, which CI builds but no branch holds.
- **Stack:** React 19.3.1 (as ours), Vite 8.3.6, Tailwind 4.3.4, TypeScript 5.9.3, Vitest 5.1.0. Own npm lockfile, no router.
- **Done:**
  - Customer phone: Desk (chat, shop cards, quote), Orders (tracker, re-order), refund wizard, Renewals.
  - Merchant phone: Home (Open switch, day log), dispatch, refund requests, renewals.
  - The stage, and seven mock journeys.
- **Still to come:** F9 to F11 (agents and the spending pass, payouts and export, polish). Nothing calls pause, resume, revoke, the cap actions or export yet.
- **Build and tests:** `npm ci`, the build and `npm test` (40 logic tests, no component tests) all pass on Node 22.23.4.
- **The seam:** `DemoProvider` takes an `adapter` prop. `App.tsx` passes `createAdapter()`, which always returns the mock. There is no live adapter and no network code. Our own entry can wrap their phone component (`AppPlaceholder`) in `<DemoProvider adapter={live}>` without editing their files.
- **Story:** one static import of their own `story.json`, which has a different shape from ours, read by 13 files.
  - The UI filters orders on `story.customer.ens`.
  - Two story jokes are hard-coded in `copy.ts`.
  - Explorer links are mock buttons with fake hashes, and their ENS explorer differs from ours.
- **No passcode** step anywhere. ADR-0068's fixes (a) to (e) are not applied, and the app is in `frontend/`, not `apps/demo-ui`.

## 2. Our back end on production

- **Live:** customer state, the merchant feed (SSE), shops and quotes, the errand, payment inside it, and the renewal cron.
- **Wired, never run on production:** refund request, refund, re-order, pause and resume, the Open toggle, dispatch.
- **Not live yet:**
  - subscribe and cancel: no hosted path, and `createSubscription` is relayer-only;
  - the kill: no route calls the owner's `kill()`.
  - Both show stale waiting-for texts (`lib/routes.ts:23,27`).
- **The errand runner is wired:** POST `/api/agents/run`, behind the passcode.
  - Frames: `started`; `trace` (message, agent start and end, tool call and result, guard); then `result` or `failed`; a keep-alive every 15 s.
  - It is cut at 280 s of the 300 s limit; the paid errand took 171 s.
  - Limits: one errand at a time and 6 an hour, per instance.
  - The server mints the run id.
  - There is no CORS, so another site must call it from the same domain or from its server.
- **Haiku:** no full errand has ever run on it. The live preset is `kimi-k3.1-pro-highspeed` (ADR-0067). Six production errands so far:
  - three stopped at a plan;
  - one failed on the W_DIRECTORY quote write;
  - one failed at the settle send, with nothing sent;
  - one paid 4.80 (11:11 IST).
- **Keys on Vercel Production:** the 18 names present cover every wired route. Missing only for unbuilt work: OPERATOR, POLICY_WRITER and DISPOSABLE keys (the kill).
- **Bugs:**
  - The merchant feed keeps the newest 50 incoming edges and holds 46. After four more, new orders stop appearing, with no error (`lib/merchant-feed.server.ts:17`).
  - `export.csv`'s 100 rows are all October's synthetic history, so it already misses every real payment.

## 3. The mapping

| their contract | served by | status · owner |
|---|---|---|
| `getSnapshot` | `/api/state/customer`, `/api/map`, the feed | live · adapter |
| `sendPrompt` → `agent.message`, `agent.status`, `shops.compared`, `graph.read`, `quote.created`, `payment.signed`, `payment.settled`, `payment.refused`, `error` | `/api/agents/run` frames | live · the adapter maps frames; Join keeps them stable |
| `order.updated`, `merchant.notification` | `/api/merchant/events` (SSE, reconnect with `since`) | live · stall fix: T5 |
| `agent.pass.period` | `/api/state/customer` (cap, spent) | live · adapter |
| `reorder` | `/api/customer/reorder` | wired, not proven · a person |
| `requestRefund`, `approveRefund` → `refund.*` | `/api/customer/refund-request`, `/api/merchant/refund` | wired |
| `declineRefund` | none | gap · T1 |
| `dispatch` | `/api/merchant/dispatch` | wired |
| `setShopOpen` → `shop.status` | `/api/merchant/open`, re-sent every 300 s; read `/api/map` | wired · adapter |
| `pauseAgent`, `resumeAgent` → `agent.permission` | `/api/customer/pause`, `/resume` | wired |
| `revokeAgent` | `/api/customer/kill-disposable` | not live · T2, Coordinator |
| `startRenewal`, `cancelRenewal` → `renewal.*` | `/api/customer/subscribe`, `/unsubscribe` | not live · T1 |
| `runNextRenewal` | the cron route (secret, server only) | gap · T1 |
| `tryRaiseCap`, `setCap` → the cap events | none | gap · T1 |
| `exportCsv` | the merchant `export.csv` | wrong rows · T5 |
| `resetDemo` | none | mock only · hidden in live |
| `ens.resolved`, `arkiv.write`, `race.result` | not used by their UI | none |

## 4. One website: the options

- **A (recommended): their phones as static pages on our domain, inside T5's stage.**
  - `frontend/` stays theirs at their path, with their lockfile and their mock dev server.
  - Our new folder `apps/phones/` holds a Vite config and two entry pages. They build their phone components with their toolchain, wrapped in our live adapter, into `apps/web/public/phones/` before `next build`.
  - At build time, their story file is swapped for a projection of `packages/config/story.json`.
  - T5's stage swaps its two phone frames for same-origin iframes and keeps the Explainer. The customer phone posts the run id to the page.
  - The adapter sends the passcode from the page's sessionStorage on every spending call, so C6 and F2 keep passing.
  - Production is always live, with real explorer links, and Tailwind's reset stays inside the frames.
  - Needs: the Vercel ignored-build step to include both folders, `pnpm check` on `apps/phones/`, and the verifier on Vite 8 and Tailwind 4.
- **B:** their components inside Next pages. One React tree, but their `import.meta.env`, `@/` alias, browser-only code and Tailwind reset all need edits in their folder.
- **C:** their stage as the home page with T5's Explainer inside it. This replaces T5's stage.
- **D:** a second Vercel project. That breaks one project and one domain.
- **Their commits:** #70 lands squashed and credited to them, because main is squash-only. Keeping each commit needs a rebase merge, which only you can allow. They sync their fork after each merge.
- **The fix list:** A replaces ADR-0068's fixes (a), (b), (d) and (e). Fix (c) stays theirs, plus the two jokes. **I record A as an ADR when you agree.**

## 5. Ownership (one editor per file)

- **The integration session:**
  - `apps/phones/`;
  - the stage (`apps/web/app/page.tsx`, `site.css`);
  - the run-id bridge (`components/site-context.tsx`);
  - `apps/web/package.json`.
- **T5:** builds no screens. It fixes the feed and the export first, then reviews the team's PRs and the integration PR. #81 is merged; proving it needs a person to tap it.
- **Join:** the runner files and F2's route list (`integration/hosted.mjs`).
- **T1:** subscribe and cancel, run-next-renewal, decline, and the cap routes.
- **T2:** the kill route and its provisioning.
- **The Coordinator:** root config, `pnpm check`, the Vercel build step, keys, funding and the ADR.
- **The team:** `frontend/` only.
- **The shared file,** `apps/web/lib/routes.ts`: each session adds only its own lines.

## 6. The founder's test run

- **Keys:** none missing for today's routes. The kill will need three more names on Vercel.
- **Wallets:**
  - PAYER: 25.2 test USDT, but only 1.20 of its 6.00 daily cap left until Sat 05:30 IST.
  - FACILITATOR: 0.793 WBT (floor 0.3).
  - SHOP_KESAR: 52.01 USDT, 17.60 of it approved for refunds.
  - VITALIK: 0.002 Sepolia ETH.
  - W_DIRECTORY: 0.48 tGLM.
  - DISPOSABLE_2 and DISPOSABLE_3: empty.
  - FUNDER: 2.59 WBT, 15.54 USDT, 15.08 tGLM, 0.275 Sepolia ETH.
- **Only you:**
  - the passcode on the site;
  - the story lock, with the paying agents' daily caps;
  - the Kimi balance;
  - a Vercel login, if the ignored-build step is dashboard-only;
  - the Mac awake with its lid open, for the workers.

## 7. Usage

- 88% at 11:39 IST. The sessions together use about 2.4 points an hour while busy.
- My estimate for the integration on Opus high is 4 to 8 points (3 to 5 hours). The 95% line, where merges stop, is 7 points away.
- Start it after the 21:30 reset, or keep the other sessions idle while it runs.

## 8. Risks, most serious first

1. **Usage:** the integration may reach 95% before it can merge.
2. **The payer's cap:** no full errand pays as PAYER until Sat 05:30 IST.
3. **The feed:** new orders stop appearing after four more incoming edges, and the export already misses every real payment.
4. **Kimi:** $0.71 to $3.55 per production errand. An empty balance stops every errand.
5. **No back end yet:** renewals, revoke, caps, decline and reset must be hidden or refused until T1 and T2 build them.
6. **A moving head:** their `main` moved 10 times in two hours. Pin a commit per step.
7. **Silent deploy skips:** commits touching only `frontend/` or `apps/phones/` don't build until the Vercel ignored-build step changes.
8. **Untested glue:** the run id through `postMessage`, the passcode through sessionStorage.
9. **Limits held in each server instance's memory:** the runner's, the re-order guard and the W_DIRECTORY writers.
10. **A sleeping Mac:** the mirror stops and the phones show stale orders.
