# ADR-0040: Arkiv naming: our own convention

Status: accepted · Date: 2026-11-05 · Decided by: founder (booth default, 21:42 IST)

## Decision

Every entity carries `project="graphpay"`, `type=<entity type>` and `schema_v=1`, at most 30 user attributes, snake_case. We do not try to match the explorer's schema tag.

## Why

No Arkiv booth answer is coming; our convention is enough for scoping and versioning.

## Consequences

Every query filters `project`, `type` and `$owner`.
