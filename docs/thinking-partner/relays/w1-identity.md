# Relay: w1-identity (W1 Identity), 00:20 IST, Sat 7 Nov

## In plain words

- W1 gives the dosa story's shops their own names on ENS, flips the story to them, and makes the kill work live.
- **Done: the new shop names are on ENS** (#158): `filter-and-fold.graphpay.eth`, `idli-index.graphpay.eth` and `tawa-tangle.graphpay.eth`, each with its three agents.
  - Each pays into the wallet its old shop used, so no money moved.
  - The old names stay registered as history.
- **Done: the kill works on the production site** (#175). At 00:16 IST the site killed the spare agent `disposable-2.vitalik.graphpay.eth`:
  1. its owner's wallet unregistered its name on Sepolia;
  2. 9 s later, the watcher revoked its spending pass on Whitechain;
  3. its next payment, a 0.80 filter coffee, was refused because the name is gone, and the refusal is recorded on Arkiv;
  4. a fresh spare, `disposable-3`, was ready with its name, its pass and 1 test USDT at 00:19.
  - This once I made the fresh spare by hand. From W5's next workers restart, the workers make one after every kill.
- **Ready: the story flip.** It sets the three labels and the category "south-indian" in `story.json` (branch `claude/w1-flip`, all tests pass). It waits for the Coordinator's go, after W2's Arkiv history.
- **In review: the owner's cap.** For W3's cap route (#179), a cap the owner sets in ENS reaches the payer's spending pass through the watcher. It can lower the pass, but never lift it above the story's cap.

## Technical

- **Kill evidence:** `docs/sessions/identity/kill-disposable-2.json`, written by `node scripts/ens/kill-proof.mjs --yes`.
  - The script reads the spare from GET, POSTs the kill to the production route, then checks the chains and Arkiv itself:
    - **unregistered:** the name is no longer REGISTERED;
    - **revoked:** `policies(node).revoked`, and the `AgentPolicySet` transaction;
    - **recorded:** the `fail` edge, by its ref, through GraphQL `order(id)`;
    - **fresh spare:** a new spare appears on GET.
  - The transactions:
    - Unregister: [0x08f1…fff5](https://sepolia.etherscan.io/tx/0x08f116fc2ceebb93e1de209fcbb2f60ac53c094c25b3b06d7da6eb16f194fff5), Sepolia block 12,078,424, 00:16:24 IST.
    - Revoke: [0x40d5…233a](https://explorer.testnet.whitechain.io/tx/0x40d51ac52b440bc33bb6ec2686fe53c53b77be370a84970a0790a744bbd8233a), Whitechain block 12,394,425, 00:16:33 IST.
    - Refusal: 402 `ENS_EXPIRED_OR_REVOKED`, order `0x6602…e934`. Edge `att:0x6602…:0xd2f6…:5426c309`, from `disposable-2.vitalik.graphpay.eth` (the shop's old name, because the flip has not happened yet).
- **The pre-flight** came first, at no risk. The route's own payment code ran for the long-dead `disposable-1` against production and was refused, with its edge on Arkiv. That proved the payment and record path before spending a spare.
- **The fresh spare** came from `node scripts/ens/spare.mjs --yes`:
  - Sepolia: [0x5f1c…10ad](https://sepolia.etherscan.io/tx/0x5f1c91b29e2f198805f48822d4ed0deda18dbbf624d527592252cd56defc10ad), [0xe19f…21f7](https://sepolia.etherscan.io/tx/0xe19f27fa4e65db93119f23301f56ed145a7d131893dde4e93c85ee86505821f7), [0xbec8…5145](https://sepolia.etherscan.io/tx/0xbec80ebc4024e52cd648a6577ee21efa719f926c4bfbd5c8a3eb829129555145).
  - Its pass: [0x5825…d608](https://explorer.testnet.whitechain.io/tx/0x5825d9ffaeb375b6d0f67750747deddf7aaadef6ed9d8d2ada003fc7a2afd608). Its 1 test USDT: [0x83a3…30d1](https://explorer.testnet.whitechain.io/tx/0x83a3de586ab8039365065ab241219694b7fd8b08893a66786f75d4d9c84130d1).
  - FUNDER has now spent 2 of the 4 test USDT the Coordinator approved; both rows are in `docs/technical/WALLETS.md` §2b.
- **Why it was by hand:** the workers running at the kill started at 23:52 IST, before #175. Their watcher revoked the pass (that code was already there), but they don't have the keeper hook yet. W5's restart after the flip loads it.
- **The owner's cap** (branch `claude/w1-owner-cap`, reviewer running):
  - On a `graphpay.cap_micro` change, the watcher reads the record as it is now, never the event's value, since a replayed batch would otherwise make the pass flap.
  - It sends `ownerCapMicro` for a live name at its epoch.
  - The sink writes min(owner's cap, configured cap) and keeps the wallet, epoch and expiry. It skips a revoked policy, another epoch, or a name outside the configured list.
  - A failed read or write never holds up a kill in the same batch; the ticker retries it.

## State

- **Running:** this session, `local_45f7cf5d-c31e-4dbf-b849-466f3067bdd3` (brief `briefs/2302-w1-identity.md`).
- **Blockers:** none.
- **Waiting on:** the Coordinator's go for the flip, and W5's restart after it.
