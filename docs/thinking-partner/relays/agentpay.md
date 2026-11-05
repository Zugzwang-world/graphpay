# Relay: agentpay (T6 AgentPay SDK)

Updated 04:10 IST, Fri 6 Nov. V1 merged in https://github.com/Zugzwang-world/graphpay/pull/38.

## In plain words

AgentPay is a small toolkit, `@graphpay/agentpay`, that lets any business take payments from AI agents in test USDT on Whitechain. It covers food, shopping and rides. It has two sides:

- **The customer's agent** pays when a shop's web address answers "402, payment required". It signs once and pays no gas. Before it signs, code checks every limit: a daily cap held on the blockchain, a weekly or monthly cap, a per-payment maximum, the shops it may pay, and the person's budget and deadline. A model cannot raise any of these limits.
- **The merchant** adds a few lines to a web route. A customer agent can then pay for it. The merchant hears when it is paid, when a refund is asked for and when a subscription renews. It can refund, mark an order delivered and export its orders as a spreadsheet, all read from the chain.

The same actions also come as ready-made AI tools for both sides, in two standard formats (AI SDK and MCP). Identity and reputation plug in from outside the toolkit. GraphPay plugs in its ENS names and its Arkiv money graph, but the toolkit imports neither.

**What works now:** everything above, on a private copy of Whitechain Sepolia (an anvil fork). The copy holds our deployed checkout contract, the real test USDT and Permit2. Two examples of about 20 lines each run on it end to end: a sweet shop (the story's good shop and its box) and a fixed-fare cab ride. On the real Whitechain Sepolia, one test payment went through the sweet-shop example: the rehearsal agent paid the good shop 0.01 test USDT, with one signature and no gas (https://explorer.testnet.whitechain.io/tx/0xfbd7d307b1b0c08f3af015b4bdb03aaeed12d0c2d18c2553432cb4679ff14c7e).

**What it means for the demo:** step 9's "drop-in checkout" now has a general SDK behind it, and the ride example shows the same payment path working outside food.

**What the founder must do:** nothing now. Publishing to npm needs your login later (the package is marked private until then).

## Technical

- **Package:** `packages/agentpay`; examples in `examples/agentpay-sweets` and `examples/agentpay-ride` (`examples/*` added to the workspace). No new dependency versions: viem, zod, `ai` and the MCP SDK use the repo's existing pins (`docs/technical/VERSIONS.md`).
- **Order model:** items, a fixed total, the merchant, and fulfilment (`delivery`, `pickup`, `ride`, `digital`, `service`) with details. The order id is computed from every term with the renewal bit cleared, so both sides derive the same id without a database. Pre-authorisation for variable fares is V2.
- **Wire:** the `graphpay-order` scheme, field for field (planning/SPEC/PAYMENTS_WHITECHAIN.md §5; checked against T1's in-progress facilitator wire). The order details travel in `extensions.agentpay`. On the paid retry the merchant re-prices from its own pricer, so a buyer cannot sign a cheaper order and have it accepted.
- **Buyer:** `createBuyerAgent`, `pay`, `quote`, `requestRefund` (signed by the payer), `subscribe` (Permit2 allowance bounded at amount × cycles), `cancel` (gasless). `eth_chainId` is checked before every signature. One payment at a time per agent. A payment with an unknown outcome stays reserved, and the retry re-sends the same signature.
- **Merchant:** `route` (Fetch and Next.js), `express`, `node`. Events: `paid`, `payment.failed`, `refund.requested`, `refunded`, `renewal.charged`, and others. Also `refund` (capped), `deliver`, `accept` (after `riskCheck`), `subscriptions`, `cancellations`, `chargeDueRenewals`, `watchRenewals`, `exportCsv` (from chain logs, formula-safe), and an `authorize` hook (GraphPay's passcode).
- **Facilitator:** the interface, `httpFacilitator` (the x402 facilitator HTTP API: what T1's M3 serves) and `inProcessFacilitator`. Also a reference relayer with anti-drain limits: a 0.1 WBT balance floor, 10.00 per order, 30 orders or 50.00 an hour, 10 per payer a minute, a 450k gas ceiling, one send at a time, and no resend while a send is unconfirmed.
- **Tools:** six buyer tools and three merchant tools, for the AI SDK and MCP. No tool input sets a limit, `maxUsdt` can only lower one, and errors never carry a URL. The refund tool needs a person-set `maxRefundMicro`.
- **Tests:**
  - 36 offline tests in CI: the order model, wire tampering, every guard, a forged signature, re-pricing, the risk check, the tools, MCP, Express, and the review cases.
  - 13 fork tests (`pnpm --filter @graphpay/agentpay test:fork`, about 30 s; public RPC only, keys made per run). They cover pay with zero WBT; refusals for the cap, the allowlist, the caller maximum and a revoked pass; a refund request and a 0.80 partial refund; the CSV; the relayer's per-order cap and balance floor; a subscription created, renewed after a 2-minute warp and cancelled; and both examples.
- **Reviewer:**
  - First pass: 2 blocking items, both fixed. A stalled settle could be paid twice through a new quote; tool errors could carry a keyed RPC URL.
  - From the should-fix list: a deadline bound, lower-case hex, the refund-tool limit, the `authorize` hook, a key-order test, and wallet-binding checks.
  - Re-check: both closed, nothing new blocking; its follow-ups applied.
- **Deviations:** week and month caps and the merchant allowlist are SDK-side, because the contract has only a daily cap (an on-chain allowlist needs a contract change, V2). A human payer's cap lives in process memory. The examples' story values sit in a new `agentpayExamples` section of the story config (Coordinator: see OPEN).
- **Real test payment (04:00 IST):** `examples/agentpay-sweets/real.mjs` (dry run unless `--yes`), rehearsal agent → good shop, 0.01 (`agentpayExamples.testAmountMicro`), the reference relayer on the RENEWER key with limits of one order an hour at that amount. 309,451 gas; `orders(id)` status PAID, payer the rehearsal wallet. Logged in `docs/sessions/agentpay/txlog.jsonl`. The FUNDER was not needed (RENEWER held 0.1 WBT).
- **Risks:** a real ride payment would name an actor outside the cast, which the mirror parks, and its checkpoint would stop there. So the ride stays on the fork.
