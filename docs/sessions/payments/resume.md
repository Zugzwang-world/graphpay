# T1 Payments: resume note (04:05 IST, Fri 6 Nov)

Read `docs/plan/sessions/T1-payments.md` first; this note says where the work stands.

## Done
- **M1 merged** (#12), **M2 merged** (#15). Notes: `m1-contract.md`, `m2-deploy.md`, `txlog.jsonl`.
- **M3 part A**: `packages/facilitator`, `packages/shop`; reviewer pass 1 and pass 2 (both blocking sets fixed, pass 2 confirmed "ship"); PR from `pay/facilitator`, "M3 part A, not M3 done". Notes: `m3-facilitator.md`.

## Next, in order
1. Watch the part A PR until it merges.
2. **M3 part B** on a new branch `pay/part-b` from main: `scripts/whitechain/local-pay.mjs` (the local facilitator and shop with T2's real `createEnsGate` and `createEnsReader().resolvePayee`; the gate's policy reads from the checkout) and `scripts/whitechain/lifecycle.mjs` (rehearsal.vitalik: pay, replay, refund, re-order, over-cap, scout revoked and restored, VITALIK human). Rehearse on the fork, reviewer, then `ALLOW_REAL_NETWORK=1 … --yes`.
3. C7 once as `acceptance.vitalik` (`usdt-ready --go --yes`), before 05:30 IST if possible so tomorrow's acceptance cap is fresh.
4. **Subscription script** on `pay/subscription` (pushed, not reviewed): review, PR, run for real.
5. `(M3 done)` PR, then **M4** (hosted routes, recorder W_SYNC writer, quote writer, `/api/cron/renew`; decide the one-instance rule for the facilitator, see OPEN.md).

## Open threads
- OPEN.md: CI required check; the config has no Whitechain role addresses (merchant lists from env until it does); M4 per-instance state.
- anvil: start it detached in a subshell, `(nohup anvil --fork-url <public RPC> --port 8547 --chain-id 1874 --silent > /dev/null 2>&1 &)`; a plain background start died mid-run.
