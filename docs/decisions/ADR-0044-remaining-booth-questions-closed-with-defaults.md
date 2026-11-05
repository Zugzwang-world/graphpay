# ADR-0044: Remaining booth questions closed with defaults

Status: accepted · Date: 2026-11-05 · Decided by: founder (21:42 IST)

## Decision

Arkiv key quota: unknown, so every transport logs the `ratelimit` header and backs off near the limit. Create-if-absent: none assumed; ADR-0023 anchors give idempotency. `HandleInvalid`: recorded as friction. Blockscout "verified" (not "fully verified"): treated as enough; Standard JSON verification only if asked. ENSv2 on Sepolia: assumed stable through Saturday. The `sim` wildcard counts as our own subname registry. ERC-8004 and ENSIP-25: Friday, only if time.

## Why

No booth answers are coming; each default is the cheapest safe assumption.

## Consequences

Open questions move to the friction notes, not the founder's list.
