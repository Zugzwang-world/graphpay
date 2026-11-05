# Join

Activity `integration`; your own worktree; branches `join/*`. Read `CLAUDE.md` and `planning/README.md`, then each prompt and its inputs.

## Goal and milestones, in order

The mirror as the one workers process, one errand end to end on the real networks, and `pnpm acceptance` (CP4).

| step | prompt (`planning/PROMPTS/`) | also apply |
|---|---|---|
| M11 mirror | `11-mirror.md` | every edge readonly (`docs/plan/amendments/M7-arkiv.md` §4; ADR-0034); keep-awake and resume (ADR-0056); HTTPS polling (ADR-0055) |
| M12 `e2e:food` | `12-e2e-food.md` | wire `resolvePayee` and `readAccepts` (`docs/plan/amendments/M5-ens.md` §2), the quote hook with `requestId` through the shop gateway, and discovery (`M7-arkiv.md` §5, §6) |
| M13 `pnpm acceptance` | `13-acceptance.md` | `planning/ACCEPTANCE_TESTS.md` plus `docs/plan/ACCEPTANCE_ADDITIONS.md`; run it Fri 05:00–06:00 IST (ADR-0053) |
| Friday | `docs/plan/MASTER_PLAN.md` §4 | items 3 (live presence and handoff hooks), 6 (the demo cast's bootstrap and history), 14 (`pnpm acceptance --friday`, which the Coordinator runs) |

## Gates

- M11 needs T3's M7a (the writer), T1's M1 (ABI and events) and T2's M5 (the cast on ENS). Until they merge, build what does not need them: the event decoding from `planning/SPEC/PAYMENTS_WHITECHAIN.md`, the bootstrap, the checkpoint and heartbeat logic, tests on fakes. M11's live run mirrors T1's real lifecycle (M3 part B).
- M12 needs M3, M6, M7b, M10 and M11. M13 needs M4, M9 and M12; C7 reads T1's qualifying payment.
- **How to wait:** every 10 minutes, `gh pr list --state merged --limit 30`; a milestone has landed when a merged PR title ends `(Mn done)`, so end yours the same way. Meanwhile build what the gate does not block.

## Owns

`packages/mirror` (the workers process, which also hosts T2's watcher), `integration/`, `acceptance/`, `ACCEPTANCE_REPORT.md`, `docs/sessions/integration/`.

## Acceptance checks

M13 runs every id in both files. Yours to pass: D1–D3 and D15 (M11), E1–E7 and E8's rows (M12), and the report itself: only C7, E3 and D7 may be `blocked`, and C7 and E3 no longer wait on supply (ADR-0054).

## The specific rules for this session

- Run exactly one workers process (`pnpm workers`) on the founder's Mac, under `caffeinate -ims -w <its pid>`, and prove it resumes from its last processed block after a network drop (D15).
- Every e2e run records the seconds and the API cost of each full errand in the preset calibration table of `docs/thinking-partner/OPEN.md` (E8).
- D7 stays `blocked: waiting for the locked story` until the Coordinator reports the M city seeded.
- Caps reset at 05:30 IST. `acceptance.vitalik`'s 6.00 covers exactly C2 and C3, so if it has paid today (the qualifying payment), run the paying checks after the reset (`pnpm acceptance --dry-run` first).
- No acceptance run, and no hosted relayer key in a local process, while the website demo is live.
- Short of time: map heartbeats (item 3) are second in ADR-0053's cut order; the core order M11 → M12 → M13 never moves.

## Unattended rules

1. **Keep going.** When a task merges, start the next unblocked one: your next milestone, then your Friday items (before CP4, additive with no-op defaults). Never end a turn to wait.
2. **Never wait on the founder.** Put the question in your `OPEN.md` section (what, where, why, your recommendation), take the safe default the pack or the ADRs allow, and go on. Only logins, funding, secrets and irreversible steps wait for him. The Coordinator reads `OPEN.md` every 10 minutes.
3. **Poll for dependencies** (Gates); the Coordinator also tells you when one lands.
4. **Small PRs, auto-merge, docs promptly** (skill `ship`); docs-only commits skip the Vercel build.
5. **Secrets:** run helpers as `pnpm -s secrets:…` (pnpm echoes its arguments); never print or paste a secret; ask the Coordinator for top-ups.

## Thinking-partner update

Activity **`integration`**, in each step's PR (skill `relay`): your `integration` sections of `docs/thinking-partner/NOW.md`, `OPEN.md` and `LOG.md`, `relays/integration.md`, and any brief you receive, in `briefs/<HHMM>-<slug>.md`.

## Model and effort

Opus 5.5 at **xhigh**: the critical path on real networks (mirror, e2e, acceptance).
