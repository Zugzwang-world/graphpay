# ADR-0025: The pack is committed as planning/, frozen

Status: accepted · Date: 2026-11-05 · Decided by: founder (F-1)

## Decision

The pre-event pack is the first content commit, `planning/`, and is never edited. The event's own changes to it live in `docs/plan/` (the milestone amendments, `ACCEPTANCE_ADDITIONS.md`, `MASTER_PLAN.md`) and in these ADRs; where they differ, the event record wins.

## Why

Judges see at once what was prepared and what was built; the rules ask for every spec, prompt and planning artifact in the repo.

## Consequences

Every session reads its pack prompt plus the matching file in `docs/plan/amendments/`.
