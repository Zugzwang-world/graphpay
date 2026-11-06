# ADR-0065: The founder's team builds its own UI in apps/demo-ui, in parallel

Status: accepted · Date: 2026-11-06 09:30 IST · Decided by: founder (the thinking-partner chat, via the 09:35 brief) · Source: `docs/thinking-partner/briefs/0935-sdk-publish-and-handoff.md` §2

## Decision

The founder's human team builds its own UI in `apps/demo-ui`, from `FRONTEND_HANDOVER.md`. T5 keeps `apps/web`, and nothing changes for T5.
- Team PRs touch only `apps/demo-ui`, and CI must accept the new app.
- Teammates commit from their own GitHub accounts and must be on the ETHGlobal team.
- Later the founder compares both UIs and combines the best.

## Why

A human-built UI in parallel gives a second take on the demo, and it's the team's own contribution, which ETHGlobal's rules on meaningful contributions ask for.

## Consequences

- **PR #70** (ajatshatru01, opened 09:09 IST) puts the UI in a root `frontend/` folder with its own npm lockfile. It should move to `apps/demo-ui` as a pnpm workspace app, which is a founder item.
- **CI:** the Coordinator makes CI accept `apps/demo-ui` once it lands. Its Vercel build for forks needs the founder's approval.
- **`FRONTEND_HANDOVER.md`** doesn't exist yet. Who writes it is a founder item.
- `AI_USAGE.md` and the submission name the human contributors and what they built.
