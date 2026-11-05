# Join: resume after a fresh start

Updated 02:50 IST, Fri 6 Nov. Read this first, then `docs/plan/sessions/join.md`.

## Where M11 stands

- Merged: PR 8 (the mirror core). The PR "the Arkiv ledger over M7a, the workers process" (M11 part 2) is PR 20 (https://github.com/Zugzwang-world/graphpay/pull/20), opened at 02:50 with auto-merge on. Check it merged, and if not, fix CI and merge `origin/main`.
- `packages/mirror`: decoding, mapping, parking, the lease and heartbeat, the recorder fold, the 5% history, the Arkiv adapter (`src/arkiv.mjs`), the process (`src/workers.mjs`, `src/main.mjs`, `pnpm workers`). 29 tests: 22 on fakes, 7 on ArkivSim with M7a's real planner.
- Not yet run on any real network.

## Waiting on

- T1, M2 (PR 15): `whitechain.contracts.checkout` with the address and deploy block. `main.mjs` reads `checkout.address` and `checkout.deployBlock`. If M2 named them differently, adjust `main.mjs` (one line) or set `GRAPHPAY_CONTRACT` and `DEPLOY_BLOCK`.
- T2, M5: the cast on ENS, with epochs (fresh names are epoch 0; `BOOTSTRAP_FILE` overrides). The Coordinator says when it lands. Then host the M6 watcher in `main.mjs`.

## Then (finishes M11)

1. Run `fnm exec --using=22.23.4 pnpm workers` in the background on the founder's Mac. It registers the cast, writes the 5% history (about 100 transactions, 10–15 min) and mirrors from the deploy block.
2. Compare with the lifecycle run (T1, M3 part B, as `rehearsal.vitalik`). The tallies should match its transcript, with 0 parked events.
3. Run D1 (decode the Rabdi tx of C2's payment: edge, 4 tally rows, link, checkpoint; record the gas ratio to 310,527), D2 (a/b/c), D3 (`reputation(verify: true)` after M7b), D15 (`docs/sessions/integration/mirror.md`), and 30 minutes with lag under 30 s.
4. Ship with the title ending `(M11 done)`, then M12 (`planning/PROMPTS/12-e2e-food.md`).

## Notes

- The reviewer runs on every money, key or writer change.
- This Mac's DNS drops now and then. Pushes may stall, so retry.
- Budget: keep tool output short, use no polling loops inside a turn, and end the turn when blocked.
