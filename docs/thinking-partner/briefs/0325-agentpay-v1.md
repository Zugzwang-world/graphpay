Received 03:25 IST, Fri 6 Nov, by T6 AgentPay (attached by the founder). Saved unchanged below.

# Brief: T6 AgentPay SDK, a new parallel track

You are the T6 AgentPay SDK session for GraphPay, a new parallel track. Save this message as a brief in docs/thinking-partner/briefs/. Goal by 08:00 IST: a working V1 of @graphpay/agentpay, a universal two-sided SDK for agentic stablecoin payments on Whitechain, so any business (food, shopping, rides) can let customer agents pay and merchant agents get paid in USDT. This is Whitechain's dedicated lane: it must not import anything from our Arkiv or ENS packages; identity and reputation plug in through two interfaces, IdentityResolver and ReputationProvider.

Scope V1:
1. A generic order model: items, total in USDT, merchant, and fulfilment type with details. Fixed-price orders only; note pre-authorisation for variable fares as V2.
2. Buyer side: createBuyerAgent with an on-chain spending pass (cap, period, optional merchant allowlist) using our deployed GraphPayCheckout and its ABIs from packages/contracts, with addresses from the config. pay() answers an HTTP 402 with one signature and no gas for the buyer. Also requestRefund, subscribe and cancel. Expose the same actions as AI tools, both AI SDK tool definitions and MCP tools, with hard guards in code for cap, allowlist and budget.
3. Merchant side: middleware for Node, Next and Express that prices any route or product with our graphpay-order 402 scheme, verifies and settles through a facilitator, and emits events for paid, refund requested and renewal charged. Also refund(), exportCsv(), and merchant agent tools for quote, accept and refund, with a pluggable riskCheck hook.
4. Facilitator: an interface, plus an adapter to T1's facilitator once its M3 merges. Until then, a small reference relayer for tests, with anti-drain limits (balance floor, per-order and per-hour caps).
5. Proof: two examples of about 20 lines each, a sweet shop and a fixed-fare cab ride, using the same SDK. Test on an anvil fork of Whitechain Sepolia; then, if FUNDER allows, one tiny real testnet payment per example, labelled as a test.
6. Docs: a README quickstart for buyers and merchants, an API reference, and a section on how GraphPay uses it.

Boundaries: work only in packages/agentpay and examples/agentpay-*. Never edit T1's or T4's packages or the contract; use their public exports, and if something you need is not exported, record it in OPEN.md for its owner. Names come from the story config. Small PRs with auto-merge; run the reviewer on any code that signs, sends or holds money; no secrets in code; do not publish to npm (I will log in later). Keep docs/thinking-partner updated: relays/agentpay.md, NOW.md, LOG.md. By 08:00 IST stop at a clean checkpoint with docs/sessions/agentpay/resume.md, and ask me only for logins, funding, secrets or anything irreversible.
