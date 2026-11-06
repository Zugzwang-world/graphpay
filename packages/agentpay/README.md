# @graphpay_ethglobal/agentpay

A two-sided SDK for agentic USDT payments on Whitechain. A customer agent pays any merchant route that answers HTTP 402 with **one signature and no gas**, under an **on-chain spending pass**. A merchant prices any route or product, settles through a facilitator and is paid in USDT. Food, shopping and rides use the same order model.

- **Pay:** the payer signs a Permit2 witness over the order (payee, amount, deadline and order id are inside the signature), plus a bounded EIP-2612 approval the first time. The relayer pays the gas; it cannot redirect or change the payment.
- **Spending pass:** the `GraphPayCheckout` contract holds each agent's pass on-chain (the wallet it may pay from, a daily cap, an expiry, a revoke switch) and checks it at settlement. The SDK checks the same pass, plus week and month caps, a per-payment maximum, a merchant allowlist and the human's mandate, **in code, before it signs**.
- **Merchant:** stateless middleware for Fetch (Next.js), Express and `node:http`; events for `paid`, `refund.requested` and `renewal.charged`; refunds, delivery marks, subscriptions and a CSV export read from the chain.
- **AI tools:** the same actions as AI SDK tools and MCP tools. No tool takes a cap, an allowlist or a budget as input.
- **Plug-ins, not dependencies:** identity and reputation come in through two interfaces, `IdentityResolver` and `ReputationProvider`.

**Status: V1, testnet only.** The SDK refuses every chain but Whitechain Sepolia (1874), when a client is created and again before every signature and send. Fixed-price orders only; pre-authorising a variable fare is V2. Version 0.1.0.

## Quickstart (5 minutes, no wallet and no faucet)

You need Node 22 and [Foundry](https://getfoundry.sh) (`anvil`). The sandbox starts a local fork of Whitechain Sepolia, deploys **your own** checkout on it, and makes a relayer, a merchant and a buyer with fresh keys. Nothing touches the real chain and you spend nothing.

```bash
mkdir agentpay-try && cd agentpay-try && npm init -y && npm pkg set type=module
npm install @graphpay_ethglobal/agentpay viem
cp node_modules/@graphpay_ethglobal/agentpay/examples/sweets.mjs .      # or paste the code below into sweets.mjs
node sweets.mjs
```

It prints the shop's `paid` event and the agent's `paid 4800000n micro-USDT`. The whole example:

```js
import { createBuyerAgent, createMerchant, createReferenceRelayer, issueSpendingPass, usdt } from '@graphpay_ethglobal/agentpay';
import { startSandbox } from '@graphpay_ethglobal/agentpay/sandbox';

const sb = await startSandbox();                       // anvil fork + your own checkout + fresh keys
const { network, publicClient, accounts, wallet } = sb;

// The shop: one priced route, settled by YOUR relayer (anti-drain limits are on by default).
const relayer = createReferenceRelayer({ walletClient: wallet(accounts.relayer), publicClient, network, allowedMerchants: [accounts.merchant.address] });
const shop = createMerchant({ name: 'corner-sweets.example', address: accounts.merchant.address, facilitator: relayer, publicClient, network });
const route = shop.route(
  () => ({ items: [{ sku: 'box-12', name: 'box of 12 sweets', unitPriceMicro: usdt('4.80') }], fulfilment: { type: 'delivery' } }),
  (_req, { order }) => ({ status: 'preparing', orderId: order.orderId }),
);

// The spending pass, written once by the policy writer: this wallet may spend up to 6 USDT a day.
await issueSpendingPass({ walletClient: wallet(accounts.policyWriter), publicClient, network, name: 'errands.sam.example', wallet: accounts.buyer.address, dailyCapMicro: usdt('6') });

// The customer agent holds no gas. One signature pays the 402.
const agent = createBuyerAgent({
  account: accounts.buyer, publicClient, network, name: 'errands.sam.example',
  pass: { capMicro: usdt('6'), period: 'day', merchants: ['corner-sweets.example'] },
  fetch: (url, init) => route(new Request(url, init)),   // straight to the shop's handler; use the default fetch for a real URL
});
const result = await agent.pay('https://corner-sweets.example/box');
console.log(result.status, result.amountMicro);          // 'paid' 4800000n
sb.stop();
```

The second example, [`examples/cab.mjs`](examples/cab.mjs), is a **fixed-fare cab ride**: the same SDK with `fulfilment: { type: 'ride', details: { pickup, dropoff, vehicle } }` and a one-fare `perPaymentMaxMicro` on the rider's pass.

## Safety: what this package never does for you

- **Whitechain Sepolia (chain 1874) only.** `whitechainNetwork()` throws for any other chain id, `createBuyerAgent`, `createMerchant` and `createReferenceRelayer` refuse a viem client that names another chain, and every signature and every send is preceded by `eth_chainId`, which must answer 1874. There is no mainnet mode.
- **No hosted service by default.** The SDK has no URL for any GraphPay facilitator or relayer. `createMerchant` needs a facilitator you pass in, and the reference relayer runs with **your** relayer key, so nobody else spends your gas and you cannot spend ours.
- **Anti-drain limits, always on.** The reference relayer starts with a balance floor (0.1 WBT), a per-order cap (10.00 USDT), an hourly cap on count (30) and on value (50.00 USDT), a per-payer rate (10 a minute), a gas ceiling per transaction and one transaction at a time (`RELAYER_DEFAULTS`). You may set a limit to another finite number above zero; `0`, `undefined`, `NaN`, `Infinity` and unknown names are refused, so a limit cannot be switched off by accident. It also needs a merchant allowlist.
- **Keys stay yours.** The SDK reads no environment variable and logs no key or URL. Read your relayer key from your own secret store and pass a viem account in. A buyer's key never leaves its viem account, and no AI tool takes a cap, allowlist or budget as input.

## Using it on the real Whitechain Sepolia

The `GraphPayCheckout` that GraphPay deployed for its own demo lets only its own relayers settle, so **it is not yours to use**: pointing your relayer at it fails with `NotRelayer`. Deploy your own checkout (the same verified contract) with your own funded key, and name your own relayer and policy writer:

```js
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { deployCheckout, createReferenceRelayer, issueSpendingPass, usdt } from '@graphpay_ethglobal/agentpay';

const chain = { id: 1874, name: 'Whitechain Sepolia', nativeCurrency: { name: 'WBT', symbol: 'WBT', decimals: 18 }, rpcUrls: { default: { http: ['https://rpc.testnet.whitechain.io'] } } };
const publicClient = createPublicClient({ chain, transport: http() });
const admin = createWalletClient({ account: privateKeyToAccount(ADMIN_KEY), chain, transport: http() });   // funded with WBT from the faucet

const { network } = await deployCheckout({ walletClient: admin, publicClient, relayer: RELAYER_ADDRESS, policyWriter: POLICY_WRITER_ADDRESS });
// Use `network` in createMerchant / createBuyerAgent / createReferenceRelayer. Keep three different keys:
// admin (owns the checkout), relayer (gas only, never USDT) and policy writer (writes spending passes).
```

Buyers need test USDT on Whitechain Sepolia at `network.token.address`, and the relayer, admin and merchant need a little WBT for gas ([faucet](https://faucet.testnet.whitechain.io)). Pass your key in from your own environment; never commit it. Report what you find: see [FEEDBACK.md](FEEDBACK.md).

## Quickstart: merchant

```js
import { createMerchant, httpFacilitator } from '@graphpay_ethglobal/agentpay';

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
import { createBuyerAgent, createMandate, usdt } from '@graphpay_ethglobal/agentpay';

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
import { buyerTools, merchantTools, createAgentPayMcpServer } from '@graphpay_ethglobal/agentpay';

const tools = buyerTools(buyer, { allowedOrigins: ['https://my-shop.example'] });   // AI SDK 7 tools
// agentpay_pass_status, agentpay_quote, agentpay_pay, agentpay_request_refund, agentpay_subscribe, agentpay_cancel

const shopTools = merchantTools(merchant, { catalog: { 'box-12': { name: 'box of 12', unitPriceMicro: 4_800_000 } } });
// agentpay_quote (prices from the catalog only), agentpay_accept (after riskCheck),
// agentpay_refund (only when the merchant has maxRefundMicro, set by a person; capped at what is left)

const mcp = createAgentPayMcpServer({ buyer });   // the same tools over MCP
```

The model proposes, code disposes: a tool can only ask to pay *less* (`maxUsdt`); a refusal comes back as `{ ok: false, code, message }`. Any other error comes back as its name only, and URLs are removed from messages, so an RPC error can never show a keyed URL to a model.

## Examples

- [`examples/sweets.mjs`](examples/sweets.mjs): a sweet shop sells a box to a customer agent (the quickstart above).
- [`examples/cab.mjs`](examples/cab.mjs): a fixed-fare cab ride (V1 is fixed-price; variable-fare pre-authorisation is V2).

Both run end to end in the package's own tests on an anvil fork of Whitechain Sepolia. GraphPay's own demo also made one labelled test payment of 0.01 test USDT on the real testnet with this SDK, with one signature and no gas for the agent: [the settlement](https://explorer.testnet.whitechain.io/tx/0xfbd7d307b1b0c08f3af015b4bdb03aaeed12d0c2d18c2553432cb4679ff14c7e).

## API reference

### Network

| export | what |
|---|---|
| `whitechainNetwork(overrides?)` | chain id, checkout, token (USDT, 6 decimals), Permit2 and explorer; the defaults are vendored in the package (the checkout default is GraphPay's demo deployment: override `checkout` with your own, see above). Refuses any chain but Whitechain Sepolia, a token on the never-use list, or a token without 6 decimals |
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

x402 v2 headers `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, `PAYMENT-RESPONSE` (base64 JSON). Exactly one requirement `{ scheme: 'graphpay-order', network: 'eip155:1874', asset, amount, payTo, maxTimeoutSeconds, extra: { contract, order, shopName, mandateRequired: true } }`, the graphpay-order scheme, so any graphpay-order facilitator settles it. The order's details travel in `extensions.agentpay` and are echoed by the payer. A payer identifies itself with `x-agentpay-payer` (wallet) and `x-agentpay-payer-name` on its first request, so the order is built for it.

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

`authorize(request)` → boolean gates every request that makes the facilitator spend gas (a paid retry, a subscription, a cancel); GraphPay's hosted demo routes use it for a passcode. Compare a passcode or token in constant time (`crypto.timingSafeEqual` on hashes); the SDK cannot check how the hook compares. A settlement the facilitator could not confirm (`pending`, `in_flight`, a timeout) is answered 502, never 402, so the payer re-sends the same signature.

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
| `exportCsv({ fromBlock?, toBlock? })` | every order of this merchant from the chain logs: status, amount, refunds, payer, transactions, explorer links (no spreadsheet formulas). Logs are read `logChunk` blocks at a time (a `createMerchant` option, default 10,000), and the span drops to a tenth when an RPC refuses the range |
| `on(event, fn)` | `paid`, `payment.failed`, `refund.requested`, `refunded`, `accepted`, `delivered`, `subscribed`, `renewal.charged`, `cancelled` |

`riskCheck(ctx)` → `{ allow, reason? }` runs before settlement and in `accept`. The default allows, unless the `ReputationProvider` rates the payer high risk.

### Facilitator

The interface: `verify(paymentPayload, requirements)`, `settle(paymentPayload, requirements)`, optional `supported()`, `subscribe()`, `renew(subId)`, `cancelSubscription()`.

- `httpFacilitator({ url, authToken })`: the x402 facilitator HTTP API (`POST /verify`, `POST /settle`, `GET /supported`, bearer token), https only. This is the adapter for a graphpay-order facilitator you run or trust (there is no default URL).
- `inProcessFacilitator(f)`: any object with `verify` and `settle` (an `x402Facilitator` with the graphpay-order scheme registered).
- Both adapters are tested against GraphPay's own facilitator on an anvil fork in the GraphPay repository.
- `createReferenceRelayer({ walletClient, publicClient, allowedMerchants, limits?, identity? })`: a small relayer for tests and small deployments, run with your own relayer key. It checks the payload for free, recovers the signature locally, predicts the on-chain outcome (order status, Permit2 nonce, balance, allowance or approval, the pass), and sends only what will settle, one transaction at a time. Anti-drain limits, on by default and never switched off (`RELAYER_DEFAULTS`, `resolveLimits`): a relayer balance floor (0.1 WBT), a per-order cap (10.00), an hourly cap on count (30) and value (50.00), a per-payer rate (10 a minute) and a gas ceiling per transaction (450,000 for a settlement; the heaviest measured is 312,024).

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

### Deploy and sandbox

- `deployCheckout({ walletClient, publicClient, relayer, policyWriter, network? })` deploys your own checkout (the admin is the wallet client's account) and returns `{ address, transactionHash, deployBlock, network }`.
- `startSandbox({ forkUrl?, buyerUsdt?, port? })` from `@graphpay_ethglobal/agentpay/sandbox`: a local anvil fork of Whitechain Sepolia with your own checkout and fresh keys; `stop()` ends it. Local only.

## How GraphPay uses it

GraphPay ("ask before you pay") is one deployment of this SDK; AgentPay itself stays the Whitechain payments lane and imports none of GraphPay's identity or memory packages.

- **Pay (Whitechain):** GraphPay runs its own deployed `GraphPayCheckout` and its own facilitator, which serves the same graphpay-order scheme and is reached through `httpFacilitator`.
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
- The reference relayer is for tests and small deployments; run your own facilitator for anything bigger.
- Testnet only: Whitechain Sepolia (1874).
