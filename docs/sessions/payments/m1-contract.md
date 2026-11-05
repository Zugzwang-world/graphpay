# M1: GraphPayCheckout (T1 Payments working notes)

Built to `planning/SPEC/PAYMENTS_WHITECHAIN.md` §3–§4 in `packages/contracts`. Solidity 0.8.30, prague, via IR, 200 runs, no metadata hash. OpenZeppelin v5.7.0 (`cab19933c33c`), Permit2 interfaces at `cc306b601f17` (the commit its only tag, named after the deployed address, points to), forge-std v1.9.7. Runtime size 17,125 bytes.

## Tests

90 Foundry tests on a fork of real Whitechain Sepolia at block 12,310,000 (2026-11-06 00:49 IST), against the real test USDT and the real Permit2, both read from `packages/config/graphpay.config.json`; test USDT is moved from FUNDER on the fork. Digests are computed three ways: by hand in Solidity, by viem (`test/fixtures/digests.json`, checked by `pnpm test`), and by the contract, the token and Permit2.

Gas, execution only (a receipt adds 21,000 and the calldata, about 12,000):

| call | gas |
|---|---:|
| first agent settle with the gasless approval, merchant already holds a float (C2's conditions) | 318,377 |
| same, merchant at zero balance | 333,479 |
| re-order with an existing approval | 251,143 |
| partial refund | 81,275 |
| createSubscription with the first charge | 482,697 |
| renew | 218,399 |
| cancelWithSig | 43,073 |

So C2's real settle should land near 351,000, inside 312,024 ±15%. `createSubscription` with the first charge is about 518,000 on a receipt (the lab had 437,794), above `MAX_SETTLE_GAS` (450,000): M3 sends it with its own limit of 700,000.

## Where this differs from the spec, and why

1. **No stand-in token** (ADR-0054). The EIP-3009 and EIP-2612 parity suite had two tokens to compare; with one token left it is an EIP-2612 suite on the real test USDT (both permit overloads, the configured domain against `DOMAIN_SEPARATOR()`, a wrong-domain permit refused).
2. **Order storage is five slots.** `paidMicro` is not stored: a paid order has paid exactly `amountMicro` (the spec's invariant). Payer node, parent and deadline are in `OrderCreated` and in `termsHash`.
3. **A renewal creates its order only when the charge succeeds.** A failed charge emits `RenewalFailed` only, not also `PaymentFailed`, so one failure is one `fail` edge. The first charge at creation is cycle 1 and emits `OrderCreated` (kind 2, parent 0), `PaymentSettled` and `SubscriptionRenewed(cycle 1)`, like every later charge.
4. **A renewal's `mandateHash` is its `subId`** (the subscriber's signed terms are its mandate).
5. **An existing order with other terms reverts `TermsMismatch`**, also when it is paid; `DUPLICATE` is recorded only for the same terms, so a duplicate record always carries the order's own nodes.
6. **`cancelOrder` requires `byNode` = the shop's node**, so a merchant cannot put a cancel on another node's record.
7. **`createSubscription` requires `nodeOfWallet(subscriber) == payerNode`**: a subscription that could never be charged, or that would charge as someone else's node, is refused at creation.
8. **The 150k gas guard runs before the approval permit and again before the pull**, so neither can be starved into a recorded failure (a property test tries gas limits from 120k to 420k).
9. **Additions** (additive views for the other tracks): `subscriptionCount()` and `subscriptionIdAt(i)` (the stateless renewal cron finds subscriptions without reading logs), `renewalOrderId`, `termsHash`, `cancelDigest`, and the dispute state in `orders(id)`.

## Reviewer

Pass 1 (02:10 IST): ship, no blocking issue. Fixed after it: a starved-gas sweep for `renew`; the JS `renewalOrderId` and witness type string compared with the contract through the fixture; two tests that promised more than they proved; the daily-cap renewal test pinned to a fixed midday; the library installer no longer leaves a half-fetched folder. Open (CI, the Coordinator's): only the `ci` job is a required check, so the `contracts` job does not gate a merge; this PR merges only after `contracts` is green.

Pass 2 (02:35 IST, on the fix commit): ship, no blocking issue. A red `contracts` job from an RPC timeout is rerun, never merged past.

## For the other tracks

`import { checkoutAbi, permitWitnessTypes, permit2Domain, tokenDomain, FAIL_REASON, renewalOrderId } from '@graphpay/contracts'`. The ABI is `packages/contracts/abi/GraphPayCheckout.json` (CI checks it against the build). The deployed address and deploy block go in `whitechain.contracts` at M2.
