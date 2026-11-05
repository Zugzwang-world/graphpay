# Relay: payments (T1)

Updated 02:55 IST, Fri 6 Nov.

## In plain words

The shop's till is now live on Whitechain Sepolia. It is our own contract, GraphPayCheckout, set up for the real test USDT (the token Whitechain's prize asks for), and anyone can read its source on the Whitechain explorer because we verified it there. An agent pays by signing one message; our relayer sends the transaction and pays its gas, so the agent needs no gas and no earlier approval. The signed message carries the order, so nobody in between can change the payee or the price. The contract also keeps each agent's spending rules, tied to its ENS name and its own wallet: today the stage payer and the acceptance agent may spend 6.00 a day, the rehearsal agent 30.00, the scout and the first disposable agent 1.00. Each shop has approved a small refund float of 20 test USDT, so refunds can be paid from the shop's own balance. A second relayer key is allowed to run subscription renewals on a schedule.

What is not done yet: no payment has gone through yet. Payments need our facilitator and the shop's payment API (M3, being built now) and the ENS names and gate (T2's M5 and M6).

## Technical

- M1 merged: https://github.com/Zugzwang-world/graphpay/pull/12 (90 Foundry tests on a Whitechain fork with the real test USDT and Permit2; two reviewer passes).
- Checkout `0x75233b7341B9e86407e4b31599f07b8936716FcA`, deploy block 12,313,887, deploy tx https://explorer.testnet.whitechain.io/tx/0x0cf2fc150261d538bf91638af813138475bb28ff9039c6183062d8461b3b01f6 (3,873,126 gas, 0.0194 WBT). Verified: https://explorer.testnet.whitechain.io/address/0x75233b7341B9e86407e4b31599f07b8936716FcA?tab=contract (`is_verified` true, `is_fully_verified` false, as expected without a metadata hash). Recorded in `packages/config/graphpay.config.json` (`whitechain.contracts.checkout`).
- Setup on the real chain (all in `docs/sessions/payments/txlog.jsonl` with links): RENEWER granted as a relayer (53,196 gas); refund floats of 20 approved by the three shops (53,376 each); policies at epoch 0 on the ENS namehash (95,177–95,237 each). Epochs move to T2's values when M5 publishes them.
- Scripts in `scripts/whitechain/`: deploy with token checks and a pending record before sending; Blockscout verification over the public RPC; idempotent setup from the story config; a read-only C7 readiness check (passes). Rehearsed on an anvil fork first. Keys only through the env loader; addresses and hashes printed, never keys.
- Deviations: no stand-in token and no `--token` switch (ADR-0054); the deployment record lives in the config, not a separate deployments file (the A7 rule allows addresses only there).
- Next: M3 part A (facilitator pipeline, shop API, recorder routes on T3's merged writer), then part B on the real chain once M5 and M6 merge, then M4 on Vercel.
