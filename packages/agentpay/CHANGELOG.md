# Changelog

## 1.0.0 (2026-11-06)

The first stable release, built and reviewed at ETHGlobal Mumbai. The API is the one 0.1.1 shipped, now documented in full; this release fixes what the review before it found. No new features. **Testnet only: Whitechain Sepolia (chain 1874).**

- Fix: `subscribe()` runs every payment guard on the plan's first charge (the mandate's deadline, merchants and budget, the identity resolver, the reputation provider, the on-chain daily cap and what is already spent this period) before it signs, and under a mandate all the cycles the signature allows must fit the mandate's budget and deadline. The first charge counts from the moment it is signed and stays counted unless the chain or a definite refusal shows it was not taken. Before, it checked only the allowlist, the per-payment maximum and that a pass existed, and counted nothing.
- Fix: `maxRefundMicro` caps what is refunded on one order in total, so several small refunds (by a person or through `agentpay_refund`) cannot add up past it, and refunds run one at a time and count what this merchant has sent even before a read shows it, so two at once cannot either. Before, it capped each refund on its own.
- Fix: `accept()` asks the reputation provider about the payer the order was paid by (its node, read from the order's `OrderCreated` event), so the default risk check refuses a payer rated high risk there too; an order whose payer cannot be found is refused.
- Fix: a buyer's payment that settled after an `unknown` answer leaves the pending ledger once its deadline passes. Before, it stayed counted against the daily and period caps on top of the chain's own count.
- Fix: a `node:http` or Express merchant answers 400 or 413 to a request it cannot read (a bad `Host` header, a body over 64 KB) instead of throwing out of the listener, which could stop the process.
- Fix: each subscription charge emits `renewal.charged` once (keyed by its renewal order id), whether the subscription endpoint, `chargeDueRenewals()` or `watchRenewals()` saw it; a renewal whose outcome is not yet known no longer emits `payment.failed`.
- Fix: `createMerchant` refuses a `quoteTtlSeconds` above 600, the payment timeout (an SDK buyer refuses such orders); the Express middleware and the `node:http` listener await every answer they write, and close a connection they cannot answer.
- Fix: `createAgentPayMcpServer` reports this package's version (it said 0.1.0); `resolveLimits` refuses inherited names such as `toString` as unknown limits.
- Types: `Merchant` no longer declares a `node` hash that the `node:http` listener hid (the shop node is `nodeOf(merchant.name)`), so `merchant.node(pricer, handler)` type-checks; route and listener handlers may receive `{ free: true }`; `buildPaymentRequired` needs its `resourceUrl`; added `createMerchant`'s `authorize`, the merchant's `limits`, `RELAYER_DEFAULTS.inFlightHoldMs`, `PayResult.retry`, `issueSpendingPass`'s `refuseWallets` and `merchantTools`' `fulfilmentTypes`.
- Docs: the README starts with the quickstart (exactly `examples/sweets.mjs`) and documents every export; it says how names in an allowlist are matched, what a replayed payment header does, the limit on `quoteTtlSeconds` and how week and month caps are counted; it links GraphPay as the reference app and says only what GraphPay's code does with the SDK.
- Tests: the README quickstart must equal `examples/sweets.mjs`, and every export must be in the README's API reference and in the type declarations.

## 0.1.1 (2026-11-06)

- The published manifest no longer lists GraphPay's private workspace packages as devDependencies (they were used only by this repository's tests).
- The sandbox removes its exit hook when stopped.
- No API change.

## 0.1.0 (2026-11-06)

First public release. **Testnet only: Whitechain Sepolia (chain 1874).**

- Buyer: `createBuyerAgent` pays an HTTP 402 with one signature and no gas under an on-chain spending pass; guards in code (caps, allowlist, mandate, revoked or expired pass); refund requests, subscriptions and cancels.
- Merchant: `createMerchant` with Fetch, Express and `node:http` handlers, a pluggable risk check, events, refunds, delivery marks, subscriptions, renewals and a CSV export read from the chain.
- Facilitators: `httpFacilitator`, `inProcessFacilitator` and `createReferenceRelayer` (your own relayer key; anti-drain limits always on). There is no default hosted facilitator or relayer.
- `deployCheckout` deploys your own `GraphPayCheckout`; `@graphpay_ethglobal/agentpay/sandbox` runs a local anvil fork with your own checkout and fresh keys.
- AI SDK tools and MCP tools for buyers and merchants.
- Chain 1874 only: refused at client creation and checked with `eth_chainId` before every signature and send.
- Self-contained: the checkout ABI, EIP-712 shapes and Whitechain Sepolia defaults are inlined.
- Two examples: a sweet shop and a fixed-fare cab ride. V1 prices are fixed; pre-authorising a variable fare is V2.
