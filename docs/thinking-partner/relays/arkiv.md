# Relay: arkiv (T3)

Updated 09:55 IST, Fri 6 Nov. This step: Swarm, the menu part of Friday items 4 and 5 (branch `arkiv/swarm-menu`). Merged before it: the SDK publish prep ([PR #74](https://github.com/Zugzwang-world/graphpay/pull/74)) and the drafts of the Arkiv judges' files ([PR #77](https://github.com/Zugzwang-world/graphpay/pull/77)).

## In plain words

Each cast shop now has a public menu stored on Swarm, and Arkiv holds a pointer to it plus a fingerprint (a hash). Anyone can open the menu from a link; anyone can check that what they got is the file Arkiv points to. If Swarm's public gateway ever loses a file, the next read that has the menu document uploads it again and it comes back under the same address. We tried it on the real gateway first with a tiny labelled test file; it accepted an anonymous upload and returned the same bytes.

The menus are synthetic story data (the test cast), with no personal data. We spent nothing and signed nothing for Swarm: the gateway's operator pays, and we run no node of our own. The encrypted refund photo is not built; it is first in the cut order and needs a secret key from the Coordinator. `arkiv/swarm.md` says what is done and what is not, with the real links.

What you need to do: nothing now. After the final story is locked, the menus should be uploaded again (one command, in OPEN).

## Technical

- **New in `packages/money-graph`:** `src/swarm.mjs` (the gateway client: anonymous upload with the all-zero batch id, never encrypted, a reference must be 64 hex, https only, one retry), `src/menu.mjs` (`menuDocument`, `writeMenu`, `readMenu`, `castMenus`), the `menu` entity in `model.mjs` (W_DIRECTORY, mutable, `shop_key` indexed; 14-day life; trusted from W_DIRECTORY only), `scripts/menus.mjs`. The gateway URL is a new `swarm.gateway` entry in `packages/config/graphpay.config.json` (the Coordinator's file; a one-key addition).
- **Behaviour:** `writeMenu` uploads, reads back and checks the sha-256, then creates the row or, if the menu changed, uploads the new file and patches the row to version + 1; an identical menu changes nothing on Arkiv. `readMenu` checks the bytes against the row's hash and refuses a mismatch. A row from another wallet is ignored.
- **Live results:** probe on the gateway (`POST /bytes` 201, read-back sha-256 equal); `POST /bzz?name=menu.json` 201; `GET /bzz/<ref>` without a file name is redirected to a "forbidden" page, so our links carry `/menu.json`. Three `menu` rows created on Rabdi by W_DIRECTORY (first tx [0xe088…35b2](https://rabdi.explorer.arkiv.network/tx/0xe08819acde1f50d2a21fc93c1b39abee3145c3f7362b35cdda3480d5200835b2)); all three read back and verified through the keyless node and the gateway. Keys, references and links: `docs/sessions/arkiv/swarm-menus.json`; one example in `arkiv/swarm.md`.
- **Tests:** `packages/money-graph/test/menu.test.mjs` (7: the client's headers and refusals, 64-hex guard, write, unchanged rewrite, version 2, lost-and-reuploaded, tampered bytes, foreign owner, cast menus carry no address); money-graph 26 pass in all; `pnpm check` clean.
- **Not done:** `refund_evidence` (AES-256-GCM in our code, ciphertext as plain bytes, per-file key wrapped with the Swarm wrapping key, a writer refusal of any 128-hex run with a regex test); the demo-video timestamp; menus on the shop pages (T5 reads `readMenu`).
- **Risks:** the gateway keeps data for a limited time and is meant for testing (said in `swarm.md`). The menu script writes as W_DIRECTORY, so it should not run while the shop seeding runs (ADR-0033).
