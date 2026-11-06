# Relay: identity (T2 Identity), 22:30 IST, Fri 6 Nov

## In plain words

- Every agent and shop has a name under `graphpay.eth` on Ethereum Sepolia.
- Before any payment, the gate reads the agent's name on the chain. It must be active, and the amount must fit the lower of its ENS cap and its on-chain policy cap. The shop's payout address comes from the shop's ENS name.
- Pause and Resume set the payer agent's status in ENS. A paused agent is refused before anything is signed.
- The watcher keeps the payment policies in step with ENS. A killed agent's policy is revoked, and paying to renew its name does not revive it.
- The payer's ENS cap is 100 test USDT a day.
- **Now:** the payer has been paused since 21:24 IST, because a visitor pressed the public Pause. The founder was asked whether to resume it and make Pause presenter-only.
- On screen the shops are Filter & Fold, Idli Index and Tawa Tangle. Their ENS names are still the test cast's: kesar-kingdom, syrup-street and jamun-junction.

## Technical

- Namespace: [#18](https://github.com/Zugzwang-world/graphpay/pull/18) (M5); records in `docs/sessions/identity/namespace.md`.
- The gate and the owner actions (pause, resume, kill): [#34](https://github.com/Zugzwang-world/graphpay/pull/34). The watcher, the policy sink and B8's MCP call: [#40](https://github.com/Zugzwang-world/graphpay/pull/40) (M6 done).
- B7, a new registration gets a new epoch (fork test): [#83](https://github.com/Zugzwang-world/graphpay/pull/83). B9 (a), the payee is the shop's ENS address: [#84](https://github.com/Zugzwang-world/graphpay/pull/84).
- The owner action `cap`, and the payer's ENS cap of 100: [#106](https://github.com/Zugzwang-world/graphpay/pull/106).
- The watcher runs inside Join's `pnpm workers` on this Mac (its state: `relays/integration.md`).
- Open:
  - ENS names for the new shops and their agents (Friday item 6), when the founder says;
  - a second kill demo needs DISPOSABLE_2 funded (it holds 0 WBT) and the kill button wired (T5);
  - the acceptance report (13:35 IST) still lists B7 and B9 as not run: B7 needs a Sepolia fork during the run, and B9 (a) passes in T2's own script for the one shop with settled payments.

## State

- **Idle.** Session `local_8ec48e25-b5c3-442f-b70d-a258266170ba`.
- Resume file: `docs/sessions/identity/resume.md` (after #84; older than #106).
- Next step: the new shops' ENS names the moment the founder locks them; then re-run `scripts/ens/acceptance.mjs` and `gate-pass.mjs`.
