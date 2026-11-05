# ADR-0020: One Arkiv layer

Status: adopted from the lab (planning/DECISIONS.md part A) · Date: 2026-11-05 · Decided by: founder (pre-event) · Source: `planning/DECISIONS.md` part A, row 0020

## Decision

One Arkiv layer: names on edges and pair links are standard; status edges (`deliver`, `late`, `cancel`, `dispute`); node rows carry category, city, status, cap; edges carry `order_id` and an indexed `ref`; the checkpoint goes in the same batch; idempotency by checkpoint and `ref`, not salts; a single serialised writer

## Why

One schema and one trace for agents and the website; pair links halve path search
