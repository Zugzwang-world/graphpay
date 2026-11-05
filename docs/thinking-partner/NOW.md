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

Updated 02:10 IST, Fri 6 Nov (T1).
- **M1 merged (#12). M2 is done on the real chain:** the checkout is deployed on Whitechain Sepolia for the real test USDT, verified on the explorer and set up (the renewal relayer, three shops' refund floats, five agent spending policies from the story). PR with the scripts and records is open.
- Checkout: https://explorer.testnet.whitechain.io/address/0x75233b7341B9e86407e4b31599f07b8936716FcA (its address and deploy block are in the config for the mirror).
- The qualifying payment's readiness check passes: the acceptance agent holds 20 test USDT and has its 6.00/day policy.
- Next: M3 part A (our facilitator, the shop's 402 API, the recorder routes). Part B (real payments) waits for T2's M5 and M6.
- Blockers: none.

## identity
Updated 02:00 IST. **M5 is built and run for real; its PR is open.** The `graphpay.eth` namespace exists on Ethereum Sepolia: root, 4 owners, 16 agents (15 cast agents and `disposable-1`), the `sim` wildcard. 60 transactions, 72.7M gas.
- Acceptance reads B1, B4, B5, B8 (records) and B9 (a) (address records) pass on real Sepolia; fork tests (scoped grants, both transfer reverts, wildcard, payee) pass.
- The hand-off table (node, epoch, wallet, expiry per agent) is `docs/sessions/identity/namespace.md`.
- Running: nothing. Blockers: none. The reviewer pass on the signing code runs before merge.
- Next: M6 (gate, kill switch, watcher); the real policy writes wait for T1's M2, the facilitator's real gate for T1's M3. Meanwhile the gate's unit tests with fakes.

## arkiv

Updated 03:05 IST, Fri 6 Nov (T3).

- **Where we are:** M7a merged (01:51). The small test city (size S, test story) is on Arkiv's testnet: 91 actors, 12 shops, 1,003 events, all labelled synthetic. Graph store and shop directory done; the plain copy (the benchmark's baseline) is finishing. GraphQL, the explain trace and the hosted MCP endpoint (M7b) are built; the PR goes up when the plain copy is done.
- **Proven live:** asked through GraphQL, the seeded city answers the benchmark questions exactly as the generator's truth says. The city-wide top 10 takes 2 reads; the map query returns exactly the three cast shops (eleven with synthetic shops opted in).
- **Running:** the plain store, resumed after an RPC timeout (detached; `docs/sessions/arkiv/seeding.md`).
- **Blockers:** none.
- **Next:** ship M8 and M7b, check the routes on the production domain, then M9 (the live benchmark: reads, not speed).

## agents

Updated 02:40 IST. **M10 is merged; the presence and handoff hooks are built** (Friday item 2, before CP4).
- Agents can now announce themselves (presence, renewed every 5 min while an errand runs) and report each hand-off between agents with its explainer lane. Both are optional and do nothing until Join wires them (item 3).
- 64 tests pass on mocks; a run log with the hooks absent or recording is byte-identical to one without.
- Blockers: none. Next: merge, then wait for Join's M12 counting run; re-run the live errand if time allows.
## integration

Updated 02:05 IST. **The mirror (M11) now runs on the real Arkiv writer, in the emulator. The live run on the real networks waits for M2 (the deployed checkout) and M5 (the cast on ENS).**
- Done: PR 8 merged (the mirror's core). This step wires it to T3's writer (M7a) and T1's contract events (M1), and adds `pnpm workers`, the one long-lived process.
- Emulator result with the real planner: the good shop's tallies match the lab's lifecycle (orders 5, paid 6.40, one refund of 0.80, 2 fails, 3 delivered). A restart writes nothing. A refusal is counted once. The history and a live payment add to the same scoreboard. A second workers process is refused, and the heartbeat keeps beating during long work. 29 tests green; the reviewer's 2 blocking and 7 should-fix items are fixed.
- Running: nothing on a real network yet.
- Blockers: the checkout's address and deploy block (T1, M2) and the cast's names on ENS (T2, M5).
- Next: when both land, start `pnpm workers` on this Mac: register the cast, write the 5% history (about 100 Arkiv transactions, 10–15 min), mirror the lifecycle run, then D1–D3 and the network-drop test (D15).

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
