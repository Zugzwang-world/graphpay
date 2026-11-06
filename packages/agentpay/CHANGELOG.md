# Changelog

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
