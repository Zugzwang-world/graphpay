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

Real-chain preflights (read-only) passed at about 04:08 IST: all payers funded, the gate passes rehearsal, scout and acceptance at epoch 0, FACILITATOR 0.8 WBT.

## Real runs

Real Whitechain Sepolia, 04:13–04:18 IST Fri 6 Nov (UTC day 5 Nov, so the acceptance agent's 6.00 for M13 on UTC 6 Nov is untouched). The lifecycle and the subscription paid as `rehearsal.vitalik`; `payer.vitalik` paid nothing. Every payer's WBT is unchanged. Transcript: `m3-lifecycle.json`; C7: `c7.json`; every transaction: `txlog.jsonl`.

| beat | result | transaction |
|---|---|---|
| C7 (also E3), acceptance.vitalik, 04:13 IST | PaymentSettled 4.80, 4,800,000 units of test USDT moved, payer gas 0, sent by FACILITATOR | [0x8750…2c00](https://explorer.testnet.whitechain.io/tx/0x87505ef2457b6e925fa7378a55fd91419e83c37fb8effc06d901884700c72c00) (309,483 gas) |
| pay 4.80, rehearsal.vitalik | 200, delivered, payer WBT unchanged (Permit2 allowance already in place) | [0x0bb3…98ba](https://explorer.testnet.whitechain.io/tx/0x0bb3b1d426a0faf8e388d49b5726f920fa1024140dd4373b34ea58ce8a5a98ba) (237,206 gas) |
| replay | 200 `alreadyPaid`, relayer nonce unchanged, no money moved | none |
| refund 0.80 (SHOP_KESAR) | payer +0.80 | [0x037b…8416](https://explorer.testnet.whitechain.io/tx/0x037b201af75e8f9b5d407575907918c7ca152876a4d2983b1955a83c4bf58416) (75,335 gas) |
| re-order 1.20 | 200, kind 1 at the parent's path | [0xab0b…c515](https://explorer.testnet.whitechain.io/tx/0xab0b9d6c736588e96a5164efc089e5e0dcdfafbed2562320ad9fcae32cbbc515) (244,295 gas) |
| over the cap (24.00 with 23.99 left) | 402 `CAP_EXCEEDED` from the ENS gate, nothing sent | none |
| scout.vitalik revoked (POLICY_WRITER) | policy revoked, name still ENS-active | [0x20f8…d493](https://explorer.testnet.whitechain.io/tx/0x20f8b2dba2b0a310773383c4653c73fa4eb773790e905c63ee89b0c2cb48d493) (38,394 gas) |
| scout pays 0.40 | 402, `PaymentFailed(AGENT_REVOKED)` on-chain, no money moved | [0x05e8…b7f1](https://explorer.testnet.whitechain.io/tx/0x05e812dccf65e255f1a25ed600cdb2e39b4a56e52172b67793c55d0cb86eb7f1) (136,586 gas) |
| scout's policy restored | epoch 0, DEAL_HUNTER, 1.00/day, no expiry, not revoked (read back) | [0x6304…e559](https://explorer.testnet.whitechain.io/tx/0x63045e36f2df6ecc4e376df64e0d628cfcc9b07a2d3a722a15e7d51dd829e559) (38,382 gas) |
| VITALIK as a human payer 0.40 | 200, payer node 0, no ENS gate | [0xf4ac…0c6b](https://explorer.testnet.whitechain.io/tx/0xf4ac5a5d4d732ebd2653bd3daeea22f803b850bc863952a1a302f48bf7620c6b) (281,661 gas) |
| subscription create (RENEWER) | sunday-box 0.40 every 120 s, first charge in the same transaction | [0x1a2b…1180](https://explorer.testnet.whitechain.io/tx/0x1a2bb6c80871b22458d66393d6afa075becc55086f2c85ab995dc38077d91180) (433,969 gas) |
| renew after 120 s | cycle 2 charged | [0x9ca1…77b0](https://explorer.testnet.whitechain.io/tx/0x9ca184afaa55ca3ef951ef7ebabf63a22dd98d0516ddceb1e83da9712b3477b0) (222,881 gas) |
| cancel with the subscriber's signature | CANCELLED | [0x3a6f…83b5](https://explorer.testnet.whitechain.io/tx/0x3a6f278f077f79cd40972b7c4a3c7bb2073f803c98fc9c462330697df87383b5) (42,227 gas) |

Merchant `markDelivered` transactions (about 31,800 gas each) are in the tx log. Refusal records written locally (the Arkiv recorder route is M4's): `CAP_EXCEEDED` for rehearsal.vitalik.

## Reviewer (part B)

Do not ship, two blocking, both fixed, then "ship": C7 could be paid twice if the receipt came after the pipeline's timeout (now a pending record before the payment and a chain guard on `PaymentSettled` for the acceptance node since the deploy block, read in 1,000-block chunks); `subscription.mjs` could send on the real chain without `ALLOW_REAL_NETWORK=1`. Also fixed: scout's restore armed before the revoke is sent, the demo cancels in a `finally`, `sendTx` re-reads `eth_chainId` before every send. Open for M13: C4(b) as the acceptance agent (the lifecycle's over-cap beat used the rehearsal agent).
