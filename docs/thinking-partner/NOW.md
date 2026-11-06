# NOW

Updated 11:46 IST, Fri 6 Nov (Coordinator)

## Summary (Coordinator only)

Updated 11:46 IST, Fri 6 Nov. **Standing rule (ADR-0066): no target times.** Only the submission (Sat 09:00 IST) and the presentation (Sat 09:30 IST) are fixed.

- **The integration audit is done:** `docs/plan/integration-audit.md` (read-only; three sub-agents).
  - **The team's phones:** they build, and their 40 tests pass. PR #70 is still open, not merged. They run on mock data only: there is no live adapter and no passcode step yet.
  - **Our back end:**
    - live: customer state, the merchant feed, shops, the errand and the renewal cron;
    - wired but never run on production: refund, re-order, pause, the Open toggle;
    - not live: subscribe and cancel, and the kill.
  - **Recommended:** serve their phones as static pages on our domain, inside T5's stage. Their folder stays untouched, and our live adapter and a build-time story projection connect them.
  - **Top risks:**
    - usage: the 95% line is 7 points away, against 4 to 8 points of estimated integration work;
    - the payer's cap is spent until Sat 05:30 IST;
    - the merchant feed stops showing new orders after four more;
    - the Kimi balance.
- **The first production purchase** (11:11 IST): the site's live runner on Kimi paid 4.80 to Kesar Kingdom in 171 s. No Arkiv write has failed since the clash fixes.
- **Both SDKs are 0.1.1 on npm** (11:34 and 11:35 IST). Both were checked from the registry: arkiv-graph has the writer fix, and agentpay has a clean manifest.
- **Usage:** 88%.
  - At 95%: no new real payment, merge or publish.
  - At 97%: every session pauses.
  - The weekly reset is at 21:30 IST.
- **Open founder items** (`OPEN.md`):
  - lock the story, with the paying agents' daily caps;
  - the Kimi balance;
  - the team's fixes;
  - the CLAUDE.md model line;
  - the Submission session;
  - this session's effort.

## foundation

M0 is done and handed over (PRs #1–#7); see `relays/foundation.md`.

## payments

Updated 10:56 IST, Fri 6 Nov (T1).
- **M4 is done: payments run from the public site.** The shop, our facilitator, the refusal recorder and the renewal job are live on https://graphpay-event.vercel.app. A 0.40 payment went through the public URL with no gas from the payer ([explorer](https://explorer.testnet.whitechain.io/tx/0x06d43ca9a501342a1177d3a48383dc1611505863bab15a396aa38bc02aee6e01)), the repeat answered "already paid", every protected route refuses without its passcode or token, and the renewal job renewed a 2-minute demo subscription on its own ([explorer](https://explorer.testnet.whitechain.io/tx/0x48b14aa45f56d487dee743721416a359fed96296b3ad0ababf546838f55e480f)).
- Join's agents now pay through the hosted facilitator, so no two processes share a key.
- F3 done: the relayer's safety floor refuses a payment before sending (`docs/sessions/payments/f3.json`).
- Fixed: a live errand's quote write failed when several servers wrote with the same Arkiv key at once. The shop now retries that write (bounded), and Join's runner pauses its own writes during a payment (#93).
- Next: the demo cast's policies, which start once the story locks. T1 pauses until then (usage near the 92% line). Blockers: none.

## identity
Updated 05:00 IST. **M6 is done and merged (gate #34, watcher #40); B7 is covered.** The fork test for epochs on re-registration passes twice: a new registration after an unregister or after a lapse gets e + 1, and an unregistered label already shows a higher epoch while AVAILABLE (0 → 2). Fork tests are now 12, all passing.
- `disposable-1` was killed on real Sepolia by someone else; the fork tests use `disposable-2` (kill) and `disposable-3` (lapse), provisioned on the fork only.
- Running: nothing. Blockers: none. B6/B7/E7 real timings wait for Join's workers process to host the watcher.
- B9 (a): the payee comparison now runs in the acceptance script and passes for Kesar Kingdom (the one shop with a settled payment); the other two are skipped until they have one.
- Next: the demo cast's ENS names the moment the story locks (Coordinator will say).
- **Payer cap (founder's support brief):** the payer's ENS `graphpay.cap_micro` is 100000000 (100 test USDT a day) on Sepolia, [transaction](https://sepolia.etherscan.io/tx/0x8898d10728f998983c7747aae50389392bb9ce276b7e2dbadaed509ede674c16). The gate takes the lower of this and the on-chain policy cap, so T1's policy update sets the effective cap.

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

Updated 11:09 IST, Fri 6 Nov (T6 AgentPay, Sonnet 5.5). **0.1.0 merged (PR 80); 0.1.1 is in its PR: the published manifest no longer names the three private workspace packages.** The Coordinator publishes it after the founder's approval link, then installs it from the registry and runs the examples. No venue feedback has arrived yet (no issues with the `agentpay` label).
- 0.1.1 packed and installed from the tarball in an empty folder; both examples pass there; 57 offline and 19 fork tests pass. The tests now get the workspace packages from the root `devDependencies`.
- Also: the sandbox removes its exit hook when stopped, and a test pins the checkout constructor argument order. No API change, no payment-code change.
- Running: nothing. Blockers: none. Next: any venue feedback becomes a 0.1.x fix before the post-submission freeze.

## records

Updated 11:46 IST, Fri 6 Nov (Coordinator).
- **Done this step:**
  - the integration audit, with three read-only sub-agents (`docs/plan/integration-audit.md`);
  - both SDKs published as 0.1.1 and checked from the registry;
  - "Founder now" refreshed.
- **Running:** the 10-minute tick and keep-awake.
- **Next:**
  - the founder's choice of hosting option (then its ADR);
  - the integration brief;
  - the story lock.

## submission

Not started (the Submission session, M17, from Fri 13:00; submit by Sat 08:00 IST).
