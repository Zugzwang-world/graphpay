# ADR-0036: ENS key-limited permissions for agents

Status: accepted · Date: 2026-11-05 · Decided by: founder (addendum B3)

## Decision

Each agent that holds its own wallet gets exactly two setter grants on its own resolver through `grantSetterRoles`: `setText` for `agent-context` and `setAddress` for coin type 2147485522 (`0x80000752`, Whitechain). Never `graphpay.cap_micro`, `graphpay.status`, `x-graphpay-accepts` or an `agent-endpoint[…]` key. Endpoint records are written by the owner at provisioning.

## Why

The verified resolver ABI scopes a grant by record key or coin type, never by name, so one resolver per agent plus two key-scoped grants keeps each agent to its own two records.

## Consequences

Acceptance B3 (amended): the agent's `agent-context` write lands; its cap write reverts `EACUnauthorizedAccountRoles`.
