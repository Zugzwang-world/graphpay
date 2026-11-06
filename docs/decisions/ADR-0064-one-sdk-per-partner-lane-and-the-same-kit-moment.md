# ADR-0064: One SDK per partner lane, and the "same kit, different business" moment

Status: accepted · Date: 2026-11-06 09:30 IST · Decided by: founder (the thinking-partner chat, via the 09:35 brief) · Source: `docs/thinking-partner/briefs/0935-sdk-publish-and-handoff.md` §2

## Decision

Each partner gets one SDK in its own lane, and the GraphPay app combines them:
- **Arkiv:** `arkiv-graph`.
- **Whitechain:** `agentpay`, a universal two-sided kit for agentic stablecoin payments.
  - The buyer side: agents with on-chain spending passes, paying with one signature and no gas; refunds and subscriptions; AI tools.
  - The merchant side: middleware, events, refunds, renewals and CSV export; merchant agent tools; a pluggable risk check.
  - V1 handles fixed-price orders only. Pre-authorisation for variable fares is V2.
- **ENS:** an agent-identity kit (subnames, scoped permissions, the kill switch), built only if Friday has time; otherwise it is named as the next step.

The demo gets a 15–20 second "same kit, different business" moment, the cab ride, for Whitechain's judges. It's placed when the story locks.

## Why

Each SDK speaks to its own partner's judges and stays reusable without the others. The cab ride shows that the kit isn't tied to one shop.

## Consequences

- The lane tests keep each package free of the others' code (ADR-0063).
- The cab-ride beat goes into the story config's demo steps when the founder locks the story.
- The ENS kit stays out of tonight's work unless Friday has spare budget.
