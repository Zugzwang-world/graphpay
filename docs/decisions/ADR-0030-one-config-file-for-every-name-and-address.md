# ADR-0030: One config file for every name and address

Status: accepted · cast part superseded by ADR-0047 (the story config) · Date: 2026-11-05 · Decided by: founder (chat, 21:40 IST)

## Decision

`packages/config/graphpay.config.json` holds every person, shop and agent name (`cast`: tonight the pack's cast as the test cast; the final demo cast is added on Friday as `cast.demo` and selected by `cast.active`) and every ENS, Whitechain and Arkiv address and URL. Code reads them through `@graphpay/config`. Wallet env names stay the pack's; each cast member is bound to a wallet role. An env value that repeats a config value (`GRAPHPAY_ROOT_ENS`, `ENS_ALLOWED_ROOTS`, `RECORDER_OWNER`, `SHOP_MERCHANTS`, `ALLOWED_MERCHANTS`) must equal it, or the service refuses to start.

## Why

The addendum's ENS rule forbids hard-coded values, and the demo cast changes on Friday.

## Consequences

`pnpm check` fails on any known address in code outside the config file (acceptance A7). If the demo cast's labels differ, its paying agents get fresh wallets (one role per run), because a wallet stays bound to its test-cast node (E-14).
