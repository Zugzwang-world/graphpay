# ADR-0059: Non-paying agents publish a zero cap in ENS

Status: accepted · Date: 2026-11-06 01:55 IST · Decided by: identity (T2) under the founder's authority · Source: `packages/config/graphpay.config.json` `ens.namespace.capMicroWithoutPolicy`; `planning/SPEC/IDENTITY_ENS.md` §4 C, §7 step 7

## Decision

Every agent that never pays (concierge, analyst, the shop agents) is seeded with `graphpay.cap_micro` = `0`. Paying agents publish the story's cap (6.00 for the payer and acceptance agents, 30.00 for rehearsal, 1.00 for scout and disposable agents).

## Why

The gate enforces `min(ENS cap, AgentPolicy cap)` and refuses a name with no policy, so a non-paying agent could never pay. Publishing 0 makes ENS alone say so, instead of leaving the record absent for a reader to guess about. The owner can still change it; the gate never treats the ENS cap as an authority.

## Consequences

Config owns the value; code reads it. Nothing else changes for T1, T4 or Join: only paying agents get an AgentPolicy.
