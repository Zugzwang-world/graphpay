# ADR-0031: Whitechain RPC: keyed Ankr, then public fallbacks, chain 1874 only

Status: accepted · Date: 2026-11-05 · Decided by: founder (chat, 21:40 IST)

## Decision

`WHITECHAIN_RPC_URL` is a server-only secret (the founder's personal Ankr URL, entered through the hidden setter). Fallbacks, in order: `https://rpc.ankr.com/whitechain_testnet`, then `https://rpc.testnet.whitechain.io`. Every candidate must answer `eth_chainId` = 1874 or it is refused; the setter refuses to store a URL on another chain. The secret scan flags an Ankr API key inside an Ankr RPC URL.

## Why

A keyed RPC gives higher limits; a wrong-chain RPC must never sign anything; keyed URLs leak through error messages unless redacted.

## Consequences

`resolveRpc('whitechain')` in `@graphpay/config` implements the order; logs carry the candidate's label, never its URL; never `NEXT_PUBLIC_`.
