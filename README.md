# GraphPay: ask before you pay

AI agents with ENS names pay shops over x402 on Whitechain through our own facilitator; every payment becomes part of a money graph on Arkiv that any agent can ask, with an explain trace of every read, before it pays. **Identify** (ENS), **remember** (Arkiv), **pay** (Whitechain): agents that can pay, can be trusted and can be stopped. Built at ETHGlobal Mumbai (5–7 November 2026). Testnets only.

**Live demo: https://graphpay-event.vercel.app** (open to everyone, no passcode; ADR-0069).

> **Fictional persona:** Mr. Vitalik is a fictional persona made for this demo; no real person is depicted or endorses GraphPay. He appears only as his caped smiley agent (ADR-0072). The ENS names under `vitalik.graphpay.eth` are labels in a test namespace on Sepolia, not an identity claim.

> **How this was built:** before the hackathon we did research and built throwaway prototypes in a separate private lab repo to test our assumptions (for example how Arkiv handles repeated writes, and how ENSv2 behaves when an agent's name is revoked). We brought only knowledge to the event: research notes, written specs, verified facts, decisions, prompts and acceptance tests, all in [`planning/`](planning/). **All code in this repo was written during the hackathon**, by us with Claude Code, and the team's two phone apps in `frontend/` by our teammate, with GitHub Copilot; see [`AI_USAGE.md`](AI_USAGE.md). At runtime the agents run on Kimi models (Moonshot AI; ADR-0067). Pre-event items we reused, all disclosed ([`planning/DISCLOSURE.md`](planning/DISCLOSURE.md); the written disclosure for ETHGlobal: [`docs/plan/DISCLOSURE_MESSAGE.md`](docs/plan/DISCLOSURE_MESSAGE.md)): two testnet wallets (a funding wallet holding faucet tokens, and the wallet that owns the ENS name), two credentials (an Arkiv access key and an Anthropic API key; no code), and the bare ENS name `graphpay.eth`, registered on Sepolia before the event with no records or subnames. Every other wallet was created at the event ([`docs/technical/WALLETS.md`](docs/technical/WALLETS.md)).

## What it does

Vitalik types one sentence on his phone: *"Just landed in Mumbai. Get me the best masala dosa near BKC under 6 USDT, delivered within an hour."* (the story, ADR-0073; synthetic).

1. **His agents ask before they pay.** A scout finds shops near him on Arkiv; an analyst asks the money graph for each shop's reputation (orders, refunds, on-time rate) in one GraphQL call and gets the exact Arkiv reads behind the answer. The trap shop is refused, with its reasons.
2. **The payer agent pays with one signature and no gas.** The shop answers HTTP 402 (x402); the payer signs once; our facilitator checks the agent's ENS name (active, not paused, not killed, under its cap), verifies and settles in test USDT on Whitechain Sepolia. The payee is read from the shop's ENS name at pay time, never hard-coded (ADR-0046).
3. **The payment becomes memory.** Our mirror writes it to Arkiv as a receipt that cannot be edited, plus running totals ("tallies") for both sides, in one atomic batch. The next agent that asks sees it.
4. **The merchant's phone rings** with the buyer agent's ENS name and its reputation; the shop dispatches, refunds part of an order, renews a subscription.
5. **The human stays in charge.** Vitalik can pause his payer (an ENS record), the owner can kill an agent (its ENS name is unregistered), and an agent cannot raise its own cap: the ENS resolver refuses the write.

The model proposes, code disposes (ADR-0019): limits come from the human's words, rankings are recomputed in code, the payer is bound to the approved order, and money and limits are never decided by a prompt.

## Try it

| what | link |
|---|---|
| The stage: the deck in the middle, Vitalik's phone and the shop's phone driving it | https://graphpay-event.vercel.app |
| How it works, in plain words | https://graphpay-event.vercel.app/how |
| Mumbai map: shops from Arkiv, agents at work (synthetic shops labelled) | https://graphpay-event.vercel.app/map |
| Race mode: plain Arkiv against Graph Arkiv, counting reads | https://graphpay-event.vercel.app/race |
| GraphQL over Arkiv (GET or POST), with the explain trace in `extensions.arkiv` | [a shop's tallies](https://graphpay-event.vercel.app/api/graphql?query=%7Bnode%28ens%3A%22kesar-kingdom.graphpay.eth%22%29%7Bcategory%20tally%7Borders%20refunds%7D%7D%7D) |
| MCP server for any agent (POST; tools `schema`, `ask`, `graphql`, `explain`) | `https://graphpay-event.vercel.app/api/mcp`, also published in ENS as `graphpay.eth`'s `agent-endpoint[mcp]` |
| Our facilitator's health: relayer, balance, daily gas budget, floor | https://graphpay-event.vercel.app/api/facilitator/health |
| The payer agent's live state: ENS status, cap, spent today, last order | https://graphpay-event.vercel.app/api/state/customer |

## Verify each claim

Most links below open a public explorer or a live endpoint, and the rest open this repo's own records; nothing needs a login. Amounts are test USDT (`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`, 6 decimals). The shops' ENS labels are still the test cast's: the good shop Filter & Fold is `kesar-kingdom.graphpay.eth`. Checked against the explorers on Fri 6 Nov, about 23:10 IST.

| claim | evidence |
|---|---|
| An agent pays a shop with one signature and no gas; our facilitator's relayer sends the transaction | A live errand from the site, 20:36 IST: `payer.vitalik.graphpay.eth` paid 4.80 to Filter & Fold, sent by our relayer `0x1AB8…EBf6` ([0xbc05…cd43](https://explorer.testnet.whitechain.io/tx/0xbc052d7f11bd61ab0fcee69a78da0b7fbe5bcbf9821741d1150345a0fe29cd43)). Earlier ones: [0x8617…863a](https://explorer.testnet.whitechain.io/tx/0x8617754857a8eb1fb1483b4f18fb6fa6a4f1607241d3f08c7ccd062de1b8863a), [0x89ac…b990](https://explorer.testnet.whitechain.io/tx/0x89acd9521341763f6f6a37893eec921c9548d7a0b5984597d56088a5f5d5b990) |
| The first agent payment through our facilitator, in real test USDT (Fri 6 Nov, 04:13 IST): the qualifying payment | `acceptance.vitalik.graphpay.eth` → `kesar-kingdom.graphpay.eth`, 4.80, payer gas 0 ([0x8750…2c00](https://explorer.testnet.whitechain.io/tx/0x87505ef2457b6e925fa7378a55fd91419e83c37fb8effc06d901884700c72c00); record [`c7.json`](docs/sessions/payments/c7.json)) |
| The checkout contract is verified on the Whitechain explorer | [`GraphPayCheckout` 0x7523…6FcA](https://explorer.testnet.whitechain.io/address/0x75233b7341B9e86407e4b31599f07b8936716FcA?tab=contract), deployed in [0x0cf2…01f6](https://explorer.testnet.whitechain.io/tx/0x0cf2fc150261d538bf91638af813138475bb28ff9039c6183062d8461b3b01f6) |
| Past the first payment: refund, re-order, subscription | Through the site: the shop refunds 0.80 to the payer from its own phone ([0xcd44…c425](https://explorer.testnet.whitechain.io/tx/0xcd442a5e6675e0eae8a66bc17ee3913af1b673e39a54a28d4a14a0fab58bc425)); "Another coffee" re-orders the filter coffee for 0.80 as a child of a paid order ([0xf1d7…2b4a](https://explorer.testnet.whitechain.io/tx/0xf1d7cb5654de6cc09ede0a404818a009f7429d9d149e3e564222d4a4d3ae2b4a)); the Sunday breakfast box at 2.40 a week, on the labelled 2-minute demo clock, subscribed ([0xf3f7…c393](https://explorer.testnet.whitechain.io/tx/0xf3f7586090fb37cf4b04963216dabc7b89915f02afb19f71fb81ca138e53c393)), renewed by the hosted cron ([0x8d40…de83](https://explorer.testnet.whitechain.io/tx/0x8d40d556382f40313dafaf712d3c174d7cc8365176c8813f04e849f93338de83)) and cancelled with the subscriber's signature ([0x70ed…7b42](https://explorer.testnet.whitechain.io/tx/0x70ed2b3ffa63b81fa426631c70cb39591f8b80c077455930d05e63de04077b42)); the subscriber paid no gas. Earlier, by script: [create](https://explorer.testnet.whitechain.io/tx/0x1a2bb6c80871b22458d66393d6afa075becc55086f2c85ab995dc38077d91180), [renew](https://explorer.testnet.whitechain.io/tx/0x9ca184afaa55ca3ef951ef7ebabf63a22dd98d0516ddceb1e83da9712b3477b0), [cancel](https://explorer.testnet.whitechain.io/tx/0x3a6f278f077f79cd40972b7c4a3c7bb2073f803c98fc9c462330697df87383b5) |
| A revoked agent is refused by the contract, and the refusal is on the chain | `PaymentFailed(AGENT_REVOKED)`, no money moved ([0x05e8…b7f1](https://explorer.testnet.whitechain.io/tx/0x05e812dccf65e255f1a25ed600cdb2e39b4a56e52172b67793c55d0cb86eb7f1)) |
| The payee comes from ENS at pay time | The shop's Whitechain address record (coin type 2147485522) is `0x2694…d03E`, the address every payment above pays to; check it with the snippet below. The acceptance record of a hosted payment shows the payee read from ENS (C2, `payeeRead`). Decision: [ADR-0046](docs/decisions/ADR-0046-the-payee-comes-from-ens-at-pay-time.md) |
| An agent can edit only its own `agent-context` and Whitechain address, never its cap | The acceptance agent's own key set its `agent-context` ([0x12f0…456e](https://sepolia.etherscan.io/tx/0x12f009dfe98a8a5a7b4cab317774cb4d79fc40c64a16bff8cb9093052c7e456e)); its writes to `graphpay.cap_micro`, `graphpay.status`, `x-graphpay-accepts` and `agent-endpoint[mcp]` revert `EACUnauthorizedAccountRoles` in simulation, so none was sent (acceptance B3 in [`ACCEPTANCE_REPORT.md`](ACCEPTANCE_REPORT.md)) |
| The owner can kill an agent, and the gate then refuses it | From the site, Sat 7 Nov 00:16 IST: the owner unregistered `disposable-2.vitalik.graphpay.eth` ([0x08f1…fff5](https://sepolia.etherscan.io/tx/0x08f116fc2ceebb93e1de209fcbb2f60ac53c094c25b3b06d7da6eb16f194fff5)), the watcher revoked its pass on Whitechain 9 s later ([0x40d5…233a](https://explorer.testnet.whitechain.io/tx/0x40d51ac52b440bc33bb6ec2686fe53c53b77be370a84970a0790a744bbd8233a)), and its next payment was refused (`ENS_EXPIRED_OR_REVOKED`) and recorded on Arkiv ([the `fail` edge](https://rabdi.explorer.arkiv.network/entity/0x057e0e89a1d7da0156bec919b0a1c64f3b2ec09427a33c8fb86e34ea8a6afc14)); a fresh spare, `disposable-3`, was then provisioned ([`kill-disposable-2.json`](docs/sessions/identity/kill-disposable-2.json)). The first kill, of `disposable-1`, by script: [0x785a…f29f](https://sepolia.etherscan.io/tx/0x785a13f119ab77f67c1ed8dfa6f1213708fde4f43158122a357e72c018acf29f) (acceptance B6, E7) |
| Every agent payment becomes a receipt on Arkiv that cannot be edited, linked to its Whitechain transaction | Arkiv entity [0xc64b…7204](https://rabdi.explorer.arkiv.network/entity/0xc64b6db9a92d0e17a84f2fd852c653355be86d12bb128ac5df8981d5715d7204), a readonly `pay` edge written by our ledger wallet, carries `ref = 1874:0x8617…863a:3`: the Whitechain payment above. The runnable query below lists them |
| Any agent can ask before it pays, and sees every read | [The live GraphQL answer](https://graphpay-event.vercel.app/api/graphql?query=%7Bnode%28ens%3A%22kesar-kingdom.graphpay.eth%22%29%7Bcategory%20tally%7Borders%20refunds%7D%7D%7D) carries `extensions.arkiv`: the calls, the exact Arkiv queries, the bytes and an explain id. The shops' tallies include labelled synthetic history; [`reputation`](https://graphpay-event.vercel.app/api/graphql?query=%7Bnode%28ens%3A%22kesar-kingdom.graphpay.eth%22%29%7Breputation%7Borders%20refunds%20refundRate%20source%20synthetic%7D%7D%7D) says so (`synthetic: true`) |
| The ranking needs fewer reads on Graph Arkiv (synthetic city, size S) | The city-wide top 10: 2 reads against 5 for plain Arkiv code reading one page at a time (6 with every page at once); [`bench/BENCHMARK-LIVE.md`](bench/BENCHMARK-LIVE.md). Graph Arkiv does not need fewer reads everywhere: Q1, Q4 and Q6 tie, and Q3 needs more |
| Menus live on Swarm, pointed to from Arkiv with a content hash | Filter & Fold's menu on the public gateway ([menu.json](https://api.gateway.ethswarm.org/bzz/25f880463e2702eb5a2e265aa3c78004d5083f430aee1347189e8bb2c6f033dd/menu.json)), referenced by an Arkiv `menu` row ([entity](https://rabdi.explorer.arkiv.network/entity/0x0f32e7cd190884066418a9fb32df6f5807e5bc3f8b59f3a7776f99e3e1de273f)); details in [`arkiv/swarm.md`](arkiv/swarm.md) |
| A shop takes payments with the drop-in kit in 12 lines | [`apps/store`](apps/store) integrates `@graphpay/checkout-kit` in 12 lines across four files (counted by the store's own "How it's built" page; a test holds it to 20 or fewer). One real payment through the kit's client code (the code its browser button runs), run by script against a local store and our hosted facilitator, no gas for the payer: [0xf1e7…3f89](https://explorer.testnet.whitechain.io/tx/0xf1e76a91d855af352e7b38122f94c337be2a74e25ce087eb396b7945be343f89) |
| Both SDKs are on npm | [`@graphpay_ethglobal/arkiv-graph`](https://www.npmjs.com/package/@graphpay_ethglobal/arkiv-graph) and [`@graphpay_ethglobal/agentpay`](https://www.npmjs.com/package/@graphpay_ethglobal/agentpay), both 0.1.1; the AgentPay SDK's first real payment: [0xfbd7…4c7e](https://explorer.testnet.whitechain.io/tx/0xfbd7d307b1b0c08f3af015b4bdb03aaeed12d0c2d18c2553432cb4679ff14c7e) |
| The checks behind all of this | [`ACCEPTANCE_REPORT.md`](ACCEPTANCE_REPORT.md), written by `pnpm acceptance` from `planning/ACCEPTANCE_TESTS.md`: what passes and what fails. In the 22:40 IST run, C3, D4, D8 and E1 fail on evidence from before the story swap, and C7 and E3 on a runner bug that reads the wrong transfer ([`docs/sessions/coordinator/handover.md`](docs/sessions/coordinator/handover.md)); the transactions they cover are linked above |

### Check ENS yourself (stock viem, no keys)

```js
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';

const ens = createPublicClient({ chain: sepolia, transport: http('https://ethereum-sepolia-rpc.publicnode.com') });
await ens.getEnsAddress({ name: 'kesar-kingdom.graphpay.eth', coinType: 2147485522n }); // the shop's Whitechain payout address
await ens.getEnsText({ name: 'payer.vitalik.graphpay.eth', key: 'graphpay.status' });    // 'active' or 'paused'
await ens.getEnsText({ name: 'payer.vitalik.graphpay.eth', key: 'graphpay.cap_micro' }); // its daily cap, 6 decimals
await ens.getEnsText({ name: 'graphpay.eth', key: 'agent-endpoint[mcp]' });              // our MCP server (ENSIP-26)
```

### Query Arkiv yourself (one command, no keys)

The stage payer's receipts, straight from Arkiv Rabdi's public endpoint: readonly `pay` edges written by our ledger wallet, each with the Whitechain transaction in `ref`. The keyless endpoint has a budget per IP address; if it answers `ANON_COST_LIMITED`, wait a few minutes or use the explorer link below.

```bash
curl -s https://rpc.rabdi.db-chain.testnet.arkiv.network -H 'content-type: application/json' --data @- <<'EOF'
{"jsonrpc":"2.0","id":1,"method":"arkiv_query","params":["project = str('graphpay') AND type = str('edge') AND kind = str('pay') AND from_node = key(0xdb661831bb42fdc4c2b6fbed89090c4df6a9e15661c2902dec096c4892e19579) AND $owner = addr(0x7DeAF022B3829C53c73031B7d28Ed9746F517665)",{"select":{"key":true,"attributes":true},"limit":"0x5"}]}
EOF
```

`from_node` is the namehash of `payer.vitalik.graphpay.eth`; the owner filter means only rows from our ledger wallet count. The same query on Arkiv's explorer: [run it](https://rabdi.explorer.arkiv.network/entity-explorer?q=project%20%3D%20str%28%27graphpay%27%29%20AND%20type%20%3D%20str%28%27edge%27%29%20AND%20kind%20%3D%20str%28%27pay%27%29%20AND%20from_node%20%3D%20key%280xdb661831bb42fdc4c2b6fbed89090c4df6a9e15661c2902dec096c4892e19579%29%20AND%20%24owner%20%3D%20addr%280x7DeAF022B3829C53c73031B7d28Ed9746F517665%29).

## Whitechain: payments

- **Why on-chain stablecoin settlement:** agents of different owners need a settlement record that neither side controls. One Whitechain event holds the order, the amount, the refund cap and the subscription terms, and it feeds a reputation that anyone can query on Arkiv.
- **Contract:** `GraphPayCheckout` [`0x75233b7341B9e86407e4b31599f07b8936716FcA`](https://explorer.testnet.whitechain.io/address/0x75233b7341B9e86407e4b31599f07b8936716FcA?tab=contract) on Whitechain Sepolia (chain 1874), source verified on the explorer. Token: test USDT [`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`](https://explorer.testnet.whitechain.io/token/0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7).
- **x402 through our own facilitator:** the shop answers 402 with one quote; the payer signs a Permit2 witness (payee, amount, deadline and order id inside it); our facilitator verifies it, checks the ENS gate and calls `settleOrder`. The payer holds no WBT and sends no transaction.
- **Who pays the gas, and what stops a drain:** our relayer `0x1AB82871c3E1Be64717269D45F08cA9d54C1EBf6` pays it from WBT the team funded from its funding wallet. The facilitator refuses any call without its bearer token, stops below a balance floor of 0.3 WBT, and keeps a daily gas budget of 0.05 WBT ([health](https://graphpay-event.vercel.app/api/facilitator/health)). Each paying agent has an on-chain daily cap, and the ENS gate takes the lower of that and its ENS cap. A signature cannot be replayed: the same order answers "already paid" and sends nothing.
- **Drop-in for any shop:** [`packages/checkout-kit`](packages/checkout-kit) on top of the AgentPay SDK. The separate demo store [`apps/store`](apps/store) adds it in 12 lines; run it with `pnpm --filter @graphpay/store dev` and the env names in [`env.example`](env.example). The merchant view has refunds, delivery marks and an accountant CSV.
- **Feedback for Whitechain:** [`WHITECHAIN_FEEDBACK.md`](WHITECHAIN_FEEDBACK.md).

## ENS: identity for agents (ENSv2 on Sepolia)

- **Root name:** `graphpay.eth`, with its own subname registry [`0xbfcF13F0Cbc15dE5F7337e8CB69eeE2641407823`](https://sepolia.etherscan.io/address/0xbfcF13F0Cbc15dE5F7337e8CB69eeE2641407823) and resolver [`0x82d9bBf1a2D2726e649Ac985241ECfdeE802Fa8d`](https://sepolia.etherscan.io/address/0x82d9bBf1a2D2726e649Ac985241ECfdeE802Fa8d). Every owner (Vitalik and the three shops) has its own registry and resolver, and every agent its own resolver; the full table, with every transaction, is [`docs/sessions/identity/namespace.md`](docs/sessions/identity/namespace.md).
- **What ENS decides:** whether an agent may pay (`graphpay.status`, its registry state, its expiry), how much (`graphpay.cap_micro`), and where the money goes (the shop's coin type 2147485522 address, read at pay time). The registry decides, not the records: a killed agent's old records do not keep it alive.
- **Scoped keys (Enhanced Access Control):** an agent's own key may set only its `agent-context` and its Whitechain address; its cap and status belong to its owner.
- **Agents as namespaces:** `concierge`, `scout`, `analyst` and `payer` under `vitalik.graphpay.eth`; `storefront`, `risk` and `dispatch` under each shop; expiring, non-transferable subnames. ENSIP-26 records: `agent-context` and `agent-endpoint[mcp]` on the root and on every agent, `agent-endpoint[web]` on the root. Synthetic agents such as `sim-0042.sim.graphpay.eth` resolve through a wildcard resolver with no per-agent transaction and say "synthetic agent, unverified".
- **ENS contracts used** (the ENSv2 Sepolia deployment): `packages/config/graphpay.config.json` (`ens.contracts`), checked against ENS's deployments page in [`docs/technical/FACTS.md`](docs/technical/FACTS.md).
- **Partner notes:** [`docs/submission/ENS.md`](docs/submission/ENS.md).

## Arkiv: the money graph

- **Writer wallets** (addresses only; each writes one kind of row, and readers trust a row only from its writer):

| wallet | writes |
|---|---|
| W_LEDGER [`0x7DeAF022B3829C53c73031B7d28Ed9746F517665`](https://rabdi.explorer.arkiv.network/address/0x7DeAF022B3829C53c73031B7d28Ed9746F517665) | the money mirror: nodes, readonly edges (receipts), tallies, pair links, checkpoints |
| W_SYNC [`0x7c32D2a9Cc01Fb855Ab7877E99886bE8d846ED71`](https://rabdi.explorer.arkiv.network/address/0x7c32D2a9Cc01Fb855Ab7877E99886bE8d846ED71) | the recorder: off-chain refusals (an over-cap attempt, a refund request) |
| W_DIRECTORY [`0x146002b43A9Fb8EB963699e77Ed18579dC30A6e4`](https://rabdi.explorer.arkiv.network/address/0x146002b43A9Fb8EB963699e77Ed18579dC30A6e4) | the directory: shops, quotes, open-now heartbeats, agent presence, hand-offs, Swarm menu pointers |
| W_SEED_EVENT [`0x9DA407FfDbF6e4dee5f972f7adcFA873D72B60D0`](https://rabdi.explorer.arkiv.network/address/0x9DA407FfDbF6e4dee5f972f7adcFA873D72B60D0) | the synthetic city at size S, labelled synthetic |
| W_SEED_M_EVENT [`0x734Fc394248777046fb80d55AD1f0b0C142a0d64`](https://rabdi.explorer.arkiv.network/address/0x734Fc394248777046fb80d55AD1f0b0C142a0d64) | the synthetic city at size M, labelled synthetic (not seeded yet: acceptance D7) |

- **The entities:** [`arkiv/schema.md`](arkiv/schema.md). **Partner files:** [`arkiv/friction.md`](arkiv/friction.md), [`arkiv/reach.md`](arkiv/reach.md), [`arkiv/why-arkiv.md`](arkiv/why-arkiv.md), [`arkiv/how-you-use-arkiv.md`](arkiv/how-you-use-arkiv.md), [`arkiv/swarm.md`](arkiv/swarm.md).

## SDKs on npm

Two MIT packages, each for one partner's network and testnet only. GraphPay's money graph is built on arkiv-graph, and the drop-in checkout kit on agentpay; the live site is their reference app (ADR-0076).

| package | version | what it does |
|---|---|---|
| [`@graphpay_ethglobal/arkiv-graph`](https://www.npmjs.com/package/@graphpay_ethglobal/arkiv-graph) | 0.1.1 | A generic graph on Arkiv: you define the nodes, edges and totals, and every read comes with an explain trace. Source: [`packages/arkiv-graph`](packages/arkiv-graph). |
| [`@graphpay_ethglobal/agentpay`](https://www.npmjs.com/package/@graphpay_ethglobal/agentpay) | 0.1.1 | Agent payments in test USDT on Whitechain Sepolia. An AI agent pays an HTTP 402 with one signature and no gas, under an on-chain spending pass. A merchant prices any route and settles through its own relayer, with the anti-drain limits on. Source: [`packages/agentpay`](packages/agentpay). |

Each README has a five-minute quickstart. Feedback goes to GitHub issues labelled `arkiv-graph` or `agentpay`, plus `feedback`. The published versions are frozen from the submission until judging ends.

## Architecture

```
 Vitalik's phone ──► concierge ─► scout ─► analyst ─► payer          (Kimi models; code checks every limit)
                                     │        │          │ 402 → one signature
                                     ▼        ▼          ▼
                     Arkiv (directory, GraphQL + MCP)   shop ──► our facilitator ──► GraphPayCheckout (Whitechain 1874)
                                     ▲                   │ ENS gate + payee        │ PaymentSettled, Refunded, Renewed
                                     │                   ▼                         ▼
                                     └──── mirror (W_LEDGER): receipts and tallies on Arkiv Rabdi, one batch per event
 ENSv2 on Sepolia: names, status, caps, payee addresses, scoped keys, kill switch
```

| path | what |
|---|---|
| `packages/contracts/` | the Whitechain checkout contract and its Foundry tests |
| `packages/facilitator/`, `packages/shop/` | our x402 facilitator and the shop API |
| `packages/ens/` | the ENSv2 namespace, the gate, the owner actions and the watcher |
| `packages/arkiv-graph/`, `packages/money-graph/` | the generic graph SDK and GraphPay's money model, GraphQL and MCP on top of it |
| `packages/mirror/` | the workers: Whitechain events into Arkiv receipts and tallies |
| `packages/agents/` | the buyer and shop agents |
| `packages/agentpay/`, `packages/checkout-kit/` | the payments SDK and the drop-in kit |
| `packages/city/` | the synthetic city generator |
| `packages/config/` | `story.json`, the one story config (cast, shops, prices, demo steps, model presets; ADR-0047), and `graphpay.config.json`, every address and URL (ADR-0030) |
| `apps/web/` | the website and the hosted routes (Vercel project `graphpay-event`) |
| `apps/phones/`, `frontend/` | the team's two phone apps (`frontend/`) and their build into the live site (ADR-0070) |
| `apps/store/` | the separate demo store for the drop-in kit |
| `planning/` | the pre-event knowledge pack, committed unchanged (no code) |
| `docs/` | the event's records: `plan/`, `decisions/` (ADRs), `technical/` (facts, versions, wallets), `problems/`, `sessions/`, `thinking-partner/` |
| `prompts/raw/` | the redacted prompt log |

## Develop

Requirements: Node 22 (`.node-version`), pnpm 10.34.9 (`packageManager`), Foundry 1.9.0 for the contracts.

```bash
pnpm install
pnpm check
pnpm test
```

Secrets live only in the git-ignored `.env` (names in [`env.example`](env.example)) and in Vercel as Sensitive values. Helpers print names and addresses, never values: `pnpm secrets:status`, `pnpm secrets:set NAME` (hidden input), `pnpm secrets:gen NAME`, `pnpm wallet:gen --only ROLE`. Networks: Whitechain Sepolia (1874), Ethereum Sepolia (11155111) for ENSv2, Arkiv Rabdi (7794095); addresses and URLs in [`packages/config/graphpay.config.json`](packages/config/graphpay.config.json), verified facts in [`docs/technical/FACTS.md`](docs/technical/FACTS.md).

## Limitations

- **Testnets only,** with test USDT. The demo shops, the cast and the synthetic city are story data, labelled synthetic; the shops' tallies include labelled synthetic history, and the accountant CSV lists those history rows (`history-buyer-N.sim…` names, no transaction) beside the real ones.
- **Receipts lapse:** every row the ledger writes, receipts included, lives 30 days on Arkiv (synthetic rows 14); a lapsed receipt can be rebuilt from its Whitechain transaction, named in its `ref`.
- **Not every payment is mirrored:** the mirror writes the payments of named agents and people; a payer it does not know, such as the scripted kit payment, is parked, not recorded.
- **The Arkiv category** of the dosa shops still says `sweets` until the city stream renames it.
- **Not on the stage's phones yet:** Subscribe and Cancel, and the kill, are buttons on the [`/customer`](https://graphpay-event.vercel.app/customer) page ([#173](https://github.com/Zugzwang-world/graphpay/pull/173), [#175](https://github.com/Zugzwang-world/graphpay/pull/175); the kill appears when a spare disposable agent is ready); the shop's Decline of a refund request is a route ([#163](https://github.com/Zugzwang-world/graphpay/pull/163)); the over-the-pass refusal ("Dosas for everyone at the hackathon", 480 test USDT) and the agent's own cap raise are routes since [#169](https://github.com/Zugzwang-world/graphpay/pull/169), each refused and recorded on Arkiv, without buttons yet; the owner's cap change has no hosted route by design (ADR-0021); and the encrypted refund photo on Swarm is not built.
- **The shops' ENS labels:** the site still uses the test cast's (`kesar-kingdom`, `syrup-street`, `jamun-junction`). The dosa shops' own names, `filter-and-fold`, `idli-index` and `tawa-tangle` under `graphpay.eth`, were registered on Sepolia on Fri 6 Nov ([#158](https://github.com/Zugzwang-world/graphpay/pull/158)); the site moves to them at the label flip.
- **Public access:** anyone can press Pause, run an errand or use up the payer's daily cap; the on-chain caps and the relayer's floor bound what that costs (ADR-0069). Since [#172](https://github.com/Zugzwang-world/graphpay/pull/172) the site heals itself: it resumes a paused agent after 2 minutes and reopens a closed shop after 5.
- **Graph Arkiv wins on aggregates, not everywhere:** at size S it ties or needs more reads on some questions ([`bench/BENCHMARK-LIVE.md`](bench/BENCHMARK-LIVE.md)).
- **The mirror runs on the team's laptop** (`pnpm workers`, ADR-0056); if it stops, receipts reach Arkiv when it resumes, from its checkpoint.

## Team

- **[Zugzwang-world](https://github.com/Zugzwang-world)**, the founder: the product, the story and the design, every decision (the ADRs), the funding, the rehearsals, the video and the pitch; directed the Claude Code sessions.
- **[ajatshatru01](https://github.com/ajatshatru01)**: the two phone apps in `frontend/` (#70, #132).

AI use, in full: [`AI_USAGE.md`](AI_USAGE.md). License: MIT ([`LICENSE`](LICENSE)).
