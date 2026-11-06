# NOW

Updated 09:35 IST, Fri 6 Nov (Coordinator)

## Summary (Coordinator only)

Updated 09:35 IST, Fri 6 Nov.

**The core is done on the real testnets.** Acceptance: **42 pass, 0 fail**, 1 blocked (D7, the benchmark at size M, waiting for the story), 5 not run (B7, F1, F3, D10 and B9 wait on other tracks). Live on https://graphpay-event.vercel.app: the hosted facilitator, shop and recorder, the renewal cron, the website with both phones, the race, the map and the explainer lanes. The checkout kit and demo store are proved with a real payment.

**The SDK publish, in progress (ADR-0063, by about 13:00):**
- `@graphpay_ethglobal/arkiv-graph` (T3) and `@graphpay_ethglobal/agentpay` (T6), both on Sonnet 5.5 and doing fresh starts.
- The names are free on npm, and the `graphpay_ethglobal` organisation is the founder's.
- The issue labels `arkiv-graph`, `agentpay` and `feedback`, and an issue template per package, are in place.
- Next: the founder's `npm login` when both pass pack, install and quickstart (about 12:00).

**The story lock: overdue** against 08:30. The latest is 13:00, because the large city must start seeding by 14:00.

**Plan usage:** 83% at 09:12; every session pauses at 92% (ADR-0062); the reset is Fri 21:30 IST.

**Open founder items** (`OPEN.md`, "Founder now"):
- the story brief;
- the npm login at publish time;
- the front-end team's PR #70, which belongs in `apps/demo-ui` (ADR-0065), and who writes `FRONTEND_HANDOVER.md`;
- the disclosure, if not sent.

**Blocked:** T5 (both phone views) is idle until the Coordinator wakes it, which it does now that the founder has typed. D7 and item 6 wait for the story.

## foundation

M0 is done and handed over (PRs #1–#7); see `relays/foundation.md`.

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

Updated 09:50 IST, Fri 6 Nov (T3).

- **Where we are:** the SDK is ready to publish as `@graphpay_ethglobal/arkiv-graph` 0.1.0 (the Coordinator's 09:40 corrections applied). The tarball installs in an empty folder on Node 22.23.4 and the README quickstart runs there; the leaderboard example too.
- **This step (Friday item 18):** a short 5-minute quickstart that runs in memory (ArkivSim) and the same code on Rabdi with the developer's own key; a leaderboard example; CHANGELOG, FEEDBACK (a log), MIT licence; the package renamed everywhere in the repo.
- **Running:** the reviewer pass; the PR then merges on green.
- **Blockers:** none for the package. Publishing needs the founder's npm login (the Coordinator publishes).
- **Next:** tell the Coordinator when the PR has merged and the pack check passes on main, then Swarm (menu upload, refund evidence).

## agents

Updated 02:40 IST. **M10 is merged; the presence and handoff hooks are built** (Friday item 2, before CP4).
- Agents can now announce themselves (presence, renewed every 5 min while an errand runs) and report each hand-off between agents with its explainer lane. Both are optional and do nothing until Join wires them (item 3).
- 64 tests pass on mocks; a run log with the hooks absent or recording is byte-identical to one without.
- Blockers: none. Next: merge, then wait for Join's M12 counting run; re-run the live errand if time allows.
## integration

Updated 09:47 IST, Fri 6 Nov. **M13 is done on the real networks. The acceptance report: 45 pass, 0 fail, 1 blocked (the big city), 2 not run, both T2's.**
- As the acceptance agent, through the hosted shop and our hosted facilitator: paid 4.80 with no gas of its own, and the shop delivered. The same request again answered "already paid" and sent nothing. The shop refunded 0.80, and the agent re-ordered 3 for 1.20. One more 0.40 was refused for being over its 6.00 daily cap: nothing was sent, and the refusal is recorded on Arkiv.
- A revoked agent is stopped on-chain: the policy writer revoked the scout agent's spending policy, the scout's next payment was refused and recorded by the contract (AGENT_REVOKED), the policy was restored exactly, and the mirror wrote the refusal to Arkiv once after a clean restart.
- No secrets in the repo (F1): the tree and the history of all 313 commits on every branch are clean, no env file is tracked, and every key and token on Vercel is hidden.
- Quotes expire as designed (D10): a quote the hosted shop wrote for the acceptance agent is owned by our directory writer, disappears from Arkiv after 15 minutes and stops being valid after 10; a missing or expired quote makes the agent re-quote before it signs.
- All 17 spending routes refuse a caller without the passcode or token (401), and nothing is sent.
- Also wired: five other tracks' checks from their recorded evidence (A3, A4, A9, A10, B3).
- Running: `pnpm workers` with T2's watcher. Local scripts no longer relay; every payment goes through the hosted facilitator.
- F3 (the relayer's safety floor) passes from T1's record (PR 78).
- Not run yet, both T2's: B7 and B9.
- Next: the item-6 bootstrap of the demo cast, when the story locks.

## website

Updated 09:40 IST, Fri 6 Nov (T5 Web). **On `main`:** both phones' buttons except the three below, the map, the lanes, race, M16 (one real kit payment). **In a PR (`web/customer-actions`):** the customer phone's **Request refund**: a refund request written to Arkiv with the recorder's key (moves no money); the order is always the payer agent's newest payment, checked on the chain; one request per order per minute. Reviewer pass in progress.
- Running: nothing.
- Blockers: Re-order needs `PAYER_PRIVATE_KEY` in Vercel; Subscribe and Cancel need a hosted subscription endpoint from T1; Kill a disposable agent waits for T2 (all in OPEN).
- Next: Re-order (the payer agent signs through the hosted shop, a reviewer pass). Fresh start file: `docs/sessions/website/resume.md`.

## agentpay

Updated 05:30 IST, Fri 6 Nov (T6 AgentPay). **Fixed: the merchant's order export failed on the real Whitechain Sepolia** (T5 found it; its checkout kit's store export and refund views depend on it). The public RPCs refuse a log search over too many blocks (Whitechain's own over 10,000, the public Ankr endpoint over about 1,000), and the export asked for 50,000 at a time. It now asks for 10,000 and drops to 1,000 when an RPC refuses. Checked on the real chain: both public RPCs export the same 15 orders from the deploy block.
- Also fixed: the fork tests no longer depend on FUNDER's real test USDT, which is down to 15.54. They write the test balance on the fork only.
- A4 merged (PR 47): the SDK merchant settles through T1's facilitator, in process and over HTTP. 17 fork tests, 41 offline tests in CI.
- Running: nothing. Blockers: none. The ride stays on the fork (OPEN).
- Next: a resume file by 08:00 (A5); npm publish waits for the founder's login.

## records

Updated 06:55 IST. **The 06:45 relay is written.** LOG.md is rolled up, and the closed M0 tables in OPEN.md are condensed: the folder was at 24,459 words, over the 20,000 guideline.
- Since 05:15: M4 done (#58, #62); M13's hosted run and C4(a) (#66, #67: 42 pass); M16 proved (#63); DISPOSABLE_1 funded and the kill check passed (#59); T5's kit payment.
- Waiting: T5 is idle and can't be woken until the founder types (the app's message cap). Join is idle after F1. The others wait for the story.
- Next: the 08:30 morning relay; the story brief; the graphpay-store Vercel project.

## submission

Not started (the Submission session, M17, from Fri 13:00; submit by Sat 08:00 IST).
