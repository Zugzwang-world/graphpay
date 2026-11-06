# Coordinator resume: the handover to a fresh Coordinator

Written by the outgoing Coordinator, Fri 6 Nov, about 10:40 IST. It replaces the "Handover state" section of `docs/plan/sessions/coordinator.md`. Read it first, then `docs/thinking-partner/NOW.md` and `OPEN.md`.

## Start

1. Ask the app to keep the Mac awake (`request_keep_awake`, until `session_idle`).
2. Set up your own tick with the cron tool (session-only). The old one used `7,27,47 * * * *`, as a polling cadence and not a target. **The outgoing Coordinator's tick and background tasks are stopped, so only you run.**
3. Run the first tick: PRs, conflicts, gates, sessions, usage, power.

## Standing rules (all hold)

- **No target times** (ADR-0066). Every task starts the moment it's given, runs as fast as it can, and is reported when it's done.
  - Only two deadlines are fixed: **submission, Sat 09:00 IST**, and **presentation, Sat 09:30 IST**.
  - Everything else is an event. The large city seeds the moment the story locks.
  - Clock times in older files are history.
- **Usage:** warn the founder at 90%. **At 92%, every session pauses gracefully** (ADR-0062). It was 86% at 10:24 IST, and the weekly window resets Fri 21:30 IST (16:00 UTC).
- **Effort:** every track session runs at high, not max (founder). The Coordinator runs Opus 5.5 at high.
- **Messages:**
  - The app stops cross-session Desktop messages after 10 sent without the founder typing. Do not work around this; ask the founder to type.
  - Never message a session while it is clearing.
  - Session clocks drift; take the time from `date`.
- **Secrets:**
  - Use only the helpers, always as `pnpm -s …`. `secrets:set NAME` is the founder's hidden prompt; `secrets:vercel NAME` sends a value as Sensitive and refuses `NEXT_PUBLIC_` and `VITE_` names.
  - Never read `~/.npmrc` or `.env`, and never type a password or one-time code for the founder.
- **Funding:**
  - Run `pnpm -s funding` (a dry run) first and read all of it. Then add `--execute --real`.
  - Never pipe a real run into `head`, which can kill it mid-send.
  - Every transfer goes into `docs/technical/WALLETS.md` §2b.
- **Presets:** never change a preset or default without the founder. ADR-0067 (Kimi) is the founder's decision.
- **CLAUDE.md's hard limits:** testnets only, never print or commit secrets, only `graphpay*` resources, no off-chain database.

## The live errand runner (option B): the founder's conditions

- It is server-side only, at `/api/agents/run`, and runs **only the live preset**.
- **Every guardrail stays on:**
  - the ENS gate before every signature;
  - the spend control and the contract caps;
  - one errand at a time per instance, and 6 an hour;
  - nothing is signed after the site stops a run.
- **Keys live only on Vercel:** never in browser code, never `NEXT_PUBLIC_`, and a missing key is logged by name only.
- **Both sites need it:** `graphpay-event` (`apps/web`) and the team's site once #70 merges, connected through the adapter contract.
- **Status:**
  - **#85 and #88 are merged and deployed** (Join, 10:5x). The reviewer found no blockers.
  - Three production errands ran through `/api/agents/run` on the live preset: 11.9, 9.4 and 7.6 s, each at most $0.025. The rows are in `OPEN.md`'s calibration table, and the evidence is in Join's PR #91.
  - **There is no purchase yet.** On Kimi the concierge answers with a plan and stops without delegating to the scout or analyst (`chosenShop` null), so nothing is signed or paid.
    - This is the agents' behaviour on Kimi (#87), not the runner's. T4 has Join's repro.
    - The testing preset may have the same problem, which would affect every errand and the video run.
    - Join re-runs the production smoke test after T4's fix.
  - D11's presence half passes (6.7 s to appear, lapsed after 14.98 minutes). D11's `shop_open` half has no runner.
  - Left over from #88's review (Join): a 429 for the rate limit, a unit test for the runner, and the `server-only` guard.
  - The provider is now **Kimi** (ADR-0067): the live preset is `kimi-k3.1-pro-highspeed` at high. It needs `KIMI_API_KEY` on Vercel.
  - Kimi is prepaid, so its balance is the spend cap across all instances.

## The website plan (the founder, Fri morning)

- **T5 has stopped building screens in `apps/web`.** It is the reviewer and integrator for the founder's team's site.
- **The team's PR is #70** (ajatshatru01, "Frontend code"); the founder confirmed it is the team's.
- **T5's review: do not merge yet.** The team must:
  - (a) move it into `apps/demo-ui` as a pnpm workspace app, with no npm lockfile;
  - (b) read the story and the explorer links from `@graphpay/config`;
  - (c) remove the middle dots and the uppercase labels;
  - (d) add the passcode to the adapter contract;
  - (e) add a CI step for `demo-ui`.
- **When the team pushes:**
  - T5 re-reviews: CI, `pnpm check`, the secret scan, no key or story name in browser code, and the passcode on every spending action.
  - The reviewer agent checks anything that spends.
  - Fork CI runs from a first-time contributor need approval (`gh run list`; the last one approved was 42162883431).
- **After the merge,** T5 builds on the team's site and connects it to the live routes and the runner. ADR-0065 covers the parallel team; ADR-0068 records this change.

## The two wallets (video and pitch)

- **What:** two fresh disposable agent wallets, one for the video and one for the pitch, with a fresh key per kill demo.
- **Status** (`pnpm -s funding --balances`, 10:3x IST):
  - **DISPOSABLE_2 and DISPOSABLE_3 already have keys and addresses, but they hold 0 WBT, 0 ETH and 0 tGLM.** Neither is in `wallets.fresh` or `scripts/funding/plan.json` yet, so the funding script refuses them.
  - DISPOSABLE_1 (0.005 WBT) was used: T2 reports it was killed on real Sepolia.
  - The `disposable-2/3` ENS labels in T2's fork tests exist only on the fork.
- **To ready them** (one small config PR, then a real funding run):
  1. Add both roles to `wallets.fresh`, as PR #59 did for DISPOSABLE_1.
  2. Add both to `scripts/funding/plan.json`: `m0.whitechain` 0.005 WBT and `usdt` 1 test USDT.
  3. Run `pnpm -s funding` (a dry run), then add `--execute --real`.
  4. Record the transfers in `WALLETS.md` §2b.
  - A wallet that has been killed is not reused. Generate another with `pnpm -s wallet:gen --only DISPOSABLE_<n>`.
- **FUNDER:** 2.5948 WBT, 0.2749 Sepolia ETH, 15.08 tGLM and about 15.54 test USDT. That covers both wallets.
- **W_SEED_M_EVENT** holds 8.5 tGLM for the large city.
- **Spending keys on Vercel Production** (names only, all Hidden): PAYER, FACILITATOR, RENEWER, SHOP_KESAR, SHOP_JAMUN, SHOP_SYRUP, VITALIK, W_DIRECTORY and W_SYNC private keys; WHITECHAIN_RPC_URL, ARKIV_ACCESS_KEY, ANTHROPIC_API_KEY, CRON_SECRET, DEMO_PASSCODE, FACILITATOR_AUTH_TOKEN, RECORDER_TOKEN and ALLOW_REAL_NETWORK.
- **RENEWER has a second use:** AgentPay's reference relayer, which made one real test payment.

## npm (ADR-0063, Friday item 18)

- **Both are published and checked:**
  - `@graphpay_ethglobal/arkiv-graph` 0.1.0 (Fri 10:14 IST; source as of #74): https://www.npmjs.com/package/@graphpay_ethglobal/arkiv-graph
  - `@graphpay_ethglobal/agentpay` 0.1.0 (Fri 10:40 IST; source as of #80): https://www.npmjs.com/package/@graphpay_ethglobal/agentpay
  - Each was installed from the registry in an empty folder. arkiv-graph's quickstart ran in memory; agentpay's sweet-shop and cab examples ran on a local anvil fork.
  - The versions and links are in `FACTS.md`, the README and `arkiv/how-you-use-arkiv.md`. The Whitechain sponsor file (Submission, M17) should link agentpay 0.1.0.
- **To publish:** in a Terminal-panel tab, run `cd ~/graphpay && git pull --ff-only -q && cd packages/<pkg> && pnpm publish --access public --publish-branch main`.
  - npm prints an `npmjs.com/auth/cli/<id>` link that **expires in about 5 minutes**. Send it at once; the founder approves it, or presses Enter in the tab to open it.
  - The old `login/cli/…` link is the sign-in link, not the publish approval.
  - If the main checkout lacks workspace links (`ERR_PNPM_CANNOT_RESOLVE_WORKSPACE_PROTOCOL`), run `fnm exec --using=22.23.4 pnpm install --frozen-lockfile` there.
- **For any later version, after the publish:** install it from the registry in an empty folder, run its quickstart, and record it in `FACTS.md`, the README and the sponsor files.
- **Versions:** 0.1.x for fixes, 0.2.0 for changes, driven by venue feedback (`FEEDBACK.md`, GitHub labels `arkiv-graph`, `agentpay`, `feedback`). **Freeze the published versions from submission until judging ends.**
- **Follow-up for agentpay 0.1.1 (T6):** drop the three workspace devDependencies (`@graphpay/config`, `contracts`, `facilitator`) from the published manifest. They are test-only and never installed by users, but they name a scope we don't own.

## Kimi (ADR-0067)

- **#87 (T4) has merged.** `testing` = `kimi-k3.1-pro`, `video` and `live` = `kimi-k3.1-pro-highspeed`, all at effort high (Kimi has no xhigh). The Anthropic presets stay as `anthropic-*`.
- **#89 (Coordinator):**
  - `KIMI_API_KEY` is a server-only name, and the scan has a Kimi rule.
  - Keys escaped in JSON are caught.
  - `secrets:set` refuses a value that isn't a Kimi key and says whether the scan recognises it.
  - The reviewer's verdict was ship. Auto-merge is on.
- **After it merges:**
  1. Pull `main` in `~/graphpay`. The prompt-log hook runs from there, so this is what turns on Kimi masking.
  2. The founder runs `cd ~/graphpay && pnpm -s secrets:set KIMI_API_KEY`.
  3. Push the key to Vercel with `pnpm -s secrets:vercel KIMI_API_KEY`.
  4. Tell T4 to calibrate: 3 errands per Kimi preset, with seconds and `apiCostUsd` in `OPEN.md`'s table.
  5. Tell Join to run the runner's smoke test.
- **Founder:** top up Kimi. $1 or more unlocks K3.1 Pro; $10 is Tier 1 (15 concurrent, 100 RPM). Add Kimi to `AI_USAGE.md` when it first runs.

## Sessions at handover

All are idle unless noted. Message them with `local_` ids.

| session | id | state, next |
|---|---|---|
| T1 Payments | `local_16ccf7cf-ca9a-497a-bfce-d8bb3415cd92` | M4 and F3 done; next, the demo cast's policies when the story locks |
| T2 Identity | `local_8ec48e25-b5c3-442f-b70d-a258266170ba` | M6 done, B7 (#83) and B9(a) (#84) done; next, the demo cast's ENS names when the story locks |
| T3 Arkiv | `local_949a2091-02b7-4f63-9c71-efebf8fe215a` | arkiv-graph published; Swarm menus (#82, #86); next, the `shop` rows and the **size-M seeding the moment the story locks** |
| T4 Agents | `local_0a83861b-1aaa-424f-abb4-cd36290807d2` | working: fixing the concierge so it delegates on Kimi (Join's repro), then calibration (3 errands per preset) |
| T5 Web | `local_e34793ca-bfc1-4489-8340-07a90fc9b703` | screens stopped; Re-order merged (#81); waits for the team's fixes on #70 |
| Join | `local_e67c2aa7-36f4-43ff-bee9-578ad5a1d519` | #85 and #88 merged and live; evidence in PR #91; re-runs the production smoke test after T4's fix |
| T6 AgentPay | `local_be1a1d1c-53bd-4570-b242-09a41617ce01` | 0.1.0 ready (#80); venue feedback, then 0.1.1 |
| Submission | not started | its gate (CP4) is met; starting it is the founder's call (usage) |

## Open decisions and founder items

1. **Lock the story.** The demo cast follows (T2 names, T1 policies, Join's bootstrap, T3 `shop` rows; then re-run B1, B2, B8, B9), and the size-M seeding starts the moment it locks. The seeding takes 100–130 minutes, uses W_SEED_M_EVENT, and needs a dry run first (`docs/sessions/arkiv/seeding.md`).
2. **The Kimi key and a top-up,** as above.
3. **#70:** the team's fixes (a)–(e).
4. **The Submission session:** start it now, or after the 21:30 reset.
5. **The disclosure** to ETHGlobal, if not sent (`docs/plan/DISCLOSURE_MESSAGE.md`).
6. **Charger in and lid open** until the presentation.

## Follow-ups (not blocking)

- **The prompt-log hook** (#24 review): trim, SIGKILL, `GIT_DIR`.
- **M0's review items** in `coordinator.md`: sign funding sends before broadcasting, and the setter drain bound.
- **The thinking-partner folder** must stay under about 20,000 words; T5's website relay is over its 800-word guide.
