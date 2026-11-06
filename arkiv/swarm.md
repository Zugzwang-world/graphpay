# Swarm in GraphPay

**DRAFT, status: MENUS LIVE; ENCRYPTED REFUND EVIDENCE NOT BUILT (T3, Fri 6 Nov 2026).** The three cast shops' menus are on Swarm through the public gateway and referenced from Arkiv. The encrypted refund photo was dropped on purpose: Swarm is first in the cut order (ADR-0053), and the demo's refund request carries no photo. Nothing below claims otherwise.

The seven items below follow the Swarm section of the event addendum.

## 1. What lives on Swarm, and what lives on Arkiv

- **On Swarm (done):** a shop's **menu** as public JSON (synthetic story data, no personal data), one small file per shop, uploaded as a one-file collection named `menu.json`.
- **On Swarm (not built, dropped):** a **refund photo**, which would have been encrypted in our own code before leaving the server.
- **On Arkiv (done):** the `menu` row (W_DIRECTORY, mutable): `shop_key`, `shop_ens`, `version`, `swarm_ref` (64 hex), `content_hash` (sha-256 of the bytes) and `size`. **(not built, dropped):** the `refund_evidence` row (`order_id`, `shop_key`, `buyer_key`, and the per-file key wrapped with a server-only key). Arkiv holds the pointer and the proof of what was uploaded; Swarm holds the bytes.

## 2. One entity key, its reference and an openable link

Kesar Kingdom's menu (a synthetic story shop), version 1:

- **Arkiv `menu` entity:** `0x0f32e7cd190884066418a9fb32df6f5807e5bc3f8b59f3a7776f99e3e1de273f` ([explorer](https://rabdi.explorer.arkiv.network/entity/0x0f32e7cd190884066418a9fb32df6f5807e5bc3f8b59f3a7776f99e3e1de273f)), created in tx [0xe088…35b2](https://rabdi.explorer.arkiv.network/tx/0xe08819acde1f50d2a21fc93c1b39abee3145c3f7362b35cdda3480d5200835b2).
- **Swarm reference (64 hex):** `7812ec17664eac04ac47b56aa9137bd1ca470fe3f30960d76e9637423f6dd3c1`
- **Open it:** <https://api.gateway.ethswarm.org/bzz/7812ec17664eac04ac47b56aa9137bd1ca470fe3f30960d76e9637423f6dd3c1/menu.json>

The other two cast shops' menus are in `docs/sessions/arkiv/swarm-menus.json` (entity key, transaction, reference and link for each).

## 3. Batch ID, buyer wallet, node or service

Decided (ADR-0061, ADR-0039): the upload goes through the **public gateway** (`api.gateway.ethswarm.org`) anonymously, with the all-zero postage batch id. We buy no stamp, run no Bee node, hold no sBZZ, and no signing step touches mainnet. The gateway's operator pays for the storage. So there is **no buyer wallet and no batch of our own**.

## 4. The upload and read files

- `packages/money-graph/src/swarm.mjs`: the gateway client (upload, read, link). Anonymous, the all-zero batch id, never encrypted; a reference that is not 64 hex digits is refused.
- `packages/money-graph/src/menu.mjs`: `menuDocument`, `writeMenu` (upload, read back, check the hash, then create or patch the `menu` row) and `readMenu` (row, bytes from the gateway, hash check; uploads again if the gateway has lost it, which gives the same reference).
- `packages/money-graph/scripts/menus.mjs`: the run script. Tests: `packages/money-graph/test/menu.test.mjs` (an in-memory stand-in for the gateway and ArkivSim).

## 5. Run steps

```bash
pnpm -s --filter @graphpay/money-graph menus             # dry run: bytes and hashes only
pnpm -s --filter @graphpay/money-graph menus --execute   # upload to the gateway, write the menu rows from W_DIRECTORY on Rabdi
```

The run needs W_DIRECTORY's key (loaded from `.env`, never printed) and a little tGLM. Running it again with an unchanged story does nothing; with a changed menu it uploads a new file and patches the row to the next version.

## 6. Demo-video timestamp

Pending. Only filled in if a Swarm moment is in the final video.

## 7. What got in the way, and what to know

- **The public gateway is for testing.** It stores on Swarm's main network, keeps data for a limited time, and its operator, not us, pays. That is why only public content goes there and why Arkiv keeps a content hash: a reader checks the bytes against it, and if the reference stops answering, the menu is uploaded again and comes back under the same reference.
- **It worked on the first try, anonymously.** A probe (Fri 04:19 UTC, a 76-byte labelled test file) went to `POST /bytes` and came back with HTTP 201 and a 64-hex reference; reading it back returned the same bytes (matching sha-256). The menus use `POST /bzz?name=menu.json` instead, so the link opens as a file.
- **A raw reference does not open in a browser by itself.** `GET /bzz/<reference>` without a file name answered a 302 to a "forbidden" page on `bzz.link`; `GET /bzz/<reference>/menu.json` (or with a trailing slash) answers 200 with the JSON. So our links always carry the file name. A raw `/bytes/<reference>` read also works for data uploaded with `POST /bytes`. We do not know why the bare path is redirected.
- **We do not let the gateway encrypt for us.** Per the Bee documentation, an encrypting node's operator would hold the key. Refund photos (not built) would be encrypted first (AES-256-GCM, one key per file) and only the ciphertext uploaded as plain bytes (a 64-hex reference). The per-file key would be wrapped with a server-only key; a menu row refuses any reference that is not 64 hex digits, and the refund row would refuse any 128-hex run, with a test.
- **No stamp, node or wallet of ours.** The gateway's operator pays; no signing step touches mainnet (testnets only).
- **Not built, by decision:** `refund_evidence` (the encrypted refund photo). The plan above is kept as the design for anyone who builds it.
- **Not done:** the demo-video timestamp (item 6) and the menus on the shop pages (a screen would call `readMenu`).
