# ADR-0041: Arkiv indexing: only queried fields

Status: accepted · Date: 2026-11-05 · Decided by: founder (booth default, 21:42 IST)

## Decision

An attribute is indexed if and only if a shipped query filters on it; everything else is stored only. SDK 1.0.1 supports this per column (`.indexed()`), so the fallback "index all" is not needed.

## Why

Indexing costs gas and predicate budget; a filter on an unindexed attribute silently matches nothing, so a test must catch that.

## Consequences

Recorder edges index `ts` because the mirror polls by it (a gap in the pack's spec).
