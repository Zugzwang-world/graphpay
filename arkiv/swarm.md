# Swarm in GraphPay

**Status: menus and one dish photo live on Swarm and referenced from Arkiv; the encrypted refund photo is not built.** The three cast shops' menus (synthetic story data) are public files on Swarm, uploaded through the public gateway, each pointed to by a `menu` row on Arkiv with its content hash. The phones' build reads them keyless and would use a Swarm image for any product without a photo of its own; today every product has the site's own copy of the Grok photo, so the phones show that, and the Swarm copy is the one anyone can check by hash. The encrypted refund photo was dropped on purpose: Swarm is first in the cut order (ADR-0053), and the refund request's photo stays on the phone. Nothing below claims otherwise. Drafted by T3 on Fri 6 Nov; finished by the Submission stream (W7) that night, with every link below fetched and its hash checked at about 23:25 IST.

The seven items below follow the Swarm section of the event addendum.

## 1. What lives on Swarm, and what lives on Arkiv

- **On Swarm:** each cast shop's **menu** as public JSON (synthetic story data, no personal data), one small file per shop, uploaded as a one-file collection named `menu.json`; and one dish photo, Filter & Fold's masala dosa combo (`dosa.jpg`, made by the Grok desk, ADR-0075).
- **On Arkiv:** the `menu` row (W_DIRECTORY, mutable): `shop_key`, `shop_ens`, `version`, `swarm_ref` (64 hex), `content_hash` (sha-256 of the bytes) and `size`. Arkiv holds the pointer and the proof of what was uploaded; Swarm holds the bytes.
- **Not built, by decision:** a **refund photo**, which would have been encrypted in our own code before leaving the server, with a `refund_evidence` row on Arkiv.

## 2. One entity key, its reference and an openable link

Filter & Fold's menu (a synthetic story shop; its ENS name is still the test cast's `kesar-kingdom.graphpay.eth`), version 3, the dosa story:

- **Arkiv `menu` entity:** `0x0f32e7cd190884066418a9fb32df6f5807e5bc3f8b59f3a7776f99e3e1de273f` ([explorer](https://rabdi.explorer.arkiv.network/entity/0x0f32e7cd190884066418a9fb32df6f5807e5bc3f8b59f3a7776f99e3e1de273f)), patched to version 3 in [0x4395…cc56](https://rabdi.explorer.arkiv.network/tx/0x43955ea40b8f1ab4632e9c4a25ce73df1a8a77fc01495464f03606ace112cc56) (Fri 6 Nov, 18:28 IST, from W_DIRECTORY).
- **Swarm reference (64 hex):** `25f880463e2702eb5a2e265aa3c78004d5083f430aee1347189e8bb2c6f033dd`
- **Open it:** <https://api.gateway.ethswarm.org/bzz/25f880463e2702eb5a2e265aa3c78004d5083f430aee1347189e8bb2c6f033dd/menu.json> (863 bytes; sha-256 `0acda655…ffe1f`, equal to the row's `content_hash`).
- **Its photo:** the masala dosa combo's `image` is `{ ref, name, contentType, sha256, bytes }`: reference `45ffef41901fd1fb0f3a6ee08bfbad31ee953b59dbd36dbc8e40379734bc4d89`, 28,626 bytes, sha-256 `9a22f698…a003`; <https://api.gateway.ethswarm.org/bzz/45ffef41901fd1fb0f3a6ee08bfbad31ee953b59dbd36dbc8e40379734bc4d89/dosa.jpg>.

The other two cast shops' menus (Tawa Tangle and Idli Index) are in [`docs/sessions/arkiv/swarm-menus.json`](../docs/sessions/arkiv/swarm-menus.json): entity key, transaction, reference and link for each.

## 3. Batch ID, buyer wallet, node or service

Decided (ADR-0061, ADR-0039): the upload goes through the **public gateway** (`api.gateway.ethswarm.org`) without an account, with the all-zero postage batch id. We buy no stamp, run no Bee node, hold no sBZZ, and no signing step touches mainnet. The gateway's operator pays for the storage. So there is **no buyer wallet and no batch of our own**.

## 4. The upload and read files

- `packages/money-graph/src/swarm.mjs`: the gateway client (upload, read, link). No account, the all-zero batch id, never encrypted; a reference that is not 64 hex digits is refused.
- `packages/money-graph/src/menu.mjs`: `menuDocument`, `writeMenu` (upload, read back, check the hash, then create or patch the `menu` row) and `readMenu` (row, bytes from the gateway, hash check; uploads again if the gateway has lost it, which gives the same reference).
- `packages/money-graph/scripts/menus.mjs`: the run script. Tests: `packages/money-graph/test/menu.test.mjs` (an in-memory stand-in for the gateway and ArkivSim).
- `apps/phones/menu-images.mjs`: the phones' build reads each shop's menu keyless, checks it, and gives its Swarm image link to any product that has no image of its own (`apps/phones/build.mjs`).

## 5. Run steps

```bash
pnpm -s --filter @graphpay/money-graph menus             # dry run: bytes and hashes only
pnpm -s --filter @graphpay/money-graph menus --execute   # upload to the gateway, write the menu rows from W_DIRECTORY on Rabdi
```

The run needs W_DIRECTORY's key (loaded from `.env`, never printed) and a little tGLM. Running it again with an unchanged story does nothing; with a changed menu it uploads a new file and patches the row to the next version. Anyone can check a menu without a key: read the row on Arkiv, fetch the link, and compare the sha-256.

## 6. Demo-video timestamp

Filled in once the video is recorded, if a Swarm moment is in it; the form text names it.

## 7. What got in the way, and what to know

- **The public gateway is for testing.** It stores on Swarm's main network, keeps data for a limited time, and its operator, not us, pays. That is why only public content goes there and why Arkiv keeps a content hash: a reader checks the bytes against it, and if the reference stops answering, the menu is uploaded again and comes back under the same reference.
- **It worked on the first try, with no account.** A probe (Fri 04:19 UTC, a 76-byte labelled test file) went to `POST /bytes` and came back with HTTP 201 and a 64-hex reference; reading it back returned the same bytes (matching sha-256). The menus use `POST /bzz?name=menu.json` instead, so the link opens as a file.
- **A raw reference does not open in a browser by itself.** `GET /bzz/<reference>` without a file name answered a 302 to a "forbidden" page on `bzz.link`; `GET /bzz/<reference>/menu.json` answers 200 with the JSON. So our links always carry the file name. We do not know why the bare path is redirected.
- **We do not let the gateway encrypt for us.** Per the Bee documentation, an encrypting node's operator would hold the key. A refund photo (not built) would be encrypted first (AES-256-GCM, one key per file) and only the ciphertext uploaded; a menu row refuses any reference that is not 64 hex digits, so an encrypted 128-hex reference can never land in a public row by mistake. The design is kept for anyone who builds it.
- **No stamp, node or wallet of ours.** The gateway's operator pays; no signing step touches mainnet (testnets only).
- **Not done:** the encrypted refund photo, and live photos from the shop.
