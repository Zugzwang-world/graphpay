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

Updated 02:35 IST, Fri 6 Nov (T1).
- **M1 (the checkout contract) is done: two reviewer passes said ship; PR #12 merges once the contract tests are green in CI.** 90 tests pass on a copy (fork) of the real Whitechain Sepolia, paying in the real test USDT through the real Permit2.
- The first agent payment costs about 318,000 gas of execution (about 351,000 on a real receipt, inside acceptance C2's band); the payer pays no gas.
- The contract's interface (ABI) is exported for the mirror (Join's M11).
- Next: M2 deploys and verifies the checkout on Whitechain Sepolia and sets up roles, merchants and policies; the facilitator and shop API (M3) start alongside.
- Blockers: none.

## identity

Not started (T2, wave 1).

## arkiv

Updated 01:40 IST, Fri 6 Nov (T3).

- **Where we are:** M7a is built and tested; its PR is going up now. The Arkiv layer is two packages: a generic graph SDK, `@graphpay/arkiv-graph` (to be published on npm on Friday; ADR-0057), and GraphPay's own layer, `@graphpay/money-graph`, which uses the SDK only through its public API.
- **Proven live on Arkiv's testnet:** the predicate limit (64 accepted, 65 refused), one probe money event in one atomic transaction (377,893 gas at steady state against the lab's 310,527), receipts that cannot be edited (a simulated edit reverts, a tally edit would pass), and the map query: a box around the probe shop finds it, a box beside it finds nothing.
- **Running:** the reviewer pass on the writer.
- **Import path for T1's recorder and Join's mirror:** `import { connectArkiv, createLedger, recordEdge, createQuote, findQuotes } from '@graphpay/money-graph'` (details in `docs/sessions/arkiv/README.md`). Join's three asks are all in (fixed nonce with NONCE_TAKEN, folding recorder edges, the heartbeat row).
- **Blockers:** none.
- **Next:** when M7a merges, the small test city (size S only, test story) seeds in the background; then M7b (GraphQL, explain, the hosted MCP).

## agents

Updated 01:45 IST. **M10 built; five live errands on the testing preset all paid the good shop and never the trap.** The "(M10 done)" PR is the next merge.
- 5 of 5 live runs: 73 to 321 s (median 94 s), $0.29 to $0.31 and about 47,000 to 52,000 tokens each, on mock services (rows in `OPEN.md`).
- Reviewer pass done, findings fixed. Join's M12 can wire against `packages/agents/index.d.ts` and `docs/sessions/agents/NOTES.md`.
- Next: merge, then the Friday presence and handoff hooks.

## integration

Updated 01:20 IST. **Join is running: the mirror (M11) is being built on test doubles while it waits for M7a (Arkiv writer), M1 (checkout events) and M5 (the cast on ENS); none has merged yet.**
- Done: the mirror's core in `packages/mirror`: reading checkout events, turning each into one Arkiv write, parking events whose actor is unknown, the one-writer lease, folding the recorder's refusals, the 5% labelled cast history, the local endpoints and keep-awake. 22 tests green on fakes.
- The lab's lifecycle result reproduces on the fake ledger: the good shop's orders 5, paid 6.40, one refund of 0.80, 2 fails, 3 delivered.
- Running: nothing on any network yet; polling merged PRs every 10 minutes.
- Blockers: only the gates above. The Mac's DNS dropped twice (00:50 and 01:15 IST); work continues offline.
- Next: as soon as M7a merges, run the mirror on ArkivSim with the real tally planner and writer; then M1's ABI and M5's hand-off; then the live run on Rabdi (D1–D3, D15).

## website

Updated 03:03 IST, Fri 6 Nov (T5 Web). **The shell and the phone views are on `main` and live** at https://graphpay-event.vercel.app. A PR adds the agent run route: one request starts an errand and streams its events back, one errand at a time; it answers "not live yet" until Join wires the agents' live services (M12).
- Running: nothing long. Panels needing other tracks' routes say which milestone they wait for.
- Blockers: none; the venue network to GitHub is slow (retries).
- Next: wire each panel as its route merges (M4, M6, M7b, M9, M12); M16 once M4 lands; Friday items 8 to 13. A fresh start file is at `docs/sessions/website/resume.md`.

## records

Updated 01:20 IST. **The Coordinator is on duty** (`docs/plan/sessions/coordinator.md`): 10-minute ticks from 00:58, a keep-awake hold, merges, records.
- Done: ADR-0057 and Friday item 18 (the graph SDK on npm); T3 briefed at 01:04 and adopted it in M7a; the npm name checked (free); the first M14 relay; AI usage rows for the new sessions.
- Running: the ticks (PRs, conflicts, gates, `OPEN.md` questions, silent sessions).
- Blockers: none. Risk: plan usage (`OPEN.md` "Founder now" 1).
- Next: each session's prompt log written into its own worktree (P-records-1); M7a's gate messages; records again about 02:45.

## submission

Not started (the Submission session, M17, from Fri 13:00; submit by Sat 08:00 IST).
