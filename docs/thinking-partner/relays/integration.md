# Relay: integration (Join)

Updated 04:10 IST, Fri 6 Nov.

## In plain words

The mirror is the piece that turns every payment on Whitechain into a line in the money graph on Arkiv, the scoreboard the agents read before they pay. **It now runs for real.** One long-lived "workers" process started on the founder's Mac at 03:13 IST, kept awake by `caffeinate`. It works on the real test networks, not the emulator.

What it did on its first start:
- registered the 19 names of the test cast (people, agents, shops) on Arkiv's testnet;
- wrote the labelled synthetic history the story needs, so the shops have a track record before the first real errand: 1,258 events at 5% of the lab's scale, every row marked synthetic, about 0.49 test GLM;
- read the checkout contract from the block it was deployed in. So far the contract has only its 9 setup events (relayers and the five agents' spending policies), and those need no write.

It keeps up 2 blocks (about 4 seconds) behind the chain head.

What this means for the demo: the agents' scores are now real reads. Asked through the hosted MCP endpoint (the same one the agents and judges use), the graph answers from the mirror's rows. Kesar Kingdom is on time 97% of the time with 1% refunds, Syrup Street 93%, and Jamun Junction 71% with 18% refunds. Jamun is the trap the analyst should exclude. These figures are synthetic story inputs, labelled as such on Arkiv.

What was proven on the live networks:
- **No double writes on a retry:** running the mirror again over the same blocks, with its memory of progress wiped, sends nothing.
- **It survives a drop:** the process was frozen for 2 minutes, then killed hard and restarted. It caught up 127 blocks in under 5 seconds and took over at once (the dead process's lease was released). It went on from the same place, and nothing was lost or written twice.

What the founder must do: **keep the Mac's lid open and the charger in**. caffeinate stops idle sleep but not a closed lid. Nothing else: no login, no funding.

Both checks count for acceptance (D2, D15) only with a payment in the window, so until then they report "not run", never "pass". Still waiting: the first real payment. It comes through T1's facilitator (M3), which needs T2's spending gate (M6). D1 (one payment = one atomic Arkiv transaction), the other two retry cases of D2, and D3 (the scores recomputed from the raw edges) run on that payment. M11 closes then.

**Since 03:36 (second PR):** the payer now runs the ENS gate before it signs. This is T2's gate (M6 part 1), with the agent's spending policy and today's spend read from the checkout on Whitechain. A refusal signs nothing; the facilitator still checks again. The one exception is the kill test (E7): it signs without this gate on purpose, because it proves that the facilitator refuses a killed agent and the refusal lands on Arkiv. Separately, the agents' "at work" rows and hand-offs (Friday item 3, on T3's new rows) are queued and written as one Arkiv transaction per phase, so they never slow an agent.

## Technical

**Branch `join/m11-live` (this PR): M11 part 3.**
- `packages/mirror/src/setup.mjs`: the connections and the mirror that `main.mjs` (the workers) and the replay share. The checkout comes from `whitechain.contracts.checkout` (M2: address and deploy block 12,313,887), Whitechain is checked as chain 1874 and Rabdi as 7794095.
- `pnpm workers:replay` (`packages/mirror/src/replay.mjs`), one mirror pass over a block range outside the workers:
  - `dry` and `lost-cursor` (D2a): the write ports are replaced by counters, so these modes are safe beside the running workers;
  - `race` (D2b): two processes hold their first raw transaction until the same instant, so they send the same batch at the same nonce;
  - `crash` (D2c): the process kills itself right after the node accepts the transaction, before any receipt.
  The two write modes refuse while a workers heartbeat is fresh.
- `acceptance/mirror.mjs` with `packages/mirror/src/checks.mjs`: D1 decodes the mirror's Rabdi receipt (`EntityCreated`, `EntityPatched`) and names each operation by type (edge, the four tally rows, link, checkpoint), with gas against the lab's 310,527. D2a–c run the replays. D3 runs `reputation(window: ALL, verify: true)` plus a full recount by paging. `refs` checks that every event in a window has exactly its one edge. `lag` checks the heartbeat. Each result goes to `acceptance/results/<id>.json` for M13's report.
- `integration/` (new workspace package, for M12):
  - `@ai-sdk/mcp` 2.0.90, verified: it shares `@ai-sdk/provider-utils` 5.0.74 with `ai` 7.0.162, whereas `latest` 2.0.91 would add a second copy. Recorded in `docs/technical/VERSIONS.md`.
  - `src/mcp.mjs`: the agents' `McpLike` over Streamable HTTP to `https://graphpay-event.vercel.app/api/mcp`. Live, it lists `schema, ask, graphql, explain`.
  - `src/hooks.mjs`: `resolvePayee` and `readAccepts` (the ENS reader with its 20 s cache, M5 amendment §2), `nodeOf`, `directory` and `shopKey` (`discoverShops` around the persona's point and 3 km radius, M7 amendment §6), `findQuotes` (W_DIRECTORY quotes, §5), and `payerWallet` by wallet role (public addresses only).
- Tests: mirror 34, integration 8, money-graph 15 (after merging PR 25). `pnpm check` is clean. The reviewer runs before merge.

**Live numbers (Rabdi, W_LEDGER `0x7DeAF022B3829C53c73031B7d28Ed9746F517665`):**
- History stream `history:test:v1:x0.05:d20762:b7d36bb9`: 1,258 events, about 50 parts, about 13 min (03:13–03:26 IST).
- Balance 1.998 → 1.510 tGLM.
- The chain stream has no checkpoint yet (no checkout event has needed a write).
- Stored all-time tallies (synthetic, from the history): kesar 241 orders, 1,156.80 paid, 3 refunds; jamun 110 orders, 20 refunds.
- Restart: 0 nodes re-registered, the history found complete, running in 22 s.

**Deviations and open items:**
- D2a and D15 ran on a window with no edge events (no payments exist yet), so they record `not run`. They are repeated with payments in M13.
- The reviewer found 3 blocking issues, all fixed before merge: the race and crash hold never fired (viem copies the client, so the hold now sits at the transport, `packages/mirror/src/intercept.mjs`); D1 looked for `day` where the rows say `day:<n>`; the D3 recount read only one end of each edge. ArkivSim tests now run D1 on every mirrored payment and the recount on every node.
- Known limit: a replay with its checkpoint lost (`lost-cursor`) would re-apply an old `AgentPolicySet` standing; the real mirror is protected by its checkpoint (every standing write moves it). Guarding standings by their last event is a follow-up.
- Found: `Reputation.synthetic` (money-graph GraphQL, T3) reads only the node row, so scores from the labelled history show `synthetic: false`. Sent to the Coordinator for T3 (`OPEN.md`).
- The killed instance's heartbeat row stays `running` until its 1-day expiry. The lease reads its age (stale after 90 s), so this is harmless, but a reader counting `running` rows must also check the age (the `lag` check does).
- Not yet hosted in the workers: T2's ENS watcher (M6, not merged).

**Second PR (`join/m12-gate`):**
- `integration/src/gate.mjs`: `createPayerGate`, `gatedSign(sign)` and `ensCheck`, on `createEnsGate` from `@graphpay/ens` (PR 34). It makes one `policies(node)` read per call (epoch and cap from the same policy), reads `spentToday(node)`, and checks chain 1874 once.
- Live, read-only: `payer` 4.80 passes (cap 6.00), `rehearsal` passes (30.00), `payer` 7.00 is `CAP_EXCEEDED`, `scout` 4.80 is `CAP_EXCEEDED` (cap 1.00), `analyst` is `ENS_NO_POLICY`, `disposable-2` is `ENS_NOT_FOUND`.
- Reviewer: no blocking issues. Its should-fix items are taken: one policy read, the chain check, and tests for the missing amount, the failed read and the zero cap.
- `integration/src/activity.mjs`: `batchedActivity(arkiv)` for T3's `agent_presence` and `handoff` (PR 35). Hook calls only queue. A flush every 2 s while calls arrive, plus `flush()` at the end of a run, sends at most 20 operations in one transaction. A renewal extends its row; a failed batch is dropped and logged.
- ArkivSim test: 1 presence and 5 hand-offs land in 1 transaction, and the renewal in 1 more.
- Tests: integration 11.

**Next:** M12's shop side, signing and gate once M3 and M6 merge; `pnpm e2e:food` (fork, then real with `E2E_BUYER=rehearsal`); then D1–D3 on the first real payment and the `(M11 done)` PR.
