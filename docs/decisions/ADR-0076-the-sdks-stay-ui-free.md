# ADR-0076: The SDKs stay free of UI; the demo app is the reference
Status: accepted · Date: 2026-11-06 22:30 IST · Decided by: founder · Source: the full-sync brief `docs/thinking-partner/briefs/2225-full-sync.md`

## Decision
- `@graphpay_ethglobal/arkiv-graph` and `@graphpay_ethglobal/agentpay` stay free of UI.
- The demo app (the live site and its source) is the reference for how to use them.
- A React kit is the next step, after the event.

## Why
Packages without UI keep each one in its own lane (ADR-0064), so they work in any front end.

## Consequences
- The READMEs link to the demo app.
- No React code goes into the published packages.
- The versions freeze from submission until judging ends (ADR-0063).
