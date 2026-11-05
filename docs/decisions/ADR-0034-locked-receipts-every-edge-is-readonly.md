# ADR-0034: Locked receipts: every edge is readonly

Status: accepted · Date: 2026-11-05 · Decided by: founder (addendum A2)

## Decision

Every edge (payment lines included) is created with the SDK's `flags: { readonly: true }`; tallies (scoreboards), nodes, links, checkpoints and `shop` rows stay mutable.

## Why

Readonly locks payload and attributes, so a receipt cannot be edited; the owner can still extend, transfer or delete it (lab G-3; SDK 1.0.1 types).

## Consequences

Wording everywhere: "cannot be edited", never "permanent". Acceptance D9 is the negative test.
