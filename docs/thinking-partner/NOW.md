# NOW

Updated 05:15 IST, Fri 6 Nov (Coordinator)

## Summary (Coordinator only)

Updated 05:15 IST, Fri 6 Nov. **CP4 is met: the core is done on the real networks.**
- **The acceptance report: 31 pass, 0 fail, 1 blocked (D7, the benchmark at size M, waiting for the locked story), 16 not yet run** (mostly the hosted endpoints, which wait for M4).
- Done: M1–M3, M5–M12. Real payments, refunds, a subscription and the live kill switch, all on Whitechain and Sepolia.
- The mirror has written every event exactly once through crashes and replays.
- In progress: M4 (hosting, T1), the website and the demo store (T5), Friday items (T3).

**Plan usage:** 81% at 05:12. Every session pauses gracefully at 92% (ADR-0062). Join is paused until M4 is hosted. The Mac is on power with the lid open.

Next:
1. M4 hosted (T1), then M13's C and F rows (Join, after 05:30 IST).
2. The founder's story brief by 08:30 for rehearsal 1; the large city starts seeding by 14:00.

## foundation

Updated 23:55 IST. **M0 done; handed over to the Coordinator** (`docs/plan/sessions/coordinator.md`).
- Merged: #1 web placeholder, #2 Vercel install fix, #3 secret helpers and config (three reviewer passes), #4 funding script (two passes), #5 records, #6 story config and presets (one pass and fixes); this handover is #7.
- A1–A6 pass. CI green on `main`; Vercel builds only for code changes.
- FUNDER at 23:53: 2.6427 WBT, 0.2749 Sepolia ETH, 15.7583 tGLM, 31.75 test USDT. No shortfall.
- Open follow-ups (none blocking) are listed in the coordinator file's handover state.

## payments

Updated 05:11 IST, Fri 6 Nov (T1).
- **M4 is done: payments run from the public site.** The shop, our facilitator, the refusal recorder and the renewal job are live on https://graphpay-event.vercel.app. A 0.40 payment went through the public URL with no gas from the payer ([explorer](https://explorer.testnet.whitechain.io/tx/0x06d43ca9a501342a1177d3a48383dc1611505863bab15a396aa38bc02aee6e01)), the repeat answered "already paid", every protected route refuses without its passcode or token, and the renewal job renewed a 2-minute demo subscription on its own ([explorer](https://explorer.testnet.whitechain.io/tx/0x48b14aa45f56d487dee743721416a359fed96296b3ad0ababf546838f55e480f)).
- Join's agents now pay through the hosted facilitator, so no two processes share a key.
- Next: the Friday items after the story lock. Blockers: none.

## identity
Updated 04:25 IST. **M6 is built: the gate is merged (PR #34); the watcher PR is open.** The watcher keeps the payment policy and the Arkiv node standing in step with ENS: a kill revokes the policy, a pause shows on the node, a lapse is caught by a 30 s ticker, and it never creates a policy or copies an ENS cap into one. Join hosts it in the workers process.
- Checked: 47 unit tests, 11 fork tests (including a `renew` after `unregister` that must not revive a killed agent), a dry run on real Sepolia, B8's MCP call (`initialize` and `tools/list` on the hosted endpoint).
- Running: nothing. Blockers: none. Real kill timings (B6/B7/E7) wait for Join's workers process.
- Next: after the merge, B6/B7/E7 with Join, then B9 (a) after T1's first settled payment, then the Friday items.

## arkiv

Updated 03:50 IST, Fri 6 Nov (T3).

- **Where we are:** M9 (the live benchmark) merged at 03:45 (PR #31): ranking the city's shops by sales takes Graph Arkiv 2 reads against plain Arkiv's 5; acceptance D6 passes. The labelling fix merged at 03:41 (PR #30).
- **This step (Friday item 1):** the "live" rows behind the map and the explainer. A shop's Open toggle, an agent at work, and one agent handing work to another are now short-lived Arkiv rows that disappear by themselves when nobody renews them. GraphQL can ask which shops are open now, which agents are online, and a run's handoffs.
- **Running:** nothing.
- **Blockers:** none. The website's Open toggle and the agent run still have to call these (T5 and T4; OPEN).
- **Next:** Swarm: the menu upload through the public gateway (the Coordinator's conditions), then refund evidence encrypted in our own code.

## agents

Updated 02:40 IST. **M10 is merged; the presence and handoff hooks are built** (Friday item 2, before CP4).
- Agents can now announce themselves (presence, renewed every 5 min while an errand runs) and report each hand-off between agents with its explainer lane. Both are optional and do nothing until Join wires them (item 3).
- 64 tests pass on mocks; a run log with the hooks absent or recording is byte-identical to one without.
- Blockers: none. Next: merge, then wait for Join's M12 counting run; re-run the live errand if time allows.
## integration

Updated 05:10 IST, Fri 6 Nov. **M11 and M12 are done on the real networks. The acceptance report: 31 pass, 0 fail, 1 blocked (the big city), 16 not run** (the hosted endpoints of M4 and a few other tracks' checks).
- The errand: the agents chose Kesar Kingdom from live reputation, paid 4.80 test USDT on Whitechain, and the shop delivered and refunded 0.80. The mirror and GraphQL show it all.
- The kill: disposable-1 paid 0.40, then its owner killed its ENS name. 9.3 s later our facilitator refused its next payment (the rule allows 25 s), and T2's watcher revoked its spending policy on Whitechain 11 s after the kill. The refusal is recorded on Arkiv.
- Found and fixed today: the MCP's buyer-risk table (every shop refused every buyer); the signer's header format; the refusal record's id, which was too long for Arkiv (it would also have broken M4's hosted recorder).
- Running: `pnpm workers` with T2's watcher.
- The mirror's last tests passed: with the mirror frozen through a real payment, two copies racing at one nonce and a copy killed right after sending both wrote nothing twice, and after a hard restart every event since the deploy is on Arkiv exactly once.
- Not run yet: the hosted endpoints (M4: C2–C6, F2, F3), F1's history scan, and a few other tracks' checks.
- Next: M13's run after 05:30 IST (the acceptance payer's fresh day), once M4 is hosted.

## website

Updated 06:10 IST, Fri 6 Nov (T5 Web; Coordinator's clock). **On `main`:** everything through M16, the map, the lanes and the real kit payment (M16 proved on the chain). **In a PR:** the merchant phone's **Mark dispatched** and **Refund** buttons (Friday item 12): the shop's own key signs on the server, behind the passcode; the order must be this shop's, a refund can never exceed what the contract says is left, the shop wallet's float is checked first, and a send whose receipt is late keeps its hash and locks the order so a retry cannot pay twice. Reviewer pass done. Not tried on the real chain from here (a live dispatch or refund changes real demo state).
- Running: nothing. Needs the shop's key on Vercel (the hosted shop already uses it for deliveries, so it is probably set).
- Blockers: the store's CSV export waits for T6's PR 64.
- Next: the customer's refund request, re-order and subscribe buttons (they sign as the payer agent; a reviewer pass each); the store's Sunday box. Fresh start file: `docs/sessions/website/resume.md`.

## agentpay

Updated 05:30 IST, Fri 6 Nov (T6 AgentPay). **Fixed: the merchant's order export failed on the real Whitechain Sepolia** (T5 found it; its checkout kit's store export and refund views depend on it). The public RPCs refuse a log search over too many blocks (Whitechain's own over 10,000, the public Ankr endpoint over about 1,000), and the export asked for 50,000 at a time. It now asks for 10,000 and drops to 1,000 when an RPC refuses. Checked on the real chain: both public RPCs export the same 15 orders from the deploy block.
- Also fixed: the fork tests no longer depend on FUNDER's real test USDT, which is down to 15.54. They write the test balance on the fork only.
- A4 merged (PR 47): the SDK merchant settles through T1's facilitator, in process and over HTTP. 17 fork tests, 41 offline tests in CI.
- Running: nothing. Blockers: none. The ride stays on the fork (OPEN).
- Next: a resume file by 08:00 (A5); npm publish waits for the founder's login.

## records

Updated 05:15 IST. **CP4's relay is written.**
- Done since 04:45: DISPOSABLE_1 funded for the kill check (#59, reviewer: ship); top-ups to plan targets; T1's facilitator wallet released after Join's run; Join paused until M4.
- One passing GitHub fault: pushes of new commits were rejected for about 4 minutes (04:52–04:56).
- Next: Join's start line when M4 is hosted; records again about 06:45.

## submission

Not started (the Submission session, M17, from Fri 13:00; submit by Sat 08:00 IST).
