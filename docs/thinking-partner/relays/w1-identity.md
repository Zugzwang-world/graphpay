# Relay: w1-identity (W1 Identity), 01:16 IST, Sat 7 Nov

## In plain words

- W1 gave the dosa story's shops their own names on ENS, flipped the story to them, and made the kill work live. **All three are done and proven on the production site.**
- **The new shop names** (#158) are `filter-and-fold.graphpay.eth`, `idli-index.graphpay.eth` and `tawa-tangle.graphpay.eth`, each with its storefront, risk and dispatch agents.
  - Each pays into the wallet its old shop used, so no money moved.
  - The old names stay registered as history.
- **The story flip** (#189, 00:31 IST): the site, the agents and the mirror now use the new names, with category south-indian.
- **The proof:** after W5's workers restart (01:00), the first errand paid Filter & Fold 4.80 at 01:07 through its new name.
  - On chain, the payment names the new shop and pays the old wallet.
  - The mirror recorded it under the new shop (241 to 242 orders).
  - Every ENS check passes, including the payee of that order.
- **The kill** (#175, 00:16 IST): the site's Kill button killed the spare `disposable-2`.
  - The watcher revoked its pass 9 s later.
  - Its next payment was refused and recorded on Arkiv.
  - A fresh spare, `disposable-3`, is ready. From now on the workers make the next spare after each kill by themselves.
- **For W3** (#191): a cap the owner sets in ENS now reaches the payer's spending pass. It can move it between 0 and the story's cap, never above it.

## Technical

- **The errand:** tx [0xcc69…5cb5](https://explorer.testnet.whitechain.io/tx/0xcc69b7bb16eb17c9dede32da4765a90ca15a6af18397011efae6a9eb599e5cb5) (Whitechain block 12,397,500). The evidence is in `docs/sessions/identity/errand-filter-and-fold.json`:
  - `PaymentSettled.shopNode` = namehash(`filter-and-fold.graphpay.eth`) `0xc82a07d8…`, and the order's merchant is SHOP_KESAR `0x2694…3E`;
  - the mirror's `pay` edge for order `0x305c2658…` goes to `filter-and-fold.graphpay.eth`.
  - `node scripts/ens/acceptance.mjs` (no relabel): 101 pass, 0 fail. B9 (a) checks this order's merchant against the ENS address. idli-index and tawa-tangle are skipped until their first settled payment.
- **The flip:** six lines in `story.json` (the labels and categories), plus `apps/phones/test/errand.test.ts`, which replays the Nov 5 recording under today's names. The full suite passed.
- **The order of the night:**
  1. W2's history went onto Arkiv (#167).
  2. The flip merged and deployed.
  3. #191 merged.
  4. The old-name mirror wrote the 00:25 and 00:31 payments under `kesar-kingdom`.
  5. W5 restarted the workers once from main `ff67dac` (the mirror is now pid 30776, and the log shows "spare keeper: spare ready: disposable-3").
  6. The proof errand ran.
  7. W4 was released, then W3.
- **The kill evidence:** `docs/sessions/identity/kill-disposable-2.json`.
  - The unregister: [0x08f1…fff5](https://sepolia.etherscan.io/tx/0x08f116fc2ceebb93e1de209fcbb2f60ac53c094c25b3b06d7da6eb16f194fff5).
  - The revoke: [0x40d5…233a](https://explorer.testnet.whitechain.io/tx/0x40d51ac52b440bc33bb6ec2686fe53c53b77be370a84970a0790a744bbd8233a).
  - The refusal: 402 `ENS_EXPIRED_OR_REVOKED`, recorded as a `fail` edge.
  - The spare keeper: `scripts/ens/spare.mjs`. FUNDER has spent 2 of the 4 test USDT the Coordinator approved (WALLETS.md §2b).
- **The owner's cap** (#191, with W3's ADR-0079):
  - On a `graphpay.cap_micro` change, the watcher reads the record as it is now and sends min(owner's cap, configured cap) to the sink. Kills in the same batch go first.
  - It keeps the chain's wallet, epoch and expiry. It never reopens a revoked pass, and it sends nothing if another policy writer moved the pass since it was read.
  - Retries are bounded, and the chain id is checked before signing.
  - One known gap is in the ADR: a cap set while the workers are down waits for the next change.
- **Reviewer:** run on every signing change (the rename run, the kill route, the keeper, the cap sync). Every blocking finding was fixed before merging.

## State

- **Running:** nothing (this session, `local_45f7cf5d-c31e-4dbf-b849-466f3067bdd3`; brief `briefs/2302-w1-identity.md`).
- **Blockers:** none.
- **Next:** on request. The site's `GET /api/customer/kill-disposable` names `disposable-3` for the next kill. Spare keys up to `DISPOSABLE_9` are in Vercel; 2 of the 4 approved test USDT are left.
