# ADR-0058: The shop box query uses i32 ranges

Status: accepted · Date: 2026-11-06 · Decided by: T3 Arkiv (M7 amendment §6, live probe)

## Decision

`shop` rows store `lat` and `lng` as indexed i32 micro-degrees (19.0760 → 19076000), and discovery filters them with two `BETWEEN i32(…) AND i32(…)` ranges plus category, the synthetic flag and `$owner = W_DIRECTORY`. The u64 fallback (offset by 180,000,000) is not needed.

## Why

M7a's live probe on Rabdi (2026-11-06 01:29 IST): a W_DIRECTORY probe row at the persona's configured point was found by a 1 km box around it in one call, and a box 0.05° north found nothing (`docs/technical/FACTS.md`, T3 rows). SDK 1.0.1 types i32 ranges and negatives (`docs/technical/FACTS.md`, Arkiv SDK API notes).

## Consequences

The filter compiler (M7b) allows i32 ranges and rejects values outside i32. Coordinates west of Greenwich or south of the equator need no offset.
