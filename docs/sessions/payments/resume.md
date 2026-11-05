# T1 Payments: resume note (04:22 IST, Fri 6 Nov)

Read `docs/plan/sessions/T1-payments.md` first; this note says where the work stands.

## Done
- **M1** (#12), **M2** (#15), **M3 part A** (#42, 04:06 IST) merged.
- **M3 part B** on the real chain (04:13–04:18 IST), branch `pay/part-b`, PR `(M3 done)`: C7 paid once as `acceptance.vitalik` (`c7.json`; never run `usdt-ready --go` again: it refuses anyway), the lifecycle as `rehearsal.vitalik` (`m3-lifecycle.json`), the subscription created, renewed and cancelled. scout's policy restored and read back. Notes: `m3-part-b.md`.

## Next, in order
1. Watch the `(M3 done)` PR until it merges.
2. **M4** (`planning/PROMPTS/04-hosted-vercel.md`, E-1, E-3): hosted routes in `apps/web/app/api/{shop,facilitator,recorder}` over the packages' Fetch handlers (`facilitatorSettings`, `shopSettings`; `local-pay.mjs` shows the composition, including the gate's policy reads), the recorder's W_SYNC writer (`recordEdge`), the quote writer (`createQuote`), `/api/cron/renew` with its cron entry; one early PR for the `apps/web` dependency change; the facilitator's one-instance rule (OPEN.md). After M4, real payments go through the hosted facilitator only, and no local script uses the hosted relayer key.
3. Friday items (`docs/plan/MASTER_PLAN.md` §4 item 6) after the story lock.

## Open threads
- OPEN.md: README link for C7; CI required check; config role addresses; M4 per-instance state.
- C4(b) as the acceptance agent is M13's (over-cap off-chain after C2 + C3).
- anvil: start it in a subshell, `(nohup anvil --fork-url <public RPC> --port 8547 --chain-id 1874 --silent > /dev/null 2>&1 &)`.
- Usage rule: pause at 92% weekly (Coordinator, 04:15 IST); 79% at 04:18.
