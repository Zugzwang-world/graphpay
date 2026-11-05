# ADR-0008: Kill switch: unregister, lapse or pause

Status: adopted from the lab (planning/DECISIONS.md part A) · Date: 2026-11-05 · Decided by: founder (pre-event) · Source: `planning/DECISIONS.md` part A, row 0008

## Decision

Kill switch: hard kill = owner `unregister`; lapse = short expiry; pause = `graphpay.status=paused`; the facilitator reads registry state, never records alone. **Amended by the lab's evidence:** the extra `linkToRecord(name, 0)` step is unnecessary

## Why

After `unregister` the records resolve to empty strings through the parent, so only registry state tells you an agent is dead
