# ADR-0026: Public repo Zugzwang-world/graphpay

Status: accepted · Date: 2026-11-05 · Decided by: founder (F-2)

## Decision

The event repo is the public repo `graphpay` under the account `Zugzwang-world`, protected `main` (required check `ci`, admins included, linear history, no force-push or deletion), squash-only auto-merge, delete branch on merge.

## Why

Branch protection and auto-merge work on a public repo on any plan; judges can read it.

## Consequences

Every change after the CI bootstrap goes through a PR.
