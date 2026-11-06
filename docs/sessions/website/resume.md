# Website session: resume file (T5 Web)

Start line: `You are T5 Web. Run docs/plan/sessions/T5-web.md. Go.` Then read this file. Updated after #124 was opened (Fri 6 Nov, afternoon). Worktree `.claude/worktrees/t5-website-graphpay-61d4fe`; branches `web/*`; Sonnet 5.5 at high. The founder's usage rule: at 95% of "Weekly · all models" (`mcp__ccd_session_mgmt__get_usage`, load with ToolSearch) no new real payment, merge or publish; at 97% push, write this file, end the turn. It read 92% when this was written; the weekly reset is 21:30 IST.

## My role now (set by the founder through the Coordinator)
- **Build no new screens in `apps/web`.** The team's phones are in `frontend/` (PR #70, merged); the Integration session (`local_7268b4b1-7f52-4fe6-9652-329b9a9c97de`) builds them into `apps/web/public/phones/` through `apps/phones/` and wires them to our routes (PRs #111, #117, #122, #124).
- **Review every Integration PR** (read from the PR ref, scratch checkout, `pnpm check`, secret scan, no key or story value in browser code, server-to-server keys kept, guards on every signing route; the reviewer agent for anything that spends). Report to the Coordinator (`local_3b893898-fa05-4265-93ee-e9090aeee49f`).
- **Public access (ADR-0069)**: visitors meet no passcode (`site.publicAccess` in the config, `requirePasscode` returns null; `GRAPHPAY_PUBLIC_ACCESS=0` closes it). The shop's pay-route passcode, `FACILITATOR_AUTH_TOKEN`, `RECORDER_TOKEN` and the cron secret stay. Reads have no visitor limits (mine were raised tenfold in #113).
- **Cross-session messages**: after ten sent without the user typing, the tool pauses until the user types; findings then go in the final message instead.

## Done and merged (mine)
Shell, both phones, agent run route, merchant stream and CSV, order trail, race, Open toggle, Pause and Resume, customer state, M16 (checkout kit, store; one real kit payment on the chain), the map, the explainer lanes, Mark dispatched and Refund (#65), Request refund (#73, `lib/refund-request.server.ts`), Re-order (#81, `lib/reorder.server.ts` decisions and `lib/reorder-live.server.ts` the only file importing `@graphpay_ethglobal/agentpay`), the feed and CSV fix (#104: the graph returns a shop's oldest edges first and cuts silently at the list cap, so both ask for 500 rows and shrink the window until it fits), the read limits (#113).

## Open, in order
1. **Review #124** (phase 3: the phones POST refund-request, merchant refund, reorder, dispatch, pause/resume, open). Read on the PR ref: bodies match my routes. Findings not yet sent (messaging was paused): the refusal texts mislead (`TOO_SOON` says wait half a minute but Re-order holds 2 to 11 minutes and Request refund 1 minute; `NOT_THIS_ORDER` says "refunded" but also fires for Re-order; `BAD_REASON` is shown as the raw code); the Open renewal runs per open merchant phone tab, so many tabs can add `W_DIRECTORY` writes (T1 reported nonce contention with quote writes); the refund reason is free text written to the public Arkiv graph.
2. **Three guards I proposed and have not built** (my files; ask the Coordinator or the founder first): (a) Open toggle: at most one write per 10 s per instance when the state alternates; (b) `/api/agents/run`: a cooldown of about a minute between runs (public Send drains Kimi credit and the payer's cap, now 100/day); (c) Request refund: a daily cap on writes and an allowlist for the reason text.
3. **The real Re-order tap is the founder's** (a payment plus the passcode is outside what I may do). After the tap, do the read-only check: the new order id, its parent (the payer's newest order before the tap), amount 1.20, status, transaction; report to the Coordinator.
4. **The store's export row** for the kit payment (order `0x0864…05f0`, tx `0xf1e76a91…`): rerun `merchant.exportCsv` locally and note the row in the relay (T6's range fix is merged).
5. Not mine to unblock: Subscribe and Cancel (T1: no hosted subscription endpoint), Kill a disposable agent (T2), the `graphpay-store` Vercel project (Coordinator), the dashboard Build Command setting for `graphpay-event` (should be the default so `apps/phones` builds first; unverified).

## Rules that bit
- Story and addresses only from `@graphpay/config` (`pnpm check` fails otherwise; no cast names in code or tests).
- Reviewer agent on every spending, signing or key route before it merges (it found a real double-payment path in every one so far).
- Never make a payment or enter the passcode on the production site myself; tell Join before and after any real payment (one sender at a time on the hosted facilitator).
- Pushes: loop on the push's exit status; `gh` calls need retries; no force-push (an amend after a push leaves the branch diverged: reset to origin and use the PR title for the squash).
- `pnpm check` does not look for merge-conflict markers; after a merge grep for `^<<<<<<< ` by hand. The prompt log `prompts/raw/*.jsonl` is append-only: on a conflict keep both sides' lines.
- Node 22.23.4 through `fnm exec --using=22.23.4`; remove `apps/web/.next` before `tsc`; run `pnpm install` after a merge that changes the lockfile.
- Scratch scripts and PR bodies live in the session scratchpad, not the repo; run local scripts with secrets only through `scripts/lib/env-loader.mjs` (`loadEnv()` returns `{ path, source, values }`; `values` is a Map) and never print a value.
- No middle dots in UI strings, no all-caps labels; "cannot be edited", never "permanent" or "hidden"; synthetic data stays labelled.
