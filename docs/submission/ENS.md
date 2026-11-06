# ENS: Best Use of ENSv2 (partner note)

**GraphPay on ENSv2, Ethereum Sepolia (chain 11155111).** Live demo: https://graphpay-event.vercel.app (open, no passcode). Open source: https://github.com/Zugzwang-world/graphpay (MIT). AI use: [`AI_USAGE.md`](../../AI_USAGE.md).

ENS is how GraphPay **identifies** every person, agent and shop, and it decides three things at pay time: whether an agent may pay, how much, and where the money goes. No agent payment through our facilitator happens without an ENS read, and the human owner can stop an agent through ENS alone. Nothing about an agent's identity is hard-coded: names, caps, status and payout addresses are read live from Sepolia with stock viem (ADR-0046).

## The namespace

- **Root:** `graphpay.eth`, registered bare before the event (disclosed); at the event it got its own subname registry [`0xbfcF13F0Cbc15dE5F7337e8CB69eeE2641407823`](https://sepolia.etherscan.io/address/0xbfcF13F0Cbc15dE5F7337e8CB69eeE2641407823) and resolver [`0x82d9bBf1a2D2726e649Ac985241ECfdeE802Fa8d`](https://sepolia.etherscan.io/address/0x82d9bBf1a2D2726e649Ac985241ECfdeE802Fa8d), first transaction [0xa763…93f7](https://sepolia.etherscan.io/tx/0xa763feb6e36a4588e066fdfc9fa1686e4b9e0b4025b21f886a3d46e072ba93f7).
- **Hierarchical registries:** each owner, `vitalik.graphpay.eth` (the fictional persona's test namespace, ADR-0072) and the three shops, has its own registry and resolver; each agent has its own resolver. The namespace took 90 transactions on Sepolia: 60 at the start, and 30 more for the dosa shops' own names, `filter-and-fold`, `idli-index` and `tawa-tangle` ([#158](https://github.com/Zugzwang-world/graphpay/pull/158)), which the site moves to at the label flip. Every transaction is listed in [`docs/sessions/identity/namespace.md`](../sessions/identity/namespace.md).
- **AI agents as namespaces:** `concierge`, `scout`, `analyst` and `payer` under `vitalik.graphpay.eth`; `storefront`, `risk` and `dispatch` under each shop. Each agent's name is non-transferable and expires (30 days; disposable agents 14), from the roles set at provisioning (`packages/ens/src/roles.mjs`).
- **Wildcard resolution:** `sim.graphpay.eth` has a wildcard resolver, so any synthetic agent name such as `sim-0042.sim.graphpay.eth` resolves with no per-agent transaction and answers "synthetic agent, unverified" (acceptance B5).
- **ENSIP-26 agent records:** `agent-context` and `agent-endpoint[mcp]` on the root and on every agent, pointing at our MCP server (`https://graphpay-event.vercel.app/api/mcp`); `agent-endpoint[web]` on the root, pointing at the site (acceptance B8: the endpoint answers `initialize` and `tools/list`).

## What ENS decides, and how to see it

| ENS feature | what it does in GraphPay | evidence |
|---|---|---|
| Text record `graphpay.status` | The owner pauses or resumes an agent with one record; the gate refuses a paused agent before anything is signed | The payer resumed at 23:00 IST on Fri 6 Nov ([0x34cd…f949](https://sepolia.etherscan.io/tx/0x34cddd47d2230e305b4f0a9546b8dfba51d37b7bee4c0336d54a4f556397f949)); live status: https://graphpay-event.vercel.app/api/state/customer. On the public site the owner's cron resumes a paused agent after 2 minutes ([#172](https://github.com/Zugzwang-world/graphpay/pull/172)) |
| Registry state (unregister) | The **kill switch**: the owner unregisters an agent and the gate refuses it; the old records do not keep it alive, because the gate reads the registry, not the records | `disposable-1.vitalik.graphpay.eth` killed ([0x785a…f29f](https://sepolia.etherscan.io/tx/0x785a13f119ab77f67c1ed8dfa6f1213708fde4f43158122a357e72c018acf29f)); its next payment refused (acceptance B6, E7) |
| Epochs | A re-registered name gets a new epoch, so it starts with an empty history on Arkiv and cannot inherit an old owner's reputation | a fork test ([#83](https://github.com/Zugzwang-world/graphpay/pull/83); acceptance B7 waits for a recorded fork run); the benchmark shows plain Arkiv code crediting a re-registered shop's earlier holder's sales to the new holder ([`bench/BENCHMARK-LIVE.md`](../../bench/BENCHMARK-LIVE.md)) |
| Text record `graphpay.cap_micro` | Each agent's daily cap; the gate takes the lower of this and the agent's on-chain policy cap. Agents that never pay publish 0 (ADR-0059) | the payer's cap record, 100 test USDT a day ([0x8898…c16](https://sepolia.etherscan.io/tx/0x8898d10728f998983c7747aae50389392bb9ce276b7e2dbadaed509ede674c16)), then 300 for tonight ([0x553c…adbc](https://sepolia.etherscan.io/tx/0x553c94e46621fa2fdab64c941a373ba60e07f572fb7fc62d0bcaa7e4c0acadbc)); read it live with the README's viem snippet |
| Enhanced Access Control (scoped setter roles on a Permissioned Resolver) | An agent's own key may set only its `agent-context` and its Whitechain address; it **cannot raise its own cap** or change its status | the acceptance agent's own `agent-context` write landed ([0x12f0…456e](https://sepolia.etherscan.io/tx/0x12f009dfe98a8a5a7b4cab317774cb4d79fc40c64a16bff8cb9093052c7e456e)); its `graphpay.cap_micro`, `graphpay.status`, `x-graphpay-accepts` and `agent-endpoint[mcp]` writes revert `EACUnauthorizedAccountRoles` in simulation (acceptance B3) |
| Coin-type address (ENSIP-11, 2147485522 for Whitechain Sepolia) | **The payee comes from ENS at pay time:** the shop's Whitechain address is read from its name just before the payment, never from code | every payment in the README's table pays `0x2694…d03E`, the address `kesar-kingdom.graphpay.eth` publishes; the acceptance record of a hosted payment shows the payee read from ENS (C2, `payeeRead`, in [`ACCEPTANCE_REPORT.md`](../../ACCEPTANCE_REPORT.md)) |
| Text record `x-graphpay-accepts` | The shop says which token it accepts, as an ERC-7930 value for test USDT on chain 1874 (ENSIP-31's draft key is not used, ADR-0038) | acceptance B4 |
| ENSIP-26 `agent-endpoint[mcp]` | An agent finds the money graph's MCP server from the name `graphpay.eth` alone | acceptance B8 |

The watcher (`packages/ens`) follows ENS changes and keeps the on-chain payment policies in step, so a killed agent's policy is revoked on Whitechain too, and paying to renew its name does not revive it.

## The moments in the demo

1. Vitalik's agents pay a shop: the gate reads each paying agent's name (status, registry state, expiry, cap) and the shop's payout address from ENS, then the payment settles on Whitechain.
2. **Pause my agent:** one ENS record, and the next errand is refused before anything is signed; Resume brings it back.
3. **The agent cannot raise its own cap:** the acceptance agent updated its own `agent-context`; its attempt to raise its own cap reverts in simulation (acceptance B3). Since [#169](https://github.com/Zugzwang-world/graphpay/pull/169) a route lets the payer agent try it live: the resolver refuses, nothing is sent, and the attempt is recorded on Arkiv. No phone button yet.
4. **The kill:** the owner unregisters a disposable agent, the watcher revokes its pass, and the gate refuses its next payment, recorded on Arkiv. Proven by the acceptance checks (B6, E7), and a button on the `/customer` page since [#175](https://github.com/Zugzwang-world/graphpay/pull/175), shown when a spare agent is ready.
5. **The name is the centre of the graph:** a shop's tallies on Arkiv hang off its name and epoch.

## Not built

ERC-8004 and ENSIP-25 linking, aliasing (`linkToNode`), reverse names and CCIP-Read. The refused cap change is proven by the acceptance checks and a route (#169), without a button yet; the stage's phones show Pause and Resume, and the kill is on the `/customer` page (#175).

## Check it yourself

The README's [ENS snippet](../../README.md#check-ens-yourself-stock-viem-no-keys) reads a shop's payout address, the payer's status and cap, and `graphpay.eth`'s MCP endpoint with stock viem and a public RPC, no keys. The ENS contracts GraphPay uses (the ENSv2 Sepolia deployment) are in `packages/config/graphpay.config.json` (`ens.contracts`), checked against ENS's deployments page in [`docs/technical/FACTS.md`](../technical/FACTS.md).
