# Relay: w5-ops (W5 Ops), 23:10 IST, Fri 6 Nov

## In plain words

- W5 keeps the live site healthy all night and drives the acceptance report to no failures.
- **The payer is active, and its pass is 300 test USDT a day for tonight.** The gate reads two places and takes the lower one, so both were raised: the spending policy on Whitechain and the cap record in ENS.
- **The payer has money for it:** 125 test USDT, topped up from FUNDER. The shop's takings refill it as it spends.
- **The shop is open.**
- **Next, in order:** Pause and Resume act on the agent whose card was tapped (payer and scout only); a paused payer resumes by itself after two minutes and a closed shop reopens after five; the workers follow W1's new shop names; the acceptance report reaches no failures.

## Technical

- Policy: `scripts/whitechain/policy-cap.mjs payer --yes`, [0x608a…b8fd](https://explorer.testnet.whitechain.io/tx/0x608ae1b6a9e380eee452735f311eaef1ad8ac502ee9b16268bacb1eebc30b8fd).
- ENS: `scripts/ens/owner.mjs cap payer.vitalik.graphpay.eth --real`, [0x553c…adbc](https://sepolia.etherscan.io/tx/0x553c94e46621fa2fdab64c941a373ba60e07f572fb7fc62d0bcaa7e4c0acadbc).
- The story: `packages/config/story.json` payer `capMicro` 300,000,000 (one value); ADR-0071 amendment.
- Funding: `pnpm funding --plan usdt --network whitechain --execute --real`, [0xa47d…3fe0](https://explorer.testnet.whitechain.io/tx/0xa47dc8907a91e0426ce16961972a07451473d20ac6ca3ab0f52fc16137643fe0); `docs/technical/WALLETS.md` §2b.
- Checked: `scripts/ens/gate-pass.mjs` (full gate ok, cap 300,000,000) and `GET /api/state/customer` (ACTIVE, cap 300,000,000).

## State

- **Running:** this session (`local_` id in the app; brief `briefs/2300-w5-ops.md`).
- **Blockers:** none.
