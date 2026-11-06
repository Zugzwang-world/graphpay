# NOW

Updated 09:46 IST, Fri 6 Nov (Coordinator)

## Summary (Coordinator only)

Updated 09:46 IST, Fri 6 Nov.

**Standing rule (the founder, ADR-0066): no target times.** Every task starts the moment it's given, runs as fast as it can, and is reported when done. Fixed: the submission, Sat 09:00 IST, and the presentation, Sat 09:30 IST. Everything else is an event.

- **The core is done on the real testnets.** Acceptance: 42 pass, 0 fail, 1 blocked (D7: the large city), 5 not run (other tracks' items).
- **The SDKs (ADR-0063):**
  - `@graphpay_ethglobal/arkiv-graph` 0.1.0 is ready (#74: pack, install and quickstart pass);
  - `@graphpay_ethglobal/agentpay` is being finished by T6 now;
  - the founder's npm login comes the moment both are ready, and then the publish.
- **The story lock** starts the demo cast and the large city's seeding the moment it happens.
- **Running:** T6 (agentpay), T3 (the `arkiv/` write-ups), T5 (both phone views). The others wait for the story lock or for unblocked items.
- **Plan usage:** 83%; every session pauses at 92% (ADR-0062).
- **Open founder items** (`OPEN.md`): the story lock; npm login when both SDKs are ready; PR #70 belongs in `apps/demo-ui`; who writes `FRONTEND_HANDOVER.md`; the disclosure, if not sent.

## foundation

M0 is done and handed over (PRs #1–#7); see `relays/foundation.md`.

## payments

Updated 09:47 IST, Fri 6 Nov (T1).
- **M4 is done: payments run from the public site.** The shop, our facilitator, the refusal recorder and the renewal job are live on https://graphpay-event.vercel.app. A 0.40 payment went through the public URL with no gas from the payer ([explorer](https://explorer.testnet.whitechain.io/tx/0x06d43ca9a501342a1177d3a48383dc1611505863bab15a396aa38bc02aee6e01)), the repeat answered "already paid", every protected route refuses without its passcode or token, and the renewal job renewed a 2-minute demo subscription on its own ([explorer](https://explorer.testnet.whitechain.io/tx/0x48b14aa45f56d487dee743721416a359fed96296b3ad0ababf546838f55e480f)).
- Join's agents now pay through the hosted facilitator, so no two processes share a key.
- F3 done: the relayer's safety floor refuses a payment before sending (`docs/sessions/payments/f3.json`).
- Next: the demo cast's policies, which start once the story locks. Blockers: none.

## identity
Updated 04:25 IST. **M6 is built: the gate is merged (PR #34); the watcher PR is open.** The watcher keeps the payment policy and the Arkiv node standing in step with ENS: a kill revokes the policy, a pause shows on the node, a lapse is caught by a 30 s ticker, and it never creates a policy or copies an ENS cap into one. Join hosts it in the workers process.
- Checked: 47 unit tests, 11 fork tests (including a `renew` after `unregister` that must not revive a killed agent), a dry run on real Sepolia, B8's MCP call (`initialize` and `tools/list` on the hosted endpoint).
- Running: nothing. Blockers: none. Real kill timings (B6/B7/E7) wait for Join's workers process.
- Next: after the merge, B6/B7/E7 with Join, then B9 (a) after T1's first settled payment, then the Friday items.

## arkiv

Updated 10:40 IST, Fri 6 Nov (T3).

- **Where we are:** the SDK `@graphpay_ethglobal/arkiv-graph` 0.1.0 is merged and ready to publish (PR #74; the Coordinator publishes with T6's package). Now Friday item 15: the Arkiv judges' drafts.
- **This step:** `arkiv/friction.md` (7 gaps we hit at the event, each with a repro, plus the open booth questions), `arkiv/how-you-use-arkiv.md` (feature to what the user sees, with what is shipped and what is only built) and `arkiv/swarm.md` (honestly "pending"; nothing uploaded yet).
- **Running:** nothing.
- **Blockers:** none. Swarm goes next only if weekly usage is under about 88% (now 84%).
- **Next:** Swarm: a probe upload through the public gateway, then the menu.

## agents

Updated 02:40 IST. **M10 is merged; the presence and handoff hooks are built** (Friday item 2, before CP4).
- Agents can now announce themselves (presence, renewed every 5 min while an errand runs) and report each hand-off between agents with its explainer lane. Both are optional and do nothing until Join wires them (item 3).
- 64 tests pass on mocks; a run log with the hooks absent or recording is byte-identical to one without.
- Blockers: none. Next: merge, then wait for Join's M12 counting run; re-run the live errand if time allows.
## integration

Updated 05:41 IST, Fri 6 Nov. **M13's hosted run passed on the production domain. The acceptance report: 43 pass, 0 fail, 1 blocked (the big city), 4 not run.**
- As the acceptance agent, through the hosted shop and our hosted facilitator: paid 4.80 with no gas of its own, and the shop delivered. The same request again answered "already paid" and sent nothing. The shop refunded 0.80, and the agent re-ordered 3 for 1.20. One more 0.40 was refused for being over its 6.00 daily cap: nothing was sent, and the refusal is recorded on Arkiv.
- A revoked agent is stopped on-chain: the policy writer revoked the scout agent's spending policy, the scout's next payment was refused and recorded by the contract (AGENT_REVOKED), the policy was restored exactly, and the mirror wrote the refusal to Arkiv once after a clean restart.
- No secrets in the repo (F1): the tree and the history of all 313 commits on every branch are clean, no env file is tracked, and every key and token on Vercel is hidden.
- All 17 spending routes refuse a caller without the passcode or token (401), and nothing is sent.
- Also wired: five other tracks' checks from their recorded evidence (A3, A4, A9, A10, B3).
- Running: `pnpm workers` with T2's watcher. Local scripts no longer relay; every payment goes through the hosted facilitator.
- Not run yet: B7 (T2's fork test does not cover re-registration), D10's quote-expiry part, B9 (T2's payee comparison), F3 (a preview deployment with the relayer floor raised; T1's).
- Next: D10(c) from a recorded quote.

## website

Updated 10:45 IST, Fri 6 Nov (T5 Web). **On `main`:** everything through Request refund (#73), the merchant phone's buttons, the map, the lanes, race, M16. **In a PR (`web/reorder-live`):** the customer phone's **Re-order**: the payer agent signs one payment for the story's re-order of its newest order through the hosted shop; the order, price and shop come from the chain and the story; a second tap is held off until a signature can no longer settle. Reviewer pass done (three double-payment findings fixed; two taps on two servers at once is a known limit, in OPEN).
- Running: nothing.
- Blockers: Re-order needs `PAYER_PRIVATE_KEY` in Vercel and T6's agentpay rename to follow (my import changes with it); Subscribe and Cancel need a hosted subscription endpoint from T1; Kill a disposable agent waits for T2.
- Next: one real re-order once the key is set (tell Join first); the store's export row for the kit payment. Fresh start file: `docs/sessions/website/resume.md`.

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
