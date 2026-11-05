# Relay: integration (Join)

Updated 02:50 IST, Fri 6 Nov.

## In plain words

The mirror turns every payment on Whitechain into a line in the money graph on Arkiv. It runs as one long-lived "workers" process on the founder's Mac, and the agents read the shops' scoreboards (tallies) that it keeps before they pay.

Since the last update, the mirror is connected to the real pieces: T3's Arkiv writer (M7a) and T1's checkout contract (M1). It has been tested in T3's Arkiv emulator with the real tally rules:
- the lab's lifecycle comes out exactly as the lab measured it: the good shop has 5 orders, 6.40 paid, one refund of 0.80, 2 failures and 3 deliveries;
- a restart writes nothing new;
- a refusal recorded by the website is counted once, and only against the agent whose own wallet signed it;
- the labelled synthetic history and a real payment after it add up on the same scoreboard;
- a second workers process is refused, and of two that start at the same moment, the later one stops itself;
- the heartbeat keeps beating during long work, so the lease never lapses while the process writes.

`pnpm workers` starts it. Nothing has run on a real network yet: that waits for the checkout's deployment (T1, M2) and the cast's names on ENS (T2, M5). The founder needs to do nothing. W_LEDGER, the mirror's Arkiv wallet, holds 1.998 tGLM, against about 0.7–0.9 needed for the history.

## Technical

**PRs:**
- [PR 8](https://github.com/Zugzwang-world/graphpay/pull/8) (merged): the mirror core on test doubles.
- This PR (link in `LOG.md`): the wiring.

**What was built:**
- `src/arkiv.mjs`: the mirror's ledger port over `@graphpay/money-graph` (PR 14).
  - It runs three `createLedger` instances on W_LEDGER's rows: the chain stream `chain:1874:<checkout>`, the `recorder` stream and the history stream. Each one plans absolute tallies from its own copy of the rows. A write through one marks the others stale, and they re-read from Arkiv before their next write. A live anchor read that differs from a ledger's copy marks that ledger stale too.
  - Live writes pin the nonce read before the anchors (`NONCE_TAKEN` otherwise).
  - The checkpoint carries an event's position only when it moves forward; while an earlier event is parked, the write carries no position and the ref guards it.
- **History.** It is sent in parts that each plan into one unsplit transaction, at a pinned nonce, checked by its checkpoint if it is found by nonce. A part therefore lands whole or not at all. A shared tally or link row the history touches is labelled `synthetic=true`.
- `src/workers.mjs`, `src/main.mjs` (`pnpm workers`):
  - Start order: the lease, the heartbeat row, the cast, the history, then the chain source every 2 s and the recorder fold every 10 s.
  - The heartbeat beats on a timer between writes and between the events of a long catch-up. Every beat looks for a rival, and the instance whose row was created first (by Arkiv block) keeps the lease.
  - A claim file is taken exclusively (`wx`) and blocks a second process on this Mac while its pid is alive.
  - Start-up writes retry a lagging-RPC nonce.
  - The Whitechain RPC is chosen by `resolveRpc`, and Arkiv's chain id is asserted at connect.
  - Errors and logs pass the redactor, and the endpoints listen on 127.0.0.1 only.
- **The checkout.** The ABI and `FAIL_REASON` come from `@graphpay/contracts`. `nodeOfWallet` attributes refusals. The address and deploy block are read from `whitechain.contracts.checkout` (M2), or else from `GRAPHPAY_CONTRACT` and `DEPLOY_BLOCK`. A lab address is refused.

**Tests:** 29 in `packages/mirror`, all green: 22 on fakes and 7 on ArkivSim with the real planner and writer.

**Reviewer:** one pass, with 2 blocking issues and 7 should-fix items, all fixed in this PR.
- The lease could lapse during the history or a long catch-up.
- The race tie-break ignored the order of creation.
- History parts could land in pieces.
- The registration check read the wrong field (`$attributes`).
- One bad refusal could block the fold.
- Mixed rows carried the wrong labels.
- Start-up writes could hit a lagging RPC.
- There were gaps in `main.mjs`, and a missing row in `VERSIONS.md`.

**Found in merged code (reported to the Coordinator for T3):** `getEntity` returns the columns under `$attributes`, but money-graph's `recordEdge`, `quotes.mjs` and the ledger's unstreamed check read `e.attributes`. After an uncertain send, those checks can reject the writer's own transaction. A recorder refusal could then be sent twice, though the fold's row guard keeps it from being counted twice.

**Deviations, and choices where the spec is silent:** these are the same as in PR 8 (history buyers, the held checkpoint, standing replays, the recorder's 120 s settle window). Added here:
- history parts are atomic, rather than 25-event batches split by bytes;
- mixed tally rows are labelled synthetic.

**Next:** when M2 and M5 merge, the founder's Mac runs `pnpm workers`. That registers the cast, writes the 5% history (1,258 events, about 100 transactions, 10–15 minutes) and mirrors the lifecycle run. Then D1–D3, D15 and the 30-minute lag check. The procedure is in `docs/sessions/integration/mirror.md`.
