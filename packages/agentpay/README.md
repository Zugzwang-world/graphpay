# @graphpay/agentpay

A two-sided SDK for agentic stablecoin payments on Whitechain. A customer agent pays any merchant route that answers HTTP 402, with **one signature and no gas**, under an **on-chain spending pass**. A merchant prices any route or product, settles through a facilitator and is paid in USDT. Food, shopping and rides use the same order model.

- **Pay:** the payer signs a Permit2 witness over the order (payee, amount, deadline and order id are inside the signature), plus a bounded EIP-2612 approval the first time. The facilitator pays the gas; it cannot redirect or change the payment.
- **Spending pass:** `GraphPayCheckout` holds each agent's pass on-chain (the wallet it may pay from, a daily cap, an expiry, a revoke switch) and checks it at settlement. The SDK checks the same pass, plus week and month caps, a per-payment maximum, a merchant allowlist and the human's mandate, **in code, before it signs**.
- **Merchant:** stateless middleware for Fetch (Next.js), Express and `node:http`; events for `paid`, `refund.requested` and `renewal.charged`; refunds, delivery marks, subscriptions and a CSV export read from the chain.
- **AI tools:** the same actions as AI SDK tools and MCP tools. No tool takes a cap, an allowlist or a budget as input.
- **Plug-ins, not dependencies:** identity and reputation come in through two interfaces, `IdentityResolver` and `ReputationProvider`. The SDK imports no identity or memory system.

Status: **V1, testnets only** (Whitechain Sepolia, chain 1874). It is not published to npm yet. All story names and amounts in the examples are synthetic.

## Quickstart: merchant

```js
import { createMerchant, httpFacilitator } from '@graphpay/agentpay';

const merchant = createMerchant({
  name: 'my-shop.example.eth',          // the merchant's name; its namehash is the shop node on-chain
  address: payoutAddress,               // receives USDT
  facilitator: httpFacilitator({ url: FACILITATOR_URL, authToken: process.env.FACILITATOR_AUTH_TOKEN }),
  publicClient,                         // a viem public client on Whitechain Sepolia
});

// Next.js App Router: app/api/box/route.js
export const GET = merchant.route(
  () => ({ items: [{ sku: 'box-12', name: 'box of 12', unitPriceMicro: 4_800_000 }], fulfilment: { type: 'delivery' } }),
  (_req, { order }) => ({ status: 'preparing', orderId: order.orderId }),
);

merchant.on('paid', ({ order, explorer }) => console.log('paid', order.orderId, explorer));
merchant.on('refund.requested', ({ orderId, amountMicro, reason }) => { /* decide, then merchant.refund(...) */ });
```

Express: `app.get('/box', merchant.express(pricer), (req, res) => res.json(req.agentpay.order))`. Plain Node: `http.createServer(merchant.node(pricer, handler))`.

The pricer is the merchant's own: on the paid retry the SDK re-prices the request and rebuilds the order id, so a buyer can never sign a cheaper order and have it accepted.

## Quickstart: buyer

```js
import { createBuyerAgent, createMandate, usdt } from '@graphpay/agentpay';

const buyer = createBuyerAgent({
  account,                              // a viem local account; the key never leaves it
  publicClient,
  name: 'errands.alice.example.eth',    // the agent's name: its node holds the on-chain pass
  pass: { capMicro: usdt('20'), period: 'week', perPaymentMaxMicro: usdt('6'), merchants: ['my-shop.example.eth'] },
  mandate: createMandate({ buyer: 'alice.example.eth', request: 'sweets under 6 USDT by 8 pm', budgetMicro: usdt('6'), deadlineMs }),
});

const r = await buyer.pay('https://my-shop.example/api/box');   // 402 → guards → one signature → paid
// r.status: 'paid' | 'failed' | 'unknown'; r.orderId, r.transaction, r.response
```

`unknown` means the payment may still settle (a timeout, a 5xx). The amount stays reserved, and calling `pay()` again with the same request re-sends **the same signature for the same order** instead of quoting a new one, so a stalled payment can never be paid twice. A definite refusal releases the reservation; either way the buyer reads the order's status on-chain before it decides.

A guard that refuses throws `AgentPayError` with a `code` (`OVER_DAILY_CAP`, `OVER_PERIOD_CAP`, `MERCHANT_NOT_ALLOWED`, `OVER_BUDGET`, `PASS_REVOKED`, `WRONG_CHAIN`, …) before anything is signed.

The agent's on-chain pass is written once by whoever holds the checkout's policy-writer key:

```js
await issueSpendingPass({ walletClient: policyWriter, publicClient, network, name: 'errands.alice.example.eth', wallet: account.address, dailyCapMicro: usdt('6') });
```

## Quickstart: AI agents

```js
import { buyerTools, merchantTools, createAgentPayMcpServer } from '@graphpay/agentpay';

const tools = buyerTools(buyer, { allowedOrigins: ['https://my-shop.example'] });   // AI SDK 7 tools
// agentpay_pass_status, agentpay_quote, agentpay_pay, agentpay_request_refund, agentpay_subscribe, agentpay_cancel

const shopTools = merchantTools(merchant, { catalog: { 'box-12': { name: 'box of 12', unitPriceMicro: 4_800_000 } } });
// agentpay_quote (prices from the catalog only), agentpay_accept (after riskCheck),
// agentpay_refund (only when the merchant has maxRefundMicro, set by a person; capped at what is left)

const mcp = createAgentPayMcpServer({ buyer });   // the same tools over MCP
```

The model proposes, code disposes: a tool can only ask to pay *less* (`maxUsdt`); a refusal comes back as `{ ok: false, code, message }`. Any other error comes back as its name only, and URLs are removed from messages, so an RPC error can never show a keyed URL to a model.

## Examples

Two examples of about 20 lines each, on the same SDK, with names and prices from the story config:

- [`examples/agentpay-sweets`](../../examples/agentpay-sweets/index.mjs): a sweet shop sells a box to a customer agent.
- [`examples/agentpay-ride`](../../examples/agentpay-ride/index.mjs): a fixed-fare cab ride, `fulfilment: { type: 'ride', details: { pickup, dropoff, vehicle } }`.

Both run end to end on an anvil fork of Whitechain Sepolia against the deployed checkout, the real test USDT and Permit2: `pnpm --filter @graphpay/agentpay test:fork`.

On the real Whitechain Sepolia, the sweet-shop example made one labelled test payment of 0.01 test USDT, with one signature and no gas for the agent: [the settlement](https://explorer.testnet.whitechain.io/tx/0xfbd7d307b1b0c08f3af015b4bdb03aaeed12d0c2d18c2553432cb4679ff14c7e) (`examples/agentpay-sweets/real.mjs`, dry run unless `--yes`).

## API reference

### Network

| export | what |
|---|---|
| `whitechainNetwork(overrides?)` | chain id, checkout, token (USDT, 6 decimals), Permit2 and explorer, from `@graphpay/config`. Refuses any chain but Whitechain Sepolia, a token on the never-use list, or a token without 6 decimals |
| `assertChain(publicClient, network)` | `eth_chainId` check; every signer and sender calls it first |
| `usdt('4.80')` → `4800000n`, `formatUsdt(4800000n)` → `'4.80'` | amounts are bigint micro-USDT everywhere |
| `AgentPayError` | `code`, `message`, `details` |

### Order model

`createOrder({ merchant: { name, address }, payer?: { name?, address? }, buyer?: { name }, items: [{ sku, name, quantity, unitPriceMicro }], fulfilment: { type, details }, deadline, parentOrderId?, salt? })`

- `fulfilment.type`: `delivery`, `pickup`, `ride`, `digital` or `service`; `details` is a small JSON object (at most 2 KB, 3 levels).
- **Fixed price only (V1):** the total is the sum of the lines; a stated `totalMicro` must equal it. Variable fares (pre-authorise a ceiling, capture the final amount) are V2.
- The order id is `keccak256(abi.encode(shopNode, merchant, buyerNode, payerNode, payerWallet, detailsHash, deadline, parentOrderId, salt))` with the top bit cleared (renewal ids keep their own id space). `detailsHash` covers items, total and fulfilment. Both sides derive it from public data.
- `order.chain` is the `GraphPayCheckout` `Order` struct. A `parentOrderId` makes it a re-order (`kind = 1`). A payer with no name is a human (`payerNode = 0`).

### Wire (`graphpay-order` x402 scheme)

x402 v2 headers `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, `PAYMENT-RESPONSE` (base64 JSON). Exactly one requirement `{ scheme: 'graphpay-order', network: 'eip155:1874', asset, amount, payTo, maxTimeoutSeconds, extra: { contract, order, shopName, mandateRequired: true } }`, field for field the scheme of `planning/SPEC/PAYMENTS_WHITECHAIN.md` §5, so any graphpay-order facilitator settles it. The order's details travel in `extensions.agentpay` and are echoed by the payer. A payer identifies itself with `x-agentpay-payer` (wallet) and `x-agentpay-payer-name` on its first request, so the order is built for it.

Helpers: `buildRequirement`, `buildPaymentRequired`, `orderOfPaymentRequired` (re-derives the order from the details and checks the requirement against it), `encodeHeader`, `decodeHeader`, and the zod schemas.

### Buyer

`createBuyerAgent({ account, publicClient, network?, name?, buyerName?, pass, mandate?, identity?, reputation?, approvalMicro?, fetch?, clock?, onEvent? })`

| method | what |
|---|---|
| `pay(url, init?)` | answers a 402: guards, one signature, the paid retry. `init.maxMicro` can only lower the limit; a body must be a string. After an `unknown` result, the same call re-sends the same signature |
| `quote(url)` | reads the 402 without signing |
| `check(order)` | runs every guard (throws `AgentPayError`) |
| `passStatus()` | the on-chain pass, spend this period and what is left |
| `requestRefund({ url, orderId, amountMicro, reason })` | a refund request signed by the payer (EIP-712 `RefundRequest`); the merchant decides |
| `subscribe({ url, maxMicro? })` | reads the plan offer, checks one charge like a payment, signs `Subscribe` and a bounded Permit2 `PermitSingle` (amount × maxCycles) |
| `cancel({ url, subId })` | signs `Cancel`; the merchant's facilitator sends `cancelWithSig` (gasless) |

Guards, in order: chain id; the order is for this payer and buyer and not expired; merchant allowlist; per-payment and caller maximum; mandate deadline, merchants and budget; the identity resolver vouches for the payee (optional); the merchant is not rated high risk (optional); the on-chain pass exists, binds this wallet, is not revoked or expired, and the payment fits today's cap; the week or month cap, summed from the contract's own per-day spend; the order is not already paid. One payment at a time per agent.

Spending pass: `issueSpendingPass`, `revokeSpendingPass`, `readSpendingPass`, `spentInPeriod`. On-chain, the pass has a daily cap (UTC days), an expiry and a revoke switch; week and month caps and the merchant allowlist are checked by the SDK (the signature binds the merchant, so no relayer can redirect a payment the allowlist let through). An on-chain allowlist and other on-chain periods need a contract change (V2).

### Merchant

`createMerchant({ name, address, facilitator, publicClient, walletClient?, network?, riskCheck?, authorize?, identity?, reputation?, quoteTtlSeconds?, maxRefundMicro?, resourceBase?, clock?, log? })`

`authorize(request)` → boolean gates every request that makes the facilitator spend gas (a paid retry, a subscription, a cancel); GraphPay's hosted routes use it for their passcode. Compare a passcode or token in constant time (`crypto.timingSafeEqual` on hashes); the SDK cannot check how the hook compares. A settlement the facilitator could not confirm (`pending`, `in_flight`, a timeout) is answered 502, never 402, so the payer re-sends the same signature.

| method | what |
|---|---|
| `route(pricer, handler)` | a Fetch route handler (Next.js App Router and any Fetch server) |
| `express(pricer)` | Express middleware; a paid request continues with `req.agentpay = { order, settlement }` |
| `node(pricer, handler)` | a `node:http` listener |
| `charge(request, pricer)` | the core, for other frameworks: `{ paid, order, settlement }` or `{ response }` |
| `order(...)` | an order of this merchant's (used by the quote tool) |
| `refund(orderId, amountMicro, { reasonCode })` | merchant → payer, capped at what is left and at `maxRefundMicro`; needs the merchant's key, WBT for gas and a USDT float approved to the checkout |
| `deliver(orderId)`, `accept(orderId)` | `markDelivered`; accept a paid order after `riskCheck` |
| `refundRequests()` | POST endpoint for signed refund requests; checks the signer paid the order; emits `refund.requested` |
| `subscriptions(plan)`, `cancellations()` | the plan offer (GET) and signed subscription (POST); signed cancels |
| `chargeDueRenewals()`, `watchRenewals()` | renew what is due through the facilitator; watch the chain for renewals charged by any relayer |
| `exportCsv({ fromBlock?, toBlock? })` | every order of this merchant from the chain logs: status, amount, refunds, payer, transactions, explorer links (no spreadsheet formulas) |
| `on(event, fn)` | `paid`, `payment.failed`, `refund.requested`, `refunded`, `accepted`, `delivered`, `subscribed`, `renewal.charged`, `cancelled` |

`riskCheck(ctx)` → `{ allow, reason? }` runs before settlement and in `accept`. The default allows, unless the `ReputationProvider` rates the payer high risk.

### Facilitator

The interface: `verify(paymentPayload, requirements)`, `settle(paymentPayload, requirements)`, optional `supported()`, `subscribe()`, `renew(subId)`, `cancelSubscription()`.

- `httpFacilitator({ url, authToken })`: the x402 facilitator HTTP API (`POST /verify`, `POST /settle`, `GET /supported`, bearer token), https only. This is the adapter for GraphPay's own facilitator.
- `inProcessFacilitator(f)`: any object with `verify` and `settle` (an `x402Facilitator` with the graphpay-order scheme registered).
- Both adapters are tested against GraphPay's own facilitator (`@graphpay/facilitator`) on an anvil fork: `test-fork/t1-facilitator.test.mjs`.
- `createReferenceRelayer({ walletClient, publicClient, allowedMerchants, limits?, identity? })`: a small relayer for tests and small deployments. It checks the payload for free, recovers the signature locally, predicts the on-chain outcome (order status, Permit2 nonce, balance, allowance or approval, the pass), and sends only what will settle, one transaction at a time. Anti-drain limits (`RELAYER_DEFAULTS`): a relayer balance floor (0.1 WBT), a per-order cap (10.00), an hourly cap on count (30) and value (50.00), a per-payer rate (10 a minute) and a gas ceiling per transaction (450,000 for a settlement; the heaviest measured is 312,024).

### Interfaces

```ts
interface IdentityResolver {
  resolve(name): Promise<{ name, node, address } | null>;
  verifyMerchant?({ name, node, address }): Promise<boolean>;   // buyer: is this payee that merchant?
  verifyPayer?({ name, node, address }): Promise<boolean>;      // relayer: is this wallet that agent?
}
interface ReputationProvider {
  assess({ subject: 'buyer' | 'merchant', name, node, address }): Promise<{ risk: 'low' | 'medium' | 'high', score?, reasons?, source? }>;
}
```

`staticIdentity([...])` and `staticReputation({...})` are fixed tables for tests and closed deployments.

## How GraphPay uses it

GraphPay ("ask before you pay") is one deployment of this SDK; AgentPay itself stays the Whitechain payments lane and imports none of GraphPay's identity or memory packages.

- **Pay (Whitechain):** GraphPay's checkout is the deployed `GraphPayCheckout`, its addresses come from `@graphpay/config`, and its own facilitator serves the same graphpay-order scheme, reached through `httpFacilitator`.
- **Identify (ENS):** GraphPay plugs its ENS names in as the `IdentityResolver`: agents and shops are names under `graphpay.eth`, the shop's node is the merchant node on-chain, and the payee is read from ENS at pay time.
- **Remember (Arkiv):** GraphPay plugs its money graph on Arkiv in as the `ReputationProvider`: before it pays, a buyer agent asks the graph about the shop (refund rate, on-time rate), and a shop's risk check asks about the buyer. Every payment the SDK settles is a `GraphPayCheckout` event, which GraphPay's mirror writes to the money graph.
- **Stop (kill switch):** the on-chain spending pass is GraphPay's AgentPolicy; pausing an agent revokes the pass, and both the SDK's guards and the contract refuse it.

## Limits of V1

- Fixed-price orders only; pre-authorisation for variable fares is V2.
- On-chain caps are per UTC day; week and month caps and the merchant allowlist are SDK-side.
- The reference relayer's counters live in its process; the on-chain caps and the balance floor are the deployment-wide bounds.
- Refund requests, the mandate ledger and pending payments are in memory; the chain holds every payment and refund.
- A human payer has no on-chain pass, so its period cap is kept in process memory only (advisory).
- Week and month caps sum the pass's current epoch: re-issuing a pass at a new epoch starts a fresh history, as the contract does.
- Not published to npm yet.
