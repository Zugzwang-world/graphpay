# Swarm in GraphPay

**DRAFT, status: PENDING (T3, Fri 6 Nov 2026).** As of this draft nothing has been uploaded to Swarm. This file says what we plan, what we have checked, and what is not done. It will be updated with the real reference, link and timestamp if the upload happens, and it will say plainly if it does not. Swarm is the first thing cut if time runs short (ADR-0053).

The seven items below follow the Swarm section of the event addendum.

## 1. What lives on Swarm, and what lives on Arkiv

- **On Swarm (planned):** a shop's **menu** as public JSON, with no personal data. And, last and only if time allows, a **refund photo**, encrypted in our own code before it leaves the server.
- **On Arkiv (planned):** the `menu` row (`shop_key`, `shop_ens`, `version`, the 64-hex Swarm reference and a content hash) and the `refund_evidence` row (`order_id`, `shop_key`, `buyer_key`, and the per-file key wrapped with a server-only key). Arkiv holds the pointers and the proof of what was uploaded; Swarm holds the bytes.

## 2. One entity key, its reference and an openable link

Pending. This will name one `menu` entity key on Rabdi, its Swarm reference, and a link of the form `https://api.gateway.ethswarm.org/bzz/<reference>` that opens it.

## 3. Batch ID, buyer wallet, node or service

Decided (ADR-0061, ADR-0039): the upload goes through the **public gateway** (`api.gateway.ethswarm.org`) anonymously, with the all-zero postage batch id. We buy no stamp, run no Bee node, hold no sBZZ, and no signing step touches mainnet. The gateway's operator pays for the storage. So there is **no buyer wallet and no batch of our own**.

## 4. The upload and read files

Pending. Planned: a server-side upload in `packages/money-graph` and a read through the same gateway, re-uploading the menu if its reference stops answering.

## 5. Run steps

Pending. They will be copied here from the working script once it runs.

## 6. Demo-video timestamp

Pending. Only filled in if a Swarm moment is in the final video.

## 7. What got in the way, and what to know

- **The public gateway is for testing.** It stores on Swarm's main network, keeps data for a limited time, and its operator, not us, pays. That is why only public content goes there and why Arkiv keeps a content hash: the menu can be checked, and re-uploaded if the reference stops answering.
- **We do not let the gateway encrypt for us.** Per the Bee documentation, an encrypting node's operator would hold the key. Refund photos are encrypted first (AES-256-GCM, one key per file) and only the ciphertext is uploaded as plain bytes (a 64-hex reference). The per-file key is wrapped with a server-only key and stored on Arkiv; the writer refuses to store any 128-hex run, with a test.
- **Verified before building** (T3's verifier, Fri 03:33 to 03:39 IST, Bee OpenAPI v2.8.3 and the bee-js 13.2.0 README): the gateway accepts an upload with the zero batch id. This was read from the documentation and not yet run by us.
- **Not done yet:** the probe upload and read-back (master plan item 4), the `menu` and `refund_evidence` entities, and everything in items 2 to 6.
