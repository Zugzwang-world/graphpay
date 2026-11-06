# NOW

Updated 23:33 IST, Fri 6 Nov (night Coordinator)

## Summary (Coordinator only)

Updated 23:33 IST, Fri 6 Nov. **Only the submission (Sat 09:00 IST) and the presentation (09:30 IST) are fixed** (ADR-0066). Every deliverable's status is in [`TRACKER.md`](TRACKER.md).

**The Mac is charging again** (65% at 23:27 IST). Keep the charger in and the lid open until the presentation: the mirror and every night session run on it.

**The night run** ([brief](briefs/2259-night-coordinator.md)): seven streams, each in its own session and worktree, on Opus 5.5 at max. The usage guardrails are off tonight, and no contract is redeployed.

| stream | session | owns tonight |
|---|---|---|
| W1 Identity | `local_45f7cf5d-c31e-4dbf-b849-466f3067bdd3` | the new shops' ENS names, the label flip, the kill |
| W2 City | `local_da212093-3d02-4768-9314-ab7be179eb86` | the new shops on Arkiv, the menus on Swarm, the big city M, race mode at M |
| W3 Payments | `local_b65be40a-eb20-4d86-b784-7d2aa1a93527` | the re-order, subscriptions, the refund decline, the limits |
| W4 Agents | `local_3404db4e-486c-4f86-8b3a-67ceb53ef025` | the relative deadline, speed and cost |
| W5 Ops | `local_29b84e36-bafe-4ba2-9315-4c2a94a0a19e` | the payer and the shop, pause per agent, self-healing, the workers, acceptance |
| W6 SDK | `local_b6205da6-b613-4662-872a-6d4879c66faf` | both SDKs at 1.0.0 |
| W7 Submission | `local_abd77623-de22-4fe2-a0a9-865fdd43dba2` | the README, AI_USAGE, the sponsor files, the form text |
| Coordinator | `local_1caa580c-782f-4658-a828-66758afb211a` | merges, the `story.json` order, funding, the records |

**The order that matters:**
1. W2 writes the new shops' Arkiv rows and history under their new names.
2. Then W1 flips the shop labels in `story.json`.
3. Then W5 restarts the workers.

The Coordinator times each step. If a merge breaks the live errand, revert first, then fix.

**Landed tonight:**
- **W5:** the payer's pass is **300 test USDT a day** for tonight, in the policy and the ENS record, and PAYER is back to 125 test USDT ([#152](https://github.com/Zugzwang-world/graphpay/pull/152)).
- **W4:** the request says "delivered within an hour", and the deadline counts from the request, so errands can buy at any hour ([#153](https://github.com/Zugzwang-world/graphpay/pull/153), live since 23:18 IST). Every model call now goes into the run log with its tokens and seconds ([#157](https://github.com/Zugzwang-world/graphpay/pull/157)). W4 runs a live errand as its baseline next.
- **W7:** the README, with a "verify each claim" table of 24 checked transactions, the persona note, the partner sections and the team; a root MIT license ([#154](https://github.com/Zugzwang-world/graphpay/pull/154)).
- **W1:** the three new shop names are live on ENS (Sepolia), each with its storefront, risk and dispatch agents, on the old shops' wallets, so no funds move (30 transactions; ENS reads 100 pass). The record is [#158](https://github.com/Zugzwang-world/graphpay/pull/158).

**In PR:** W3's 0.80 coffee re-order ([#155](https://github.com/Zugzwang-world/graphpay/pull/155), reviewer: no blocking issues). W2 is writing the new shops' history (63 of 1,258 rows at 23:27 IST); W1 flips the labels after it.

**Live now** (23:17 IST):
- **The payer is ACTIVE:** resumed at 23:00 IST ([Sepolia tx](https://sepolia.etherscan.io/tx/0x34cddd47d2230e305b4f0a9546b8dfba51d37b7bee4c0336d54a4f556397f949)). 78 of tonight's 300 test USDT are spent; the pass resets at 05:30 IST.
- **Filter & Fold is open.** A listing lasts 15 minutes, and only an open merchant phone renews it, so all three shops had lapsed to closed.
- **A bridge loop on this Mac** renews the shop's listing every 9 minutes and resumes a paused payer after about 6 minutes, until W5's self-healing cron is live.

**Retired at 23:05 IST:**
- T1 to T6, Booth (with its two side sessions), Booth Sync and Integration are archived. Their last prompt logs are committed here.
- The outgoing Coordinator was asked to delete its tick.
- Join stays idle until W5 restarts the mirror from its own worktree, because `pnpm workers` still runs from Join's.

**Still open** (from the 22:49 IST sync):
- The Arkiv access key's quota is used up, so reads go to the keyless endpoint (#148).
- Acceptance: 35 pass, 8 fail (W5).

**Founder now** (OPEN):
1. Keep the charger in.
2. The Arkiv key.
3. The Kimi balance, and more test USDT to FUNDER.
4. npm's web approval when W6 asks.
5. The video.
6. The disclosure and the team's registration.

## records

Updated 23:10 IST, Fri 6 Nov (night Coordinator, `local_1caa580c-…`).
- **Done:**
  - took over from the handover;
  - resumed the payer and opened Filter & Fold;
  - retired the day sessions;
  - filed the night brief;
  - moved the retired relays and the finished briefs to `docs/archive/`, to keep this folder under its word limit.
- **Running:** the 10-minute tick, and the bridge loop (the shop's listing and the payer) until W5's cron.
- **Next:** time the W2 → W1 → W5 order, merge the streams' PRs, and keep NOW and TRACKER current.

## w1-identity

Updated 23:35 IST, Fri 6 Nov (W1 Identity, session `local_45f7cf5d-c31e-4dbf-b849-466f3067bdd3`).
- **Done: the new shops are on ENS** (Sepolia), each with storefront, risk and dispatch agents:
  - `filter-and-fold.graphpay.eth`, `idli-index.graphpay.eth`, `tawa-tangle.graphpay.eth`.
  - Each pays into its old shop's wallet, so no money moved. The old names stay registered as history.
  - 30 transactions; all 100 ENS acceptance reads pass for the new names (`docs/sessions/identity/namespace.md`).
- **Waiting on:** the Coordinator's go for the `story.json` label flip, after W2 writes the new shops' Arkiv rows.
- **Next:** the kill (a funded spare, the site's Kill route, the watcher's revoke, a refused payment, a fresh spare).

## w2-city

Started 23:02 IST, Fri 6 Nov (session `local_da212093-3d02-4768-9314-ab7be179eb86`). W2 rewrites this section at the end of each step.

## w3-payments

Updated 23:50 IST, Fri 6 Nov (W3 Payments, session `local_b65be40a-eb20-4d86-b784-7d2aa1a93527`).
- **Re-order (item 1, PR #155):** "Another coffee" re-orders the filter coffee for 0.80 (ADR-0073), from `order.reorder` in the story. One live re-order proves it after the deploy.
- **Next:** subscribe and cancel (item 2), the refund decline (item 3), then the limits (item 4).
- Blockers: none.

## w4-agents

Updated 23:35 IST, Fri 6 Nov (W4 Agents, session `local_3404db4e-486c-4f86-8b3a-67ceb53ef025`).
- **Item 1, the relative deadline ([#153](https://github.com/Zugzwang-world/graphpay/pull/153), merged 23:18 IST):** the request says "delivered within an hour"; code reads the hour from the moment of the request, so errands work at any hour.
- **Item 2, measuring ([#157](https://github.com/Zugzwang-world/graphpay/pull/157), merged 23:26 IST):** every agent's end event carries each model call (tokens in and cached, out and reasoning, cost, tools, seconds).
- **The live baseline (23:30 IST):** paid 4.80 in 91.4 s; 19 model calls, 33,287 tokens, $0.1455; 62.6 s of it was the models.
- **Item 3, first cut ([#162](https://github.com/Zugzwang-world/graphpay/pull/162)):** the routine agents think at Kimi's low effort; the model reads short tool replies (the screens keep the whole data); the concierge gets the limits from code. Next: measure it live, then move the routine steps into code.
- **Blockers:** none.

## w5-ops

Updated 23:10 IST, Fri 6 Nov (W5 Ops).
- **The payer is ACTIVE**, with a **300 test USDT** pass for tonight, in the policy and the ENS record (the gate passes it at 300). 78 spent today.
- **PAYER holds 125 test USDT** (66.8 from FUNDER); the shop's takings (118.81) refill it next.
- **The shop (Filter & Fold) is open.**
- **Next:** Pause and Resume per agent, the self-healing cron, the workers after W1's new labels, and acceptance at 0 failures.

## w6-sdk

Started 23:02 IST, Fri 6 Nov (session `local_b6205da6-b613-4662-872a-6d4879c66faf`). W6 rewrites this section at the end of each step.

## w7-submission

Updated 23:38 IST, Fri 6 Nov (W7 Submission, `local_abd77623-de22-4fe2-a0a9-865fdd43dba2`; relay `relays/w7-submission.md`).
- **Landed:** the README and a root `LICENSE` ([#154](https://github.com/Zugzwang-world/graphpay/pull/154)); AI_USAGE.md and the five Arkiv files ([#159](https://github.com/Zugzwang-world/graphpay/pull/159)); `WHITECHAIN_FEEDBACK.md` and `docs/submission/ENS.md` ([#161](https://github.com/Zugzwang-world/graphpay/pull/161)).
- **In this PR:** `docs/submission/ETHGLOBAL.md`, the form text ready to paste (name, one-liner, description, how it's made, links, the three partner prizes), with every URL checked.
- **Next:** a pass over all of it as W1 (shop names), W2 (race at M, menus), W3 and W6 (SDK 1.0.0) land; the founder submits from the file.
- **Blockers:** none.

## before the night (retired day sessions)

Rolled up 23:10 IST by the night Coordinator. The day sessions (M0, T1 to T6, Join, Integration, Booth and Booth Sync) are retired; their last relays are in `docs/archive/thinking-partner-relays/`.

What they left live:
- the errand, paying 4.80 through the hosted shop and our facilitator, after the ENS gate, with the payee read from ENS;
- the money graph on Arkiv, with explain traces;
- the refund request and the shop's refund;
- the re-order (of the 4.80 combo);
- pause and resume, and the Open switch;
- race mode at size S, the map and the MCP endpoint;
- three menus on Swarm;
- the one screen, with the phones driving the deck;
- both SDKs at 0.1.1 on npm.

TRACKER has every deliverable with its evidence link.
