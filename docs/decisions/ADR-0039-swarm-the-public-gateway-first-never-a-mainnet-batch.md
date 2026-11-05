# ADR-0039: Swarm: the public gateway first, never a mainnet batch

Status: accepted · Date: 2026-11-05 · Decided by: founder (booth default, 21:42 IST)

## Decision

Friday's Swarm work uploads through the public gateway first. We never buy a postage batch with mainnet funds (the hard limit is testnets only); if the gateway refuses, a Bee node on Swarm's testnet is the fallback, and otherwise the bonus is dropped and `arkiv/swarm.md` says so. An encrypted 128-hex reference is never stored on Arkiv in plain form: it is AES-wrapped with a server-only key.

## Why

No shared hackathon batch was confirmed, and the gateway was the founder's choice.

## Consequences

Writers: `menu` by W_DIRECTORY, `refund_evidence` by W_SYNC. The wrapping key is a new generated secret added on Friday.
