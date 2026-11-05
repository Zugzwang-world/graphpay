# M9 — The live benchmark

**Goal:** plain Arkiv against Graph Arkiv on the freshly seeded cities, live on Rabdi, with honest scoring, committed CSVs and a plain-language report; the same harness powers the website's race mode.
**Depends on:** M7b, M8 (S; M when seeded). **Worktree:** `wt-arkiv` (`arkiv/bench`). **Model:** Opus High. **Time:** 45–60 min (lab: about 50 min).

## Inputs
`SPEC/BENCHMARK.md` (all), `SPEC/ARKIV_GRAPH.md` §4; `ACCEPTANCE_TESTS.md` D6, D7.

## Prompt
> In `bench/`, build the harness of `planning/SPEC/BENCHMARK.md` §3: one shared metered transport counting Arkiv calls and bytes, a warm-up run, medians of 5 runs (11 interleaved rounds for Q2), correctness against the generator's ground truth, plain scored by name with the identity difference reported (`truth_basis`, `matches_identity_truth`), Q2 plain at its fastest (one `count()` then 4, 8, 16 and all pages in flight), an HTTP log of status, time and the `ratelimit` header only (never the URL). The plain baseline is best effort, written by hand against the plain store as §2 describes; Graph Arkiv answers each question with one GraphQL document.
>
> Expose the Q2 race as a function both modes run live (no cache) that returns per-call timings and read counts as it goes; the website's race mode (M15) calls it through a passcode-free, rate-limited read route.
>
> Run at S now and at M when its seed is done. Write the CSVs of §7 with a SYNTHETIC header, the commit, the backend and the block range, and `bench/BENCHMARK-LIVE.md` (plain language first, tables, then caveats). Compare with the lab's numbers in §4 and flag any call count that differs.

## Done when
- `ACCEPTANCE_TESTS.md` D6 passes (calls equal: plain 5, Graph Arkiv 2 at S; times within ±25% of the lab's medians), and D7 at M if seeded (plain 47 sequential / 48 parallel, Graph Arkiv 2).
- The report states what not to claim (§5).

## Pitfalls
Warm up before timing (cold calls take about 1 s). Do not compare emulated and live numbers. One dataset per owner. At S the fastest plain Q2 is level with Graph Arkiv: say so; the gap grows with size. Re-measure bytes (the merged model adds about 12.5% to Q2 reads at S).

## Thinking-partner update (end of the step, in the same PR)
Activity name: **`arkiv`**. In `docs/thinking-partner/` (convention in `PROMPTS/00-foundation.md`), touch only your own parts:
- `briefs/`: save any brief the founder attached for this step as soon as it arrives (a pack prompt gets a one-line pointer, not a copy).
- `NOW.md`: rewrite the `arkiv` section (updated time IST, where we are in plain words, what's running, blockers, next).
- `relays/arkiv.md`: overwrite with about 800 words, plain language first, then technical: what was built, PR links, numbers with their sources, where the work deviated from the spec and why.
- `LOG.md`: append one line per PR under the `arkiv` heading (time IST, activity, result, PR link). Only main rolls lines up.
- `OPEN.md`: update the `arkiv` section: the founder's to-dos and open questions, each with what, where, why and a recommendation; close what this step settled.

No secrets or key-shaped strings; judge-safe wording (the repo is public); the folder stays under about 20,000 words. After the last push, watch the PR until it merges; on a conflict, merge `origin/main` again, keep every line, and push.
