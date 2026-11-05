# T1 Payments: resume note (05:11 IST, Fri 6 Nov)

Read `docs/plan/sessions/T1-payments.md` first; this note says where the work stands.

## Done
- **M1** (#12), **M2** (#15), **M3 part A** (#42, 04:06 IST) merged.
- **M4** merged (#58) and live (`m4-hosted.md`). **M3 part B** merged (#45): C7 paid once as `acceptance.vitalik` (`c7.json`; never run `usdt-ready --go` again: it refuses anyway), the lifecycle as `rehearsal.vitalik` (`m3-lifecycle.json`), the subscription created, renewed and cancelled. scout's policy restored and read back. Notes: `m3-part-b.md`.

## Next, in order
1. Watch the `(M4 done)` PR until it merges.
2. Friday items (`docs/plan/MASTER_PLAN.md` §4 item 6: the demo cast's policies) after the story lock.
3. Real payments go through the hosted facilitator only; no local FACILITATOR or RENEWER sends during the demo.

## Open threads
- OPEN.md: CI required check; config role addresses.
- C4(b) as the acceptance agent is M13's (over-cap off-chain after C2 + C3).
- anvil: start it in a subshell, `(nohup anvil --fork-url <public RPC> --port 8547 --chain-id 1874 --silent > /dev/null 2>&1 &)`.
- Usage rule: pause at 92% weekly (Coordinator, 04:15 IST); 79% at 04:18.
