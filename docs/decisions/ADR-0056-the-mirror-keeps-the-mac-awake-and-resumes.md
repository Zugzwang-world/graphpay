# ADR-0056: The mirror keeps the Mac awake and resumes

Status: accepted · Date: 2026-11-05 · Decided by: founder (brief v2)

## Decision

The one workers process (the mirror and the ENS watcher, E-2) runs under `caffeinate -ims -w <its pid>` for as long as it runs, and resumes from its last processed block (its Arkiv checkpoint) after a sleep or a network drop.

## Why

The Mac's system sleep is one minute when idle; the mirror runs overnight.

## Consequences

Join (M11) shows a resume after a forced network drop; main checks it when the mirror starts.
