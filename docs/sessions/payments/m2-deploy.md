# M2: deploy, verify, set up (T1 Payments working notes)

The USDT checkout is live on Whitechain Sepolia (chain 1874), verified on the explorer and set up. The stand-in token is retired (ADR-0054), so there is no `deploy-token` and no `--token` switch: every script works on test USDT only.

| what | value |
|---|---|
| GraphPayCheckout | `0x75233b7341B9e86407e4b31599f07b8936716FcA` (config `whitechain.contracts.checkout`) |
| deploy block, tx | 12,313,887, https://explorer.testnet.whitechain.io/tx/0x0cf2fc150261d538bf91638af813138475bb28ff9039c6183062d8461b3b01f6 (3,873,126 gas, 0.0194 WBT) |
| verified | https://explorer.testnet.whitechain.io/address/0x75233b7341B9e86407e4b31599f07b8936716FcA?tab=contract : `is_verified` true, `is_fully_verified` false (no metadata hash, as expected) |
| roles | admin DEPLOYER, relayers FACILITATOR and RENEWER, policy writer POLICY_WRITER |
| merchant floats | 20 test USDT approved by SHOP_KESAR, SHOP_JAMUN, SHOP_SYRUP (53,376 gas each) |
| policies (epoch 0, the namehash; ENS epochs replace them when M5 publishes them) | scout → DEAL_HUNTER 1.00/day; payer → PAYER 6.00; rehearsal → REHEARSAL_PAYER 30.00; acceptance → ACCEPTANCE_PAYER 6.00; disposable-1 → DISPOSABLE_1 1.00, expiry 14 days (95,177–95,237 gas each) |

Every transaction, with gas, fee and explorer link: `txlog.jsonl` (this folder).

## The scripts (`scripts/whitechain/`)

- `deploy-checkout.mjs`: checks the token (code, 6 decimals, symbol, the configured EIP-712 domain = `DOMAIN_SEPARATOR()`, not on the never-use list), Permit2's code, and that the forge build is the committed ABI; writes a pending record (predicted address, DEPLOYER nonce) to the tx log before sending; a rerun finds an earlier deploy instead of repeating it; records address, deploy block and tx in `whitechain.contracts.checkout` (a splice checked to change nothing else in the config).
- `verify.mjs`: the Blockscout command of the spec §7 over the public RPC, then the explorer API.
- `setup.mjs`: RENEWER as a second relayer, the merchant floats, one policy per paying agent from the story config (`plan.mjs`: owner wallets never bound, one wallet per agent, a wallet bound to another node stops); each step only when the chain differs, so a rerun is a no-op (checked on a fork).
- `usdt-ready.mjs`: read-only readiness of the qualifying payment (C7): all checks pass.
- Shared (`lib.mjs`): keys only through the env loader, chain 1874 checked (or a loopback anvil fork with `--fork`), dry run unless `--yes`, no send while the role has a pending transaction, the redacting error boundary. A fork rehearsal logs to a temporary file, never to `txlog.jsonl`.

Rehearsed first on an anvil fork (deploy, setup, setup again: no-op), then run for real.

## Reviewer (02:05 IST): fix first, then fixed

- Blocking, fixed: a rerun of setup would have lifted a revocation (the revoked-agent beat) and cleared an expiry. Setup now carries `revoked` and a non-zero on-chain expiry forward, and a test pins it.
- Fixed: `--fork` must answer as anvil, and a real run refuses an anvil RPC; setup checks the configured address (code, `USDT()`, `owner()` = DEPLOYER) before any float is approved; the deploy sends at exactly the nonce of its pending record, and a timed-out deploy is recovered from its logged hash; a missing shop key fails the run; the config splice merges into `whitechain.contracts`; owner and infrastructure wallets are refused by role and by address; the FUNDER check is real; record times corrected (the runs were 01:54 to 01:57 IST).
- Kept: the 20 USDT float is a constant from the M2 brief (an operational value, not story data).
