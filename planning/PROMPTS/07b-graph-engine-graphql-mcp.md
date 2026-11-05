# M7b — Graph Arkiv engine, GraphQL, explain trace and MCP

**Goal:** one GraphQL document answers any money question with the fewest Arkiv reads, an explain trace of every read and an `explainId`; reputation windows; MCP tools for agents.
**Depends on:** M7a. **Worktree:** `wt-arkiv` (`arkiv/engine`). **Model:** Opus High. **Time:** 60–90 min.

## Inputs
`SPEC/ARKIV_GRAPH.md` §4–§6, §9, §10; `SPEC/AGENTS.md` §5 (code's fixed ranking query); `SPEC/BENCHMARK.md` §2 (the six questions).

## Prompt
> In `packages/arkiv-graph`, build the engine of `planning/SPEC/ARKIV_GRAPH.md` §4 (trusted owner on every query and on every returned row, the predicate budget with chunking and halve-and-retry, paging with a cap and `truncated`, `edges`, `khop`, two-ended `path` using pair links, `top` by `ORDER BY` plus one batched node lookup, windows, `verify` by `count()` of the same epoch, per-request DataLoaders, the explain trace and `explainId` = sha256 of backend + sorted queries, 12 hex, keeping the last 200), the filter compiler with every rejection listed, and the backend switch `ARKIV_BACKEND=sim|local|rabdi`.
>
> GraphQL with Yoga 5.24.6 and graphql 16.14.2 (§5): the query fields and types listed, `U64` as a decimal string, limits (100 rows, 8 top-level fields, depth 8 through fragments), no mutations; `reputation(window: TODAY|D30|D90|ALL, verify)` with source TALLY, RAW_VERIFIED, MISMATCH or TRUNCATED and rates as 4-place strings rounded down, current epoch only. Serve it as a Vercel route: GET with `Cache-Control: s-maxage=5, stale-while-revalidate=10`, POST uncached; plus `/api/explain/:id`.
>
> MCP tools `schema`, `ask`, `graphql` (returns `explainId`), `explain` exactly as §6, with name normalisation and the depth, field and syntax checks; and the benchmark-only `arkiv_query` that parses and re-renders the agent's text before adding the owner filter. Expose MCP over HTTP from the app and in-process for tests.
>
> Tests: §9's list (three shops' reputation in 2 calls; `TRUNCATED` when a cap bites; a re-registered name starts empty; identical questions give identical explain ids; aliases and fragments counted; an `x) OR (y` escape attempt refused), and the six benchmark questions equal ground truth on a small emulated city. Run against Rabdi read-only once. Reviewer pass. Ship.

## Done when
- Tests green; the GraphQL route answers on the preview deployment against Rabdi (empty or seeded data) with `extensions.arkiv`.
- The analyst's fixed ranking query returns every shop with `reputation(window: D90)` and an `explainId`.

## Pitfalls
Silent undercounting under a row cap; `verify` across epochs; existence checks must ask for `limit 1`; project only the needed columns; two copies of `graphql` in the repo break schemas ("another module or realm"); aliases are free calls.

## Thinking-partner update (end of the step, in the same PR)
Activity name: **`arkiv`**. In `docs/thinking-partner/` (convention in `PROMPTS/00-foundation.md`), touch only your own parts:
- `briefs/`: save any brief the founder attached for this step as soon as it arrives (a pack prompt gets a one-line pointer, not a copy).
- `NOW.md`: rewrite the `arkiv` section (updated time IST, where we are in plain words, what's running, blockers, next).
- `relays/arkiv.md`: overwrite with about 800 words, plain language first, then technical: what was built, PR links, numbers with their sources, where the work deviated from the spec and why.
- `LOG.md`: append one line per PR under the `arkiv` heading (time IST, activity, result, PR link). Only main rolls lines up.
- `OPEN.md`: update the `arkiv` section: the founder's to-dos and open questions, each with what, where, why and a recommendation; close what this step settled.

No secrets or key-shaped strings; judge-safe wording (the repo is public); the folder stays under about 20,000 words. After the last push, watch the PR until it merges; on a conflict, merge `origin/main` again, keep every line, and push.
