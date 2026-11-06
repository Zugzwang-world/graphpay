# ETHGlobal Mumbai: the submission, ready to paste

For the founder. Paste each block into the field of the same name on the Hacker Dashboard. Every claim in the blocks links to its evidence, either directly or through the README's ["Verify each claim"](../../README.md#verify-each-claim) table, where each row opens a public explorer or a live endpoint. **Submit by Sat 7 Nov, 08:00 IST** (the form closes at 09:00 IST; no late entries). The form takes a title, a description and the repo link, then up to three partner prizes ([`docs/technical/FACTS.md`](../technical/FACTS.md)). If a field is shorter than a block, cut from the end of the block: each one leads with what matters most.

Status of this text: written Fri 6 Nov, 23:38 IST, against the live site and the explorers; every URL in it answered then. The last section lists what the night streams may still change before you paste.

---

## Project name

```text
GraphPay
```

## Short description (one line, under 100 characters)

```text
AI agents with ENS names ask a money graph on Arkiv, then pay shops in USDT on Whitechain.
```

## Description

```text
GraphPay: ask before you pay. AI agents with ENS names pay shops in test USDT on Whitechain through our own x402 facilitator, and every payment becomes part of a money graph on Arkiv that any agent can ask, with an explain trace of every read, before it pays. Identify (ENS), remember (Arkiv), pay (Whitechain): agents that can pay, can be trusted and can be stopped.

Live demo, open to everyone with no passcode: https://graphpay-event.vercel.app

The story: Vitalik types one sentence on his phone: "Just landed in Mumbai. Get me the best masala dosa near BKC under 6 USDT, delivered within an hour." His agents find the shops near him on Arkiv, ask the money graph for each shop's orders, refunds and on-time rate, refuse the trap shop with its reasons, and pay the good shop 4.80 USDT with one signature and no gas. A live payment from the site: https://explorer.testnet.whitechain.io/tx/0xbc052d7f11bd61ab0fcee69a78da0b7fbe5bcbf9821741d1150345a0fe29cd43

The shop's phone rings with the buyer agent's ENS name and its reputation. The shop dispatches, refunds part of an order (https://explorer.testnet.whitechain.io/tx/0xcd442a5e6675e0eae8a66bc17ee3913af1b673e39a54a28d4a14a0fab58bc425) and exports a CSV for its accountant, with the shop's labelled synthetic history beside the real rows (https://graphpay-event.vercel.app/api/merchant/export.csv); a weekly subscription renews on its own (https://explorer.testnet.whitechain.io/tx/0x8d40d556382f40313dafaf712d3c174d7cc8365176c8813f04e849f93338de83) and is cancelled with the subscriber's signature (https://explorer.testnet.whitechain.io/tx/0x70ed2b3ffa63b81fa426631c70cb39591f8b80c077455930d05e63de04077b42).

The human stays in charge. Pausing an agent is one ENS record. The owner can kill an agent by unregistering its name: the watcher revokes its pass on Whitechain, and its next payment is refused and recorded on Arkiv. A kill from the site: https://sepolia.etherscan.io/tx/0x08f116fc2ceebb93e1de209fcbb2f60ac53c094c25b3b06d7da6eb16f194fff5 (the revoke: https://explorer.testnet.whitechain.io/tx/0x40d51ac52b440bc33bb6ec2686fe53c53b77be370a84970a0790a744bbd8233a). An agent cannot raise its own cap, because its ENS resolver refuses the write. The payee is read from the shop's ENS name at pay time, never hard-coded.

Every agent payment becomes a receipt on Arkiv that cannot be edited, linked back to its Whitechain transaction, plus running tallies for both sides, written in one atomic batch. Any agent can ask the graph over GraphQL or MCP and see the exact Arkiv reads behind each answer: https://graphpay-event.vercel.app/api/graphql?query=%7Bnode%28ens%3A%22filter-and-fold.graphpay.eth%22%29%7Bcategory%20tally%7Borders%20refunds%7D%7D%7D

Both SDKs we wrote are on npm, MIT, testnet only: @graphpay_ethglobal/arkiv-graph (a generic graph on Arkiv with explain traces) and @graphpay_ethglobal/agentpay (agent payments over x402 on Whitechain). Every claim above, with its evidence: https://github.com/Zugzwang-world/graphpay#verify-each-claim

Mr. Vitalik is a fictional persona made for this demo; no real person is depicted or endorses GraphPay. All demo data is synthetic and labelled; testnets only.
```

## How it's made

```text
Whitechain Sepolia (pay). GraphPayCheckout, a Solidity contract built and tested with Foundry and verified on the Whitechain explorer (https://explorer.testnet.whitechain.io/address/0x75233b7341B9e86407e4b31599f07b8936716FcA?tab=contract): one-signature orders settled by a relayer through a Permit2 witness (payee, amount, deadline and order id inside the signature), refunds capped by the order, re-orders as children of a paid order, subscriptions renewed by a relayer and cancelled by the subscriber's signature, and per-agent daily caps the contract enforces, recording a refusal on the chain. Our own x402 facilitator runs on Vercel: the shop answers HTTP 402 with one quote, the agent signs once, the facilitator checks the ENS gate, verifies and settles, and its relayer pays the gas under a balance floor and a daily gas budget (https://graphpay-event.vercel.app/api/facilitator/health). The first agent payment through our facilitator, in real test USDT: https://explorer.testnet.whitechain.io/tx/0x87505ef2457b6e925fa7378a55fd91419e83c37fb8effc06d901884700c72c00

ENSv2 on Ethereum Sepolia (identify). Our own subname registry under graphpay.eth, a registry and resolver per owner, a resolver per agent, and agents as namespaces (payer.vitalik.graphpay.eth, risk.<shop>.graphpay.eth) with expiring, non-transferable names. Scoped setter roles (Enhanced Access Control) let an agent set only its agent-context and its Whitechain address, so it cannot raise its own cap. ENSIP-26 records publish our MCP server from the root name. A wildcard resolver serves synthetic agents with no per-agent transaction. The gate reads status, registry state, expiry, cap and the payee address live with stock viem; a watcher keeps the on-chain policies in step, so a killed agent stays dead. Every transaction: https://github.com/Zugzwang-world/graphpay/blob/main/docs/sessions/identity/namespace.md

Arkiv Rabdi (remember). A mirror turns each Whitechain event between named actors into a readonly receipt plus tallies for both ends, the pair link and a checkpoint, in one atomic batch, so a restart never double-counts. Arkiv has no SUM or GROUP BY, so the tallies make a city-wide top 10 two reads where plain code needs five (synthetic city, size S; on other questions it ties or needs more, and we say so: https://github.com/Zugzwang-world/graphpay/blob/main/bench/BENCHMARK-LIVE.md). Every read is scoped to our writer wallets; expiring rows drive "open now", agents at work and quotes; GraphQL and MCP routes return an explain trace of every Arkiv call. Menus live on Swarm through the public gateway, with their content hash on Arkiv. The graph layer is a generic package on npm: https://www.npmjs.com/package/@graphpay_ethglobal/arkiv-graph

Agents. Seven agents (concierge, scout, analyst and payer for the buyer; storefront, risk and dispatch for the shop). Three of them make one Kimi K3.1 Pro call each per errand, through the Vercel AI SDK: the concierge chooses, the analyst ranks, the shop's risk agent judges the buyer; the routine steps run in code under each agent's name, so an errand takes 3 model calls instead of 19. The model proposes, code disposes: limits come from the human's words, rankings are recomputed in code, the payer is bound to the approved order, and money is never decided by a prompt.

The stage. Next.js on Vercel: the deck in the middle, driven live by the team's two phone apps (React, Vite, Tailwind) for the customer and the shop; figurines and photos from our Grok desk. No database of our own: state lives on the Whitechain contract and on Arkiv, and the website only runs code.

How we built it. All code was written during the hackathon: by us with Claude Code, in parallel sessions, from specs we wrote before the event (committed unchanged in planning/), and the team's two phone apps by our teammate, with GitHub Copilot. Full AI disclosure, including Kimi at runtime and the Grok desk's assets: https://github.com/Zugzwang-world/graphpay/blob/main/AI_USAGE.md

Notable hacks: the payee comes from ENS at the moment of payment; every Arkiv receipt names its Whitechain transaction in a ref attribute, so anyone can re-derive the tallies from the chain; the graph node is the ENS name plus its epoch, so a re-registered name cannot inherit an old reputation (fork-tested); a shop's "open now" is a row that expires unless the shop keeps it alive.
```

## Links

| field | paste |
|---|---|
| GitHub repo | `https://github.com/Zugzwang-world/graphpay` |
| Live demo | `https://graphpay-event.vercel.app` |
| Demo video | **the founder pastes the link after recording** (2 to 4 minutes, your own voice, every party shown) |
| Other links (if the form has a field) | `https://www.npmjs.com/package/@graphpay_ethglobal/arkiv-graph` · `https://www.npmjs.com/package/@graphpay_ethglobal/agentpay` · `https://graphpay-event.vercel.app/race` · `https://graphpay-event.vercel.app/map` |

## Partner prizes (three, the most the form takes; ADR-0051)

### 1. Arkiv: Build on Arkiv (with the Arkiv + Swarm bonus)

```text
GraphPay's memory is a money graph on Arkiv Rabdi: every agent payment, refund, delivery and renewal on Whitechain becomes a readonly receipt plus running tallies, written in one atomic batch by our ledger wallet, and any agent asks it before it pays, over GraphQL or MCP, with an explain trace of every Arkiv read. Filters drive discovery (a shop box query by i32 coordinates), owner scoping decides whose rows count, expiry runs "open now", agents at work and quotes, readonly makes receipts that cannot be edited, and count() verifies a reputation against the raw rows. Swarm holds the shops' menus and their dish photos, with their hashes on Arkiv, so anyone can check the bytes. We published the graph layer as a generic SDK: npm i @graphpay_ethglobal/arkiv-graph.
Friction: https://github.com/Zugzwang-world/graphpay/blob/main/arkiv/friction.md
Reach: https://github.com/Zugzwang-world/graphpay/blob/main/arkiv/reach.md
Why Arkiv: https://github.com/Zugzwang-world/graphpay/blob/main/arkiv/why-arkiv.md
How we use Arkiv: https://github.com/Zugzwang-world/graphpay/blob/main/arkiv/how-you-use-arkiv.md
Schema: https://github.com/Zugzwang-world/graphpay/blob/main/arkiv/schema.md
Swarm: https://github.com/Zugzwang-world/graphpay/blob/main/arkiv/swarm.md
Writer wallets: https://github.com/Zugzwang-world/graphpay#arkiv-the-money-graph
A runnable query with no keys: https://github.com/Zugzwang-world/graphpay#query-arkiv-yourself-one-command-no-keys
```

### 2. ENS: Best Use of ENSv2

```text
ENS decides every GraphPay payment. Each person, agent and shop has a name under graphpay.eth on ENSv2 (Sepolia), with our own subname registry, a registry and resolver per owner and a resolver per agent. Before any payment, our facilitator reads the paying agent's name live: its status record (Pause is one ENS record), its registry state (the owner's kill switch: an unregistered agent is refused, whatever its old records say), its expiry and its cap; and it reads the shop's Whitechain payout address from the shop's name at pay time, never from code. Enhanced Access Control scopes each agent's key: it can update its own agent-context, but its attempt to raise its own cap reverts: the resolver refuses it in simulation, so nothing is sent, and the attempt is recorded on Arkiv. ENSIP-26 records publish our MCP server from the root name, and a wildcard resolver serves synthetic agents with no per-agent transaction. A re-registered name gets a new epoch (a fork test), so it cannot inherit an old reputation on Arkiv.
Live demo: https://graphpay-event.vercel.app
ENS partner note, with every transaction: https://github.com/Zugzwang-world/graphpay/blob/main/docs/submission/ENS.md
Root name, registry and resolver: https://github.com/Zugzwang-world/graphpay#ens-identity-for-agents-ensv2-on-sepolia
```

### 3. Whitechain: Operate (stablecoin payments for business)

```text
GraphPay gets a business paid in USDT on Whitechain, past the first payment. Customers' AI agents pay with one signature and no gas through our own x402 facilitator; the shop sees each order on its phone with the buyer's ENS name and reputation, dispatches, refunds part of an order, renews a subscription and exports a CSV for its accountant. Why on-chain stablecoin settlement: agents of different owners need a settlement record neither side controls; one Whitechain event holds the order, the amount, the refund cap and the subscription terms, and it feeds a reputation anyone can query on Arkiv. Any shop can add the drop-in checkout kit in 12 lines (our separate demo store does), on top of our AgentPay SDK on npm.
Verified contract: https://explorer.testnet.whitechain.io/address/0x75233b7341B9e86407e4b31599f07b8936716FcA?tab=contract
The qualifying payment in test USDT: https://explorer.testnet.whitechain.io/tx/0x87505ef2457b6e925fa7378a55fd91419e83c37fb8effc06d901884700c72c00
Refund: https://explorer.testnet.whitechain.io/tx/0xcd442a5e6675e0eae8a66bc17ee3913af1b673e39a54a28d4a14a0fab58bc425
Re-order: https://explorer.testnet.whitechain.io/tx/0xf1d7cb5654de6cc09ede0a404818a009f7429d9d149e3e564222d4a4d3ae2b4a
Subscription, on a labelled 2-minute demo clock: subscribe https://explorer.testnet.whitechain.io/tx/0xf3f7586090fb37cf4b04963216dabc7b89915f02afb19f71fb81ca138e53c393 · renewal https://explorer.testnet.whitechain.io/tx/0x8d40d556382f40313dafaf712d3c174d7cc8365176c8813f04e849f93338de83 · cancel https://explorer.testnet.whitechain.io/tx/0x70ed2b3ffa63b81fa426631c70cb39591f8b80c077455930d05e63de04077b42
Accountant export (it lists the shop's labelled synthetic history beside the real rows): https://graphpay-event.vercel.app/api/merchant/export.csv
Drop-in store (12 lines): https://github.com/Zugzwang-world/graphpay/tree/main/apps/store
Feedback: https://github.com/Zugzwang-world/graphpay/blob/main/WHITECHAIN_FEEDBACK.md
Setup: https://github.com/Zugzwang-world/graphpay#develop
Architecture: https://github.com/Zugzwang-world/graphpay#architecture
Limitations: https://github.com/Zugzwang-world/graphpay#limitations
```

## Before you press Submit (the founder)

- [ ] The demo video link is in the Links field, and the video is public (2 to 4 minutes, your own voice, no text-to-speech).
- [ ] Every team member is on the ETHGlobal project (the README's Team section names `Zugzwang-world` and `ajatshatru01`; add anyone missing).
- [ ] The written pre-event disclosure was sent ([`docs/plan/DISCLOSURE_MESSAGE.md`](../plan/DISCLOSURE_MESSAGE.md)).
- [ ] The three partner prizes above are selected: Arkiv, ENS, Whitechain Operate.
- [ ] The live demo opens, the payer agent is active and the shop is open ([live state](https://graphpay-event.vercel.app/api/state/customer)).

## What can still change tonight (W7 updates this file when it lands)

- **W1, the shops' ENS names:** done; the links use `filter-and-fold.graphpay.eth` since the label flip (#189).
- **W2, the race at size M:** the "two reads where plain code needs five" line becomes the size-M numbers, labelled synthetic with the city size.
- **W6, the SDKs at 1.0.0:** arkiv-graph 1.0.0 is on npm (Sat 00:34 IST); agentpay's 1.0.0 waits for its publish. The form text names no version, so nothing here changes.
- **W3, the re-order and subscriptions:** a newer refund, re-order or renewal link, if one replaces these.
