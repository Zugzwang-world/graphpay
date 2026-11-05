# SPEC: Payments on Whitechain Sepolia (contract, facilitator, shop 402 API, hosting)

Proven in the lab on a Whitechain fork against the real test USDT and Permit2, then on the **real** Whitechain Sepolia with a labelled stand-in token: deploy, Blockscout verification, a gasless agent payment, replay, refund, re-order, over-cap, revoked agent, human payer, subscription create, renew and cancel, and one payment through a public Vercel URL. **Not proven: any payment in the real test USDT** (none could be obtained). Amounts and names in the demo are synthetic scenario values (ADR-0013).

## 1. Facts that drive the design (re-verify the starred ones at 9 pm)

| # | fact |
|---|---|
| 1 | Test USDT `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`: "Tether USD", `USDT`, 6 decimals, EIP-1967 proxy over a verified TetherTokenV2. **Never** `0xaa7962d073935D387e8d442DA1D7149C81388f46` (USDT.e, bridged) |
| 2 | It supports **EIP-2612** `permit` (domain `name="Tether USD"`, `version="1"`, `chainId=1874`, `verifyingContract` = the proxy; v,r,s and packed-bytes overloads) **and EIP-3009** (`transferWithAuthorization`, `receiveWithAuthorization`, `cancelAuthorization`, `authorizationState`). There is no `eip712Domain()` and no `version()` |
| 3 | Canonical Permit2 `0x000000000022D473030F116dDEE9F6B43aC78BA3` is deployed on 1874; domain `{ name: "Permit2", chainId: 1874, verifyingContract: <Permit2> }` (no version) |
| 4 | Also present: deterministic deployer `0x4e59…956C`, EntryPoint v0.6/v0.7/v0.8, Multicall3 `0xcA11bde05977b3631167028862bE2a173976CA11`, `x402ExactPermit2Proxy` `0x402085c248EeA27D92E8b30b2C58ed07f9E20001` |
| 5 | 1 s blocks; base fee 5 gwei; gas price paid 5.001 gwei; block gas limit 40M; OP-stack L1 data fee 2.5e-15 to 2.6e-13 WBT per transaction (negligible) |
| 6 | Real gas: first agent settle (with gasless approval) **312,024**; settle through the public URL with an existing approval 234,292; re-order 252,082; recorded failure 160,525; refund 65,681; `markDelivered` 36,027; `setPolicy` 95,233 new / 38,568 update; `createSubscription` 437,794; `renew` 201,555; `cancelWithSig` 44,582; checkout deploy 3,596,042; stand-in token deploy 1,307,372 |
| 7* | The faucet gives WBT only: 0.5 WBT per rolling 24 h per GitHub account at least 30 days old (captcha, per-wallet and per-IP limits). USDT `mint` is owner-only. **How to get test USDT is unknown**: 50 holders, about 1,945,270 supply, one holder holds about 1M. Ask at the Whitechain workshop |
| 8* | x402 packages `@x402/core`, `@x402/evm`, `@x402/hono`, `@x402/fetch` all 2.29.0 (2026-11-03). Only `@x402/core` was used |
| 9 | The public x402.org facilitator does not support chain 1874, so we run our own |

Consequence: the payer needs **no gas and no prior approval**. The facilitator sends one transaction that (a) applies the payer's signed EIP-2612 permit with Permit2 as spender and (b) pulls the token with the payer's Permit2 witness, which carries the order terms.

## 2. Flows

1. **One-off order:** `settleOrder` creates the order and pulls the token in one call.
2. **Partial or full refund:** `refund(orderId, amountMicro, reason)` moves the token merchant → payer, capped at what was paid.
3. **Failed payment:** never a silent revert. `PaymentFailed(reason)` records agent revoked or expired, daily cap, node mismatch, token or permit failure, order deadline, duplicate. A failed first attempt leaves the order `CREATED`, so the same signed permit can be retried until its deadline.
4. **Re-order:** `kind=REORDER` with `parentOrderId`; the parent must be PAID, DELIVERED or REFUNDED and share buyer and shop.
5. **Subscription:** `createSubscription` (subscriber-signed terms + Permit2 `PermitSingle`), `renew` (relayer, from a scheduled job, not x402), lapse after 3 consecutive failures, `cancelWithSig` (gasless) or `cancelSubscription`.
6. **Dispute (minimal):** `openDispute` (payer, needs a little gas), `resolveDispute(outcome 0|1, refundMicro)` (admin).
7. **AgentPolicy:** `setPolicy(node, epoch, wallet, revoked, dailyCapMicro, expiry)` keyed by the agent's ENS node. The facilitator's ENS gate checks ENS; the contract enforces the policy.

**Why the contract binds wallet ↔ node.** A policy keyed only by `payerNode` is bypassable: the payer signs the witness, so a revoked agent could sign `payerNode = 0` ("a human") and skip the policy. Store `wallet` per node and `nodeOfWallet[wallet]`; a bound wallet may pay only as its node (`NODE_MISMATCH` otherwise), and a claimed node must be bound to the paying wallet.

**Consequences for wallets (each one breaks a beat if ignored):**
- `setPolicy` reverts ("wallet bound to another node") if the wallet already backs another node. **Every paying agent needs its own wallet**: `payer.vitalik` (PAYER), `scout.vitalik` for the revoked-agent beat (DEAL_HUNTER), `rehearsal.vitalik` (REHEARSAL_PAYER), `acceptance.vitalik` (ACCEPTANCE_PAYER), and a fresh wallet per `disposable-<n>` agent (`WALLETS.md`).
- **Never bind an owner wallet** (VITALIK, the shops) to an agent node: a bound wallet that pays as a human (`payerNode = 0`) fails `NODE_MISMATCH`, which breaks the human payment and the Sunday-box subscription.
- Policies are created only by the setup script from a configured list (agent → wallet → cap); the ENS watcher only updates policies that already exist.

## 3. Contract interface: `GraphPayCheckout`

Solidity 0.8.30, EVM `prague`, `via_ir = true`, optimizer 200 runs, `bytecode_hash = "none"`, `cbor_metadata = false`. Inherits `Ownable2Step`, `ReentrancyGuard`, `EIP712("GraphPayCheckout","1")` (OpenZeppelin Contracts v5.7.0). The lab's role-split build was 15,868 bytes of deployed code (under the 24 KB limit).

Constructor: `constructor(address token, address permit2, address admin, address relayer, address policyWriter)`. The three role addresses must be non-zero and distinct. `token` is the test USDT or the labelled stand-in; the getter stays `USDT()` so the ABI does not change with the token. **The contract never holds funds.** One deployment per token.

### 3.1 Roles (ADR-0021)

| role | lab wallet | may call | may not |
|---|---|---|---|
| admin (owner, `Ownable2Step`) | DEPLOYER (a fresh event wallet; OPERATOR is Sepolia-only at the event) | `setRelayer`, `setPolicyWriter`, `resolveDispute`, `transferOwnership` (the next admin calls `acceptOwnership`) | settle, renew, write policies, refund, open disputes, cancel subscriptions; `renounceOwnership` reverts |
| relayer | FACILITATOR | `settleOrder`, `createSubscription`, `renew` | write policies, refund, deliver, dispute |
| policy writer | POLICY_WRITER | `setPolicy` | anything that moves money |
| merchant | the order's own `merchant` | `refund`, `markDelivered`, `cancelOrder` on its own orders; `cancelSubscription` on its own subscriptions | anyone else's orders |

Granting a role refuses an address that already holds another role (or is the admin or pending admin); removing always works. Relayers are a set (`setRelayer(addr, bool)`), so a second relayer key for scheduled jobs is possible (`DECISIONS.md` E-1).

### 3.2 Types (schema)

| type | fields |
|---|---|
| `Order` | `bytes32 orderId, bytes32 parentOrderId, bytes32 buyerNode, bytes32 shopNode, bytes32 payerNode` (0 = human payer)`, address merchant, uint64 amountMicro, uint64 deadline, uint8 kind` (0 ONE_OFF, 1 REORDER, 2 RENEWAL) |
| `Sub` | `bytes32 subId, bytes32 subscriberNode, bytes32 shopNode, bytes32 payerNode, address subscriber, address merchant, uint64 amountMicro, uint32 period, uint64 firstChargeAt` |
| `Status` | `NONE, CREATED, PAID, DELIVERED, CANCELLED, REFUNDED` |
| `SubStatus` | `NONE, ACTIVE, LAPSED, CANCELLED` |
| `FailReason` (0..7) | `NONE, AGENT_REVOKED, SPEND_CAP, TRANSFER_FAILED, EXPIRED, DUPLICATE, AGENT_EXPIRED, NODE_MISMATCH` |
| AgentPolicy (per node) | `uint32 epoch, address wallet, bool revoked, uint64 dailyCapMicro, uint64 expiry` |

`day = block.timestamp / 1 days` (UTC). `amountMicro` = token units with 6 decimals. Nodes are ENS namehashes. Daily cap `0` means "may not spend"; `type(uint64).max` means unlimited.

### 3.3 Events (final schema; **bold** = indexed)

| event | arguments | Arkiv effect (mirror) |
|---|---|---|
| `OrderCreated` | **orderId**, **shopNode**, **buyerNode**, payerNode, merchant, amountMicro, deadline, parentOrderId, kind | `order` edge |
| `PaymentSettled` | **orderId**, **payerNode**, **shopNode**, payer, amountMicro, day, mandateHash, payerEpoch | `pay` edge |
| `PaymentFailed` | **orderId**, **payerNode**, **shopNode**, amountMicro, reason, payerEpoch | `fail` edge (onchain) |
| `Refunded` | **orderId**, **shopNode**, **buyerNode**, amountMicro, totalRefundedMicro, full, reason | `refund` edge |
| `OrderDelivered` | **orderId**, **shopNode**, deliveredAt | `deliver` or `late` edge |
| `OrderCancelled` | **orderId**, **byNode**, reason | `cancel` edge |
| `Disputed` | **orderId**, **buyerNode**, **shopNode**, reason | `dispute` edge |
| `DisputeResolved` | **orderId**, outcome (0 shop upheld, 1 buyer upheld), refundMicro | — |
| `SubscriptionCreated` | **subId**, **subscriberNode**, **shopNode**, amountMicro, period, firstChargeAt | `subscribe` edge |
| `SubscriptionRenewed` | **subId**, **orderId**, cycle, amountMicro | `renew` edge (amount 0: money is on the renewal's `PaymentSettled`) |
| `RenewalFailed` | **subId**, cycle, reason | `fail` edge |
| `SubscriptionLapsed` | **subId**, cycle | node/sub status |
| `SubscriptionCancelled` | **subId**, **byNode**, effectiveAt | `cancel` edge |
| `AgentPolicySet` | **payerNode**, epoch, wallet, revoked, dailyCapMicro, expiry | patch node status and cap |
| `RelayerSet` | **relayer**, allowed | — |
| `PolicyWriterSet` | **writer**, allowed | — |
| `OwnershipTransferStarted` / `OwnershipTransferred` | **previousOwner**, **newOwner** | — |

A renewal's order id is `keccak256(abi.encode(subId, cycle))` in the lab; at the event it also gets the top bit set (§3.6, E-5). Its `OrderCreated` has `kind = 2` and `parentOrderId` = the previous cycle's order id (0 for cycle 1). Idempotency key of every event: `1874:<txHash>:<logIndex>`. Payment events carry no token field: the token is fixed per deployment, so records mirrored from a stand-in checkout carry the stand-in label and are never counted as USDT.

### 3.4 Functions

| function | caller | behaviour |
|---|---|---|
| `settleOrder(Order o, bytes32 mandateHash, PermitTransferFrom permit, address payer, bytes sig, bytes approvalPermit)` | relayer | creates the order if `NONE`; retries if `CREATED` and terms match `termsHash`; else `PaymentFailed(DUPLICATE)`. Checks in order: policy, order deadline, permit token == the token and amount ≥ price, gas ≥ 150k, optional EIP-2612 approval, then `Permit2.permitWitnessTransferFrom` inside `try/catch` |
| `markDelivered(bytes32 orderId)` | merchant | PAID → DELIVERED |
| `cancelOrder(bytes32 orderId, bytes32 byNode, uint8 reason)` | merchant | only CREATED |
| `refund(bytes32 orderId, uint64 amountMicro, uint8 reason)` | merchant | PAID or DELIVERED; reverts if the merchant lacks balance or allowance for this contract |
| `openDispute(bytes32 orderId, uint8 reason)` / `resolveDispute(bytes32 orderId, uint8 outcome, uint64 refundMicro)` | payer / admin | resolve caps the refund at what is left |
| `createSubscription(Sub s, PermitSingle ps, bytes permitSig, bytes subSig, bytes approvalPermit)` | relayer | takes the first charge if `firstChargeAt <= now` |
| `renew(bytes32 subId)` | relayer | needs `now >= nextChargeAt` and `>= retryAt`; failure sets `retryAt = now + 1 day`; 3 consecutive failures lapse |
| `cancelWithSig(bytes32 subId, uint64 deadline, bytes sig)` / `cancelSubscription(bytes32 subId)` | anyone with the subscriber's `Cancel` signature / subscriber or merchant | |
| `setPolicy(bytes32 node, uint32 epoch, address wallet, bool revoked, uint64 dailyCapMicro, uint64 expiry)` | policy writer | epoch never decreases; moving a node to a new wallet releases the old one |
| `setRelayer(address, bool)`, `setPolicyWriter(address, bool)`, `transferOwnership(address)` | admin | |
| views | | `orders(id)`, `subscription(id)`, `policies(node)`, `nodeOfWallet(addr)`, `spentMicro(node, epoch, day)`, `spentToday(node)`, `witnessHash(order, mandate)`, `subscribeDigest(sub, permitSingle)`, `domainSeparator()`, `isRelayer(addr)`, `isPolicyWriter(addr)`, `owner()`, `pendingOwner()`, `USDT()`, `PERMIT2()` |

Errors (caller mistakes only; payment problems are events): `NotRelayer`, `NotPolicyWriter`, `NotAllowed`, `BadInput(string)`, `UnknownOrder`, `BadState`, `TermsMismatch`, and OpenZeppelin's `OwnableUnauthorizedAccount`, `OwnableInvalidOwner`.

### 3.5 Invariants

- A paid order has `paidMicro == amountMicro`; `refundedMicro <= paidMicro`; `REFUNDED` iff equal.
- Spend per `(node, epoch, day)` only increases on a settlement; a new epoch starts a fresh history; old epochs stay queryable.
- Payee, amount, nodes, deadline and kind of a one-off order are inside the payer's signed witness: the facilitator cannot redirect or change them.
- The policy check, in the lab contract's order: if the paying wallet is bound to a node, the claimed node must be that node (else `NODE_MISMATCH`); a claimed node 0 (human) is allowed only for an unbound wallet; the node's policy must exist with `wallet == payer` (else `NODE_MISMATCH`); `revoked` → `AGENT_REVOKED`; `expiry != 0 && block.timestamp >= expiry` → `AGENT_EXPIRED` (expiry 0 means "never"); `spentMicro[node][policy epoch][day] + amount > dailyCapMicro` → `SPEND_CAP`. `settleOrder` takes no epoch: the policy's stored epoch is used, and the ENS gate compares the name's live epoch with it (`expectedEpoch`). Because the contract checks expiry and revocation itself, a dead watcher cannot keep a lapsed agent paying.

### 3.6 Trust assumptions and the griefing fix

No role can redirect a payer's money. The relayer can still grief, with no funds at risk: (a) order terms are stored before the signature is verified, so a wrong first attempt makes the right one fail `TermsMismatch`; (b) it can create an unpaid order with any id and itself as merchant; (c) it can squat a subscription's next renewal id, after which `renew` reverts forever. Order ids are public in the 402, so (a) and (b) can target real orders.
- **Adopt at the event:** renewal ids in their own id space (set the top bit on renewal ids; `settleOrder` rejects ids with that bit; the shop derives one-off ids with the bit cleared). Closes (c).
- **Optional (untested):** derive one-off order ids from payer and witness (for example `keccak256(payer, witnessHash)`), which closes (a) and (b) but changes the shop's id format. Verifying the signature before storing does **not** close them: a relayer can sign for a wallet it controls.
- Policy writer: can lift a cap, bump an epoch, un-revoke, or bind a wallet to a node (polluting that node's tallies). Keep it a separate key.
- Admin: rotates the other roles and arbitrates disputes. Keep it cold.

## 4. Signatures (exact)

### 4.1 Order payment: Permit2 `PermitWitnessTransferFrom`
- Domain `{ name: "Permit2", chainId: 1874, verifyingContract: 0x000000000022D473030F116dDEE9F6B43aC78BA3 }`.
- Message: `permitted { token, amount }`, `spender` = the checkout, `nonce`, `deadline`, `witness: GraphPayOrder`.
- Witness type: `GraphPayOrder(bytes32 orderId,bytes32 parentOrderId,bytes32 buyerNode,bytes32 shopNode,bytes32 payerNode,address merchant,uint64 amountMicro,uint64 deadline,uint8 kind,bytes32 mandateHash)`; struct hash = keccak256 of the ABI-encoded typehash and fields in that order.
- `witnessTypeString` passed to Permit2 (contract constant `WITNESS_TYPE`): `GraphPayOrder witness)GraphPayOrder(bytes32 orderId,bytes32 parentOrderId,bytes32 buyerNode,bytes32 shopNode,bytes32 payerNode,address merchant,uint64 amountMicro,uint64 deadline,uint8 kind,bytes32 mandateHash)TokenPermissions(address token,uint256 amount)`.
- viem `signTypedData` with `primaryType: 'PermitWitnessTransferFrom'` and the three types produces exactly this digest (types sort G before T). Tests recompute the digest by hand and match viem.
- `nonce = uint256(orderId)` (one signature per order, no bookkeeping); `deadline = order.deadline`.
- `mandateHash` = hash of the human's intent mandate ("max 6 USDT, by 20:00"), stored in `PaymentSettled`.

### 4.2 Gasless first approval: EIP-2612 for Permit2
- `Permit(owner, spender = Permit2, value, nonce = token.nonces(owner), deadline)` in domain `{ name: <token name()>, version: "1", chainId: 1874, verifyingContract: <token> }`: `"Tether USD"` for test USDT, `"gpUSD TEST stand-in (not USDT)"` for the stand-in.
- Sent as `approvalPermit = abi.encode(uint256 value, uint256 deadline, bytes signature)` (65-byte r‖s‖v), applied with the packed-bytes overload `permit(owner, spender, value, deadline, bytes)` (selector `0x9fd5a6cf`) inside `try/catch` (a front-run permit is harmless). Bounded value (the lab used 50), never unlimited. Applied **after** the policy checks, so a refused payment consumes no approval and a retry must resend it.
- **A wrong domain name is silently dropped** by the contract and the payment ends `TRANSFER_FAILED`. Check the configured domain against the token's `DOMAIN_SEPARATOR()` at start-up.

### 4.3 Subscription
- Permit2 `PermitSingle` (AllowanceTransfer; domain as 4.1): `PermitSingle(PermitDetails details,address spender,uint256 sigDeadline)PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)`; spender = the checkout; `amount ≥ amountMicro`; `expiration > firstChargeAt`.
- The subscriber signs the terms (the `PermitSingle` binds none of payee, amount or period): `Subscribe(bytes32 subId,bytes32 subscriberNode,bytes32 shopNode,bytes32 payerNode,address merchant,uint64 amountMicro,uint32 period,uint64 firstChargeAt,bytes32 permitHash)` in the domain `{ name: "GraphPayCheckout", version: "1", chainId: 1874, verifyingContract: <checkout> }`, `permitHash = keccak256(abi.encode(token, amount, expiration, nonce, spender, sigDeadline))`. Rejected after `sigDeadline`. If Permit2's `permit` call fails (front-run), accept only if Permit2's stored allowance shows the nonce moved past the signed one and amount and expiration are at least the signed ones.
- `Cancel(bytes32 subId,uint64 deadline)` in the checkout domain; replay is harmless (`CANCELLED` is terminal).
- Schedule: success moves `nextChargeAt += period` but never more than one period behind (re-anchor to `now + period` after an outage). Cancelling does not revoke the Permit2 allowance: tell users about `Permit2.lockdown`.

## 5. The `graphpay-order` x402 scheme (against `@x402/core` 2.29.0)

**API names used** (from the installed types, 2026-11-04):
- `@x402/core/types`: `PaymentRequirements {scheme, network, asset, amount, payTo, maxTimeoutSeconds, extra}`, `PaymentRequired {x402Version, error?, resource, accepts[], extensions?}`, `PaymentPayload {x402Version, resource?, accepted, payload, extensions?}`, `VerifyResponse {isValid, invalidReason?, payer?}`, `SettleResponse {success, errorReason?, payer?, transaction, network, amount?, extra?}`, `SchemeNetworkFacilitator {scheme, caipFamily, getExtra(network), getSigners(network), verify(payload, requirements), settle(payload, requirements)}`, `SchemeNetworkClient {scheme, createPaymentPayload(x402Version, requirements)}`.
- `@x402/core/facilitator`: `new x402Facilitator().register(network, scheme)`, `.verify`, `.settle`, `.getSupported()`.
- `@x402/core/client`: `new x402Client().register(network, scheme)`, `.setSpendControls({ allowedAssets: [{ network, asset, maxAmountPerPayment }] })`, `.createPaymentPayload(paymentRequired)`; `new x402HTTPClient(client).encodePaymentSignatureHeader(payload)` → `{ 'PAYMENT-SIGNATURE': … }`.
- `@x402/core/server`: `HTTPFacilitatorClient({ url, createAuthHeaders })` with `.verify`, `.settle`, `.getSupported`; `createAuthHeaders` returns header maps for `verify`, `settle`, `supported`.
- `@x402/core/http`: `encodePaymentRequiredHeader`, `decodePaymentRequiredHeader`, `decodePaymentSignatureHeader`, `encodePaymentResponseHeader`, `decodePaymentResponseHeader`. Headers `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, `PAYMENT-RESPONSE` (lower case on the wire; look up case-insensitively). v2 field names only (`amount`, never `maxAmountRequired`; never `X-PAYMENT`).
- **Gotcha:** `x402Client` spend controls are on by default and allow only "default assets" up to $1. Set `allowedAssets` for the token (this is also the mandate: at most 6 per payment, only this token).

**Requirement** the shop returns: `{ scheme: "graphpay-order", network: "eip155:1874", asset: <token>, amount: String(amountMicro), payTo: merchant, maxTimeoutSeconds: 600, extra: { contract, order: WireOrder, shopName, mandateRequired: true } }`. `WireOrder` = `Order` with numbers as decimal strings. Exactly one entry in `accepts`.

**Payload** (`PaymentPayload.payload`): `{ order, mandateHash, payerName, payer, permit: { token, amount, nonce, deadline }, signature, approvalPermit }`.

**Facilitator pipeline** (`verify`; `settle` repeats it and runs one at a time through a queue). The relayer pays gas for every transaction, and the contract records payment problems as events instead of reverting, so a sloppy facilitator pays to publish garbage. Order of defence:
1. **Schema and terms (free):** zod-parse the payload (lengths capped); scheme and network; asset and permit token == the configured token (never USDT.e); `extra.contract` is ours; `payTo` is on the merchant allow-list; `payTo == order.merchant`; `amount == order.amountMicro == permit.amount`; the payload's order equals the requirement's; deadlines not passed; if `payerNode != 0`, `namehash(payerName) == payerNode`.
2. **The payer's signature, before anything costly:** local `recoverTypedDataAddress` for a 65-byte signature (no RPC); `verifyTypedData` (ERC-1271) only for other lengths; refuse ERC-6492 wrapped signatures. Only now is the payer proven; limits key on it. Then `ensGate(payerName, amount)` must be ok with the same node; a refusal is an off-chain refusal record.
3. **On-chain reads that predict the outcome:** order status NONE, or CREATED with the same `termsHash`; Permit2 nonce bit unused (`nonceBitmap`); token balance and allowance (an included EIP-2612 approval counts only if it will really apply: value ≥ amount, deadline in the future, signature valid against `nonces(payer)`); the AgentPolicy rules (`nodeOfWallet`, `policies`, `spentToday`).
4. **Send** only if all pass. A predicted policy failure (cap, revoked, expired) is refused off-chain, except a daily quota (`RECORDED_FAILURES_PER_DAY`, 20) sent on purpose so the failure is recorded on-chain for the reputation graph. `NODE_MISMATCH` is **never** sent (it would write failures against someone else's name). Garbage, duplicates, bad signatures, used nonces and empty balances are never sent.
5. **Limits at send time** (checked first, consumed only when everything passed): global, per verified payer (10/min), per payee (30/min); queue depth 20 (`busy`); gas estimate ≤ `MAX_SETTLE_GAS` (450,000); a daily gas budget reserved before sending and corrected from the receipt; a relayer-balance floor; a receipt timeout. Send gas as `min(cap, max(1.2 × estimate, 400k))` (`estimateGas` can undershoot because of the try/catch around the pull). `settle` decides from the receipt: `PaymentSettled` → success; `PaymentFailed` → `success:false` with `errorReason` = the FailReason name and the tx hash.

**Refusal record** (sent to the recorder route `/api/recorder/attempts`, which writes it to Arkiv as an off-chain `fail` edge from W_SYNC; the mirror folds it into the tallies, `SPEC/INTEGRATION_AND_MIRROR.md` §2): `{ onchain: false, status: 'rejected', reason, orderId, payerName, payerNode, amountMicro, at }`. Attribute it to a node only when `nodeOfWallet(payer) == node`; otherwise anyone could plant refusals in another agent's history.

**Start-up checks** (refuse to start, or answer 503 and retry): `eth_chainId == 1874`; `checkout.USDT()` == the configured token; the configured EIP-712 domain hashes to the token's `DOMAIN_SEPARATOR()`; the ENS RPC is chain 11155111; never the ENS stub on a real network; `ALLOW_REAL_NETWORK=1` required for a non-loopback RPC (exact host match); never print a start-up RPC error (viem's message contains the URL and any key in it).

**HTTP:** bearer token on `/verify` and `/settle` (constant-time compare; at least 24 characters); 64 KB body limit enforced on the bytes read; 429 on rate limits; `/health` cached 5 s (signer, WBT balance, budget); `/supported` free.

## 6. Shop API

- `GET /catalog?shop=` → synthetic catalog `{ item, unitPriceMicro, stock, etaMinutes, distanceKm }[]`, labelled synthetic.
- `GET /quote?shop&item&qty&buyer&payer&wallet` → `{ quote, order, payUrl, asset, network, synthetic: true }`. Free. Price = catalog `unitPriceMicro × qty`, never from the request.
- `POST /orders/:id/pay` (body = the quote terms). Needs header `X-Demo-Passcode` (the endpoint makes the relayer pay gas). Without `PAYMENT-SIGNATURE`: **402** with `PAYMENT-REQUIRED` and the same JSON body. With it: if the order is already PAID or DELIVERED on-chain → 200 `alreadyPaid` (no money moves); else `/verify` then `/settle`; success → 200 `{ status: 'paid', orderId, transaction, delivery }` + `PAYMENT-RESPONSE`, then the merchant may `markDelivered` (`delivery` = `delivered`, `pending`, or `not_configured`); facilitator outage → 502 (retry is safe); failure → 402 with the reason and `PAYMENT-RESPONSE` (`success:false`).
- `POST /orders/:id/reorder` (`:id` = parent order id): same, with `parentOrderId` and `kind = 1`.
- **Stateless:** `orderId = keccak256(abi.encode(shopNode, buyerNode, payerNode, payerWallet, item, qty, exp, parentOrZero))` (with the top bit cleared, §3.6); the id must match the terms in the body; quotes expire and a client-echoed `exp` is clamped to `now + ttl`; a human payer must give a wallet address. No database: the chain is the record.
- The x402 `resource.url` must be the agent-facing absolute URL, so the payer's spend controls can check the host.
- Not built in the lab: `/.well-known/ucp`, `/.well-known/agent-card.json`, payment links, webhooks, `@x402/hono` middleware (needs a custom `SchemeNetworkServer`: `parsePrice`, `paymentFlows`, `defaultAssetTransferMethod`).

## 7. Deploy and verify (real Whitechain Sepolia)

1. Fund roles from FUNDER (`WALLETS.md` §3). Deploy from DEPLOYER with a script that reads the key in-process; never put a key on a command line.
2. Before deploying the checkout, check the token: code present, 6 decimals, symbol, and `DOMAIN_SEPARATOR()` equal to the domain clients will sign. Record a **pending deployment** (predicted address and nonce) before sending, so a timeout never causes a second deploy. Checksum `contractAddress` (viem returns it lower case).
3. Verify on Blockscout:

```bash
forge verify-contract <ADDR> src/GraphPayCheckout.sol:GraphPayCheckout --rpc-url https://rpc.testnet.whitechain.io/ --verifier blockscout --verifier-url https://explorer.testnet.whitechain.io/api/ --compiler-version 0.8.30 --evm-version prague --num-of-optimizations 200 --via-ir --constructor-args $(cast abi-encode "constructor(address,address,address,address,address)" $TOKEN $PERMIT2 $ADMIN $RELAYER $POLICY_WRITER) --watch
```

The verifier URL must end in `/api/`. Expect "verified", not "fully verified": the build carries no metadata hash, so it is a partial match; source and ABI are published. Fallback: Blockscout "Verify & publish" with Standard JSON input (untested). `--broadcast` is required for `forge create` in Foundry 1.9.
4. Merchant: `token.approve(checkout, cap)` once, bounded, for refund liquidity. Policy writer: `setPolicy` per agent node (epoch and wallet from ENS).
5. First real payment, then record its `PaymentSettled` explorer link `https://explorer.testnet.whitechain.io/tx/<hash>` in the README.

**Stand-in token (ADR-0022).** Until test USDT is obtained, deploy a labelled ERC-20 named `gpUSD TEST stand-in (not USDT)`, symbol `gpUSD-TEST`, 6 decimals, owner-mintable, with EIP-2612 (packed-bytes and v,r,s with ERC-1271 owners, like Tether), EIP-3009, `Ownable2Step`, no `eip712Domain()`. Deploy a second checkout for it. The token is one switch (`--token usdt|standin`) for every script and service. Every record from the stand-in checkout says "stand-in" on screen and never counts as USDT. The lab's EIP-3009 parity suite showed the stand-in and the real test USDT accept the same digests (on a fork).

## 8. Hosting on Vercel

The lab hosted the shop API and the facilitator as Next.js route handlers on Vercel (Node runtime, Fluid compute), real chain, behind a passcode.

| path | gate |
|---|---|
| `GET /api/shop/health`, `/api/shop/catalog`, `/api/shop/quote` | free |
| `POST /api/shop/orders/:id/pay`, `/orders/:id/reorder` | `X-Demo-Passcode` |
| `GET /api/facilitator/health`, `/supported` | free |
| `POST /api/facilitator/verify`, `/settle` | `Authorization: Bearer <FACILITATOR_AUTH_TOKEN>`; only the shop calls them |

- Every answer `cache-control: no-store`. Errors are logged as one redacted line and answered `{"error":"internal error"}`.
- The hosted config is stricter than local: always `ALLOW_REAL_NETWORK=1`, https RPC, passcode and token at least 24 characters, merchant allow-list, no ENS stub.
- Limits and their scope:

| limit | value | scope |
|---|---|---|
| `MAX_SETTLE_GAS` | 450,000 (heaviest real settle 312,024) | per transaction |
| `RECORDED_FAILURES_PER_DAY` | 20 | per instance (in memory) |
| `GAS_BUDGET_DAILY_WBT` | 0.05 | per instance |
| `MIN_RELAYER_BALANCE_WBT` | 0.3 (refuse once the relayer is down to it) | global (reads the chain) |
| facilitator rate limit | 60/min, one shared bucket (no socket address on Vercel) | per instance |
| `RECEIPT_TIMEOUT_MS` | 30,000; facilitator route `maxDuration` 60 s, shop route 120 s | per request |
| agent spend cap | 6.00 per UTC day for `payer.vitalik` and `acceptance.vitalik`; 30.00 for `rehearsal.vitalik` (the M3 part B lifecycle plus several rehearsals in one UTC day); rehearsals never spend the stage payer's cap | on-chain, global |

- **Fluid compute runs several instances** with their own counters, and an instance restarts with fresh ones. The on-chain caps and the relayer-balance floor are the deployment-wide bounds.
- **Nonce clashes:** two instances, or a local script using the same relayer key, can pick the same nonce; one send fails or replaces the other; no order is paid twice (order id and Permit2 nonce are enforced on-chain). Give scheduled jobs (renewals) their own relayer key (E-1). Never run local scripts with the hosted relayer key during the demo.
- Deploy only commits that are on `origin/main`; upload the commit as committed; pin the Vercel project id; push secrets as Sensitive values on stdin.
- The payment client for the public URL calls only the production domain and follows no redirect (`redirect: 'error'`).

## 9. Environment variables (names only)

| service | variables |
|---|---|
| facilitator | `WHITECHAIN_RPC_URL`, `ALLOW_REAL_NETWORK`, `FACILITATOR_PRIVATE_KEY`, `GRAPHPAY_CONTRACT`, `FACILITATOR_AUTH_TOKEN`, `ALLOWED_MERCHANTS`, `MAX_SETTLE_GAS`, `GAS_BUDGET_DAILY_WBT`, `MIN_RELAYER_BALANCE_WBT`, `RECORDED_FAILURES_PER_DAY`, `RECEIPT_TIMEOUT_MS`, `GRAPHPAY_TOKEN`, `GRAPHPAY_TOKEN_NAME`, `GRAPHPAY_TOKEN_VERSION`, `GRAPHPAY_ROOT_ENS`, `SEPOLIA_RPC_URL`, `ENS_ALLOWED_ROOTS`, `ENS_GATE_TTL_MS` (20000), `ATTEMPTS_URL` (the recorder route), `RECORDER_TOKEN` |
| shop API | `GRAPHPAY_CONTRACT`, `SHOP_MERCHANTS` (JSON label → address), `SHOP_KESAR_PRIVATE_KEY`, `SHOP_JAMUN_PRIVATE_KEY`, `SHOP_SYRUP_PRIVATE_KEY` (optional, delivery and refunds), `FACILITATOR_URL`, `FACILITATOR_AUTH_TOKEN`, `DEMO_PASSCODE`, `WHITECHAIN_RPC_URL`, `ALLOW_REAL_NETWORK`, `GRAPHPAY_TOKEN*` (must equal the facilitator's) |
| renewer (Vercel cron `/api/cron/renew`) | `RENEWER_PRIVATE_KEY`, `CRON_SECRET`, `WHITECHAIN_RPC_URL`, `GRAPHPAY_CONTRACT`, `ALLOW_REAL_NETWORK` |
| scripts | `DEPLOYER_PRIVATE_KEY`, `POLICY_WRITER_PRIVATE_KEY`, `RENEWER_PRIVATE_KEY` (second relayer, E-1), `FUNDER_PRIVATE_KEY`, `WHITECHAIN_RPC_URL` |

## 10. Pitfalls (each cost the lab time)

1. A 300k settle cap refuses the first payment (about 312k–334k). Use 450k.
2. `x402Client` spend controls deny non-default assets ("All payment requirements were rejected by spendControls"). Set `allowedAssets`.
3. Policy bypass via `payerNode = 0` without the wallet binding.
4. `PermitSingle` binds no payee, amount or period: the subscriber must sign `Subscribe`.
5. Pin the permit's token to the configured token in the contract: Permit2 binds the token in the signature, not our witness.
6. Failures cost gas and do not revert; `estimateGas` and `eth_call` succeed for them. Verify and predict before sending.
7. Approval permits are applied after the policy; a retry must resend `approvalPermit`.
8. Refunds need the merchant's allowance and balance; pre-check in the merchant screen.
9. EIP-681 QR codes bypass the contract (plain transfer). Use an HTTPS link.
10. Foundry with `via_ir`: `block.timestamp` read in test code can be stale after `vm.warp`; use `vm.getBlockTimestamp()` everywhere in tests. `vm.prank` is consumed by the next call, including a view call inside the argument list.
11. Keep `via_ir = true` (stack too deep without it) and pass `--via-ir` when verifying.
12. `catch` swallows out-of-gas in the callee; the 150k gas guard turns a starved call into a revert.
13. Test USDT is a proxy: its permit domain uses the proxy address and version "1".
14. Public RPC limit 50 req/s: pinned-block fork tests, WebSocket for logs, no load tests against it.
15. The token was hard-coded once (address and EIP-712 name): a stand-in then fails `wrong_asset` or, worse, signs its approval under the wrong domain. Make the token configuration and check it at start-up.
16. Over the cap is refused **off-chain** by the real ENS gate (`CAP_EXCEEDED`); only failures the gate lets through (a revoked or expired on-chain policy) reach the chain. A revoked-agent beat needs an ENS-active name whose on-chain policy is revoked.
17. A successful renewal costs about 200k gas, not the 81k a fork median suggested. Budget from real receipts.
18. `--import tsx` resolves from the working directory: run TypeScript entry points from the package that owns `tsx`.
19. Contract libraries are git-ignored: a fresh worktree needs the dependency install before `forge build` (about 25 s).
20. A wallet generator that creates every missing role will mint new keys for roles whose real keys live elsewhere. Generate one role at a time.
