# M7a — Graph Arkiv model, the safe writer and the emulator

**Goal:** the five entities of the standard model, an absolute-value tally planner, the ADR-0023 writer (anchor in the same batch, confirmed nonce, find-by-nonce after an uncertain send, split by bytes), and ArkivSim as the test backend, with one real write on Rabdi.
**Depends on:** M0. **Worktree:** `wt-arkiv` (`arkiv/model`). **Model:** Opus High. **Time:** about 60 min.

## Inputs
`SPEC/ARKIV_GRAPH.md` §1–§3, §7, §9, §10; `DECISIONS.md` 0017, 0020, 0023, E-2, E-4; `FACTS.md` §4.

## Prompt
> In `packages/arkiv-graph`, pin the versions of `planning/SPEC/ARKIV_GRAPH.md` §1 (re-check with `npm view`), then:
> 1. **Smoke test on Rabdi** (read-only, with `ARKIV_ACCESS_KEY`): a schema read, a `count()`, a typed predicate rendering `u64(…)`, the 64/65-leaf probe. Record results in `docs/technical/FACTS.md`.
> 2. **ArkivSim**: an in-memory emulator that answers the JSON-RPC the stock SDK sends and enforces the node's rules: pages of 100, 64 predicate leaves including tag and owner, indexed-only filters (a non-indexed filter matches nothing), creation order, `count`, atomic `executeBatch`, readonly entities, keys from owner + nonce + salt (so a repeated create duplicates), **and the 256 KiB request limit with HTTP 413**. The stock SDK must run on it unchanged (swap only the transport).
> 3. **Entities** exactly as §3 (node, edge, tally, link, checkpoint, plus the plain record and profile for the benchmark), with a definition check: at most 31 columns, snake_case, `*_micro` u64, epoch wherever a node is stored, no bytes on tallies.
> 4. **Tally planner**: §3 tally rules, absolute values, `plan(event, anchor)` returns `[]` when the anchor or a row's `last_event_id` already names the event; commit only after the receipt with created keys in batch order.
> 5. **Writer** per §7: one serialised queue per wallet, confirmed nonce, one `executeBatch` per event with the checkpoint, find the mined transaction by nonce after an uncertain send, never resend blindly, discard and re-adopt on failure, split by encoded bytes under 120 KB and halve on a 413 found down the cause chain, lifetimes per E-4, a redacting transport (the access key is in the URL).
> 6. One real write on Rabdi from W_LEDGER (a labelled synthetic edge with 1-day life), its gas recorded against the lab's 310,527 for a steady money event.
> Tests for every rule (spoofed owner invisible, blank owner is a start-up error, duplicate on repeated create in the emulator, uncertain send recovered by nonce, 413 split, replay after restart is a no-op with the anchor, epoch separation). Run the reviewer on the writer. Ship.

## Done when
- Tests green on ArkivSim; one live Rabdi transaction hash in the facts file.
- Seeding (M8) can start on this writer.

## Pitfalls
`SPEC/ARKIV_GRAPH.md` §10 items 1, 2, 5, 13, 14; a bare bigint renders as u256; never `pending` nonces; a created tally row needs its key before the next patch; ArkivSim without the request limit hid the first seed failure in the lab.

## Thinking-partner update (end of the step, in the same PR)
Activity name: **`arkiv`**. In `docs/thinking-partner/` (convention in `PROMPTS/00-foundation.md`), touch only your own parts:
- `briefs/`: save any brief the founder attached for this step as soon as it arrives (a pack prompt gets a one-line pointer, not a copy).
- `NOW.md`: rewrite the `arkiv` section (updated time IST, where we are in plain words, what's running, blockers, next).
- `relays/arkiv.md`: overwrite with about 800 words, plain language first, then technical: what was built, PR links, numbers with their sources, where the work deviated from the spec and why.
- `LOG.md`: append one line per PR under the `arkiv` heading (time IST, activity, result, PR link). Only main rolls lines up.
- `OPEN.md`: update the `arkiv` section: the founder's to-dos and open questions, each with what, where, why and a recommendation; close what this step settled.

No secrets or key-shaped strings; judge-safe wording (the repo is public); the folder stays under about 20,000 words. After the last push, watch the PR until it merges; on a conflict, merge `origin/main` again, keep every line, and push.
