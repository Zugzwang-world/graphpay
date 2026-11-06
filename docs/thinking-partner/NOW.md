# NOW

Updated 16:40 IST, Fri 6 Nov (Coordinator)

## Summary (Coordinator only)

Updated 13:32 IST, Fri 6 Nov. **Standing rule (ADR-0066): no target times.** Only the submission (Sat 09:00 IST) and the presentation (Sat 09:30 IST) are fixed.

**Now: the integration proof of concept** (the 1240 briefs).

- **The errand pays reliably on production** (Join, 13:32 IST).
  - Two live errands through the site's runner each paid 4.80 to Kesar Kingdom, with no retry needed: 129 s ([tx](https://explorer.testnet.whitechain.io/tx/0x9749a7f766282021a4e0e255276b938e53c608f55985a68b4b59b08d852a1e1a)) and 115 s ([tx](https://explorer.testnet.whitechain.io/tx/0x11588a5e47611c1e9095219ab95b8907d8b0f59a602f56d8b12d11a16cfa0a13)).
  - With the 11:14 run, that is three paid in a row. All seven agents ran each time, and no Arkiv write or settle failed.
  - The fixes: #92, #93, #96, #97, #108, #112 and #114.
- **The payer's pass is 100 test USDT a day,** on-chain and in ENS. 14.40 is spent today, and PAYER held 125 before these runs.
- **Public access is live** (#117, ADR-0069): visitors meet no passcode, and the keys between our own servers stay.
- **Phase 1 is live at `/live`:** the team's phones around the explainer (#111).
  - Production deploys had failed from #111 until #116 fixed the build (Vercel had skipped the phones' build tools). Production now runs `ff12990`.
- **Phase 2 works end to end** (#122):
  - An errand asked from `/live` at 16:34 IST paid 4.80 to Kesar Kingdom in about 107 s ([tx](https://explorer.testnet.whitechain.io/tx/0x89acd9521341763f6f6a37893eec921c9548d7a0b5984597d56088a5f5d5b990)).
  - Vitalik's phone showed the agents' steps, the three shops (the trap rejected, with reasons) and the quote going from signed to paid. Kesar's phone showed the order, and the explainer showed the lanes.
  - Rough edges:
    - Kimi's closing line said "mock" (being removed);
    - the repeat-buyers count shows a dash (no data);
    - there is no Dispatch button on a fresh order (the shop delivers itself).
- **Phase 3 is live** (#124): the money buttons that exist are wired live. The Integration session is testing each one once.
- **A visitor paused the payer** at 15:45 IST. Pause is public now. On the founder's go the Coordinator resumed it at 16:33 IST. The payer is active, with 19.20 of 100 spent today.
- **Join next:** C6 and F2 rewritten for public access.
- **Idle until the founder's run:**
  - the story swap;
  - the kill;
  - subscribe, cancel, caps and decline;
  - Kimi tuning;
  - the big city;
  - Submission.
- **Usage: 92% at 16:09 IST**, rising about one point an hour while the sessions were idle. Every session pauses at 97%; the weekly reset is at 21:30 IST (in 5 h 20 min).

## foundation

M0 is done and handed over (PRs #1–#7); see `relays/foundation.md`.

## payments

Updated 12:46 IST, Fri 6 Nov (T1).
- **M4 is done: payments run from the public site.** The shop, our facilitator, the refusal recorder and the renewal job are live on https://graphpay-event.vercel.app. A 0.40 payment went through the public URL with no gas from the payer ([explorer](https://explorer.testnet.whitechain.io/tx/0x06d43ca9a501342a1177d3a48383dc1611505863bab15a396aa38bc02aee6e01)), the repeat answered "already paid", every protected route refuses without its passcode or token, and the renewal job renewed a 2-minute demo subscription on its own ([explorer](https://explorer.testnet.whitechain.io/tx/0x48b14aa45f56d487dee743721416a359fed96296b3ad0ababf546838f55e480f)).
- Join's agents now pay through the hosted facilitator, so no two processes share a key.
- F3 done: the relayer's safety floor refuses a payment before sending (`docs/sessions/payments/f3.json`).
- Fixed: a live errand's quote write failed when several servers wrote with the same Arkiv key at once. The shop now retries that write (bounded), and Join's runner pauses its own writes during a payment (#93).
- The payer agent's daily cap is now 100 test USDT on-chain (founder's brief); the ENS cap record is T2's.
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

Updated 13:33 IST, Fri 6 Nov. **The live errand pays reliably on the production site: the founder's two test errands (13:28, 13:30 IST) both paid 4.80 to kesar on Kimi, in 115–129 s, after three paid in a row.**
- As the acceptance agent, through the hosted shop and our hosted facilitator: paid 4.80 with no gas of its own, and the shop delivered. The same request again answered "already paid" and sent nothing. The shop refunded 0.80, and the agent re-ordered 3 for 1.20. One more 0.40 was refused for being over its 6.00 daily cap: nothing was sent, and the refusal is recorded on Arkiv.
- A revoked agent is stopped on-chain: the policy writer revoked the scout agent's spending policy, the scout's next payment was refused and recorded by the contract (AGENT_REVOKED), the policy was restored exactly, and the mirror wrote the refusal to Arkiv once after a clean restart.
- No secrets in the repo (F1): the tree and the history of all 313 commits on every branch are clean, no env file is tracked, and every key and token on Vercel is hidden.
- Quotes expire as designed (D10): a quote the hosted shop wrote for the acceptance agent is owned by our directory writer, disappears from Arkiv after 15 minutes and stops being valid after 10; a missing or expired quote makes the agent re-quote before it signs.
- All 17 spending routes refuse a caller without the passcode or token (401), and nothing is sent.
- Also wired: five other tracks' checks from their recorded evidence (A3, A4, A9, A10, B3).
- The agents' live presence (Friday item 3, D11's first half) is proven: an errand's presence row appears on Arkiv 6.7 s after it starts and lapses 15 minutes after it ends. The e2e scripts now pay through the hosted shop and facilitator.
- What made it reliable: the concierge on Kimi (T4), the Arkiv write clash held around the quote (Join), the facilitator's settle made safe to retry (T1), the site's runner retrying only safe answers, with no hourly cap (the founder).
- Running: `pnpm workers` with T2's watcher. Local scripts no longer relay; every payment goes through the hosted facilitator.
- F3 (the relayer's safety floor) passes from T1's record (PR 78).
- Not run yet, both T2's: B7 and B9.
- Next: the item-6 bootstrap of the demo cast, when the story locks.

## phones

Updated 17:05 IST, Fri 6 Nov (Integration).
- **The errand pays from the stage:** 4.80 to Kesar Kingdom in about 107 s (tx `0x89ac…b990`). The shops were compared and the trap rejected on Vitalik's phone; the order appeared on the shop's phone; the explainer's lanes filled.
- **Phase 3, used live:**
  - works: the Open switch; the refund request (it reaches the shop's inbox after #127); pause and resume (through `/customer`);
  - fails on the server, reported to the owners: the merchant refund (502) and the re-order (`BAD_402`);
  - dispatch is automatic (about 6 s after payment).
- **Phase 4 in review:** `/live` becomes the home page; the gulab jamun's Swarm image is read through its Arkiv menu row into the phones' data; the founder's click-by-click script is `docs/sessions/integration/test-script.md`.
- Blockers: the two server fixes. The team's flag to hide unbuilt actions.

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

Updated 12:47 IST, Fri 6 Nov (Coordinator).
- **Done this step:**
  - #70 merged;
  - the funding moves (PAYER to 125 test USDT, VITALIK to 0.02 Sepolia ETH);
  - ADR-0069, ADR-0070 and ADR-0071, and the second amendment to ADR-0062;
  - CLAUDE.md and the README;
  - the Vercel `ignoreCommand`.
- **Waiting on:** T1's and T2's cap transactions, Join's reliable errand, and T3's Swarm image.
- **Next:** tell the founder when the pass is 100 and the errand pays reliably, then when phase 2 works.

## submission

Not started (the Submission session, M17, from Fri 13:00; submit by Sat 08:00 IST).
