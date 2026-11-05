# ADR-0043: The synthetic city goes straight into Arkiv

Status: accepted · Date: 2026-11-05 · Decided by: founder (21:42 IST)

## Decision

The synthetic cities S and M are seeded directly as Arkiv entities from W_SEED_EVENT and W_SEED_M_EVENT, labelled synthetic, with no Whitechain payments. Their shops (fictional Mumbai shops at realistic neighbourhood coordinates) are also listed in the `shop` directory by W_DIRECTORY, labelled synthetic, so discovery is one query on one owner (addendum A4).

## Why

Real payments for thousands of synthetic orders would cost time and test tokens and prove nothing more; labels keep it honest.

## Consequences

M8 writes city data from the seed wallets and directory rows from W_DIRECTORY.
