# M10 — The agent teams

**Goal:** the buyer team (concierge, scout, analyst, payer) and a shop team (storefront, risk, dispatch) on AI SDK 7, with every guard in code, a scripted mock model for CI, and five live runs on Haiku against the real or mock services.
**Depends on:** M0 (interfaces from `SPEC/*`). **Worktree:** `wt-agents` (`agents/*`). **Model:** Sonnet High. **Time:** 60–75 min (lab: 35 min with two reviewer passes, plus 15 min for the live fix).

## Inputs
`SPEC/AGENTS.md` (all); `SPEC/ARKIV_GRAPH.md` §6 (MCP tools); `SPEC/PAYMENTS_WHITECHAIN.md` §5–§6 (402 flow); `SPEC/IDENTITY_ENS.md` §7 (`ens_check` reads); `DECISIONS.md` 0019, E-10.

## Prompt
> In `packages/agents`, build the teams of `planning/SPEC/AGENTS.md` in this order, each step ending green:
> 1. Skeleton: the cast as one constant with `ROOT = graphpay.eth`, money as bigint 6-decimal units, the zod contracts of §6, the scoring and policy of §7 (unit tests reproduce 0.986 / 0.934 / 0.821).
> 2. Guards first (§3, G1–G16) with hand-made state and no model: the mandate parser, need adoption, the pay guard (phases, eligibility, budget, deadline, synchronous reservation), payer tools bound to the approved order, client spend controls (refuse more than one `accepts` entry; check every field), the unclear-settlement rule, the scrubber.
> 3. Interfaces only for live services (`LiveHooks`, `McpLike`, `ShopSurface`), so this package imports no heavy runtime; mock services behind them (MCP over a fixture with real graphql-js, a shop with the R2 flow, an ENS check).
> 4. Seven `ToolLoopAgent`s with structured output and `stopWhen: isStepCount(8)`, sub-agents as concierge tools, the prompts of §8 verbatim (insert the SDL from the `schema` tool), the run log of §9 streamed as events.
> 5. A scripted mock model (`MockLanguageModelV4`) per role, including bad play: price-only concierge, lying analyst, overspend and wrong-shop payer. Tests named for their promises: the trap is never paid, the model cannot widen the limits, one payment per errand (three parallel `pay_shop` calls), scout and analyst run in parallel, revoked/expired/paused payer refused, a 502 after signing keeps the reservation.
> 6. `AGENT_MODE=mock|anthropic|auto` (unknown → error), `AGENT_MODEL` default `claude-haiku-5-5`, Grok behind `AGENT_PROVIDER=grok` (one line, optional). Then five live runs on Haiku against the mocks: every run chooses kesar-kingdom or refuses; record `usageTokens`; tune only the JSON tail of the prompts if structured output fails.
> Two reviewer passes (concurrency and money paths). Ship.

## Done when
- All guard and bad-play tests pass in CI on the mock model.
- Five live Haiku runs: kesar-kingdom chosen (or a refusal), never jamun-junction; tokens recorded.
- Two mock runs produce byte-identical run logs.

## Pitfalls
`SPEC/AGENTS.md` §13. Concurrency is the bug class sequential tests miss. Never a free-form URL or amount in a model-visible tool. An `AGENT_MODE` typo must not trigger a paid run. A key-shaped literal in a test trips the secret scan.

## Thinking-partner update (end of the step, in the same PR)
Activity name: **`agents`**. In `docs/thinking-partner/` (convention in `PROMPTS/00-foundation.md`), touch only your own parts:
- `briefs/`: save any brief the founder attached for this step as soon as it arrives (a pack prompt gets a one-line pointer, not a copy).
- `NOW.md`: rewrite the `agents` section (updated time IST, where we are in plain words, what's running, blockers, next).
- `relays/agents.md`: overwrite with about 800 words, plain language first, then technical: what was built, PR links, numbers with their sources, where the work deviated from the spec and why.
- `LOG.md`: append one line per PR under the `agents` heading (time IST, activity, result, PR link). Only main rolls lines up.
- `OPEN.md`: update the `agents` section: the founder's to-dos and open questions, each with what, where, why and a recommendation; close what this step settled.

No secrets or key-shaped strings; judge-safe wording (the repo is public); the folder stays under about 20,000 words. After the last push, watch the PR until it merges; on a conflict, merge `origin/main` again, keep every line, and push.
