# Swarm in GraphPay

**Status: the dosa shops' menus and their dish photos live on Swarm and referenced from Arkiv; the encrypted refund photo is not built.** The three cast shops' menus (synthetic story data) are public files on Swarm, uploaded through the public gateway, each pointed to by a `menu` row on Arkiv with its content hash; every menu carries the shop's storefront photo and every item its dish photo, each also on Swarm with its own hash ([#181](https://github.com/Zugzwang-world/graphpay/pull/181), [#201](https://github.com/Zugzwang-world/graphpay/pull/201)). The phones' build reads the menus keyless and would use a Swarm image for any product without a photo of its own; today every product has the site's own copy of the same photo, so the phones show that, and the Swarm copy is the one anyone can check by hash. The encrypted refund photo was dropped on purpose: Swarm is first in the cut order (ADR-0053), and the refund request's photo stays on the phone. Nothing below claims otherwise. Drafted by T3 on Fri 6 Nov; finished by the Submission stream (W7) that night and updated at 00:57 IST on Sat 7 Nov, with every link below fetched and its hash checked (the version-2 menus at 01:20 IST).

The seven items below follow the Swarm section of the event addendum.

## 1. What lives on Swarm, and what lives on Arkiv

- **On Swarm:** each cast shop's **menu** as public JSON (synthetic story data, no personal data), one small file per shop, uploaded as a one-file collection named `menu.json`; the shop's **storefront photo** and each item's **dish photo** (one storefront and four dishes per shop, the phones' own photos, made by the Grok desk, ADR-0075).
- **On Arkiv:** the `menu` row (W_DIRECTORY, mutable): `shop_key`, `shop_ens`, `version`, `swarm_ref` (64 hex), `content_hash` (sha-256 of the bytes) and `size`. Arkiv holds the pointer and the proof of what was uploaded; Swarm holds the bytes.
- **Not built, by decision:** a **refund photo**, which would have been encrypted in our own code before leaving the server, with a `refund_evidence` row on Arkiv.

## 2. One entity key, its reference and an openable link

Filter & Fold's menu (a synthetic story shop) under its own name, `filter-and-fold.graphpay.eth`, version 2:

- **Arkiv `menu` entity:** `0x628f9aeed5550c543ca17dbfc14b0f15e683114c556ea273bbfe753c635604f8` ([explorer](https://rabdi.explorer.arkiv.network/entity/0x628f9aeed5550c543ca17dbfc14b0f15e683114c556ea273bbfe753c635604f8)), written in [0xca19…ef5a](https://rabdi.explorer.arkiv.network/tx/0xca197cd3e08cfd97bdf63333ce2b53b52ac17d4bcd1da0db79e8b6158575ef5a) and patched to version 2 in [0x27b8…82f6](https://rabdi.explorer.arkiv.network/tx/0x27b80f721ad0bd043414c73cbc86e72eefaf0598a2974f7131294debf5ce82f6), both from W_DIRECTORY.
- **Swarm reference (64 hex):** `3f26da16d819311ceca5fde8e4af8077b497c272292df78d7f3292433df2dc76`
- **Open it:** <https://api.gateway.ethswarm.org/bzz/3f26da16d819311ceca5fde8e4af8077b497c272292df78d7f3292433df2dc76/menu.json> (1,870 bytes; sha-256 `cfc0df8f…3f1d10`, equal to the row's `content_hash`).
- **Its storefront photo:** the menu's `shop.image`: reference `2edb64a7735e6a123b638e402249e3e32d6977142550e0fab2c39d506738b7c7`, 24,936 bytes, sha-256 `40d0afe5…1574ec`; <https://api.gateway.ethswarm.org/bzz/2edb64a7735e6a123b638e402249e3e32d6977142550e0fab2c39d506738b7c7/storefront-filter-and-fold.jpg>.
- **One of its photos:** the masala dosa combo's `image` is `{ ref, name, contentType, sha256, bytes }`: reference `0f28013fa2f52285c954066fd6a4597106aabe6dfc1136ae1bd8028149406613`, 13,583 bytes, sha-256 `4e245665…`; <https://api.gateway.ethswarm.org/bzz/0f28013fa2f52285c954066fd6a4597106aabe6dfc1136ae1bd8028149406613/filter-and-fold-masala-dosa-combo.jpg>.
- **The earlier menus:** version 1 under the new name (<https://api.gateway.ethswarm.org/bzz/1e3df1a9613b7da3250a3247f13a03b29011453368ff683b6411a33c307f389f/menu.json>, dishes only), and the menu under the shop's earlier name `kesar-kingdom.graphpay.eth` (version 3, with one photo): entity [0x0f32…273f](https://rabdi.explorer.arkiv.network/entity/0x0f32e7cd190884066418a9fb32df6f5807e5bc3f8b59f3a7776f99e3e1de273f), <https://api.gateway.ethswarm.org/bzz/25f880463e2702eb5a2e265aa3c78004d5083f430aee1347189e8bb2c6f033dd/menu.json>.

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
