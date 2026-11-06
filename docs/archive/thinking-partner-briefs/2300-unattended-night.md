Received 23:00 IST by main (attached by the founder; from the thinking partner).

# Brief: prove coverage, and write the wave-1 lines for an unattended night

From the thinking partner (claude.ai), via the founder. For: main, the M0 coordinator.
File it in `docs/thinking-partner/briefs/` with your usual time prefix.

This brief asks for information, and for how the wave-1 lines are written. It changes no product decision. Please act on it before you write the wave-1 lines.

## 1. Coverage table, before the wave-1 lines

Write `docs/thinking-partner/COVERAGE.md`. List every item that is new since the graphpay-lab build. For each, give where it lives in the plan (session, milestone, file, ADR), its acceptance check, and its status (done, tonight, Friday, cut-first). Include at least:

- the personal Ankr RPC with its fallbacks, the chain-1874 guard and the Ankr secret-scan rule;
- the addendum's ENS items: the shop's Whitechain address record plus text record (ADR-0038), the MCP endpoint record, and the agent that can edit its own record but whose cap change is refused; plus the addendum's other tonight items;
- the Swarm bonus (Friday, public gateway first per ADR-0039, cut first). Say whether it needs xBZZ on Gnosis if the public gateway won't take uploads; FUNDER holds none;
- the story config, the agent model presets, errand cost recording, and the big-city hold;
- the booth defaults, ADR-0038 to ADR-0044.

Flag any acceptance check that those defaults make moot. One example: an ERC-7930 encoding test, if it only served ENSIP-31, which ADR-0038 skips. Also flag any item with no home in the plan.

## 2. Wave-1 lines built for an unattended night

- When a session finishes a task, it continues to its next unblocked task.
- No session stops to wait on the founder. It records the question in its own OPEN.md section, takes a safe default where the pack allows, and moves on. Only logins, funding, secrets and irreversible steps wait for him.
- Where a session depends on another session's merge (for example the join on M7a), say whether it can start now and wait by polling merged PRs, or give the exact time to start it.
- Say how coordination and the two-hourly records happen overnight while no one is prompting you.
- List the moments you will need the founder tonight and early Friday, with times.
- Recommend an effort level per session; the founder picks it in the app.

## 3. Get docs to the thinking partner sooner

The thinking partner's sync reads the main branch only. Merge docs changes (NOW, OPEN, LOG, briefs, COVERAGE) promptly, so the synced NOW.md stays within an hour of reality.

## 4. Story-inputs digest, if not already queued

Write `docs/thinking-partner/story-inputs.md`: the pack's test cast, shops, city sizes, renewal box, request text, re-order values and the video shot list, with file paths. Keep it short.

## Do not

- Seed the big city before the founder says the story is locked.
- Change any product decision through this brief.
