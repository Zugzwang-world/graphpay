# ADR-0046: The payee comes from ENS at pay time

Status: accepted · Date: 2026-11-05 · Decided by: founder (addendum B2)

## Decision

The payer resolves the shop's Whitechain address (coin type 2147485522) from ENS when it pays and refuses a 402 whose `payTo` differs (`PAYEE_MISMATCH`) or a shop with no address (`PAYEE_UNRESOLVED`); the shop API answers a 402 only if its own `payTo` equals its ENS address. No addresses are hard-coded.

## Why

The ENS prize forbids hard-coded values, and a resolved payee stops a spoofed 402 from redirecting money.

## Consequences

`resolvePayee` lives in `packages/ens` (T2); T1 and T4 call it; acceptance B9.
