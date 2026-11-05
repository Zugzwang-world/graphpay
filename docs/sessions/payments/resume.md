# T1 Payments: resume note (04:25 IST, Fri 6 Nov)

Read `docs/plan/sessions/T1-payments.md` first; this note says where the work stands.

## Done
- **M1 merged** (#12), **M2 merged** (#15, 01:59 IST). Notes: `m1-contract.md`, `m2-deploy.md`, `txlog.jsonl`.
- **M3 part A**, branch `pay/facilitator` (pushed, **no PR yet**): `packages/facilitator` and `packages/shop`, 59 + 14 offline tests, the fork e2e (`packages/shop/scripts/fork-e2e.mjs`, passes on an anvil fork). Notes: `m3-facilitator.md` (built, gas table, reviewer pass 1).
- Reviewer pass 1: do not ship, 3 blocking; all fixed in commit 4152161 (Permit2's exact signature rule, T2's `{ ok, payee }` shape, in-flight sends, record dedupe, settings). Records (NOW, relay, LOG, OPEN payments sections, VERSIONS.md M3 row) are written and committed.

## Next, in order
1. **Reviewer pass 2** on `git diff origin/main...HEAD -- packages/facilitator packages/shop`: it was started at 04:20 and lost with the session clear, so run it again (same brief as pass 1, plus: verify the pass 1 fixes listed in `m3-facilitator.md` § Reviewer). Fix what it finds.
2. Merge `origin/main` (main moved: #16–#27), re-run `pnpm check` and `pnpm test`, push (retry loop: `git -c http.lowSpeedLimit=100 -c http.lowSpeedTime=60 push`), open the PR with skill `ship` (body draft: the PR body should say "M3 part A, not M3 done"), update the LOG line's time and link, watch until merged.
3. **Subscription script**: `scripts/whitechain/subscription.mjs` (demo|create|renew|cancel, as `rehearsal.vitalik`, RENEWER relays) is on branch `pay/subscription` (pushed, not reviewed). Rehearsed on a fork: create with first charge 506,284 gas, renew 222,881, cancel 42,227, subscriber WBT unchanged. It needs no ENS gate: review it, PR it, run it for real (part B step 2).
4. **M3 part B** once T2's M6 merges (M5 is merged, #18; `docs/sessions/identity/namespace.md` exists and every agent is at epoch 0, so M2's policies already match): inject T2's real `ensGate` and `createEnsReader().resolvePayee`; lifecycle as `rehearsal.vitalik` (rehearse on a fork first); C7 once as `acceptance.vitalik`; then the `(M3 done)` PR.
5. **M4**: hosted routes in `apps/web` over the packages' Fetch handlers and `facilitatorSettings` / `shopSettings`; the recorder's W_SYNC writer (`recordEdge`); the quote writer (`createQuote` with `identityKey(namehash(shop), epoch)`); `/api/cron/renew`. One early PR for the `apps/web` dependency change.

## Open threads
- OPEN.md (for the Coordinator): CI required check; the config has no Whitechain role addresses, so `ALLOWED_MERCHANTS` / `SHOP_MERCHANTS` come from env until it does (`settings.mjs` checks them against `wallets.addresses` once present).
- anvil: start detached (`nohup anvil --fork-url https://rpc.testnet.whitechain.io --port 8547 --chain-id 1874 --silent &`); a backgrounded tool run died twice with exit 144.
