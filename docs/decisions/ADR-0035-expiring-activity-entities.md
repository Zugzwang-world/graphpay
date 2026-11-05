# ADR-0035: Expiring activity entities

Status: accepted · Date: 2026-11-05 · Decided by: founder (addendum A3, A6–A8)

## Decision

Tonight: `quote` (W_DIRECTORY, readonly, expires 15 minutes after creation; the shop's `valid_until` stays 10 minutes). The payer refuses a missing or expired quote and re-quotes once. Friday: `shop_open` (15 minutes, renewed while the Open toggle is on), `agent_presence` (15 minutes, renewed while the agent runs), `handoff` (30 minutes).

## Why

Expiry makes "open now", "online" and "quote still valid" true on Arkiv itself, visible to every reader, with no cleanup job.

## Consequences

Acceptance D10 tonight; D11 on Friday.
