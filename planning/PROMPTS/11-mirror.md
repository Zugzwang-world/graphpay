# M11 — The mirror (contract events → Arkiv)

**Goal:** our own mirror writes every `GraphPayCheckout` event to Graph Arkiv on real Rabdi, one atomic batch per event, duplicate-proof, restart-safe, as the single writer of real data.
**Depends on:** M1 (ABI and events), M7a (writer), M5 (the cast to register). **Worktree:** `wt-join` (`join/mirror`). **Model:** Opus High. **Time:** 60–75 min (lab: about 35 min with 7 blocking review items fixed; the Rabdi path was never run live in the lab).

## Inputs
`SPEC/INTEGRATION_AND_MIRROR.md` §2, §3, §8; `SPEC/ARKIV_GRAPH.md` §3, §7; `SPEC/PAYMENTS_WHITECHAIN.md` §3.3; `DECISIONS.md` E-2, E-4.

## Prompt
> In `packages/mirror`, build the mirror of `planning/SPEC/INTEGRATION_AND_MIRROR.md` §2 on M7a's writer: decode checkout logs into events with id `1874:<tx>:<logIndex>`; for each event, skip it if the stream checkpoint covers it or an edge with that `ref` exists, otherwise map it with the table in §3 and send one batch with the checkpoint; payer epoch from the event, shop and buyer epochs from the node rows (fresh names are epoch 0); renewals move money once; on-time within the delivery promise after the payment's time; `DUPLICATE` not counted; park events with unknown actors; discard and re-adopt on any failed write. The chain source polls `eth_getLogs` in ranges of at most 1,000 blocks to `head − 2`, reads the head with `cacheTime: 0`, and holds one lock around each poll and its write.
>
> Run it as **exactly one long-lived "workers" process** (`pnpm workers`, on the founder's Mac during the event) that polls every 2 s and also hosts the ENS watcher from M6: it is the only W_LEDGER writer (`SPEC/INTEGRATION_AND_MIRROR.md` §2 explains why a Vercel cron plus on-demand trigger is unsafe: a stale read can land at the next nonce and overwrite absolute tallies). On start it refuses to run if another instance's heartbeat row on Arkiv is fresher than 90 s; it patches its heartbeat every 30 s (cursor, last block, lag) for the website's lag chip. Read the confirmed nonce before the anchors and send at exactly that nonce. Fold the recorder's off-chain edges (owner W_SYNC: refusals from `/api/recorder/attempts` and refund requests from `/api/recorder/requests`) into the tallies from their own `recorder` checkpoint. Local endpoints `/health`, `/status`, `/sync` (waits for the writes; used by the e2e run). Add a reconcile command that recounts the cast's tallies from edges with `count()` and deletes duplicate edges by `ref`. The labelled history stream for the three cast shops at scale 0.05 on Rabdi: about 1,256 events in 25-event logical batches split by bytes (about 100 transactions; refused if parameters differ). Optional stretch: a Vercel cron fallback that runs only when the heartbeat is older than 90 s.
>
> Tests on ArkivSim: a recorded fork transcript mirrored exactly (expected kesar-kingdom: orders 5, paid 6.40, one refund of 0.80, 2 fails, 3 delivered); a replayed poll; a restart; a lost cursor caught by `ref`; a second instance refused by the heartbeat; a stale read losing the nonce race and starting over; a recorder refusal folded into `fails` exactly once; an attempt attributed only for a bound wallet; renewals counted once; unknown actors parked. Then the live run: register the cast from M5's hand-off, mirror the real lifecycle run of M2 from the checkout's deploy block, and compare the tallies with the lifecycle transcript. Reviewer pass. Ship.

## Done when
- Every real event since deploy is mirrored with 0 unresolved, and the tallies match the M2 transcript (orders, paid, refunds, fails, deliveries).
- `ACCEPTANCE_TESTS.md` D1, D2, D3 pass.
- The workers process has run for 30 minutes on Rabdi with lag under 30 s and no duplicate `ref`.

## Pitfalls
`SPEC/INTEGRATION_AND_MIRROR.md` §8 items 1–8; the deploy-time `AgentPolicySet` arrives before the actors (register first); never print the Arkiv RPC URL; every write is a real transaction on Rabdi (5–8 s each).

## Thinking-partner update (end of the step, in the same PR)
Activity name: **`integration`**. In `docs/thinking-partner/` (convention in `PROMPTS/00-foundation.md`), touch only your own parts:
- `briefs/`: save any brief the founder attached for this step as soon as it arrives (a pack prompt gets a one-line pointer, not a copy).
- `NOW.md`: rewrite the `integration` section (updated time IST, where we are in plain words, what's running, blockers, next).
- `relays/integration.md`: overwrite with about 800 words, plain language first, then technical: what was built, PR links, numbers with their sources, where the work deviated from the spec and why.
- `LOG.md`: append one line per PR under the `integration` heading (time IST, activity, result, PR link). Only main rolls lines up.
- `OPEN.md`: update the `integration` section: the founder's to-dos and open questions, each with what, where, why and a recommendation; close what this step settled.

No secrets or key-shaped strings; judge-safe wording (the repo is public); the folder stays under about 20,000 words. After the last push, watch the PR until it merges; on a conflict, merge `origin/main` again, keep every line, and push.
