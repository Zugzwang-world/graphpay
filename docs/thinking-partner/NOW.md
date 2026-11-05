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
Updated 02:00 IST. **M5 is built and run for real; its PR is open.** The `graphpay.eth` namespace exists on Ethereum Sepolia: root, 4 owners, 16 agents (15 cast agents and `disposable-1`), the `sim` wildcard. 60 transactions, 72.7M gas.
- Acceptance reads B1, B4, B5, B8 (records) and B9 (a) (address records) pass on real Sepolia; fork tests (scoped grants, both transfer reverts, wildcard, payee) pass.
- The hand-off table (node, epoch, wallet, expiry per agent) is `docs/sessions/identity/namespace.md`.
- Running: nothing. Blockers: none. The reviewer pass on the signing code runs before merge.
- Next: M6 (gate, kill switch, watcher); the real policy writes wait for T1's M2, the facilitator's real gate for T1's M3. Meanwhile the gate's unit tests with fakes.

## arkiv

Not started (T3, wave 1).

## agents

Not started (T4, wave 1).

## integration

Not started (Join, when M7a merges).

## website

Not started (T5, wave 1). A placeholder page is live at https://graphpay-event.vercel.app.

## records

Not started (the Coordinator, M14, every 2 hours from about 00:45).

## submission

Not started (the Submission session, M17, from Fri 13:00; submit by Sat 08:00 IST).
