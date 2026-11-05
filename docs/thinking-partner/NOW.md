# NOW

Updated 23:05 IST, Thu 5 Nov (main)

## Summary (main only)

Updated 23:55 IST, Thu 5 Nov. **M0 is complete and merged (PRs #1–#6); ready for handover.** The founder starts all six track sessions and a fresh Coordinator from `docs/plan/sessions/README.md` (one run file each). The M0 session takes no more work.

Done:
- the repo is protected; every change goes through PRs with auto-merge;
- every wallet funded on all three testnets (FUNDER also holds 15.76 tGLM and 31.75 test USDT for top-ups);
- the founder's Ankr RPC is stored (in `.env` and in Vercel as Sensitive);
- facts re-verified;
- the one story config, the agent presets and the no-story-in-code check are on `main`;
- the live site is https://graphpay-event.vercel.app.

Next:
1. The founder starts T1–T5 and Join together, then the Coordinator (start lines in the index).
2. Only the small city is seeded tonight; the large city waits for the founder's story lock, latest start Fri 14:00 (the Coordinator loads it).
3. Acceptance targets Fri 05:00–06:00 IST; feature freeze Fri 18:00; submit by Sat 08:00.

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

Updated 01:20 IST. **Join is running: the mirror (M11) is being built on test doubles while it waits for M7a (Arkiv writer), M1 (checkout events) and M5 (the cast on ENS); none has merged yet.**
- Done: the mirror's core in `packages/mirror`: reading checkout events, turning each into one Arkiv write, parking events whose actor is unknown, the one-writer lease, folding the recorder's refusals, the 5% labelled cast history, the local endpoints and keep-awake. 21 tests green on fakes.
- The lab's lifecycle result reproduces on the fake ledger: the good shop's orders 5, paid 6.40, one refund of 0.80, 2 fails, 3 delivered.
- Running: nothing on any network yet; polling merged PRs every 10 minutes.
- Blockers: only the gates above. The Mac's DNS dropped twice (00:50 and 01:15 IST); work continues offline.
- Next: as soon as M7a merges, run the mirror on ArkivSim with the real tally planner and writer; then M1's ABI and M5's hand-off; then the live run on Rabdi (D1–D3, D15).

## website

Not started (T5, wave 1). A placeholder page is live at https://graphpay-event.vercel.app.

## records

Not started (the Coordinator, M14, every 2 hours from about 00:45).

## submission

Not started (the Submission session, M17, from Fri 13:00; submit by Sat 08:00 IST).
