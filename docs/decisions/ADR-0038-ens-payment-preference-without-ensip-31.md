# ADR-0038: ENS payment preference without ENSIP-31

Status: accepted · Date: 2026-11-05 · Decided by: founder (booth default, 21:42 IST)

## Decision

Each shop publishes its Whitechain receiving address (coin type 2147485522) and a text record `x-graphpay-accepts` whose value is the ERC-7930 encoding of test USDT on chain 1874 (`0x0001000002075214cedfb56113143d55b2358b8cfbb0deb5ad2f55a7`). ENSIP-31's `payment-preference` data record is not used.

## Why

No ENS booth answer is coming, and ENSIP-31 is a draft that changed in October.

## Consequences

The ERC-7930 encoder, parser and unit test stay (they produce the text value). Acceptance B4 amended.
