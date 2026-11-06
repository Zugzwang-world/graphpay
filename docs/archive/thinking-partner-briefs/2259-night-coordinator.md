# Brief: the night Coordinator

From the thinking partner (claude.ai), via the founder, Fri 6 Nov. For: a fresh Coordinator session on Opus 5.5, Max effort. File it in `docs/thinking-partner/briefs/` with your time prefix.

**Read first:**
- `docs/sessions/coordinator/handover.md`
- `docs/thinking-partner/TRACKER.md`
- `docs/thinking-partner/NOW.md`

## First, now

1. **Resume the payer**; it is paused. Make sure Filter & Fold's shop is open.
2. **Retire the old sessions:** tell T1 to T6, Join, Booth, Sync and the Integration session to stop. Tonight's sessions replace them.

## Tonight's workstreams

Each runs in its own worktree and session, with its own brief.

| Stream | Owns | Brief |
|---|---|---|
| W1 Identity | `packages/ens`, `scripts/ens`, the watcher, the shop ENS labels in `story.json` | `W1-identity.md` |
| W2 City | `packages/city`, `packages/money-graph`, the race-mode server files in `apps/web`, `arkiv/schema.md`, the menu and city keys in `story.json` | `W2-city.md` |
| W3 Payments | the hosted shop and facilitator, the customer and merchant money routes in `apps/web/app/api`, the renewal and re-order keys in `story.json` | `W3-payments.md` |
| W4 Agents | `packages/agents`, the request line in `story.json` | `W4-agents.md` |
| W5 Ops and acceptance | the integration and acceptance scripts, the workers on the Mac, the pause and resume routes, a self-healing cron in `apps/web`, the ops scripts | `W5-ops.md` |
| W6 SDK 1.0.0 | `packages/arkiv-graph`, `packages/agentpay` | `W6-sdk.md` |
| W7 Submission docs | `README.md`, `AI_USAGE.md`, `arkiv/*.md` except `schema.md`, `docs/submission/` | `W7-submission.md` |

**Reserved for the frontend pass that comes later:** `frontend/`, `apps/phones/`, and the website's UI (the stage, the deck). No stream restyles screens.

## Your job

- **Ownership:**
  - Each stream edits only its own files.
  - `story.json` changes come as small PRs touching only that stream's keys. Merge them in order, rebase as needed, and never reformat the file.
- **The order that matters:**
  1. W2 writes the new shops' Arkiv rows and history under their new names.
  2. Then W1 flips the shop labels.
  3. Then W5 restarts the workers.

  Never let the live errand break. If a merge breaks it, revert first, then fix.
- **Funding:**
  - FUNDER and the shop's takings cover tonight.
  - Recycle test USDT from the shop wallets to the payer as needed.
  - The founder is sending more test USDT to FUNDER and topping up Kimi. Tell him early if WBT, Sepolia ETH or tGLM run low.
- **Records:**
  - Keep NOW and TRACKER current.
  - Tell the founder when each stream lands.
  - Ask him only for logins, funding or secrets.

## Rules tonight

- **Usage guardrails are off** (the founder's decision), and every session runs Opus 5.5 Max.
- **No contract redeploys.**
- **Never print a secret.**
