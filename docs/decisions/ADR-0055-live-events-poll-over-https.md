# ADR-0055: Live events poll over HTTPS

Status: accepted · Date: 2026-11-05 · Decided by: main under the founder's authority (brief v2)

## Decision

Every live event (the merchant's chime, the explainer, the mirror) is read by polling over HTTPS through `resolveRpc` (the keyed Ankr URL, then the public fallbacks); Whitechain makes a block every second, so a 2-second poll is enough. The founder's Ankr plan is the free tier, whose WSS endpoint is locked. Whitechain's public WebSocket (`wss://rpc.testnet.whitechain.io/ws`) may be used as an optional push, never as a requirement.

## Why

Vercel functions stream to the browser over SSE from the Node runtime and cannot hold a chain subscription open between requests anyway.

## Consequences

Amends ADR-0031.
