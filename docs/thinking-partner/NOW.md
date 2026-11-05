# NOW

Updated 04:45 IST, Fri 6 Nov (Coordinator)

## Summary (Coordinator only)

Updated 04:45 IST, Fri 6 Nov. **The first real payment is on-chain (04:14 IST),** and the core is nearly complete:
- Merged: M1–M3, M5–M10, the mirror (M11) and the first acceptance report (18 pass, 0 fail, 1 blocked, 29 not yet run).
- The payment: 4.80 test USDT, ENS-gated, gasless for the payer, through our facilitator ([the transaction](https://explorer.testnet.whitechain.io/tx/0x87505ef2457b6e925fa7378a55fd91419e83c37fb8effc06d901884700c72c00)).
- Join is running the real `e2e:food`. T1 is on M4 (hosting), T5 on the website and the checkout kit, T6 on the AgentPay SDK, T3 on Friday items.

**Plan usage:** 79% at 04:33. The founder decided every session pauses gracefully at 92% (ADR-0062), and all track sessions run at high. The Mac is on power with the lid open.

Next:
1. CP4: the acceptance report fills in as `e2e:food` and the live checks run (expected about 06:15).
2. M4 hosting (T1), then the checkout kit (T5).
3. The founder's story brief by 08:30 for rehearsal 1; the large city starts seeding by 14:00.

## foundation

Updated 23:55 IST. **M0 done; handed over to the Coordinator** (`docs/plan/sessions/coordinator.md`).
- Merged: #1 web placeholder, #2 Vercel install fix, #3 secret helpers and config (three reviewer passes), #4 funding script (two passes), #5 records, #6 story config and presets (one pass and fixes); this handover is #7.
- A1–A6 pass. CI green on `main`; Vercel builds only for code changes.
- FUNDER at 23:53: 2.6427 WBT, 0.2749 Sepolia ETH, 15.7583 tGLM, 31.75 test USDT. No shortfall.
- Open follow-ups (none blocking) are listed in the coordinator file's handover state.

## payments

Updated 04:20 IST, Fri 6 Nov (T1).
- **The first real payments are on Whitechain Sepolia.** The qualifying payment (C7, also E3) is done, once: an agent with an ENS name paid 4.80 test USDT to Kesar Kingdom through our own facilitator, with no gas of its own: [explorer](https://explorer.testnet.whitechain.io/tx/0x87505ef2457b6e925fa7378a55fd91419e83c37fb8effc06d901884700c72c00).
- **The whole payment lifecycle ran on the real chain** through T2's real ENS gate: pay, "already paid" on a replay, refund, re-order, an over-limit payment refused before the chain, a revoked agent recorded on-chain (then restored), a human payer, and a subscription created, renewed after 2 minutes and cancelled by signature.
- Running: the `(M3 done)` PR. Next: M4, hosting the facilitator and the shop on Vercel.
- Blockers: none.

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

Updated 04:55 IST, Fri 6 Nov. **M12's counting run passed on the real networks; the acceptance report is at 24 pass, 0 fail, 1 blocked, 23 not run.**
- The story's errand ran end to end. The agents chose Kesar Kingdom from live Arkiv reputation and never the trap, and paid 4.80 test USDT on Whitechain as payer.vitalik through our facilitator (the ENS gate, the payee from ENS, the quote on Arkiv first). The shop marked it delivered, then refunded 0.80. The mirror put each step on Arkiv, and GraphQL showed the new tallies. 122 s, $0.30 of model cost.
- Two bugs found and fixed on the way: the hosted MCP's buyer-risk table (it made every shop refuse every real buyer; PR 48) and the signer's header format.
- Running: `pnpm workers` with T2's ENS watcher (a killed name revokes its spending policy).
- Not run yet: the kill check (E7, which needs a fresh disposable agent), the hosted endpoints (M4), D2's two write tests and D15 with payments in a drop.
- Next: the kill check, then fill in the C and F rows with T1.

## website

Updated 07:55 IST, Fri 6 Nov (T5 Web). **On `main`:** everything through M16 (the checkout kit and the demo store, #51). **In a PR:** the Mumbai map (Friday item 10), our own drawing of the neighbourhoods with no tiles: every shop in the directory as a dot (the small city labelled synthetic), open shops and agents at work glowing while their heartbeat is live and fading when it lapses, every dot opening its Arkiv record. Read live this session: 13 shops (3 cast, 10 synthetic), 18 agents at work, 0 open (nobody has tapped Open shop yet).
- Running: nothing long. The store is not deployed (needs the Vercel project and env, see OPEN).
- Blockers: none for the map. The Open toggle and Pause/Resume are live in production once the next deploy runs and someone with the passcode tries them.
- Next: item 13 (the explainer lanes from the handoff and quote records); the store's Sunday box if time. Fresh start file: `docs/sessions/website/resume.md`.

## agentpay

Updated 04:20 IST, Fri 6 Nov (T6 AgentPay). **A4 done: the SDK's merchant now settles through GraphPay's own facilitator (T1, PR 42), not only through its reference relayer.** On an anvil fork, a gasless buyer agent paid the SDK merchant twice through T1's real pipeline: once in process, once over T1's HTTP handler with a bearer token. Both orders are PAID on-chain, sent by T1's relayer.
- Also proven there: a wrong bearer token is refused by T1 and nothing is sent; an agent T1's ENS gate refuses is stopped before any send, and T1 records the refusal. Reviewer: nothing blocking.
- V1 (PR 38) and the first real test payment (PR 41, 0.01 test USDT, https://explorer.testnet.whitechain.io/tx/0xfbd7d307b1b0c08f3af015b4bdb03aaeed12d0c2d18c2553432cb4679ff14c7e) are merged. 17 fork tests, 36 offline tests in CI.
- Fixed on the way: the merchant's CSV could miss a refund from the last few seconds (a cached block number); its fork test is now reliable.
- Running: nothing. Blockers: none. The ride stays on the fork (OPEN).
- Next: a resume file by 08:00 (A5); npm publish waits for the founder's login.

## records

Updated 04:45 IST. **The Coordinator is on duty**, ticking every 20 minutes.
- Done since 03:20:
  - the prompt-log hook fix and its sweep (#24, #27); T6 added to the records (#28);
  - the effort steps (#29), then all at high on the founder's instruction; ADR-0061 Swarm (#32); ADR-0062 the 92% pause (this PR);
  - gates passed for M7a, M1, M5, M6, M3 and the first payment; T1's FACILITATOR held while Join runs `e2e:food`;
  - the top-ups to plan targets (WALLETS §2b); three secrets set in Vercel Production for T5 (the Open toggle, Pause/Resume, the passcode).
- Next: CP4's relay when the acceptance report is complete; records again about 06:45.

## submission

Not started (the Submission session, M17, from Fri 13:00; submit by Sat 08:00 IST).
