# Relay: w1-identity (W1 Identity), 23:35 IST, Fri 6 Nov

## In plain words

- W1 gives the dosa story's shops their own names on ENS, flips the story to them, and makes the kill work live.
- **Done: the three new shops have their names on ENS** (Ethereum Sepolia): `filter-and-fold.graphpay.eth`, `idli-index.graphpay.eth` and `tawa-tangle.graphpay.eth`, each with its storefront, risk and dispatch agents.
- They are built exactly like the old shops: their own registry and resolvers and the same records.
- Each new name pays into the wallet its old shop used, so no money moved:
  - Kesar Kingdom's wallet → Filter & Fold;
  - Syrup Street's → Idli Index;
  - Jamun Junction's → Tawa Tangle.
- The old names stay registered as history; nothing was changed for them.
- **Not yet:** the site still uses the old names. The story flips to the new names in one small PR, after W2 has written the new shops' rows and history on Arkiv. The Coordinator times it; then W5 restarts the workers.
- **Next: the kill.** One spare disposable agent with money, its key on the site; a button unregisters it; the watcher revokes its spending pass; its next payment is refused and recorded on Arkiv; a fresh spare is made for the next kill.

## Technical

- **Registered:** 30 Sepolia transactions, 23:10 to 23:18 IST, about 39M gas at 16 wei.
  - For each shop: the owner registry, the owner resolver, the registration under `graphpay.eth` and `setParent`.
  - Then two transactions for each of the nine agents: its resolver, then its registration with role bitmap 0.
  - Every hash is in [`docs/sessions/identity/namespace.md`](../../sessions/identity/namespace.md), under the new "Renamed shops" table and in the transactions table.
- **How:** `node scripts/ens/real-run.mjs --real --relabel kesar-kingdom=filter-and-fold,syrup-street=idli-index,jamun-junction=tawa-tangle`.
  - The shops keep their story keys and wallet roles; only their labels are new.
  - The provisioner skips everything that already exists.
  - It was rehearsed on an anvil fork of Sepolia first.
- **Checked:** `node scripts/ens/acceptance.mjs --relabel …` on real Sepolia: 100 checks pass.
  - Each new name is REGISTERED at epoch 0, with its own resolver.
  - Its kind and status are right, and its coin type 2147485522 address is the old shop's wallet.
  - `x-graphpay-accepts` is test USDT, and every agent has `agent-context` and `agent-endpoint[mcp]`.
  - B9 (a), the payee of the last settled order, waits for the first payment under a new name.
- **Nodes, for W2's Arkiv rows** (every new name is epoch 0):
  - `filter-and-fold.graphpay.eth` `0xc82a07d8a94558e9c674da7dcff543682d8b80d29787bda4616890ed93dc07d6`
  - `idli-index.graphpay.eth` `0x85dbc5b3f68825d4f3e39f9680127f6394b5cdd460c91e5cdb359ead885e04b4`
  - `tawa-tangle.graphpay.eth` `0xe7445394024c4044d77327c3cc9eed02725501773a6cf6f9e60408c85cf5aaf3`
  - The agents' nodes are in the hand-off table of `namespace.md`.
- **Code:**
  - `relabelShops` and `parseRelabel` in `packages/ens/src/plan.mjs`, with a unit test.
  - `--relabel` in `real-run.mjs` and `acceptance.mjs`.
  - The namespace record is merged by name, so the old names stay in it as history.
- **Seen in passing:** `payer.vitalik.graphpay.eth` reports DRIFT on `graphpay.cap_micro`. That is expected: W5 raised the payer's pass to 300 for tonight (#152), and the provisioner never rewrites a record.

## State

- **Running:** this session, `local_45f7cf5d-c31e-4dbf-b849-466f3067bdd3` (brief `briefs/2302-w1-identity.md`).
- **Blockers:** none.
- **Waiting on:** the Coordinator's go for the label flip, after W2 confirms the Arkiv rows.
