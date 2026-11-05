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

Updated 04:20 IST, Fri 6 Nov (T1).
- **M2 merged (#15):** the checkout is live on Whitechain Sepolia for the real test USDT, verified and set up.
- **M3 part A is in review:** our own x402 facilitator (every drain check runs before the relayer sends anything), the shop's 402 payment API and the refusal recorder. 73 offline tests, and a full run on a local copy of Whitechain against the real contract and test USDT: paid 4.80 with no gas from the agent, a replay answered "already paid", refund 0.80, re-order 1.20, a forged signature never sent, a revoked agent recorded on-chain.
- Running: the `pay/facilitator` PR. Reviewer pass 1 found three blocking issues (the sharpest: a signature form the chain rejects would have passed our check), all fixed; pass 2 is running, then auto-merge.
- Next: M4 groundwork (the hosted routes) while part B (real payments as `rehearsal.vitalik`, the subscription, the qualifying payment C7) waits for T2's M5 and M6.
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

Updated 02:40 IST. **M10 is merged; the presence and handoff hooks are built** (Friday item 2, before CP4).
- Agents can now announce themselves (presence, renewed every 5 min while an errand runs) and report each hand-off between agents with its explainer lane. Both are optional and do nothing until Join wires them (item 3).
- 64 tests pass on mocks; a run log with the hooks absent or recording is byte-identical to one without.
- Blockers: none. Next: merge, then wait for Join's M12 counting run; re-run the live errand if time allows.
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
