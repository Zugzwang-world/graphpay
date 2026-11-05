# Relay: payments (T1)

Updated 01:55 IST, Fri 6 Nov.

## In plain words

The shop's till is a contract on Whitechain called GraphPayCheckout. An agent with an ENS name pays a shop by signing one message; our relayer sends the transaction and pays its gas, so the agent needs no gas and no earlier approval. The signed message carries the order (shop, amount, deadline, who pays for whom), so nobody in between can change the payee or the price. The contract also keeps each agent's spending rules: a daily cap, an expiry and an off switch, tied to the agent's ENS name and its own wallet, so a stopped agent cannot pay by pretending to be a human. Refunds, re-orders, a small dispute process and subscriptions (renewed on a schedule, stopped after three failed charges, cancelled with a signature) are in the same contract. When a payment fails, the contract writes down why, so the money graph on Arkiv can show it; it never moves money twice and it never holds money itself.

Tonight M1 is done in code: the contract and 90 tests that run against a copy of the real Whitechain Sepolia with the real test USDT and the real Permit2. Nothing is deployed yet (that is M2).

## Technical

- PR: pay/contract (link in LOG.md once opened). Files: `packages/contracts/src/GraphPayCheckout.sol` (17,125 bytes deployed), tests in `packages/contracts/test/`, the ABI in `packages/contracts/abi/`, the EIP-712 shapes in `packages/contracts/typed-data.mjs`.
- Pins: Solidity 0.8.30, prague, via IR, 200 runs, no metadata hash; OpenZeppelin v5.7.0, Permit2 source at commit `cc306b6`, forge-std v1.9.7.
- Tests fork block 12,310,000 of Whitechain Sepolia (00:49 IST); the token, Permit2 and the RPC come from the config file, never from code. Every signature digest is computed by hand, by viem and by the contract, and they agree.
- Gas, execution only (measured in the fork tests): first agent settle with the gasless approval 318,377 when the merchant already holds a float; re-order 251,143; partial refund 81,275; subscription create with first charge 482,697; renew 218,399; gasless cancel 43,073. A receipt adds about 33,000 (intrinsic gas and calldata), so the first settle should be about 351,000, inside C2's 312,024 ±15%.
- Deviations from the spec (all in `docs/sessions/payments/m1-contract.md`): no stand-in token (ADR-0054), so the token parity suite became an EIP-2612 suite on the real USDT; five storage slots per order; a renewal creates its order only when the charge succeeds and a failed charge is one `RenewalFailed` event; a renewal's mandate hash is its subscription id; an existing order with other terms always reverts; `cancelOrder` must name the shop; a subscription must name the subscriber's own node; the gas guard runs before the approval and before the pull; small views added for the renewal cron (`subscriptionCount`, `subscriptionIdAt`).
- Next: M2 (deploy from DEPLOYER, verify on Blockscout, grant RENEWER, merchant floats, policies from the story config), then M3 and M4.
