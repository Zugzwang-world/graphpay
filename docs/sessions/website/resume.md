# Website session: resume file (T5 Web)

Start line: `You are T5 Web. Run docs/plan/sessions/T5-web.md. Go.` Then read this file. Updated 06:15 IST (Coordinator's clock), Fri 6 Nov. Worktree `.claude/worktrees/t5-website-graphpay-61d4fe`; branches `web/*`; Sonnet 5.5 at high. Pause everything at 92% weekly usage (check `mcp__ccd_session_mgmt__get_usage`, load it with ToolSearch).

## State
- **Merged to `main`:** #10 shell, #13 phone views, #17 agent run route, #23 merchant stream and CSV, #26 order trail and explain detail, #36 race mode, #39 Open toggle (`/api/merchant/open`), #43 Pause/Resume, #44 customer state (`/api/state/customer`), #51 **M16** (`packages/checkout-kit`, `apps/store`), #54 Mumbai map (`/map`, `/api/map`), #55 explainer agent lanes, #63 M16 proof records.
- **In PR #65 (auto-merge on, CI running):** the merchant phone's Mark dispatched and Refund (`/api/merchant/{dispatch,refund}`, `lib/merchant-actions.server.ts`; reviewer pass done). Watch it until it merges; on DIRTY merge `origin/main` (read `git diff --name-only --diff-filter=U` and `grep -ln '^<<<<<<< '` before committing: P-website-2), rerun `pnpm check`, `pnpm build`, push.
- **M16's done-when is met on the chain:** on 6 Nov ~05:16 IST (Coordinator's clock) one real 4.80 USDT payment through the kit's client (persona wallet VITALIK as a human payer, no gas) against a local store and the hosted facilitator: order `0x0864e72ad5fa120c343d35cc2326e433d83bb88e60283a7a1406178614e805f0`, tx `0xf1e76a91d855af352e7b38122f94c337be2a74e25ce087eb396b7945be343f89`, block 12326025, `settleOrder` success; order reads PAID 4.80 (relay `docs/thinking-partner/relays/website.md`). Not done: the store's CSV row for it (the export needs T6's PR 64), and a person paying in MetaMask itself (the wallet path is tested with a mock EIP-1193 provider).
- Production: https://graphpay-event.vercel.app. Keys the Coordinator set in Vercel Production: `W_DIRECTORY_PRIVATE_KEY`, `VITALIK_PRIVATE_KEY`, `DEMO_PASSCODE` (live after the next deploy). The founder holds the passcode; a stage run of one Open toggle cycle and one pause then resume (leave it resumed) needs it, so it is not done.

## Next, in order (Friday items: `docs/plan/MASTER_PLAN.md` §4)
1. Watch #65 to merge. When T6's #64 (the log-range fix in `@graphpay/agentpay`) merges, rerun the store's export locally (`merchant.exportCsv`) and note the row for the order above in the relay.
2. **Item 11/12 leftovers, each a spending route needing a reviewer pass:** `POST /api/customer/refund-request` (a `request` edge by W_SYNC via `recordEdge`; the hosted recorder route only does `attempts`, so call `@graphpay/money-graph` `recordEdge` as the payments module does, see `apps/web/lib/payments.server.ts`; the photo needs T3's swarm items, item 5, so ship without it first); `POST /api/customer/reorder`, `subscribe`, `unsubscribe` (the payer agent signs: `PAYER_PRIVATE_KEY`, through the hosted shop/facilitator; agentpay's buyer has `pay`, `signSubscription`, `signCancel`); `kill-disposable` needs T2's `provisionDisposable` and a funded wallet. Each route is a file under `apps/web/app/api/customer/**/route.ts` that answers `notLive(waitingFor(path))` today; keep the passcode check first, keep `SITE_ROUTES` (`lib/routes.ts`) accurate; `lib/routes.test.ts` (F2) must pass.
3. **The store's Sunday box** (subscribe and cancel; the kit's `shop.merchant` has it, the button does not): stretch.
4. When Join wires `errandRunner()` in `apps/web/lib/agents-live.server.ts` (he agreed to pass `runId: input.runId`), look at the lanes and the map with a live run (they filled from handoff and presence rows; nothing has filled them yet).
5. Acceptance on the production URL once the keys are live: `WEBSITE_SPEC.md` §13, F2, A8, D11 to D13, CP5.

## Open threads (all in `docs/thinking-partner/OPEN.md`, website section)
- The Vercel project `graphpay-store` (root `apps/store`) is the Coordinator's to create; env names: `MERCHANT_ADDRESS`, `DEMO_PASSCODE` (24+ characters), `FACILITATOR_AUTH_TOKEN`, optional `FACILITATOR_URL`, `SHOP_KESAR_PRIVATE_KEY` for dispatch and refund; the shop wallet needs a refund float approved to the checkout.
- T3: add an entity `key` to the GraphQL `Shop` (map dots link to the explorer's query page, unverified). T1: a shared table of refund reason codes (the phone sends `1`). Join: pass `input.runId` to the runner.
- `pnpm check` does not look for merge-conflict markers; do it by hand after every merge.

## How a panel goes live (the pattern)
Each unwired route is a file under `apps/web/app/api/**/route.ts` that checks the passcode (spending routes) and answers `notLive(waitingFor(path))`. To wire it: replace the body with the real call, keep the passcode check first, answer 503 "not live yet" while its key is missing, set `waitingFor` in `SITE_ROUTES`. The client already handles 503 "not live yet".

| route | state |
|---|---|
| `POST /api/agents/run` | seam set by Join's M12 wiring (`lib/agents-live.server.ts`; `ErrandInput.runId` is passed) |
| `POST /api/customer/{reorder,subscribe,unsubscribe,refund-request}` | not live (item 2 above) |
| `POST /api/customer/kill-disposable` | not live (T2 provisioning) |
| everything else in `lib/routes.ts` | live |

## Rules that bit
- Story and addresses only from `@graphpay/config` (`pnpm check` fails otherwise, tests included: no cast names such as `payer.vitalik...` in code or tests).
- Reviewer agent on every spending, signing or key route before it merges (it found a real double-payment path in every one so far); records in the same PR (skill `relay`); `git add` specific paths, never `.claude/launch.json`.
- Pushes: loop on the push's exit status (`if git push; then break; fi`), not on `| tail`; a GitHub-side "commit_refs_rules" rejection cleared by itself after a few minutes. `gh` calls need retries.
- Node's type stripping (used by `node --test` on `.ts`) rejects TypeScript parameter properties and needs `.ts` import extensions; stale `apps/web/.next` types break `tsc`: `rm -rf apps/web/.next` first. After a merge that changes the lockfile run `pnpm install`.
- Run local servers with secrets only through `scripts/lib/env-loader.mjs` in a scratch launcher (never print a value); scratch launchers live in the session scratchpad, not the repo.
- No middle dots in UI strings, no all-caps labels; say "cannot be edited", never "permanent" or "hidden"; synthetic data stays labelled.
- One sender at a time on the hosted facilitator: tell Join before and after any real payment.
