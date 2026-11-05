# ADR-0045: Test USDT arrived: it carries the main flow

Status: accepted · Date: 2026-11-05 · Decided by: main under the founder's authority (E-6)

## Decision

150 test USDT reached FUNDER at 21:54 IST (FUNDER held 153.75). M0 distributed it per `planning/WALLETS.md` §3, extended for the larger amount: ACCEPTANCE_PAYER 20, PAYER 30, SHOP_KESAR 20 (refund float), VITALIK 10, REHEARSAL_PAYER 40, DEAL_HUNTER 2; FUNDER keeps 31.75 for disposable agents and top-ups. M2 deploys the USDT checkout first; the stand-in checkout is optional, labelled, and only a fallback.

## Why

Whitechain's qualification needs a real test USDT payment in the main flow; a self-minted token does not count. E-6 says deploy the USDT checkout as soon as test USDT exists.

## Consequences

C7 and E3 no longer wait on supply: the qualifying payment runs once as `acceptance.vitalik` when M3 part B is ready.
