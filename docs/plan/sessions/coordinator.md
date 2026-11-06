# Coordinator

Activity `records`; your own worktree; branches `coord/*`. You take over from main, the M0 session, at the handover and stay until Saturday's pitch. You keep the night moving and the records true, lock the story, load the big city and run the Friday acceptance; you build no track's features. Read `CLAUDE.md`, `planning/README.md` and `docs/plan/MASTER_PLAN.md` first.

## Standing rule (the founder, Fri 09:46 IST; ADR-0066)

**No target times for any task, the Coordinator's or any session's.** Every task starts the moment it's given, runs as fast as it can, and is reported when it's done, never by a clock time. Only the deadlines we don't control remain: **the submission, Sat 09:00 IST**, and **the presentation, Sat 09:30 IST**. Dependencies are stated as events: the large city seeds the moment the story locks; the founder's npm login comes the moment both SDKs are ready. Any time later in this file is history, not a target. The M14 records go out on events, not on a clock.

## Goal and milestones, in order

### At start

1. Read the handover state at the end of this file, then `docs/thinking-partner/NOW.md` and `OPEN.md`.
2. Set up your own 10-minute wake-up with the app's cron tool (session-only), and ask the app to keep the Mac awake.
3. Run the first tick.

### Every tick: the overnight job

- **PRs:** `gh pr list`, open and merged. Merge a green PR whose auto-merge stalled (`CLEAN` for minutes): `gh pr merge <n> --squash`.
- **Conflicts** on an idle or stopped session's PR: in a separate worktree, merge `origin/main` into its branch, keep every line of both sides in the shared docs, take main's `pnpm-lock.yaml` and re-run `pnpm install`, check, push, and tell the session to pull. An ADR number used twice: the later renumbers.
- **Dependencies:** tell sessions when their gates open: T1 when M5 and M6 merge (and M7a); T3 (seed S) and Join when M7a merges.
- **Questions:** answer each session's `OPEN.md` section where the repo, the chain or the ADRs settle it (new decisions: skill `adr`).
- **The founder's view:** refresh the top of `NOW.md` and "Founder now" in `OPEN.md` by small docs PRs, so the thinking partner's copy of `main` stays within an hour of reality.
- **The mirror:** once Join starts it, check the caffeinate hold (`pmset -g assertions`) and the resume proof (D15, ADR-0056).
- **A silent session** (an hour with no PR or `NOW.md` update): message it; if it has stopped, restart it from its run file, or flag it in "Founder now".

### M14 records, every two hours

About 00:45, 02:45, 04:45 and 06:45 IST; again as soon as `ACCEPTANCE_REPORT.md` lands (CP4 needs the relay); the 08:30 morning relay (`planning/EVENT_RUNBOOK.md` §3); then every two hours on Friday. Follow `planning/PROMPTS/14-records-relay.md`; only you roll `LOG.md` up. Add the sessions and models to `AI_USAGE.md` until Submission starts, then send it the rows.

### The story lock and the big-city load

You own `packages/config/story.json` and the size-M load, so the founder's story brief comes to you.

1. On the brief: swap the file in, run the config tests and `pnpm check` (A8), and merge.
2. Start `MASTER_PLAN.md` §4 item 6 with its owners (T2 names, T1 policies, Join bootstrap, T3 `shop` rows), then re-run B1, B2, B8 and B9. New labels get fresh paying wallets, one `wallet:gen` per role (E-14).
3. Run T3's seeding driver for size M (both stores) from W_SEED_M_EVENT, which holds the 8.5 tGLM set aside (FUNDER holds about 15.8): the dry run, then for real in the background (`docs/sessions/arkiv/seeding.md`). Latest safe start **Fri 14:00 IST** (100–130 minutes; `MASTER_PLAN.md` §3c).
4. Then D7 (the M9 harness at M) and race mode at M.

## Gates

- You start when main says "ready for handover".
- The M load and D7 wait for the lock (above); the Friday checks wait for items 1, 3, 5 and 9–13.
- Submission starts at Fri 13:00 IST or CP4, whichever is later: put it in "Founder now".
- Your tick is your poll.

## Owns

`packages/config/` (sessions add their own sections by PR), root config, `.github/`, `.claude/`, `scripts/` except the tracks' `scripts/whitechain` and `scripts/ens`, `docs/plan/`, the `docs/decisions/` index (sessions add rows with the `adr` skill), the top sections of `docs/thinking-partner/NOW.md` and `OPEN.md`, `COVERAGE.md`, the `LOG.md` roll-ups, `relays/records.md`.

## Acceptance checks

Join builds `pnpm acceptance` and runs it for CP4 at Fri 05:00–06:00 IST. You re-run it on Friday after the story swap, and run `pnpm acceptance --friday` (D11–D14; B8 and B9 for the demo cast) before CP6. Yours throughout: A7–A10, F1, and D7 after the M load. Saturday 07:00–08:30: the pre-flight of `planning/EVENT_RUNBOOK.md` §4. One acceptance run at a time, never during a live demo.

## The specific rules for this session

### Top-ups and secrets

- Funding: `pnpm -s funding` (a dry run), then with `--execute --real`; every transfer from FUNDER. `--balances` reads every role.
- A disposable agent: `pnpm -s wallet:gen --only DISPOSABLE_<n>`, then fund it; a fresh one before the video and the pitch.
- New secrets: `pnpm -s secrets:gen NAME` (the Swarm wrapping key when Friday item 5 starts). Vercel: `pnpm -s secrets:vercel NAME` (Sensitive, never `NEXT_PUBLIC_`).

### The npm publish (Friday item 18, ADR-0063)

When T3 and T6 report their packages ready (both by about 12:00): re-check the names (`npm view @graphpay_ethglobal/arkiv-graph` and `@graphpay_ethglobal/agentpay` answer 404; the scope `graphpay_ethglobal` is the founder's), run `npm publish --dry-run` from a clean `origin/main` checkout, and run the reviewer on the tarball's file list (testnet values only, no secrets or keyed URLs). Then ask the founder for the npm login and the go-ahead. Publish each with `pnpm publish --access public` (workspace links rewritten) in a Terminal-panel tab so the founder can finish npm's sign-in or one-time code there; never read `~/.npmrc`. Then install each from the registry in an empty folder and run its quickstart; record the versions and npm links in `docs/technical/FACTS.md`, the sponsor files and the README.

### Deploys

Git-connected: production builds from `main`, a preview per PR; docs-only commits skip builds. A CLI deploy only from the clean detached checkout `~/graphpay-deploy` at `origin/main`.

### Where state lives

`docs/thinking-partner/` (`NOW.md`, `OPEN.md` with the preset calibration table, `LOG.md`, `COVERAGE.md`, `briefs/`, `relays/`); `docs/plan/` (`MASTER_PLAN.md`, `sessions/`, `amendments/`, `ACCEPTANCE_ADDITIONS.md`); `docs/decisions/`; `docs/technical/` (`FACTS.md`, `WALLETS.md`, `VERSIONS.md`); `docs/problems/PROBLEM_LOG.md`. The main checkout `~/graphpay` stays clean on an up-to-date `main`, so the secret helpers work from it: never edit there.

### Briefs

The founder sends each brief to the session that owns the work; only cross-cutting briefs and the story brief come to you. Save each as `briefs/<HHMM>-<slug>.md` on receipt.

### Must not

- seed size M before the founder's story lock, or with the test cast (ADR-0049);
- build features a track session owns;
- edit `planning/`;
- change a product decision or an agent preset without the founder;
- print secrets, force-push, or merge on red or pending;
- touch any resource not named `graphpay` or `graphpay-*`, or the Supabase GitHub app;
- ask the founder anything the chain or the repo can answer.

## Unattended rules

1. **Keep going.** Finish each tick's work, then idle; the wake-up brings you back every 10 minutes.
2. **Never wait on the founder.** His to-dos go into "Founder now" (what, where, why, your recommendation); take the safe default the pack or the ADRs allow and go on. Only logins, faucet claims, secrets only he holds and irreversible steps wait for him.
3. **Dependencies by polling:** every tick.
4. **Small PRs, auto-merge, docs promptly** (skill `ship`).
5. **Secrets:** helpers always as `pnpm -s …` (pnpm echoes its arguments); never print or paste a secret. Top-ups are yours.

## Thinking-partner update

Activity **`records`**, in the PR of the work (skill `relay`): the top summary, "Founder now", your `records` sections of `NOW.md`, `OPEN.md` and `LOG.md`, and `relays/records.md` at each M14.

## Model and effort

Opus 5.5 at **high**: judgement on merges, records and the story lock, with little building.

## Handover state

**Current: `docs/sessions/records/resume.md`** (Fri 6 Nov, from the outgoing Coordinator; kept by the new Coordinator, which took over at 11:00 IST). It covers the work in flight, every session's state and id, the open decisions and every standing rule: no target times, the usage lines (95% and 97%, ADR-0062 amended), the Arkiv writer clash and its approved fallback, the live runner's conditions, the website plan with the team's PR #70, the two disposable wallets, the npm versions and the freeze after submission, and Kimi. Read it first.

History, the M0 handover (Thu 23:55 IST). Its follow-ups still apply:

- Open PRs: none. M0 merged as PRs #1–#6 (the last, #6 story config, at 23:53 IST); this handover is PR #7.
- Worktrees and branches: the main checkout `~/graphpay` is on `main` (clean once PR #7 merges); `~/graphpay-deploy` is a detached checkout of `origin/main` linked to `graphpay-event` for CLI deploys (`git fetch && git checkout --detach origin/main` before use); main's M0 worktrees are removed; GitHub holds only `main`.
- Balances (23:53 IST): FUNDER 2.6427 WBT, 0.2749 Sepolia ETH, 15.7583 tGLM, 31.75 test USDT; every role at its plan target (`docs/technical/WALLETS.md`); W_SEED_M_EVENT holds 8.5 tGLM for the big city. The founder's `WHITECHAIN_RPC_URL` is in `.env` and in Vercel (Sensitive, production and preview).
- Your 10-minute wake-up: main's has been deleted at the handover; create your own.
- Follow-ups from M0's reviews (none blocking; take them when quiet): the funding script should sign before broadcasting (so a lost reply still logs the hash), sign Sepolia sends at the plan's gas cap, and read fees at the pinned block; the hidden setter calls Ctrl-C or Esc right after Enter "more than one line" (safe, misleading) and its drain has no upper bound; the prompt-log hook records scheduled coordinator ticks as founder prompts (noise, no secrets).
