# T6 AgentPay: resume

Updated 05:30 IST, Fri 6 Nov. Brief: `docs/thinking-partner/briefs/0325-agentpay-v1.md`. Branch prefix `agentpay/`.

## State

- PR 1 (`agentpay/v1-core`): the SDK, its offline tests (CI) and fork tests, both examples, README, VERSIONS rows, story section `agentpayExamples`. Reviewer: 2 blocking fixed, re-check clean.
- PR 1 merged (#38). Real test payment done 04:00 IST: https://explorer.testnet.whitechain.io/tx/0xfbd7d307b1b0c08f3af015b4bdb03aaeed12d0c2d18c2553432cb4679ff14c7e (txlog.jsonl; script `examples/agentpay-sweets/real.mjs`).
- Real test payment merged as PR 41.
- A4 done (branch `agentpay/t1-adapter`): `packages/agentpay/test-fork/t1-facilitator.test.mjs`, the SDK merchant through T1's facilitator (#42), in process and over HTTP; devDependencies `@graphpay/facilitator`, `@x402/core` 2.30.0.
- A4 merged as PR 47. Branch `agentpay/log-chunk`: log reads fit the public RPCs' range caps (T5's report); fork `giveUsdt` writes the balance on the fork.
- T5's `packages/checkout-kit` uses `createMerchant` (route, exportCsv, deliver, refund, the 402 flow), `httpFacilitator`, `whitechainNetwork`, `decodeHeader` (tests: `signOrderPayment`, `buildRequirement`, `createOrder`, `nodeOf`): keep them stable, tell T5 before changing them.
- Not done yet: npm publish (founder's login, later). The CSV fork test's flake was viem's cached block number in `exportCsv`, fixed (`cacheTime: 0`).

## How to run

- Offline: `fnm exec --using=22.23.4 node --test "packages/agentpay/test/*.test.mjs"`.
- Fork: `fnm exec --using=22.23.4 pnpm --filter @graphpay/agentpay test:fork` (spawns anvil on the public Whitechain RPC; keys made per run; roles and USDT by impersonation on the fork only).

## Rules kept

- Never import `@graphpay/ens`, `@graphpay/money-graph` or `@graphpay/arkiv-graph`: identity and reputation are the `IdentityResolver` and `ReputationProvider` interfaces.
- Never edit T1's or T4's packages or the contract. Names and prices come from the story config.
- Real payments only to cast actors (the mirror parks unknown actors and stops its checkpoint there).
