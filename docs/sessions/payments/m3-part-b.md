# M3 part B: real payments through T2's ENS gate (T1 Payments working notes)

Part B runs the facilitator and the shop API locally (`ALLOW_REAL_NETWORK=1`), in-process on loopback ports, against the real Whitechain Sepolia checkout, with T2's real ENS gate and payee read on Ethereum Sepolia (read-only). The facilitator signs as FACILITATOR; after M4 hosts it, real payments go through the hosted facilitator only.

## The scripts (`scripts/whitechain/`)

- `local-pay.mjs`: the composition. T2's `createEnsGate` with three inputs read from the checkout (`policyReads`): the epoch the policy was written for (`null` when the policy has no wallet, so a name without a policy is `ENS_NO_POLICY`), its daily cap (also when revoked, so the contract records that failure itself within the facilitator's quota; `null` when the epoch differs) and `spentMicro(node, epoch, day)` for the contract's UTC day. `createEnsReader().resolvePayee` for the shop. Start-up checks include the ENS RPC on chain 11155111. Relayer and merchant transactions go to the tx log.
- `lifecycle.mjs`: the lifecycle as the story's rehearsal agent; read-only preflight without `--yes`; the scout policy is restored in a `finally` if a later beat fails.
- `usdt-ready.mjs --go --yes`: C7 once ever; `docs/sessions/payments/c7.json` is the record and a second run refuses.
- `subscription.mjs demo`: create (first charge in the same transaction), renew after the 120 s demo period, cancel with the subscriber's signature; all sent by RENEWER.
- `@graphpay/facilitator` re-exports the x402 client, facilitator and header helpers, so scripts and M4 use the package's pinned `@x402/core` (no root dependency).

## Fork rehearsals (anvil, about 04:05 IST)

| run | result |
|---|---|
| lifecycle | pay 4.80 (237,206 gas; Permit2 allowance already in place), replay `alreadyPaid` (relayer nonce unchanged), refund 0.80 (75,335), re-order 1.20 (244,343), over the cap refused off-chain `CAP_EXCEEDED` (nothing sent), scout revoked → `AGENT_REVOKED` on-chain (136,598) → policy restored, human payer 0.40 (226,492); payers' WBT unchanged |
| C7 | PaymentSettled, 4.80 moved, payer gas 0, sent by the relayer |
| subscription | create 433,957, renew 222,869 (cycle 2), cancel 42,215 |

Real-chain preflights (read-only) passed at about 04:15 IST: all payers funded, the gate passes rehearsal, scout and acceptance at epoch 0, FACILITATOR 0.8 WBT.

## Real runs

(filled in after the runs)
