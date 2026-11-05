# ADR-0003: No off-chain database

Status: adopted from the lab (planning/DECISIONS.md part A) · Date: 2026-11-05 · Decided by: founder (pre-event) · Source: `planning/DECISIONS.md` part A, row 0003

## Decision

No off-chain database: state on the Whitechain contract and Arkiv; Vercel only runs code; no Supabase, no Redis; no personal data; secrets only in the Vercel environment and `.env`

## Why

The product claim is "state you can verify"; a database would also be something to secure and explain
