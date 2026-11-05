# Relay: identity (M5)

Updated at the end of M5, Fri 6 Nov. **The `graphpay.eth` namespace is live on Ethereum Sepolia.**

## In plain words

Every actor in the demo now has an ENS name that really exists on-chain: `vitalik.graphpay.eth`, the three shops, the agents under each of them, and a wildcard (`anything.sim.graphpay.eth`) that answers as "synthetic" without any transaction. Each agent has its own record page (resolver). The agents that pay hold their own wallet and can edit only two of their own records: their description and their Whitechain payout address. They cannot raise their own cap or un-pause themselves; an attempt reverts. Shops publish their Whitechain address and the one token they accept (test USDT) so a payer can look the payee up from ENS at pay time instead of trusting a typed address.

For the demo this means the "who is this agent" moment is real and verifiable, and the pause/kill beats (M6) have names to act on. `disposable-1.vitalik.graphpay.eth` exists as the first kill target; a killed name can never be created again, so every further rehearsal needs a new number.

The founder has nothing to do for this step. The final demo cast will be added on Friday through the same script after the story lock.

## What was built (technical)

- `packages/ens`: names and ids, ERC-7930 encoder/parser (the ENSIP-31 draft vectors reproduce byte for byte; the test-USDT value equals the config's), role bitmaps, the namespace plan from the story config, record builders, the registry walk with the payee and accepts reads (20 s cache, failed reads not cached), a transaction runner, and the idempotent provisioner. ABIs are generated from Sourcify by `scripts/ens/abis.mjs`.
- `scripts/ens/real-run.mjs` (dry run, `--fork`, `--real`), `scripts/ens/acceptance.mjs` (read-only B1, B4, B5, B8, B9a), `scripts/ens/namespace-doc.mjs`.
- Real run: 60 transactions, 72,668,520 gas, at about 19 wei. Hand-off table, resolvers, registries and every transaction link: `docs/sessions/identity/namespace.md`.
- Acceptance on real Sepolia: B1, B4, B5, B8 (records) and B9 (a) (address records) by `scripts/ens/acceptance.mjs`, which also reads the roles; B3 by `scripts/ens/b3-real.mjs` (the agent's own `agent-context` write landed, the five refused writes revert in simulation). The reviewer found that a re-run would have rewritten status and cap on existing names; provisioning now only reports drift, and a real re-run sent 0 transactions.
- Tests: 13 unit tests; 6 fork tests (`pnpm --filter @graphpay/ens test:fork` against an anvil fork provisioned by `real-run.mjs --fork`).

## Deviations from the spec, and why

- Both setter grants go in one `multicall`, so a self-held agent takes 3 transactions (the amendment allowed 4).
- Non-paying agents publish `graphpay.cap_micro` = 0 (ADR-0059).
- The ENS texts and the namespace parameters (30-day agent expiry, salt prefix) live in the config's `ens` section, as the amendment asked.
- A read-after-write on the public Sepolia RPC can hit a lagging node: the provisioner retries reads and waits for post-write state (`docs/problems/PROBLEM_LOG.md` P-identity-1).
- The `agent-endpoint[mcp]` value is the hosted MCP URL; it answers only once T3's M7b ships.

## Open risks

- The payee comparison in B9 (a) waits for the first settled payment; B8's MCP call waits for M7b.
- Agents expire in 30 days (the event is two days); disposable agents in 14.
