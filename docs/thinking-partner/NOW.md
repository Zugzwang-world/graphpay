# NOW

Updated 22:49 IST, Fri 6 Nov (Coordinator, full sync)

## Summary (Coordinator only)

Updated 22:49 IST, Fri 6 Nov. **Only the submission (Sat 09:00 IST) and the presentation (09:30 IST) are fixed** (ADR-0066). Every deliverable's status is in [`TRACKER.md`](TRACKER.md). A fresh Coordinator can start from `docs/sessions/coordinator/handover.md`.

**Urgent: the Mac is on battery** (78% at 22:49 IST, about 5 h 20 min left). It would die around 04:10 IST, before the 09:30 presentation, taking the mirror (`pnpm workers`) and every session with it. **Plug in the charger and keep the lid open.**

**Found by the sync:**
- Vitalik's phone says "Agents active" while the payer is PAUSED (a status bug in the phones).
- https://graphpay-store.vercel.app answers 404: the drop-in store is not deployed.
- `WHITECHAIN_FEEDBACK.md`, which the Whitechain track asks for, does not exist yet (Submission).

**Live and proven** on https://graphpay-event.vercel.app:
- **One screen:** the deck in the middle, and the team's two live phones driving it (ADR-0074). Public access: no passcode (ADR-0069).
- **The errand:** the agents pay a shop 4.80 with no gas, after the ENS gate. Examples: [0x8617…863a](https://explorer.testnet.whitechain.io/tx/0x8617754857a8eb1fb1483b4f18fb6fa6a4f1607241d3f08c7ccd062de1b8863a) and [0x89ac…b990](https://explorer.testnet.whitechain.io/tx/0x89acd9521341763f6f6a37893eec921c9548d7a0b5984597d56088a5f5d5b990). The trap shop is refused, with reasons.
- **The money buttons:**
  - refund request, then the shop's refund ([0xcd44…c425](https://explorer.testnet.whitechain.io/tx/0xcd442a5e6675e0eae8a66bc17ee3913af1b673e39a54a28d4a14a0fab58bc425));
  - re-order ([0x78ac…78ef](https://explorer.testnet.whitechain.io/tx/0x78acbc3fbf50a15bbe3920bdcfe9e47a032fa43db81b5710c1d369e8a83778ef));
  - pause and resume;
  - the Open switch.
- **The payer's pass:** 100 test USDT a day, on-chain (#107) and in ENS.
- **The story on screen:** masala dosa near BKC (ADR-0073), with Grok's figurines and photos (ADR-0075).
- **Both SDKs on npm at 0.1.1:** [arkiv-graph](https://www.npmjs.com/package/@graphpay_ethglobal/arkiv-graph) and [agentpay](https://www.npmjs.com/package/@graphpay_ethglobal/agentpay).

**Broken or not built:**
- **The payer has been PAUSED since 21:24 IST** (someone pressed the public Pause). Errands are refused until it is resumed. The founder decides.
- **The Arkiv access key's quota is used up** (since about 21:36). Reads fall back to the keyless endpoint (#148). The map and the customer state work, but more slowly.
- **The story on chain:** the dosa shops' ENS names, their history and their Arkiv category ("sweets") are still the test cast's.
- **Not built:** subscribe and cancel, the kill, the cap actions, the big city at M, and the 0.80 coffee re-order.
- **Acceptance** (regenerated read-only at 22:40 IST): **35 pass, 8 fail, 1 blocked (D7), 4 not run**, of 48.
  - B1 and B2: the paused payer, plus a test agent's spent cap (it resets at 05:30 IST).
  - C3, D4, E1 and D8: their evidence predates the story swap, so they need fresh live runs.
  - C7 and E3: a bug in the acceptance runner, which reads the 1.20 re-order instead of the 4.80 payment (Join).
- **Between about 23:14 IST and midnight no errand can buy:** the deadline is 11:59 pm, and the good shop needs 45 minutes. Avoid that window for tests and the video.
- **The mirror** made no successful poll from 22:02 until at least 22:31 IST, then recovered by 22:39 without a restart. Join and T3 should check why.

**Decisions today:**
- ADR-0062: amended to 95%/97%, then guardrails off tonight.
- ADR-0067: Kimi.
- ADR-0069: public access, with no private links or ceilings.
- ADR-0070 and ADR-0074: the stage.
- ADR-0071: the pass is 100.
- ADR-0072: the fictional persona.
- ADR-0073: the dosa story.
- ADR-0075: the Grok desk.
- ADR-0076: SDKs without UI.

**Founder now** (OPEN):
1. Start the Submission session.
2. The payer: resume it, and decide whether Pause becomes presenter-only.
3. The Arkiv key.
4. The demo scope.
5. The video.
6. The Kimi balance.
7. The disclosure and team registration.

**Sessions:** all idle except the Coordinator. Ids are in `docs/sessions/coordinator/handover.md` §5.
- T1 to T6, Join, the Integration session, Booth and Booth Sync are idle.
- Submission has not started.
- Retired: the first Coordinator and M0.

**Usage:** about 1% of the week that began at the 21:30 reset. The guardrails are off tonight, and every session runs on Opus 5.5 at max.

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

Updated 17:20 IST, Fri 6 Nov (Integration).
- **All four phases are live.** The home page is the team's two phones on live data around T5's explainer, with no passcode.
- **Proven live, each once:**
  - the errand paid 4.80 (tx `0x89ac…b990`, about 107 s);
  - the Open switch;
  - the refund request;
  - the merchant refund of 0.80 (tx `0xcd44…c425`, after T5's #129);
  - the re-order of 1.20 (tx `0x78ac…78ef`, after #131);
  - pause and resume;
  - dispatch is automatic.
- Waiting on the team (OPEN): product images (the Swarm image is in the data), hiding unbuilt actions, a pause switch, optional repeat buyers, a receipt card for a re-order.
- The founder's script: `docs/sessions/integration/test-script.md`.

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

Updated 22:49 IST, Fri 6 Nov (Coordinator).
- **Done:** the full sync (TRACKER, NOW, OPEN, LOG, every relay, ADR-0072 to ADR-0076, the acceptance report, the handover).
- **Running:** the 10-minute tick.
- **Next:** the founder's answers (Submission, the payer, the Arkiv key), and a fresh Coordinator taking over from the handover.

## booth

Updated 20:25 IST, Fri 6 Nov (Sync session).
- **sync (done, merged and live):** the phones drive the deck. Every errand step and every phone event (refund request, the shop's refund, pause, resume, the Open switch, a renewal) moves the deck to its slide with its explorer links, from one table (`apps/web/lib/deck-map.ts`); the strip's title is the slide's own title, so the two agree. Back and Next only browse. Figurines are large, with no ring or badge. No QR strip; the deck has the height back (#143, #144).
- **The no-purchase errands** (19:31 to 19:35) were the clock: the good shop needs 45 min and the request said "by 8 pm". The story deadline is now "by 11:59 pm" (#142). Not a bug.
- **Checked on production in Chrome:** one live errand (all seven steps in sync, paid 4.80, order #4B28), a 0.80 refund from Vitalik's phone to Filter & Fold's, Pause then Resume on the Payer card. Payer active, shop open.
- **Waiting on:** nothing. **Next:** the founder's demo check; what not to tap is in `docs/sessions/booth/demo-note.md`.

## submission

Not started (the Submission session, M17, from Fri 13:00; submit by Sat 08:00 IST).

## w3-payments

Updated 23:40 IST, Fri 6 Nov (W3 Payments).
- **Re-order (item 1, in its PR):** "Another coffee" re-orders the filter coffee for 0.80 (ADR-0073), from `order.reorder` in the story. One live re-order proves it after the deploy.
- **Next:** subscribe and cancel (item 2), the refund decline (item 3), then the limits (item 4).
- Blockers: none.
