# ADR-0009: Arkiv data model basics

Status: adopted from the lab (planning/DECISIONS.md part A) · Date: 2026-11-05 · Decided by: founder (pre-event) · Source: `planning/DECISIONS.md` part A, row 0009

## Decision

Arkiv data model: one trusted writer per role, absolute-value tallies, a checkpoint entity, snake_case, `u64` micro-amounts. **Superseded in part** by 0017 (graph model), 0020 (merged layer) and 0023 (no salted keys)

## Why

Re-derivable, replay-safe totals without a database

## Consequences

Superseded in part by ADR-0017, ADR-0020 and ADR-0023 (as the pack says).
