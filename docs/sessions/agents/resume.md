# T4 agents: resume (written 02:00 IST, Fri 6 Nov, after M10 merged as PR 11)

## Done
- M10 merged: `packages/agents` (buyer and shop teams, every guard in code, mock services, scripted models, 56 tests), `scripts/agents/errand.mjs` (`pnpm agents:errand [--runs N] [--buyer KEY] [--out DIR]`, `AGENT_MODE=anthropic` = active preset), notes and Join's wiring list in `docs/sessions/agents/NOTES.md`, pins in `docs/technical/VERSIONS.md`, thinking-partner NOW/LOG/OPEN/relay for `agents`.
- One reviewer pass done (3 blocking findings fixed with regression tests). Five live errands on the testing preset (`claude-opus-5-5`, xhigh) all paid the good shop; their rows (seconds, apiCostUsd) are already in the calibration table in `docs/thinking-partner/OPEN.md`. Nothing is owed there.

## Next: Friday item 2 (`docs/plan/MASTER_PLAN.md` §4 item 2)
Optional hooks `presence(start, renew)` and `handoff(from, to, step)` on `LiveHooks`, no-op by default, additive (before CP4). Spec: `planning/EVENT_ADDENDUM.md` A7, A8 (read them first); entities are T3's `agent_presence` (agent_ens, owner_ens, role, session = run id; renewed, 15 min) and `handoff` (request_id = run id, from_agent, to_agent, step = explainer lane; 30 min). Names come from the cast (`teamCast`), never typed. Call sites: presence at each agent's `agent.start` and renewals while an errand runs, handoff at each `message` edge between agents; hook failures must never block or fail an agent step (fire and forget, errors scrubbed into the log). Add mock hooks and tests (hooks absent = no change to byte-identical run logs), update `index.d.ts`, `NOTES.md`, then ship via the `ship` and `relay` skills (relay also owes: LOG line, NOW section, relay file).

## Open threads
- Join (M12): the config's `whitechain.contracts` is empty, so the payer refuses every real 402 as `UNKNOWN_CONTRACT` until T1's checkout address is in the config or passed as `hooks.contracts` (in `OPEN.md` agents section).
- Live runs used loosened reason-length caps only after the runs; the next live run (Join's M12 counting run) should show no `too_big` no-answers. If it does, loosen further; code decides regardless.
- The analyst's own `graphql` query is advisory; real graph city/category casing is T3's concern.
- Optional, not built: Grok provider, spec §12 `NEEDS`. A second reviewer pass was skipped to save plan budget; run one before the live demo if time allows.
- Operational: GitHub is flaky from this Mac; retry `git -c http.lowSpeedLimit=100 -c http.lowSpeedTime=60 push` up to 6 times, 15 s apart, and retry `gh` calls. Poll `gh pr list --state merged` only when waiting on a dependency (every 10 minutes at most).
- Budget: Coordinator asked for short outputs, no extra subagents beyond reviewer and verifier, no polling loops.
