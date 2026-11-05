# ADR-0033: A second Arkiv writer: W_DIRECTORY

Status: accepted · Date: 2026-11-05 · Decided by: founder (addendum A, E)

## Decision

A new wallet `W_DIRECTORY` writes the directory and activity entities (`shop`, `quote`, and on Friday `shop_open`, `agent_presence`, `handoff`, `menu`). It never writes money entities; the money mirror stays the single W_LEDGER writer. Every read is scoped by `$owner` to the right writer.

## Why

Directory and activity data change for reasons unrelated to money and must not share the mirror's serialised nonce stream.

## Consequences

Generated and funded at M0 (0.2 tGLM; top up to 0.5 from FUNDER when the synthetic directory is seeded). Vercel route writes are create-only with the confirmed nonce and a retry on a clash; only scripts patch `shop` rows, never while the site is live.
