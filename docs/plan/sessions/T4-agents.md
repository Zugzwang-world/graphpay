# T4 Agents

Activity `agents`; your own worktree; branches `agents/*`. Read `CLAUDE.md` and `planning/README.md`, then each prompt and its inputs.

## Goal and milestones, in order

The buyer team (concierge, scout, analyst, payer) and a shop team on AI SDK 7, with every guard in code: the model proposes, code disposes (ADR-0019).

| step | prompt (`planning/PROMPTS/`) | also apply |
|---|---|---|
| M10 agents | `10-agents.md` | `docs/plan/amendments/M5-ens.md` §2: resolve the payee from ENS after the 402 and before signing (`PAYEE_MISMATCH`, `PAYEE_UNRESOLVED`), and the 402's asset must be in `readAccepts` (ADR-0046). `docs/plan/amendments/M7-arkiv.md` §5: refuse a missing or expired quote and re-quote once; `QUOTE_MISMATCH` refuses. ADR-0048 (presets) supersedes E-10 |
| Friday | `docs/plan/MASTER_PLAN.md` §4 item 2 | optional `presence(start, renew)` and `handoff(from, to, step)` hooks, no-op by default |

## Gates

- M10 needs only M0: the live services sit behind interfaces. `resolvePayee` and `readAccepts` (T2's M5) and `findQuotes` (T3's M7a) reach the payer as injected hooks: mock them; Join wires the real ones in M12.
- Join's M12 waits on M10: ship it early.
- **How to wait:** every 10 minutes, `gh pr list --state merged --limit 30`; a milestone has landed when a merged PR title ends `(Mn done)`, so end yours the same way. Meanwhile build what the gate does not block.

## Owns

`packages/agents`, `docs/sessions/agents/`.

## Acceptance checks

`planning/ACCEPTANCE_TESTS.md` E1 and E2 (E2 amended: the good, trap and runner-up shops come from the cast's roles), read from Join's M12 run. From `docs/plan/ACCEPTANCE_ADDITIONS.md`: B9 (b) (`PAYEE_MISMATCH` before any signature), D10 (each refusal, then one re-quote), E8 (your rows), A8. M10's done-when, with the five live runs on the active preset instead of Haiku.

## The specific rules for this session

- The model and effort of every agent role come from the story config's presets through `agentPreset(role)` (ADR-0048; `testing` = `claude-opus-5-5` at xhigh is active), never from code. `AGENT_PRESET` replaces the pack's `AGENT_MODEL`. Nothing changes a preset without the founder.
- Read only the final text block of each reply, and handle an empty reply or a `max_tokens` stop.
- Every test run records the seconds and the API cost (`apiCostUsd`) of each full errand as a row in the preset calibration table of `docs/thinking-partner/OPEN.md`.
- Every agent and shop name, the request text and the order come from `packages/config/story.json` (ADR-0047).
- No signature before every check passes. An `AGENT_MODE` typo never starts a paid run.

## Unattended rules

1. **Keep going.** When a task merges, start the next unblocked one: your next milestone, then your Friday items (before CP4, additive with no-op defaults). Never end a turn to wait.
2. **Never wait on the founder.** Put the question in your `OPEN.md` section (what, where, why, your recommendation), take the safe default the pack or the ADRs allow, and go on. Only logins, funding, secrets and irreversible steps wait for him. The Coordinator reads `OPEN.md` every 10 minutes.
3. **Poll for dependencies** (Gates); the Coordinator also tells you when one lands.
4. **Small PRs, auto-merge, docs promptly** (skill `ship`); docs-only commits skip the Vercel build.
5. **Secrets:** run helpers as `pnpm -s secrets:…` (pnpm echoes its arguments); never print or paste a secret; ask the Coordinator for top-ups.

## Thinking-partner update

Activity **`agents`**, in each step's PR (skill `relay`): your `agents` sections of `docs/thinking-partner/NOW.md`, `OPEN.md` and `LOG.md`, `relays/agents.md`, and any brief you receive, in `briefs/<HHMM>-<slug>.md`.

## Model and effort

Sonnet 5.5 at **high**: the guards in code are specified; mock tests first.
