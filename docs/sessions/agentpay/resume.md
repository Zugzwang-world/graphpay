# T6 AgentPay: resume

## BRIEF FROM THE COORDINATOR, 09:20 IST Fri 6 Nov (ADR-0063): publish `@graphpay/agentpay` on npm by about 13:00

You are on Sonnet 5.5 at high. **`@graphpay/agentpay` goes on npm by about 13:00 today**, so developers at the venue can try it. The Coordinator publishes with `pnpm publish` after the founder's npm login. The scope is `@graphpay` (never `graphpay_ethglobal`). After the submission, versions are frozen until judging ends. Pause at 92% weekly usage (it was 83% at 09:20).

1. **README quickstart that works in 5 minutes** for an outside developer, plus one example and a CHANGELOG for 0.1.0. `package.json`: `"version": "0.1.0"`, `"publishConfig": { "access": "public" }`, a `files` list, plus license, repository, homepage, bugs and keywords.
2. **Self-contained:** inline the checkout ABIs into agentpay, so there is no `@graphpay/contracts` or any other workspace dependency. Then `pnpm pack`, install the tarball in an empty folder outside the repo, and run the quickstart there on Node 22. Check the tarball's file list: no secrets, no keyed URLs.
3. **Safety, the founder's rule:**
   - testnet only: V1 refuses any chain but 1874, at client creation and before every signing;
   - no default to our hosted facilitator or our relayer: developers bring their own relayer key (and facilitator), so nobody can spend our gas or break the demo.
   - Check whether the checkout contract only lets granted relayers settle. If it does, an outside developer cannot use our deployment, so make the 5-minute quickstart a path that really works for them, and tell the Coordinator which.
4. **FEEDBACK.md:** feedback is a GitHub issue with the label `sdk:agentpay` (the Coordinator is creating the labels and an issue template).
5. **A reviewer pass is mandatory** (payment and signature code) before the PR merges.

**Ready by about 12:00 IST:** tell the Coordinator (session `local_d1ca442e-73e0-4e15-aa2b-9250fe0cc432`) when pack, install and quickstart pass.

Start line: the Coordinator sends it after this session is cleared. Keep T5's `packages/checkout-kit` working (it uses the public exports named under "State"); it depends on `@graphpay/agentpay` and `@graphpay/contracts` today, so tell T5 before any export or the workspace dependency changes.

---

Updated 09:30 IST, Fri 6 Nov. Brief: `docs/thinking-partner/briefs/0325-agentpay-v1.md`. Branch prefix `agentpay/`.

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
