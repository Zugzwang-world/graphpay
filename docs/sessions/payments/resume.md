# T1 Payments: resume note (05:05 IST, Fri 6 Nov)

Read `docs/plan/sessions/T1-payments.md` first; this note says where the work stands.

## Done
- **M1** (#12), **M2** (#15), **M3 part A** (#42, 04:06 IST) merged.
- **M3 part B** merged (#45): C7 paid once as `acceptance.vitalik` (`c7.json`; never run `usdt-ready --go` again: it refuses anyway), the lifecycle as `rehearsal.vitalik` (`m3-lifecycle.json`), the subscription created, renewed and cancelled. scout's policy restored and read back. Notes: `m3-part-b.md`.

## Next, in order
1. **M4 PR** (`pay/hosted`): Vercel's preview build must be green before auto-merge (the per-minute cron needs a plan that allows it). Then the Git integration deploys `main`.
2. After the deploy: message Join for the FACILITATOR slot, then `ALLOW_REAL_NETWORK=1 pnpm pay:public --yes --recorder` (health, C6, one 0.40 human payment and its repeat, one test recorder edge); `docs/sessions/payments/m4-public.json`. Then the cron check: `subscription.mjs create --yes` (120 s demo period) and watch the cron renew it once; cancel it with `subscription.mjs cancel --sub <id> --yes` (sends as RENEWER: not while the cron sends).
3. `(M4 done)` PR with the facts (explorer links) for NOW and the relay; tell Join to relay through the hosted facilitator.
4. Friday items (`docs/plan/MASTER_PLAN.md` §4 item 6) after the story lock.

## Open threads
- OPEN.md: CI required check; config role addresses; one sender per key (FACILITATOR, SHOP_KESAR, RENEWER) until Join relays through the hosted facilitator; the Vercel plan question.
- C4(b) as the acceptance agent is M13's (over-cap off-chain after C2 + C3).
- anvil: start it in a subshell, `(nohup anvil --fork-url <public RPC> --port 8547 --chain-id 1874 --silent > /dev/null 2>&1 &)`.
- Usage rule: pause at 92% weekly (Coordinator, 04:15 IST); 79% at 04:18.
