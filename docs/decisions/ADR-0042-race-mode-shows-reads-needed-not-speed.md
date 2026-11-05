# ADR-0042: Race mode shows reads needed, not speed

Status: accepted · Date: 2026-11-05 · Decided by: founder (21:42 IST)

## Decision

Race mode's result is the number of Arkiv reads each approach needs (Graph Arkiv against plain storage), plus bytes. Times may be recorded in the benchmark CSV but are neither shown as the result nor a pass criterion.

## Why

Read counts are structural and repeatable; times depend on the network on the day.

## Consequences

Acceptance D6 and D7 amended (calls exact, times recorded); D13 on Friday.
