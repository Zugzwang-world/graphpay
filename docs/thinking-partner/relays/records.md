# Relay: records (the Coordinator), 11:15 IST, Fri 6 Nov: the new Coordinator takes over

## In plain words

A fresh Coordinator session took over at 11:00 IST, and the first one has retired. Every session has been told that it now reports to the new Coordinator.

**The new usage rule** (the founder; ADR-0062 amended). It replaces the 92% pause:
- At 95% of the weekly plan, no session starts a new real payment, merge or publish, and every session writes its resume.
- At 97%, every session pauses at a clean checkpoint.
- Usage was 87% at 11:02 IST. The weekly window resets at 21:30 IST.

**The Arkiv writer clash, and where it stands:**
- The shop's quotes, the agents' presence and hand-off rows, and the merchant's Open toggle all write with one Arkiv wallet, W_DIRECTORY, from separate server instances. Their transactions collided.
- At 10:49 IST a live errand's quote write failed, so that errand paid nothing.
- Three fixes are merged and live on production:
  - the shop retries a quote write that ends uncertain (#96, T1);
  - the writer never takes another instance's transaction for its own (#97, T3);
  - the live runner holds its own writes while the shop writes the quote (#93, Join).
- **The founder's fallback:** if one more quote, presence or Open write fails in a live errand, each writer gets its own Arkiv wallet at once, and every check that trusts W_DIRECTORY changes in the same PR.

**npm:**
- Both SDKs are on npm as 0.1.0.
- arkiv-graph 0.1.1, which carries the writer fix, is merged and checked. It needs only the founder's approval link.
- agentpay 0.1.1 (T6) drops three test-only dependencies from the published manifest.
- Any 0.1.1 lands before the freeze at submission.

**What the founder does next** (`OPEN.md`, "Founder now"):
1. Lock the story.
2. Say when you're at the browser, for the 0.1.1 approval link.
3. Pass T5's fixes to the team.
4. Start the Submission session when usage allows.
5. Switch this session to high effort.

## Technical

**The takeover:**
- The tick runs every 10 minutes (`4,14,…,54`), session-only, with keep-awake on.
- The workers' caffeinate hold is asserted (`pmset -g assertions`).
- Eight messages have gone out (T1–T6 and Join, plus a second one to T3). The app's cap is 10 before the founder types again.

**PRs:**
- #93: OPEN.md conflicted only in the calibration table (Join's 10:47 row against T4's rows). I merged `origin/main` into `join/runner-guards`, kept every row in time order and pushed 5404ad5. It merged at 11:07, with CI green.
- #97 and #98 (T3): the writer fix and the 0.1.1 bump. The CHANGELOG has a 0.1.1 entry, and 0.1.0's entry no longer claims the fix.
- This PR (`coord/takeover-usage`):
  - the ADR-0062 amendment, its index row and ADR-0066's line;
  - T6's run file;
  - NOW, OPEN, the LOG roll-up, this relay, the resume and AI_USAGE.

**arkiv-graph 0.1.1, before the publish:**
- `pnpm pack` from the main checkout at `caa0ecc` gives 21 files, the same as 0.1.0.
- The secret shapes over the unpacked tarball found nothing.
- Its dependencies are `@arkiv-network/sdk` 1.0.1 and `viem`, with no workspace names.
- Its URLs are public: the Arkiv docs, the Rabdi public RPC, the faucet and GitHub issues.
- T3 installed the tarball in an empty folder and ran the quickstart and the leaderboard on Node 22.23.4.

**The wallet split, if it comes.**

The writers:
- `apps/web/lib/payments.server.ts` (quotes);
- `integration/src/live-runner.mjs` and `activity.mjs` (presence and hand-offs);
- `apps/web/lib/open-toggle.server.ts` (`shop_open`).

The owner checks:
- `packages/money-graph`:
  - `quotes.mjs` (`findQuotes`);
  - `activity.mjs` (`directory()`);
  - `graphql.mjs` (the owner lists);
  - `model.mjs`;
- `integration/d11.mjs` and `quote-d10.mjs`;
- `acceptance/tracks.mjs`;
- `packages/config/graphpay.config.json`;
- `scripts/whitechain/vercel-env.mjs`;
- `scripts/funding/plan.json`.

The directory and menu rows stay on W_DIRECTORY, because only scripts write them (ADR-0033).

**The thinking-partner folder:**
- It was 22,443 words, over its 20,000 guide.
- I rolled up the LOG lines before 04:00 (−733 words), which brings it to about 21,700. It is still over.
- Next to condense: `COVERAGE.md` (1,619 words, not updated since Thu 23:20) and the closed items in OPEN.

## Problems

- None new. The clash is logged by T1 and T3 (P-arkiv-3).
