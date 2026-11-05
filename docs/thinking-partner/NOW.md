# NOW

Updated 01:20 IST, Fri 6 Nov (Coordinator)

## Summary (Coordinator only)

Updated 01:20 IST, Fri 6 Nov. **Wave 1 is running.** T1–T5 and Join started at about 00:44 IST; the Coordinator took over at 00:46 (10-minute checks, merges, records). No track has opened a PR yet; T3 is building M7a, the first gate (T1's recorder, Join's mirror and the small city wait for it).

New since the handover:
- **Usage risk:** the weekly plan limit is 71% used and resets Fri 21:30 IST. All seven sessions started on Opus 5.5 at max effort; at 01:22 the Coordinator switched the six track sessions to the planned mix (from their next turn). The Coordinator's own setting and extra usage are the founder's (`OPEN.md` "Founder now" 1).
- **The graph layer becomes a developer SDK** (ADR-0057): T3 keeps `@graphpay/arkiv-graph` generic now, GraphPay's payment model sits in `packages/money-graph`, and on Friday after acceptance the package goes to npm (Friday item 18).
- M0's background tasks: none failed (11 agents and 3 background commands, all completed; `relays/records.md`).

Next:
1. Tell T1 and Join M7a's import path when it merges; CP2 expected about 01:35.
2. Acceptance (CP4) about 05:30 IST; the next records relay about 02:45.
3. The large city waits for the founder's story lock (by Fri 08:30 for rehearsal 1, at the latest 13:00; seeding starts by 14:00).

## foundation

Updated 23:55 IST. **M0 done; handed over to the Coordinator** (`docs/plan/sessions/coordinator.md`).
- Merged: #1 web placeholder, #2 Vercel install fix, #3 secret helpers and config (three reviewer passes), #4 funding script (two passes), #5 records, #6 story config and presets (one pass and fixes); this handover is #7.
- A1–A6 pass. CI green on `main`; Vercel builds only for code changes.
- FUNDER at 23:53: 2.6427 WBT, 0.2749 Sepolia ETH, 15.7583 tGLM, 31.75 test USDT. No shortfall.
- Open follow-ups (none blocking) are listed in the coordinator file's handover state.

## payments

Not started (T1, wave 1).

## identity

Not started (T2, wave 1).

## arkiv

Not started (T3, wave 1).

## agents

Not started (T4, wave 1).

## integration

Not started (Join, when M7a merges).

## website

Not started (T5, wave 1). A placeholder page is live at https://graphpay-event.vercel.app.

## records

Updated 01:20 IST. **The Coordinator is on duty** (`docs/plan/sessions/coordinator.md`): 10-minute ticks from 00:58, a keep-awake hold, merges, records.
- Done: ADR-0057 and Friday item 18 (the graph SDK on npm); T3 briefed at 01:04 and adopted it in M7a; the npm name checked (free); the first M14 relay; AI usage rows for the new sessions.
- Running: the ticks (PRs, conflicts, gates, `OPEN.md` questions, silent sessions).
- Blockers: none. Risk: plan usage (`OPEN.md` "Founder now" 1).
- Next: each session's prompt log written into its own worktree (P-records-1); M7a's gate messages; records again about 02:45.

## submission

Not started (the Submission session, M17, from Fri 13:00; submit by Sat 08:00 IST).
