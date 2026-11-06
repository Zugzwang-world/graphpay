# @graphpay_ethglobal/agentpay

A two-sided SDK for agentic USDT payments on Whitechain. A customer agent pays any merchant route that answers HTTP 402 with **one signature and no gas**, under an **on-chain spending pass**. A merchant prices any route or product, settles through a facilitator and is paid in USDT. Food, shopping and rides use the same order model. No user interface; MIT licensed.

**Testnet only.** The SDK refuses every chain but Whitechain Sepolia (1874), when a client is created and again before every signature and send. Fixed-price orders only; pre-authorising a variable fare is V2.

**Reference app:** [GraphPay](https://graphpay-event.vercel.app), live on Whitechain Sepolia, where AI agents pay shops over the same 402 scheme on the same checkout contract ([source](https://github.com/Zugzwang-world/graphpay); what it shares with this SDK is under [Reference app](#reference-app)).

## Quickstart (5 minutes, no wallet and no faucet)

You need Node 22 and [Foundry](https://getfoundry.sh) (`anvil`). The sandbox starts a local fork of Whitechain Sepolia, deploys **your own** checkout on it, and makes a relayer, a merchant and a buyer with fresh keys. Nothing touches the real chain and you spend nothing.

```bash
mkdir agentpay-try && cd agentpay-try && npm init -y && npm pkg set type=module
npm install @graphpay_ethglobal/agentpay viem
cp node_modules/@graphpay_ethglobal/agentpay/examples/sweets.mjs .      # or paste the code below into sweets.mjs
node sweets.mjs
```

The whole of [`examples/sweets.mjs`](examples/sweets.mjs):

```js
// A sweet shop and a customer agent: the agent pays a 402 with one signature and no gas.
// Everything runs on a local anvil fork of Whitechain Sepolia (needs Foundry's `anvil`);
// the keys are made for this run and nothing touches the real chain.
//   node sweets.mjs
import { createBuyerAgent, createMerchant, createReferenceRelayer, issueSpendingPass, usdt } from '@graphpay_ethglobal/agentpay';
import { startSandbox } from '@graphpay_ethglobal/agentpay/sandbox';

const sb = await startSandbox();
try {
  const { network, publicClient, accounts, wallet } = sb;
  const shopName = 'corner-sweets.example';
  const agentName = 'errands.sam.example';

  // The shop: one priced route. Your own relayer settles (the anti-drain limits are on by default).
  const relayer = createReferenceRelayer({ walletClient: wallet(accounts.relayer), publicClient, network, allowedMerchants: [accounts.merchant.address] });
  const shop = createMerchant({ name: shopName, address: accounts.merchant.address, facilitator: relayer, publicClient, network });
  const route = shop.route(
    () => ({ items: [{ sku: 'box-12', name: 'box of 12 sweets', unitPriceMicro: usdt('4.80') }], fulfilment: { type: 'delivery', details: { etaMinutes: 25 } } }),
    (_req, { order }) => ({ status: 'preparing', orderId: order.orderId }),
  );
  shop.on('paid', ({ order }) => console.log('shop: paid order', order.orderId, '(on the local fork)'));

  // The spending pass, written once by the policy writer: this wallet may spend up to 6 USDT a day.
  await issueSpendingPass({ walletClient: wallet(accounts.policyWriter), publicClient, network, name: agentName, wallet: accounts.buyer.address, dailyCapMicro: usdt('6') });

  // The customer agent: no gas, pays only this shop. Its fetch goes straight to the shop's handler.
  const agent = createBuyerAgent({
    account: accounts.buyer, publicClient, network, name: agentName,
    pass: { capMicro: usdt('6'), period: 'day', merchants: [shopName] },
    fetch: (url, init) => route(new Request(url, init)),
  });
  const result = await agent.pay('https://corner-sweets.example/box');
  console.log('agent:', result.status, result.amountMicro, 'micro-USDT, answer', await result.response.json());
  if (result.status !== 'paid') process.exitCode = 1;
} finally {
  sb.stop();
}
```

It prints the shop's `paid` event, then `agent: paid 4800000n micro-USDT` and the shop's answer:

```
shop: paid order 0x… (on the local fork)
agent: paid 4800000n micro-USDT, answer { status: 'preparing', orderId: '0x…' }
```

The second example, [`examples/cab.mjs`](examples/cab.mjs), is a **fixed-fare cab ride**: the same SDK with `fulfilment: { type: 'ride', details: { pickup, dropoff, vehicle } }` and a one-fare `perPaymentMaxMicro` on the rider's pass. Copy it the same way and run `node cab.mjs`.

## What it does

- **Pay:** the payer signs a Permit2 witness over the order (payee, amount, deadline and order id are inside the signature), plus a bounded EIP-2612 approval the first time. The relayer pays the gas; it cannot redirect or change the payment.
- **Spending pass:** the `GraphPayCheckout` contract holds each agent's pass on-chain (the wallet it may pay from, a daily cap, an expiry, a revoke switch) and checks it at settlement. The SDK checks the same pass, plus week and month caps, a per-payment maximum, a merchant allowlist and the human's mandate, **in code, before it signs**.
- **Merchant:** stateless handlers for Fetch (Next.js), Express and `node:http`; events for `paid`, `refund.requested` and `renewal.charged`; refunds, delivery marks, subscriptions and a CSV export read from the chain.
- **AI tools:** the same actions as AI SDK tools and MCP tools. No tool takes a cap, an allowlist or a budget as input.
- **Plug-ins, not dependencies:** identity and reputation come in through two interfaces, `IdentityResolver` and `ReputationProvider`.

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
import { deployCheckout } from '@graphpay_ethglobal/agentpay';

const chain = { id: 1874, name: 'Whitechain Sepolia', nativeCurrency: { name: 'WBT', symbol: 'WBT', decimals: 18 }, rpcUrls: { default: { http: ['https://rpc.testnet.whitechain.io'] } } };
const publicClient = createPublicClient({ chain, transport: http() });
const admin = createWalletClient({ account: privateKeyToAccount(ADMIN_KEY), chain, transport: http() });   // funded with WBT from the faucet

const { network } = await deployCheckout({ walletClient: admin, publicClient, relayer: RELAYER_ADDRESS, policyWriter: POLICY_WRITER_ADDRESS });
// Use `network` in createMerchant / createBuyerAgent / createReferenceRelayer. Keep three different keys:
// admin (owns the checkout), relayer (gas only, never USDT) and policy writer (writes spending passes).
```

Buyers need test USDT on Whitechain Sepolia at `network.token.address`, and the relayer, admin and merchant need a little WBT for gas ([faucet](https://faucet.testnet.whitechain.io)). Pass your key in from your own environment; never commit it. Report what you find: see [FEEDBACK.md](FEEDBACK.md).

## The merchant side

```js
import { createMerchant, httpFacilitator } from '@graphpay_ethglobal/agentpay';

const merchant = createMerchant({
  name: 'my-shop.example.eth',          // the merchant's name; its namehash is the shop node on-chain
  address: payoutAddress,               // receives USDT
  facilitator: httpFacilitator({ url: FACILITATOR_URL, authToken: process.env.FACILITATOR_AUTH_TOKEN }),
  publicClient,                         // a viem public client on Whitechain Sepolia
  network,                              // from deployCheckout, or whitechainNetwork({ checkout: yourCheckout })
});

// Next.js App Router: app/api/box/route.js
export const GET = merchant.route(
  () => ({ items: [{ sku: 'box-12', name: 'box of 12', unitPriceMicro: 4_800_000 }], fulfilment: { type: 'delivery' } }),
  (_req, { order }) => ({ status: 'preparing', orderId: order.orderId }),
);

merchant.on('paid', ({ order, explorer }) => console.log('paid', order.orderId, explorer));
merchant.on('refund.requested', ({ orderId, amountMicro, reason }) => { /* decide, then merchant.refund(...) */ });
```

Express: `app.get('/box', merchant.express(pricer), (req, res) => res.json({ orderId: req.agentpay.order.orderId }))` (an order holds bigints, so send the fields you need). Plain Node: `http.createServer(merchant.node(pricer, handler))`; a request it cannot read (a bad `Host` header, a body over 64 KB) is answered 400 or 413.

The pricer is the merchant's own: on the paid retry the SDK re-prices the request and rebuilds the order id, so a buyer can never sign a cheaper order and have it accepted. The handler gets `{ order, settlement }`, or `{ free: true }` when the pricer returns `null`. A request that carries an already-paid order's `PAYMENT-SIGNATURE` again runs the handler with `alreadyPaid: true` and settles nothing: the header works as the payment's receipt, so make the handler safe to run twice for one `orderId`.

## The buyer side

```js
import { createBuyerAgent, createMandate, usdt } from '@graphpay_ethglobal/agentpay';

const buyer = createBuyerAgent({
  account,                              // a viem local account; the key never leaves it
  publicClient,
  network,
  name: 'errands.alice.example.eth',    // the agent's name: its node holds the on-chain pass
  pass: { capMicro: usdt('20'), period: 'week', perPaymentMaxMicro: usdt('6'), merchants: ['my-shop.example.eth'] },
  mandate: createMandate({ buyer: 'alice.example.eth', request: 'sweets under 6 USDT by 8 pm', budgetMicro: usdt('6'), deadlineMs }),
});

const r = await buyer.pay('https://my-shop.example/api/box');   // 402 → guards → one signature → paid
// r.status: 'paid' | 'failed' | 'unknown' | 'free' | 'not_payable'; r.orderId, r.amountMicro, r.transaction, r.response
```

`unknown` means the payment may still settle (a timeout, a 5xx). The amount stays reserved, and calling `pay()` again with the same request re-sends **the same signature for the same order** instead of quoting a new one, so a stalled payment can never be paid twice. A definite refusal releases the reservation; either way the buyer reads the order's status on-chain before it decides. `free` means the route answered without a 402; `not_payable` means the order is already past payment on-chain (`orderStatus` says where), so there is nothing to sign.

A guard that refuses throws `AgentPayError` with a `code` (`OVER_DAILY_CAP`, `OVER_PERIOD_CAP`, `MERCHANT_NOT_ALLOWED`, `OVER_BUDGET`, `PASS_REVOKED`, `WRONG_CHAIN`, …) before anything is signed. After `unknown`, `r.retry` says what to do.

A name in `pass.merchants` (or the mandate's) is matched against the name the 402 claims. Give the buyer an `IdentityResolver` so `verifyMerchant` binds that name to the payee's address, or list payee addresses (`0x…`) for an allowlist that needs no resolver.

The agent's on-chain pass is written once by whoever holds the checkout's policy-writer key:

```js
await issueSpendingPass({ walletClient: policyWriter, publicClient, network, name: 'errands.alice.example.eth', wallet: account.address, dailyCapMicro: usdt('6') });
```

## AI agents

```js
import { buyerTools, merchantTools, createAgentPayMcpServer } from '@graphpay_ethglobal/agentpay';

const tools = buyerTools(buyer, { allowedOrigins: ['https://my-shop.example'] });   // AI SDK 7 tools
// agentpay_pass_status, agentpay_quote, agentpay_pay, agentpay_request_refund, agentpay_subscribe, agentpay_cancel

const shopTools = merchantTools(merchant, { catalog: { 'box-12': { name: 'box of 12', unitPriceMicro: 4_800_000 } } });
// agentpay_quote (prices from the catalog only), agentpay_accept (after riskCheck),
// agentpay_refund (only when the merchant has maxRefundMicro, set by a person: the most refunded on one order; capped at what is left)

const mcp = createAgentPayMcpServer({ buyer });   // the same tools over MCP
```

The model proposes, code disposes: a tool can only ask to pay *less* (`maxUsdt`); a refusal comes back as `{ ok: false, code, message }`. Any other error comes back as its name only, and URLs are removed from messages, so an RPC error can never show a keyed URL to a model.

## Examples

- [`examples/sweets.mjs`](examples/sweets.mjs): a sweet shop sells a box to a customer agent (the quickstart above).
- [`examples/cab.mjs`](examples/cab.mjs): a fixed-fare cab ride (V1 is fixed-price; variable-fare pre-authorisation is V2).

Both run end to end in the package's own tests on an anvil fork of Whitechain Sepolia. This SDK also made one labelled test payment of 0.01 test USDT on the real testnet, with one signature and no gas for the agent: [the settlement](https://explorer.testnet.whitechain.io/tx/0xfbd7d307b1b0c08f3af015b4bdb03aaeed12d0c2d18c2553432cb4679ff14c7e).

## API reference

Everything below is exported from the package root (the sandbox from `@graphpay_ethglobal/agentpay/sandbox`); [`index.d.ts`](index.d.ts) and [`sandbox.d.ts`](sandbox.d.ts) have the types. Amounts are bigint micro-USDT everywhere.

### Network and money

| export | what |
|---|---|
| `whitechainNetwork(overrides?)` | chain id, checkout, token (USDT, 6 decimals), Permit2 and explorer; the defaults are vendored in the package (the checkout default is GraphPay's demo deployment: override `checkout` with your own, see above). Refuses any chain but Whitechain Sepolia, a token on the never-use list, or a token without 6 decimals |
| `ALLOWED_CHAIN_IDS` | `[1874]` |
| `assertChain(publicClient, network)` | `eth_chainId` check; every signer and sender calls it first |
| `assertClientChain(client, network)` | throws `WRONG_CHAIN` when a viem client names another chain (a client with no chain is checked by `eth_chainId` instead) |
| `assertWriteChain(publicClient, walletClient, network)` | before a write: the public client and the wallet client must both answer chain 1874 |
| `explorerTx(network, hash)` | the explorer link of a transaction |
| `usdt('4.80')` → `4800000n` | a string is exact, a number is rounded to 6 decimals, a bigint counts whole USDT |
| `formatUsdt(4800000n)` → `'4.80'` | at least two decimals |
| `toMicro(value, what?)` | a micro amount from a bigint, a safe integer or a string of digits; refuses a negative or above-uint64 value |
| `AgentPayError` | `code`, `message`, `details` |

### Order model

`createOrder({ merchant: { name, address }, payer?: { name?, address? }, buyer?: { name }, items: [{ sku, name, quantity, unitPriceMicro }], fulfilment: { type, details }, deadline, parentOrderId?, salt? })`

- `fulfilment.type`: `delivery`, `pickup`, `ride`, `digital` or `service` (`FULFILMENT_TYPES`); `details` is a small JSON object (at most 2,048 characters of canonical JSON, 3 levels deep).
- **Fixed price only (V1):** the total is the sum of the lines; a stated `totalMicro` must equal it. Variable fares (pre-authorise a ceiling, capture the final amount) are V2.
- The order id is `keccak256(abi.encode(shopNode, merchant, buyerNode, payerNode, payerWallet, detailsHash, deadline, parentOrderId, salt))` with the top bit cleared (renewal ids keep their own id space). `detailsHash` covers items, total and fulfilment. Both sides derive it from public data.
- `order.chain` is the `GraphPayCheckout` `Order` struct. A `parentOrderId` makes it a re-order (`kind = 1`). A payer with no name is a human (`payerNode = 0`).

| export | what |
|---|---|
| `createOrder(input)` | the order, with its id, nodes, details hash and `chain` struct (`ORDER_SCHEMA` is `'agentpay.order/v1'`) |
| `deriveOrderId(fields)`, `detailsHash({ items, totalMicro, fulfilment })` | the two hashes above |
| `nodeOf(name)` | the ENS namehash of a normalised name; `ZERO32` for no name |
| `canonicalJson(value)` | JSON with sorted keys and no white space (what the hashes cover) |
| `orderToWire(order)`, `orderFromWire(wire)` | an order as the JSON the 402 carries, and back (re-derived and checked) |
| `ZERO32` | 32 zero bytes |

### Wire (`graphpay-order` x402 scheme)

x402 v2 (`X402_VERSION`) headers `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, `PAYMENT-RESPONSE` (`HEADERS`; base64 JSON). Exactly one requirement `{ scheme: 'graphpay-order', network: 'eip155:1874', asset, amount, payTo, maxTimeoutSeconds, extra: { contract, order, shopName, mandateRequired: true } }`, the graphpay-order scheme (`SCHEME`), so any graphpay-order facilitator settles it. The order's details travel in `extensions.agentpay` and are echoed by the payer. A payer identifies itself on its first request with the `PAYER_HEADERS`: `x-agentpay-payer` (wallet), `x-agentpay-payer-name`, and optionally `x-agentpay-buyer-name` and `x-agentpay-salt`, so the order is built for it.

| export | what |
|---|---|
| `buildRequirement(order, network, { shopName?, maxTimeoutSeconds? })`, `buildPaymentRequired(order, network, { resourceUrl, description?, error? })` | the requirement, and the whole 402 body (a buyer needs its `resourceUrl`) |
| `orderOfPaymentRequired(paymentRequired, network)` | re-derives the order from the details and checks the requirement against it |
| `encodeHeader(value)`, `decodeHeader(text)` | base64 JSON (bigints as strings); `decodeHeader` returns `null` for anything it cannot read |
| `requirementSchema`, `paymentRequiredSchema`, `paymentPayloadSchema` | the zod schemas |

### Buyer

`createBuyerAgent({ account, publicClient, network?, name?, buyerName?, pass, mandate?, identity?, reputation?, approvalMicro?, fetch?, clock?, onEvent? })`

| method | what |
|---|---|
| `pay(url, init?)` | answers a 402: guards, one signature, the paid retry. `init.maxMicro` can only lower the limit; a body must be a string. After an `unknown` result, the same call re-sends the same signature |
| `quote(url)` | reads the 402 without signing |
| `check(order)` | runs every guard but the chain id, which `pay` checks first (throws `AgentPayError`), and returns the order's on-chain `status`: `NONE` or `CREATED` can still be paid |
| `passStatus()` | the on-chain pass, spend this period and what is left |
| `requestRefund({ url, orderId, amountMicro, reason })` | a refund request signed by the payer (EIP-712 `RefundRequest`); the merchant decides |
| `subscribe({ url, maxMicro? })` | reads the plan offer, runs every payment guard on its first charge, checks that the plan fits the period cap and, under a mandate, that all its cycles fit the mandate's budget and deadline; signs `Subscribe` and a bounded Permit2 `PermitSingle` (amount × maxCycles). The first charge counts from the moment it is signed and stays counted unless the chain or a definite refusal shows it was not taken |
| `cancel({ url, subId })` | signs `Cancel`; the merchant's facilitator sends `cancelWithSig` (gasless) |

Guards, in order: chain id; the order is for this payer and buyer, not expired, and its deadline within the payment timeout; merchant allowlist; per-payment and caller maximum; mandate deadline, merchants and budget; the identity resolver vouches for the payee (optional); the merchant is not rated high risk (optional); the on-chain pass exists, binds this wallet, is not revoked or expired, and the payment fits today's cap; the week or month cap, summed from the contract's own per-day spend; the order is not already paid. One payment at a time per agent.

| export | what |
|---|---|
| `createMandate({ buyer?, request?, budgetMicro, deadlineMs, merchants?, currency? })` | the human's intent ("at most 6 USDT, by 8 pm"), hashed into every payment it covers |
| `issueSpendingPass({ walletClient, publicClient, network, name, wallet, dailyCapMicro, expiry?, epoch?, revoked?, refuseWallets? })`, `revokeSpendingPass({ walletClient, publicClient, network, name })` | write the on-chain pass with the checkout's policy-writer key; `refuseWallets` lists wallets that must never be bound to an agent (an owner's, a merchant's), and `node` may replace `name` in these and the reads below |
| `readSpendingPass({ publicClient, network, name, wallet?, nowSec })`, `spentInPeriod({ publicClient, network, node, epoch, period, nowSec })` | read the pass and today's spend; the spend over a `PERIOD_DAYS` period (`day` 1, `week` 7, `month` 30) |
| `signOrderPayment`, `signSubscription`, `signCancel`, `signRefundRequest` | the payer's signatures, as the buyer makes them (each checks `eth_chainId` first) |
| `DEFAULT_APPROVAL_MICRO` | the first payment's bounded EIP-2612 approval of Permit2: 50.00 USDT, never unlimited (`approvalMicro` changes it) |

Spending pass: on-chain, the pass has a daily cap (UTC days), an expiry and a revoke switch; week and month caps and the merchant allowlist are checked by the SDK (for an agent, a week or month is the last 7 or 30 UTC days of on-chain spend; for a human payer, a fixed 7- or 30-day block counted from 1970, kept in memory) (the signature binds the merchant, so no relayer can redirect a payment the allowlist let through). An on-chain allowlist and other on-chain periods need a contract change (V2).

### Merchant

`createMerchant({ name, address, facilitator, publicClient, walletClient?, network?, riskCheck?, authorize?, identity?, reputation?, quoteTtlSeconds?, maxRefundMicro?, logChunk?, resourceBase?, clock?, log? })`

`authorize(request)` → boolean gates every request that makes the facilitator spend gas (a paid retry, a subscription, a cancel); GraphPay's hosted demo routes use it for a passcode. Compare a passcode or token in constant time (`crypto.timingSafeEqual` on hashes); the SDK cannot check how the hook compares. A settlement the facilitator could not confirm (`pending`, `in_flight`, a timeout) is answered 502, never 402, so the payer re-sends the same signature.

| method | what |
|---|---|
| `route(pricer, handler)` | a Fetch route handler (Next.js App Router and any Fetch server) |
| `express(pricer)` | Express middleware; a paid request continues with `req.agentpay = { order, settlement }` |
| `node(pricer, handler)` | a `node:http` listener |
| `charge(request, pricer)` | the core, for other frameworks: `{ paid, order, settlement }` or `{ response }` |
| `order(...)` | an order of this merchant's (used by the quote tool) |
| `refund(orderId, amountMicro, { reasonCode })` | merchant → payer, capped at what is left and, with `maxRefundMicro`, at that much refunded on the order in total (refunds run one at a time, so two at once cannot pass it); needs the merchant's key, WBT for gas and a USDT float approved to the checkout |
| `deliver(orderId)`, `accept(orderId)` | `markDelivered`; accept a paid order after `riskCheck` |
| `refundRequests()` | POST endpoint for signed refund requests; checks the signer paid the order; emits `refund.requested` |
| `subscriptions(plan)`, `cancellations()` | the plan offer (GET) and signed subscription (POST); signed cancels |
| `chargeDueRenewals()`, `watchRenewals()` | renew what is due through the facilitator; watch the chain for renewals charged by any relayer. Each charge emits `renewal.charged` once (by its renewal order id), whichever saw it; a renewal whose outcome is not yet known emits nothing |
| `exportCsv({ fromBlock?, toBlock? })` | every order of this merchant from the chain logs: status (a delivered order shows as `PAID`), amount, refunds, payer, transactions, explorer links (no spreadsheet formulas). Logs are read `logChunk` blocks at a time (default 10,000), and the span drops to a tenth when an RPC refuses the range |
| `on(event, fn)`, `off`, `once` | `paid` (with the order, payer and payer name), `payment.failed` (a definite failure), `refund.requested`, `refunded`, `accepted`, `delivered`, `subscribed`, `renewal.charged`, `cancelled` |

`riskCheck(ctx)` → `{ allow, reason? }` runs before settlement and in `accept`. The default allows, unless the `ReputationProvider` rates the payer high risk; `accept` asks about the payer the order was paid by (its node, from the order's `OrderCreated` event), and refuses an order whose payer it cannot find. `quoteTtlSeconds` (default 300) is at most 600, and `createMerchant` refuses more: an SDK buyer refuses an order whose deadline is further out than the payment timeout. The shop node on-chain is `nodeOf(merchant.name)`; `merchant.node` is the `node:http` listener.

| export | what |
|---|---|
| `jsonResponse(status, body, headers?)` | a JSON `Response` (bigints as strings) |
| `toFetchRequest(req)`, `sendFetchResponse(res, response)` | the `node:http` and Express glue: a Node request as a Fetch `Request`, and a Fetch `Response` written to a Node response |
| `toCsv(columns, rows)` | RFC 4180 CSV with no spreadsheet formulas (what `exportCsv` writes) |

### Facilitator

The interface: `verify(paymentPayload, requirements)`, `settle(paymentPayload, requirements)`, optional `supported()`, `subscribe()`, `renew(subId)`, `cancelSubscription()`.

- `httpFacilitator({ url, authToken, fetch?, timeoutMs? })`: the x402 facilitator HTTP API (`POST /verify`, `POST /settle`, `GET /supported`, bearer token), https only (or a loopback `http` URL for local tests). This is the adapter for a graphpay-order facilitator you run or trust (there is no default URL). An unreachable facilitator throws `FacilitatorUnavailable`.
- `inProcessFacilitator(f)`: any object with `verify` and `settle` (an `x402Facilitator` with the graphpay-order scheme registered).
- Both adapters are tested against GraphPay's own facilitator on an anvil fork in the GraphPay repository.
- `createReferenceRelayer({ walletClient, publicClient, network?, allowedMerchants, limits?, identity?, clock?, log? })`: a small relayer for tests and small deployments, run with your own relayer key. It checks the payload for free, recovers the signature locally, predicts the on-chain outcome (order status, Permit2 nonce, balance, allowance or approval, the pass), and sends only what will settle, one transaction at a time. Anti-drain limits, on by default and never switched off (`RELAYER_DEFAULTS`, `resolveLimits(overrides)`): a relayer balance floor (0.1 WBT), a per-order cap (10.00), an hourly cap on count (30) and value (50.00), a per-payer rate (10 a minute) and a gas ceiling per transaction (450,000 for a settlement; the heaviest measured is 312,024).
- `predictPolicy({ payerNode, boundNode, policy, payer, spentToday, amount, nowSec })`: the contract's pass check, predicted from chain state: `'NONE'` (it passes), `'NODE_MISMATCH'`, `'AGENT_REVOKED'`, `'AGENT_EXPIRED'` or `'SPEND_CAP'`.

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

### AI tools and MCP

| export | what |
|---|---|
| `buyerTools(buyer, { allowedOrigins? })`, `merchantTools(merchant, { catalog?, fulfilmentTypes? })` | AI SDK 7 tools, by name |
| `buyerToolDefinitions(...)`, `merchantToolDefinitions(...)` | the same tools as plain `{ name, description, shape, run }` definitions |
| `aiSdkTools(definitions)` | definitions as AI SDK tools |
| `createAgentPayMcpServer({ buyer?, merchant?, buyerOptions?, merchantOptions?, name?, version? })` | an MCP server with the buyer's tools, the merchant's, or both (the merchant's then start with `merchant_`) |
| `registerTools(server, definitions, { prefix? })`, `registerBuyerTools(server, buyer, options?)`, `registerMerchantTools(server, merchant, options?)` | the same tools on an MCP server you already have |

### Deploy and sandbox

- `deployCheckout({ walletClient, publicClient, relayer, policyWriter, network? })` deploys your own checkout (the admin is the wallet client's account) and returns `{ address, transactionHash, deployBlock, network }`.
- `startSandbox({ buyerUsdt?, port? })` from `@graphpay_ethglobal/agentpay/sandbox`: a local anvil fork of Whitechain Sepolia with your own checkout and fresh keys; `stop()` ends it. `port` (default 18,000) is where it starts looking for a free port. Local only.

## Reference app

[GraphPay](https://graphpay-event.vercel.app) ("ask before you pay") is the reference for a full deployment on Whitechain Sepolia: AI agents with ENS names pay shops, one signature and no gas each, after asking a money graph on Arkiv about the shop ([a live payment of 4.80](https://explorer.testnet.whitechain.io/tx/0xbc052d7f11bd61ab0fcee69a78da0b7fbe5bcbf9821741d1150345a0fe29cd43)). In [its source](https://github.com/Zugzwang-world/graphpay):

- **The same payments:** GraphPay's agents pay over the same `graphpay-order` scheme, on the same `GraphPayCheckout` contract and spending passes, through GraphPay's own facilitator ([`packages/facilitator`](https://github.com/Zugzwang-world/graphpay/tree/main/packages/facilitator)). The live errand runs GraphPay's own shop and agent code; this SDK's `httpFacilitator` and `inProcessFacilitator` are tested against that facilitator on a fork ([`test-fork/t1-facilitator.test.mjs`](https://github.com/Zugzwang-world/graphpay/blob/main/packages/agentpay/test-fork/t1-facilitator.test.mjs)).
- **A checkout on this SDK:** [`packages/checkout-kit`](https://github.com/Zugzwang-world/graphpay/tree/main/packages/checkout-kit) is a shop checkout built on `createMerchant`, `httpFacilitator` and `whitechainNetwork`; [one real payment of 4.80 test USDT](https://explorer.testnet.whitechain.io/tx/0xf1e76a91d855af352e7b38122f94c337be2a74e25ce087eb396b7945be343f89) went through it.
- **The two plug-ins, in GraphPay's own code:** identify (ENS names under `graphpay.eth`; the payee is read from ENS at pay time) and remember (the money graph on Arkiv, asked before each payment, built with [`@graphpay_ethglobal/arkiv-graph`](https://www.npmjs.com/package/@graphpay_ethglobal/arkiv-graph)). Here they are `IdentityResolver` and `ReputationProvider`, so you plug in your own; this package imports neither ENS nor Arkiv.
- **Stop:** a revoked pass stops an agent on chain. GraphPay revoked a test agent's pass, and the contract refused its next payment ([`PaymentFailed(AGENT_REVOKED)`](https://explorer.testnet.whitechain.io/tx/0x312d31320300c20205ac46a66501ac4738c2ac572ef1abebd21534765aee6021)); the SDK's guards refuse a revoked pass before signing.

## Limits of V1

- Fixed-price orders only; pre-authorisation for variable fares is V2.
- On-chain caps are per UTC day; week and month caps and the merchant allowlist are SDK-side.
- The reference relayer's counters live in its process; the on-chain caps and the balance floor are the deployment-wide bounds.
- Refund requests, the mandate ledger and pending payments are in memory; the chain holds every payment and refund.
- A human payer has no on-chain pass, so its period cap is kept in process memory only (advisory).
- Week and month caps sum the pass's current epoch: re-issuing a pass at a new epoch starts a fresh history, as the contract does.
- The reference relayer is for tests and small deployments; run your own facilitator for anything bigger.
- Under a mandate, a renewal that is delayed (by a failed charge, say) can still be charged after the mandate's deadline, within its budget: cancel the subscription when the mandate ends.
- Testnet only: Whitechain Sepolia (1874).

## Feedback

Tell us what worked, what broke and what you need: see [FEEDBACK.md](FEEDBACK.md), or [open an issue](https://github.com/Zugzwang-world/graphpay/issues/new?template=agentpay-feedback.yml) with the labels `agentpay` and `feedback`.

## Licence

MIT. See [LICENSE](LICENSE).
