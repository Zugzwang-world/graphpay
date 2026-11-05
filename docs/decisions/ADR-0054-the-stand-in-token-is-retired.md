# ADR-0054: The stand-in token is retired

Status: accepted · Date: 2026-11-05 · Decided by: founder (brief v2) under ADR-0045

## Decision

Test USDT is in the wallets, so the labelled stand-in token is removed from the plan: no stand-in deploy, no stand-in mint, no stand-in checkout. Every payment, rehearsal and acceptance test uses test USDT; fork tests use the real token on a Whitechain fork.

## Why

Whitechain's qualification needs real USDT payments in the main flow, and one token means one checkout and one set of policies.

## Consequences

Supersedes ADR-0022 and the stand-in parts of ADR-0045. FUNDER keeps 31.75 USDT for top-ups and disposable agents.
