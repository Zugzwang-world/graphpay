# ADR-0062: Every session pauses gracefully at 92% of the weekly plan limit

Status: accepted · Date: 2026-11-06 04:15 IST · Decided by: founder (chat, in answer to the extra-usage question) · Source: the plan usage readings in `docs/technical/FACTS.md` (records rows)

## Decision

When the account's "Weekly · all models" limit reaches 92%, every session pauses gracefully: it starts nothing new, pushes its work, writes `docs/sessions/<activity>/resume.md`, stops its own wake-ups and ends its turn, and resumes only when the founder or the Coordinator says so. Extra usage stays off. At 04:2x IST the founder also set every track session to high effort.

## Why

The limit was at 78% at 03:56 IST and climbing about 6 points an hour with seven sessions. It resets only at Fri 21:30 IST. A graceful pause keeps 8% in hand and leaves every piece of work resumable, where running out mid-step would stop everything at once.

## Consequences

- Each session checks `get_usage` at its natural stopping points. The Coordinator's tick warns every running session at 90% (the uds route reaches a session mid-turn). At 92% it confirms all have paused, ships a records PR saying what is half-done, notifies the founder and stops ticking.
- The mirror (`pnpm workers`) keeps running: it uses no plan budget.
- The work most worth landing before the pause is CP4's ACCEPTANCE_REPORT and the real `e2e:food`.
