# ADR-0061: Swarm: public content through the gateway, evidence encrypted client-side

Status: accepted · Date: 2026-11-06 03:50 IST · Decided by: the Coordinator under the founder's authority (ADR-0039, ADR-0053) · Source: T3's verifier findings, 03:33–03:39 IST (Bee OpenAPI v2.8.3, the bee-js 13.2.0 README, the gateway repositories)

## Decision

Friday items 4 and 5 (`menu`) upload to `api.gateway.ethswarm.org` anonymously, with the all-zero batch id. Only public, unencrypted content goes this way: the menu JSON, with no personal data. Its reference and a content hash are kept on Arkiv, and it is re-uploaded if the reference stops answering. Nothing is ever encrypted on the gateway's side. `refund_evidence` encrypts the photo in our own code (AES-256-GCM, one key per file) and uploads only the ciphertext. The per-file key is wrapped with the Swarm wrapping key and stored base64url. We run no Bee node and buy no stamp.

## Why

- The gateway signs nothing and spends nothing for us. The operator pays with its own stamp, so the testnets-only limit holds: every signing step is on 1874, 11155111 or 7794095, and no mainnet funds are spent. ADR-0039 already chose the gateway.
- The gateway does store on Swarm mainnet, keeps data "for a limited time" and is meant for testing. So it carries only content that is public anyway, and Arkiv keeps the hash.
- If the gateway did the encryption, its operator would hold the key (Bee documentation). Encrypting first keeps the evidence private while still "uploaded encrypted", as addendum C asks.
- The testnet route needs downloaded Bee software, a Sepolia swap for sBZZ and a stamp purchase, which is too much risk and budget for a bonus that is first in the cut order (ADR-0053).

## Consequences

- T3 builds item 1 first, then item 4 and the menu, then `refund_evidence` last. `refund_evidence` is dropped before any demo-path item if time or budget runs short.
- The writer's 128-hex refusal rule and its regex test stay.
- The Coordinator generates the Swarm wrapping key as a secret when T3 asks.
- `arkiv/swarm.md` says plainly what the gateway is: testing only, mainnet storage paid by the operator, possibly temporary.
