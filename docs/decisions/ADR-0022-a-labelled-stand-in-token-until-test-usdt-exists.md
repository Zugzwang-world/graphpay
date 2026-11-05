# ADR-0022: A labelled stand-in token until test USDT exists

Status: adopted from the lab (planning/DECISIONS.md part A) · superseded by ADR-0054 · Date: 2026-11-05 · Decided by: founder (pre-event) · Source: `planning/DECISIONS.md` part A, row 0022

## Decision

Until test USDT is obtained, prove the real chain with a labelled stand-in `gpUSD-TEST` ("gpUSD TEST stand-in (not USDT)"); one checkout per token; the token is one switch

## Why

Test USDT could not be obtained; the stand-in signs exactly like Tether, so switching is configuration

## Consequences

Amended by ADR-0045: test USDT arrived at kickoff, so the USDT checkout carries the main flow; the stand-in is only a fallback.
