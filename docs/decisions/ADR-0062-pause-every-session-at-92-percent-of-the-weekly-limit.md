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

## Amendment (founder, Fri 6 Nov 11:00 IST): two lines, 95% and 97%

This replaces the 92% pause. The founder gave it to the new Coordinator at the takeover. The lines are on the same "Weekly · all models" limit (`get_usage`).

- **At 95%:** no session starts a new real payment, merge or publish, and every session writes its resume (`docs/sessions/<activity>/resume.md`). Work that does none of the three, such as code, tests or docs on a branch, may go on.
- **At 97%:** every session pauses at a clean checkpoint. It pushes its work, its resume is current, it stops its own wake-ups and ends its turn. It resumes only when the founder or the Coordinator says so.
- **The reset:** the weekly window resets Fri 21:30 IST (16:00 UTC).
- **Unchanged:**
  - At 90% the Coordinator warns the founder and every running session.
  - The mirror (`pnpm workers`) keeps running, because it uses no plan budget.
  - Extra usage stays off.
- **The Coordinator's reading (not the founder's words):**
  - "No merge" at 95% means nobody merges by hand or turns auto-merge on. A PR whose auto-merge was already on may still land, because finishing it costs no plan budget.
  - At 97% the Coordinator confirms that every session has paused and ships a records PR saying what is half-done. It replaces its tick with one wake-up just after the 21:30 reset, then resumes the sessions.

## Amendment 2 (founder, Fri 6 Nov 12:40 IST): merges and payments up to 97% for the integration

- Merges and real payments are allowed up to 97% for three things: the integration proof of concept, the support essentials in the 1240 brief (`docs/thinking-partner/briefs/1240-coordinator-integration-support.md`), and the founder's run.
- Every session pauses at 97%, as before.
- At 95% every session still writes its resume. For other work, the 95% stop on new real payments, merges and publishes stands.
