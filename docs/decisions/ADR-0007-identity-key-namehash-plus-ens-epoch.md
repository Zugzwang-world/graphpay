# ADR-0007: Identity key: namehash plus ENS epoch

Status: adopted from the lab (planning/DECISIONS.md part A) · Date: 2026-11-05 · Decided by: founder (pre-event) · Source: `planning/DECISIONS.md` part A, row 0007

## Decision

Identity key = `namehash(normalize(name))` plus `ens_epoch` (low 32 bits of `getState().resource`); every edge, tally and policy carries both; real agents are tokenized, synthetic ones resolve by wildcard

## Why

A re-registered name must not inherit the previous holder's reputation
