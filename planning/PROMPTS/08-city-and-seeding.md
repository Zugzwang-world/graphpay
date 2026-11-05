# M8 — Synthetic city generator and seeding S and M on Rabdi

**Goal:** a deterministic, labelled synthetic city at sizes S and M, seeded fresh on Rabdi into a graph store and a plain store per size, each under its own wallet, running in the background.
**Depends on:** M7a (writer). **Worktree:** `wt-arkiv` (`arkiv/city`); the long seed runs on the founder's Mac. **Model:** Opus High. **Time:** 45 min to build; seeding S 15–20 min and M 100–130 min (lab: 15 and 99.6 min on the pre-merge model; expect about 30% more).

## Inputs
`SPEC/ARKIV_GRAPH.md` §3, §7, §8; `SPEC/BENCHMARK.md` §1; `WALLETS.md` (W_SEED_EVENT, W_SEED_M_EVENT, funding).

## Prompt
> In `packages/city`, write the generator of `planning/SPEC/ARKIV_GRAPH.md` §8 (mulberry32 seed 2026, the cast plus generated humans and shops under `sim.graphpay.eth`, 120 days, Zipf popularity with the cast shops at ranks 1–3 and their refund rates as inputs, log-normal amounts, order → pay or fail → sometimes refund, weekly subscriptions, Vitalik's agents' purchases in the last week, one shop re-registered 30 days before the end at epoch 2), sizes S (about 1,000 edges) and M (about 10,000), with in-memory ground truth for the six questions of `SPEC/BENCHMARK.md` §2. Every row `synthetic=true` with dataset `graphpay-city-v1`; 14-day life.
>
> A seeding driver per (size, store) on M7a's writer: graph store (standard model) and plain store, 25 events per logical batch split by bytes, a manifest per run (owner, transactions, creates, patches, minutes, gas, tGLM, first and last tx, HTTP status counts, lowest `ratelimit` remaining), refusing a store an owner already holds or a second size under one owner, a dry-run plan with the estimated tGLM, and a wipe script for failed runs. S under W_SEED_EVENT and M under W_SEED_M_EVENT (fresh wallets, so the lab's old cities never mix in).
>
> Check on ArkivSim first: the same entity counts as a direct load and every question equals ground truth. Then print the dry-run cost and **stop if a wallet is short** (put the shortfall in `docs/thinking-partner/OPEN.md`). Otherwise start S, then M, in the background with logs, and report progress every 15 minutes in `docs/sessions/arkiv/seeding.md`. Commit the manifests.

## Done when
- S seeded: two manifests committed with first and last tx hashes; every question equals ground truth when read from Rabdi.
- M seeding running (or done) with its manifest; if not funded, `docs/thinking-partner/OPEN.md` says how much tGLM is missing.

## Pitfalls
One dataset per owner (reads filter by owner, not dataset). Split by bytes, not events (256 KiB). Never resend a batch blindly. Patches only touch rows committed earlier, so splitting is safe only in seeding mode. Tallies must come from the same planner as the mirror. Do not edit the running seed script.

## Thinking-partner update (end of the step, in the same PR)
Activity name: **`arkiv`**. In `docs/thinking-partner/` (convention in `PROMPTS/00-foundation.md`), touch only your own parts:
- `briefs/`: save any brief the founder attached for this step as soon as it arrives (a pack prompt gets a one-line pointer, not a copy).
- `NOW.md`: rewrite the `arkiv` section (updated time IST, where we are in plain words, what's running, blockers, next).
- `relays/arkiv.md`: overwrite with about 800 words, plain language first, then technical: what was built, PR links, numbers with their sources, where the work deviated from the spec and why.
- `LOG.md`: append one line per PR under the `arkiv` heading (time IST, activity, result, PR link). Only main rolls lines up.
- `OPEN.md`: update the `arkiv` section: the founder's to-dos and open questions, each with what, where, why and a recommendation; close what this step settled.

No secrets or key-shaped strings; judge-safe wording (the repo is public); the folder stays under about 20,000 words. After the last push, watch the PR until it merges; on a conflict, merge `origin/main` again, keep every line, and push.
