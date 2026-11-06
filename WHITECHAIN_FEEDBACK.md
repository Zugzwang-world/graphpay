# Whitechain feedback

From the GraphPay team at ETHGlobal Mumbai (5–7 November 2026). Everything here comes from the event build's own runs on Whitechain Sepolia (chain 1874), each with its source; no number is carried over from earlier research. Times are IST.

## What we built

A general Whitechain payments solution for agents and shops, in test USDT (`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`):

- **`GraphPayCheckout`** [`0x75233b7341B9e86407e4b31599f07b8936716FcA`](https://explorer.testnet.whitechain.io/address/0x75233b7341B9e86407e4b31599f07b8936716FcA?tab=contract), source verified on the explorer: one-signature orders settled by a relayer (the payer holds no WBT), refunds capped by the order, re-orders as children of a paid order, subscriptions renewed by a relayer and cancelled by the subscriber's signature, and per-agent daily caps that the contract itself enforces, recording a refusal on the chain.
- **Our own x402 facilitator** on Vercel: the shop answers HTTP 402 with one quote; the agent signs a Permit2 witness (payee, amount, deadline and order id inside it); the facilitator checks the agent's ENS name and settles.
- **Two SDKs and a drop-in:** [`@graphpay_ethglobal/agentpay`](https://www.npmjs.com/package/@graphpay_ethglobal/agentpay) for agents and merchants, and [`packages/checkout-kit`](packages/checkout-kit), which a separate demo store ([`apps/store`](apps/store)) adds in 12 lines.
- **Merchant and customer views** on the live site, https://graphpay-event.vercel.app, where an AI agent pays a shop with no gas, the shop refunds from its phone, and every payment becomes a receipt on Arkiv.

**Why on-chain stablecoin settlement:** agents of different owners need a settlement record that neither side controls. One Whitechain event holds the order, the amount, the refund cap and the subscription terms, and it feeds a reputation that anyone can query on Arkiv.

## What worked

- **Standard contracts are where tools expect them.** On chain 1874, checked with `eth_getCode` at 23:29 IST on Fri 6 Nov: canonical Permit2 (9,152 bytes of code), Multicall3 (3,808), EntryPoint v0.7 (16,035), x402's exact Permit2 proxy (2,913) and the deterministic deployment proxy (69). Our checkout builds on Permit2 with no deploy of our own beyond the checkout.
- **Test USDT signs like Tether.** The token's EIP-2612 domain (`Tether USD`, version `1`, chain 1874) hashes to its `DOMAIN_SEPARATOR()`, both `permit` overloads approve Permit2, and Permit2's domain hashes to the deployed contract's (Foundry fork tests, `packages/contracts/test/Digests.t.sol`; [`docs/technical/FACTS.md`](docs/technical/FACTS.md)).
- **Deploy and verify with Foundry and Blockscout, first time.** The checkout deployed in [0x0cf2…01f6](https://explorer.testnet.whitechain.io/tx/0x0cf2fc150261d538bf91638af813138475bb28ff9039c6183062d8461b3b01f6) (3,873,126 gas, 0.0194 WBT) and verified through Blockscout over the public RPC ([`docs/sessions/payments/m2-deploy.md`](docs/sessions/payments/m2-deploy.md)).
- **The explorer's API.** Blockscout's `/api/v2/transactions/<hash>` returns the method, status and decoded token transfers; our acceptance checks and the README's evidence table are read from it.
- **Cheap, predictable gas.** The FACILITATOR relayer received 0.81 WBT in all (0.8 at the start and a 0.0103 top-up, [`docs/technical/WALLETS.md`](docs/technical/WALLETS.md)) and still held 0.774 WBT on Fri 6 Nov at 23:05 IST, after every agent payment of the event ([health](https://graphpay-event.vercel.app/api/facilitator/health)).

## Gas measured on the event build

Every row is a real transaction on chain 1874, read back from the explorer on Fri 6 Nov at about 23:10 IST.

| action | gas | example |
|---|---:|---|
| deploy `GraphPayCheckout` | 3,873,126 | [0x0cf2…01f6](https://explorer.testnet.whitechain.io/tx/0x0cf2fc150261d538bf91638af813138475bb28ff9039c6183062d8461b3b01f6) |
| agent payment, first by that payer (`settleOrder`) | 309,483 | [0x8750…2c00](https://explorer.testnet.whitechain.io/tx/0x87505ef2457b6e925fa7378a55fd91419e83c37fb8effc06d901884700c72c00) |
| agent payment, steady (`settleOrder`) | 237,170 to 254,294 | [0xbc05…cd43](https://explorer.testnet.whitechain.io/tx/0xbc052d7f11bd61ab0fcee69a78da0b7fbe5bcbf9821741d1150345a0fe29cd43) |
| browser-wallet payment through the kit (`settleOrder`) | 206,184 | [0xf1e7…3f89](https://explorer.testnet.whitechain.io/tx/0xf1e76a91d855af352e7b38122f94c337be2a74e25ce087eb396b7945be343f89) |
| re-order (`settleOrder`, child order) | 244,307 | [0x78ac…78ef](https://explorer.testnet.whitechain.io/tx/0x78acbc3fbf50a15bbe3920bdcfe9e47a032fa43db81b5710c1d369e8a83778ef) |
| refund by the shop (`refund`) | 75,335 | [0xcd44…c425](https://explorer.testnet.whitechain.io/tx/0xcd442a5e6675e0eae8a66bc17ee3913af1b673e39a54a28d4a14a0fab58bc425) |
| subscription with its first charge (`createSubscription`) | 433,969 | [0x1a2b…1180](https://explorer.testnet.whitechain.io/tx/0x1a2bb6c80871b22458d66393d6afa075becc55086f2c85ab995dc38077d91180) |
| renewal by the relayer (`renew`) | 222,881 | [0x48b1…480f](https://explorer.testnet.whitechain.io/tx/0x48b14aa45f56d487dee743721416a359fed96296b3ad0ababf546838f55e480f) |
| cancel with the subscriber's signature (`cancelWithSig`) | 42,227 | [0x3a6f…83b5](https://explorer.testnet.whitechain.io/tx/0x3a6f278f077f79cd40972b7c4a3c7bb2073f803c98fc9c462330697df87383b5) |
| a revoked agent's refusal, recorded on chain (`settleOrder` → `PaymentFailed`) | 136,586 | [0x05e8…b7f1](https://explorer.testnet.whitechain.io/tx/0x05e812dccf65e255f1a25ed600cdb2e39b4a56e52172b67793c55d0cb86eb7f1) |
| a plain USDT `transfer` (funding) | 60,923 | [`docs/technical/WALLETS.md`](docs/technical/WALLETS.md) |

## Friction, ranked by what it cost us

1. **`eth_getLogs` range caps on the public RPCs, undocumented.** `rpc.testnet.whitechain.io` answers at most 10,000 blocks (-32602 "query exceeds max block range 10000"); the public Ankr endpoint about 1,000 (-32062 "Block range is too large"), measured Fri 05:00 to 05:10 ([`docs/technical/FACTS.md`](docs/technical/FACTS.md)). Our accountant CSV export scanned in 50,000-block steps and answered 502 (logged in #63); the AgentPay SDK now reads 10,000 blocks at a time and drops to a tenth on a refusal. **Would help:** the limits in the RPC docs, next to the chain id.
2. **Getting test USDT took a person.** The faucet gives WBT only (the docs' Standard tier, 0.5 WBT per rolling 24 hours, GitHub account at least 30 days old, captcha). Our test USDT arrived by transfer, 150 on Thu 5 Nov at 21:54 IST and 150 on Fri 6 Nov at 11:44 IST (ADR-0045, [`docs/technical/WALLETS.md`](docs/technical/WALLETS.md)). **Would help:** a test-USDT faucet, or a documented way to request it, since the qualifying payment must use this token.
3. **"Verified" but not "fully verified".** Blockscout reports the checkout with `is_verified` true and `is_fully_verified` false, because our Foundry build carries no metadata hash ([`docs/sessions/payments/m2-deploy.md`](docs/sessions/payments/m2-deploy.md)). Nothing on the explorer page says which one a prize rule means. **Would help:** one line in the docs on what "verified" requires.
4. **The faucet's amount in the docs differs from what arrived.** The docs say 0.5 WBT per 24 hours; our funding wallet rose by 2 WBT in one drip on Thu 5 Nov, 21:59 to 22:12 IST ([`docs/technical/FACTS.md`](docs/technical/FACTS.md)). Harmless for us, confusing when planning a relayer's budget.
5. **WebSockets need a paid RPC tier.** Our keyed Ankr endpoint, on the free tier, is HTTPS only (its WSS is locked), so our live events poll over HTTPS (ADR-0055). The public `wss://rpc.testnet.whitechain.io/ws` is in our config but not used.

## Docs we would add

- An RPC limits table: block range for `eth_getLogs`, request rate, WebSocket availability, per endpoint.
- A test-USDT page: the one token address the prizes mean (our config keeps the other USDT address listed in the docs on a never-use list), how to get some, and its signing domain.
- A note on gasless payments on Whitechain: Permit2, the x402 exact Permit2 proxy and EntryPoint v0.7 are deployed at their canonical addresses (with the addresses), so x402 and account-abstraction tools work unchanged.
- The ENSIP-11 coin type for Whitechain Sepolia, 2147485522 (`0x80000752`), so wallets and agents can publish a Whitechain address in ENS, as our shops do.
