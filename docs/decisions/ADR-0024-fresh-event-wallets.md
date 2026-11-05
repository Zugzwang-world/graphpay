# ADR-0024: Fresh event wallets

Status: accepted · Date: 2026-11-05 · Decided by: founder (E-7, F-3)

## Decision

Only FUNDER (the bank) and OPERATOR (owner of `graphpay.eth`) carry over from the lab; every other role key was generated at M0, one role per run, addresses only. The import allowlist is exactly `FUNDER_PRIVATE_KEY`, `OPERATOR_PRIVATE_KEY`, `ARKIV_ACCESS_KEY`, `ANTHROPIC_API_KEY`. The addendum's directory writer `W_DIRECTORY` is one more fresh role (ADR-0033).

## Why

Fewer pre-event items and nothing tied to lab activity; the ENS root can only be built by its owner, and FUNDER holds the faucet tokens (`planning/DECISIONS.md` E-7).

## Consequences

Addresses and funding transactions are in `docs/technical/WALLETS.md`; A5 passed at M0 (19 role addresses, none a lab wallet, no duplicates).
