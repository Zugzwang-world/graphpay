# NOW

Updated 10:40 IST, Fri 6 Nov (Coordinator)

## Summary (Coordinator only)

Updated 10:40 IST, Fri 6 Nov. **A fresh Coordinator is taking over.** Its handover is `docs/sessions/records/resume.md`.

**Standing rule (ADR-0066): no target times.** Every task starts the moment it's given, runs as fast as it can, and is reported when it's done. Two deadlines are fixed: the submission, Sat 09:00 IST, and the presentation, Sat 09:30 IST. Everything else is an event.

- **The core works on the real testnets.** Acceptance: 45 pass, 0 fail, 1 blocked, 2 not run (09:51 run). D7, the large city, is the blocked one; B7 and B9 have merged since (#83, #84) and go into the next run.
- **Both SDKs are on npm** (ADR-0063): `@graphpay_ethglobal/arkiv-graph` 0.1.0 and `@graphpay_ethglobal/agentpay` 0.1.0. Each was installed from the registry into an empty folder, and its quickstart passed. The links are in the README and `FACTS.md`.
  - Developers at the venue can try them; their feedback goes to GitHub issues labelled `arkiv-graph` or `agentpay` plus `feedback`.
  - Versions freeze from submission until judging ends.
- **The agents run on Kimi** (ADR-0067):
  - `KIMI_API_KEY` is stored, on the Mac and on Vercel Production, and the secret scan recognises Kimi keys (#89).
  - T4 is calibrating: three errands per preset, with seconds and cost per errand.
- **The website** (ADR-0068):
  - The founder's team's site (#70) needs fixes (a)–(e) before it merges. T5 reviews them and then integrates the site.
  - Join's live errand runner (#88) is merged and live on production. It runs on the server, with every guardrail, on Kimi.
  - **On Kimi the agents don't complete a purchase yet:** the concierge stops at a plan, so nothing is signed or paid. T4 is fixing this with Join's repro.
- **Next on the story lock:** the moment the story locks, the demo cast is set up and the large city starts seeding.
- **Plan usage:** 86%. Every session pauses at 92% (ADR-0062); the weekly window resets at 21:30 IST.
- **Open founder items** (`OPEN.md`): lock the story; top up Kimi; the team's fixes on #70; start the Submission session; the disclosure, if not sent.

## foundation

M0 is done and handed over (PRs #1–#7); see `relays/foundation.md`.

## payments

Updated 09:47 IST, Fri 6 Nov (T1).
- **M4 is done: payments run from the public site.** The shop, our facilitator, the refusal recorder and the renewal job are live on https://graphpay-event.vercel.app. A 0.40 payment went through the public URL with no gas from the payer ([explorer](https://explorer.testnet.whitechain.io/tx/0x06d43ca9a501342a1177d3a48383dc1611505863bab15a396aa38bc02aee6e01)), the repeat answered "already paid", every protected route refuses without its passcode or token, and the renewal job renewed a 2-minute demo subscription on its own ([explorer](https://explorer.testnet.whitechain.io/tx/0x48b14aa45f56d487dee743721416a359fed96296b3ad0ababf546838f55e480f)).
- Join's agents now pay through the hosted facilitator, so no two processes share a key.
- F3 done: the relayer's safety floor refuses a payment before sending (`docs/sessions/payments/f3.json`).
- Next: the demo cast's policies, which start once the story locks. Blockers: none.

## identity
Updated 05:00 IST. **M6 is done and merged (gate #34, watcher #40); B7 is covered.** The fork test for epochs on re-registration passes twice: a new registration after an unregister or after a lapse gets e + 1, and an unregistered label already shows a higher epoch while AVAILABLE (0 → 2). Fork tests are now 12, all passing.
- `disposable-1` was killed on real Sepolia by someone else; the fork tests use `disposable-2` (kill) and `disposable-3` (lapse), provisioned on the fork only.
- Running: nothing. Blockers: none. B6/B7/E7 real timings wait for Join's workers process to host the watcher.
- B9 (a): the payee comparison now runs in the acceptance script and passes for Kesar Kingdom (the one shop with a settled payment); the other two are skipped until they have one.
- Next: the demo cast's ENS names the moment the story locks (Coordinator will say).

## arkiv

Updated 09:55 IST, Fri 6 Nov (T3).

- **Where we are:** the SDK 0.1.0 is merged and waits for the npm login (PR #74). The three Arkiv judges' drafts are merged (PR #77). This step: Swarm.
- **This step (Friday items 4 and 5, the menu part):** the three cast shops' menus (synthetic story data) are public files on Swarm through the public gateway, each referenced by a `menu` row on Arkiv with a hash; read back and verified from Arkiv and the gateway. `arkiv/swarm.md` now has the real entity key, reference and link.
- **Running:** nothing. **Blockers:** none.
- **Dropped on purpose:** the encrypted refund photo (`refund_evidence`); the demo has no refund photo (Coordinator).
- **Next:** idle until the story locks; then the demo cast `shop` rows (item 6).

## agents

Updated 02:40 IST. **M10 is merged; the presence and handoff hooks are built** (Friday item 2, before CP4).
- Agents can now announce themselves (presence, renewed every 5 min while an errand runs) and report each hand-off between agents with its explainer lane. Both are optional and do nothing until Join wires them (item 3).
- 64 tests pass on mocks; a run log with the hooks absent or recording is byte-identical to one without.
- Blockers: none. Next: merge, then wait for Join's M12 counting run; re-run the live errand if time allows.
## integration

Updated 10:36 IST, Fri 6 Nov. **M13 is done on the real networks. The acceptance report: 45 pass, 0 fail, 1 blocked (the big city), 2 not run, both T2's.**
- As the acceptance agent, through the hosted shop and our hosted facilitator: paid 4.80 with no gas of its own, and the shop delivered. The same request again answered "already paid" and sent nothing. The shop refunded 0.80, and the agent re-ordered 3 for 1.20. One more 0.40 was refused for being over its 6.00 daily cap: nothing was sent, and the refusal is recorded on Arkiv.
- A revoked agent is stopped on-chain: the policy writer revoked the scout agent's spending policy, the scout's next payment was refused and recorded by the contract (AGENT_REVOKED), the policy was restored exactly, and the mirror wrote the refusal to Arkiv once after a clean restart.
- No secrets in the repo (F1): the tree and the history of all 313 commits on every branch are clean, no env file is tracked, and every key and token on Vercel is hidden.
- Quotes expire as designed (D10): a quote the hosted shop wrote for the acceptance agent is owned by our directory writer, disappears from Arkiv after 15 minutes and stops being valid after 10; a missing or expired quote makes the agent re-quote before it signs.
- All 17 spending routes refuse a caller without the passcode or token (401), and nothing is sent.
- Also wired: five other tracks' checks from their recorded evidence (A3, A4, A9, A10, B3).
- The agents' live presence (Friday item 3, D11's first half) is proven: an errand's presence row appears on Arkiv 6.7 s after it starts and lapses 15 minutes after it ends. The e2e scripts now pay through the hosted shop and facilitator.
- Running: `pnpm workers` with T2's watcher. Local scripts no longer relay; every payment goes through the hosted facilitator.
- F3 (the relayer's safety floor) passes from T1's record (PR 78).
- Not run yet, both T2's: B7 and B9.
- Next: the item-6 bootstrap of the demo cast, when the story locks.

## website

Updated 10:45 IST, Fri 6 Nov (T5 Web). **On `main`:** everything through Request refund (#73), the merchant phone's buttons, the map, the lanes, race, M16. **In a PR (`web/reorder-live`):** the customer phone's **Re-order**: the payer agent signs one payment for the story's re-order of its newest order through the hosted shop; the order, price and shop come from the chain and the story; a second tap is held off until a signature can no longer settle. Reviewer pass done (three double-payment findings fixed; two taps on two servers at once is a known limit, in OPEN).
- Running: nothing.
- Blockers: Re-order needs `PAYER_PRIVATE_KEY` in Vercel (the agentpay rename is done in the PR); Subscribe and Cancel need a hosted subscription endpoint from T1; Kill a disposable agent waits for T2.
- Next: one real re-order once the key is set (tell Join first); the store's export row for the kit payment. Fresh start file: `docs/sessions/website/resume.md`.

## agentpay

Updated 09:50 IST, Fri 6 Nov (T6 AgentPay, Sonnet 5.5). **`@graphpay_ethglobal/agentpay` 0.1.0 is ready to publish: pack, install in an empty folder and the README quickstart all pass on Node 22.** The reviewer pass is clean after two blocking fixes (PR 80). The Coordinator publishes after the founder's npm login.
- The package is renamed (T5's checkout kit imports it; changed in the same PR, told T5). It is self-contained: the ABI, EIP-712 shapes and defaults are inlined, and there is no workspace dependency.
- Safety: chain 1874 only (client creation and before every signing and send); no default hosted facilitator or relayer; anti-drain limits on by default and impossible to switch off; a lane test fails if agentpay imports our Arkiv or ENS packages.
- Outside developers cannot use our deployed checkout (only its relayers settle). The quickstart runs a local anvil fork with their own checkout (`startSandbox`); on the real testnet they deploy their own with `deployCheckout`.
- Running: nothing. Blockers: none. Next: the reviewer's findings, the PR, then tell the Coordinator; a 0.1.x API reference can follow.

## records

Updated 06:55 IST. **The 06:45 relay is written.** LOG.md is rolled up, and the closed M0 tables in OPEN.md are condensed: the folder was at 24,459 words, over the 20,000 guideline.
- Since 05:15: M4 done (#58, #62); M13's hosted run and C4(a) (#66, #67: 42 pass); M16 proved (#63); DISPOSABLE_1 funded and the kill check passed (#59); T5's kit payment.
- Waiting: T5 is idle and can't be woken until the founder types (the app's message cap). Join is idle after F1. The others wait for the story.
- Next: the 08:30 morning relay; the story brief; the graphpay-store Vercel project.

## submission

Not started (the Submission session, M17, from Fri 13:00; submit by Sat 08:00 IST).
