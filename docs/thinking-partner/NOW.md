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

Updated 01:31 IST, Fri 6 Nov (T5 Web). **The website shell is on `main` and live** at https://graphpay-event.vercel.app (the top-bar chips already show the three chains' real latest blocks). Now adding the phone views' Friday items that need no other track: the request card (budget chip, deadline countdown), the spending pass states, merchant notifications.
- Running: nothing long. Panels that need other tracks' routes say which milestone they wait for (M4, M6, M7b, M9, M10, M11).
- Blockers: none. The venue network to GitHub is slow (retries needed).
- Next: wire each panel as its route merges; M16 once M4 lands; Friday items 8 to 13.

## records

Not started (the Coordinator, M14, every 2 hours from about 00:45).

## submission

Not started (the Submission session, M17, from Fri 13:00; submit by Sat 08:00 IST).
