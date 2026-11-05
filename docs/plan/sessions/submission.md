# Submission

Activity `submission`; your own worktree; branches `submit/*`. Read `CLAUDE.md` and `planning/README.md`, then each source below.

## Goal and milestones, in order

M17: everything a judge or a sponsor reads is in the repo, true and linked, and the founder submits by **Sat 08:00 IST** (hard deadline 09:00; ADR-0053).

| step | source | also apply |
|---|---|---|
| sponsor files, README | `planning/PROMPTS/17-submission.md`; `planning/SPONSOR_CHECKLIST.md` §1, §2, §4, §5 | the tracks of ADR-0051: Arkiv "Build on Arkiv" with the Swarm bonus, ENS "Best Use of ENSv2", Whitechain Operate (§3, Scale, is not entered); the ~20-line drop-in (ADR-0032); full AI disclosure (ADR-0028) |
| the `arkiv/` files | `docs/plan/MASTER_PLAN.md` §4 item 15 | finish T3's drafts of `friction.md`, `how-you-use-arkiv.md` and `swarm.md`; write `reach.md` and `why-arkiv.md` |
| video shot list, narration | `planning/WEBSITE_SPEC.md` §11 | the founder's own voice, a Mac screen recording at real speed; the ENS moment as `docs/plan/amendments/M5-ens.md` §5 words it |
| submission text, checklist | `SPONSOR_CHECKLIST.md` §6 | every row done with a link, or listed as a founder action |

## Gates

- Start at Fri 13:00 IST or when CP4 is done (`ACCEPTANCE_REPORT.md` on `main`), whichever is later.
- Numbers wait for their sources: the report (CP4); `bench/` results (M9; M only after D7); the live site and store (M15, M16, CP5).
- Feature freeze at Fri 18:00; after it, docs and fixes for real breakages only.
- **How to wait:** every 10 minutes, `gh pr list --state merged --limit 30`; a milestone has landed when a merged PR title ends `(Mn done)`. Meanwhile write what already has its sources.

## Owns

`README.md`, `AI_USAGE.md` (the Coordinator sends you the sessions and models), `WHITECHAIN_FEEDBACK.md`, the `arkiv/` files except `schema.md`, and `docs/submission/` (the submission text, the shot list and narration, the checklist).

## Acceptance checks

`SPONSOR_CHECKLIST.md` §6 green. From `planning/ACCEPTANCE_TESTS.md`: C7's explorer link in the README (M13's done-when), A2 and F1 (no secrets). From `docs/plan/ACCEPTANCE_ADDITIONS.md`: D9's wording ("cannot be edited") and D13's headline in reads. Every link checked.

## The specific rules for this session

- Only this repo's own measurements, never lab numbers; every number with its source; synthetic data labelled, with the city size. Without the M city the race is about 2 reads against 5–6 at S: say so rather than quote 48.
- Track wording lives only in the sponsor files and the submission text; the product stays a general Whitechain payments solution (ADR-0051).
- Wording (ADR-0052): identify (ENS), remember (Arkiv), pay (Whitechain); "decentralized, secure and verifiable"; receipts "cannot be edited"; never "hidden" or "permanent"; "known by name, not by data", never "private" or "anonymous"; "tallies".
- Live links use https://graphpay-event.vercel.app and the store's production domain, never a preview URL.
- The founder reviews the README and the sponsor files, records the video and submits (title, description, repo link, three partner prizes): keep each as a to-do with its time in your `OPEN.md` section.
- Never cut the sponsor files or the video (ADR-0053).

## Unattended rules

1. **Keep going.** When a task merges, start the next unblocked one: the next row above, then whatever the checklist still lacks. Never end a turn to wait.
2. **Never wait on the founder.** Put the question in your `OPEN.md` section (what, where, why, your recommendation), take the safe default the pack or the ADRs allow, and go on. Only logins, funding, secrets and irreversible steps wait for him. The Coordinator reads `OPEN.md` every 10 minutes.
3. **Poll for dependencies** (Gates); the Coordinator also tells you when one lands.
4. **Small PRs, auto-merge, docs promptly** (skill `ship`); docs-only commits skip the Vercel build.
5. **Secrets:** run helpers as `pnpm -s secrets:…` (pnpm echoes its arguments); never print or paste a secret; ask the Coordinator for top-ups.

## Thinking-partner update

Activity **`submission`**, in each step's PR (skill `relay`): your `submission` sections of `docs/thinking-partner/NOW.md`, `OPEN.md` and `LOG.md`, `relays/submission.md`, and any brief you receive, in `briefs/<HHMM>-<slug>.md`.

## Model and effort

Sonnet 5.5 at **high**: writing to a checklist from the repo's own records.
