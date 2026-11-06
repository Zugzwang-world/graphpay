# Reach: what anyone can use from GraphPay on Arkiv

```bash
npm i @graphpay_ethglobal/arkiv-graph
```

GraphPay is built on a graph layer we wrote for Arkiv during the event and published for everyone: [`@graphpay_ethglobal/arkiv-graph`](https://www.npmjs.com/package/@graphpay_ethglobal/arkiv-graph) (MIT, source in [`packages/arkiv-graph`](../packages/arkiv-graph)). Nothing in it is specific to payments (ADR-0057): you define nodes, edges and totals; it writes each event as one atomic batch, reads rows scoped to a wallet you trust, and gives every read an explain trace. Around it, four things anyone can use today, with no account and no key.

## 1. The SDK: a graph on Arkiv in ten lines

Needs Node 22. Runs in memory against ArkivSim (an in-memory Arkiv node the stock `@arkiv-network/sdk` talks to), so it needs no keys and no funds; the same code runs on Rabdi with your own testnet key.

```js
import { connect, createStore, defineGraph, nodeKeyOf } from '@graphpay_ethglobal/arkiv-graph';

const graph = defineGraph({ project: 'quickstart', node: { columns: ['handle:str'] },
  totals: { counters: ['likes'], rules: { like: { likes: 'count' } } } });
const store = createStore({ graph, arkiv: await connect(), stream: 'quickstart' });
const person = (handle) => ({ node: nodeKeyOf(handle), epoch: 0, kind: 'person', columns: { handle } });
await store.write([{ ref: 'e1', kind: 'like', from: person('ada'), to: person('grace'), ts: Math.floor(Date.now() / 1000) }]);
const { rows, explain } = await store.query('totals', { filter: { node: { eq: nodeKeyOf('grace') }, window: { eq: 'all' } } });
console.log(rows[0].likes, explain.queries); // 1n, and the exact Arkiv query behind it
```

The package README has the five-minute quickstart, the Rabdi connection, the concepts and the API, and [`examples/leaderboard.mjs`](../packages/arkiv-graph/examples/leaderboard.mjs) builds a game leaderboard with no payments in it.

## 2. The live money graph over GraphQL

`https://graphpay-event.vercel.app/api/graphql` takes GET (`?query=`) or POST. Every answer carries `extensions.arkiv`: the calls, the exact Arkiv queries, the bytes, the entity keys and an explain id. Try [a shop's tallies](https://graphpay-event.vercel.app/api/graphql?query=%7Bnode%28ens%3A%22filter-and-fold.graphpay.eth%22%29%7Bcategory%20tally%7Borders%20refunds%7D%7D%7D). The schema has `node`, `top`, `path`, `neighborhood`, `edges`, `order`, `shops` (a box query by `i32` coordinates), `agentsOnline` and `handoffs`. An explain id opens again at `/api/explain/<id>` (JSON) or `/explain/<id>` (a page) while the server instance keeps it (the last 200 answers); the trace in the answer itself is the lasting copy.

## 3. An MCP server any agent can add

```bash
claude mcp add --transport http graphpay https://graphpay-event.vercel.app/api/mcp
```

Read-only tools: `schema` (the GraphQL SDL), `ask` (fixed money questions about ENS names: `shop_reputation`, `buyer_risk`, `compare_shops`, `order_trail`), `graphql` (one bounded query) and `explain`. Every answer ends with its explain id and its number of Arkiv calls. An agent does not even need our URL: it is published in ENS as `graphpay.eth`'s `agent-endpoint[mcp]` (ENSIP-26), and GraphPay's own buyer agents use the same tools before they pay.

## 4. Raw Arkiv, one command

The README's [keyless query](../README.md#query-arkiv-yourself-one-command-no-keys) reads the stage payer's receipts straight from Rabdi's public endpoint, with an explorer "run this query" link. The entity types and attributes are in [`schema.md`](schema.md), so anyone can write their own reads against the same rows.

## Installs and feedback

- **Published** (IST): 0.1.0 at 10:14 and 0.1.1 at 11:34 on Fri 6 Nov, and **1.0.0 at 00:34 on Sat 7 Nov**; `latest` is 1.0.0 (the registry, read 00:37 IST; shasum `2bde2d21…6adf16b`, 21 files). 1.0.0 is the same API, with five bugs fixed (each with a test that fails on 0.1.1), every export documented and typed, and the quickstart first ([#174](https://github.com/Zugzwang-world/graphpay/pull/174)); it was packed and installed from the tarball in an empty folder before the publish, and our ten-line quickstart above runs on it unchanged. Each 0.1.x version was installed from the registry in an empty folder outside the repo, and its quickstart ran ([`docs/sessions/records/resume.md`](../docs/sessions/records/resume.md); [`docs/technical/FACTS.md`](../docs/technical/FACTS.md) has the shasums).
- **Downloads:** npm's public download counter has no data yet for a package published today (`api.npmjs.org` answered "not found" at 23:25 IST), so we claim no install numbers.
- **Feedback:** a GitHub issue template adds the labels `arkiv-graph` and `feedback` ([open one](https://github.com/Zugzwang-world/graphpay/issues/new?template=arkiv-graph-feedback.yml)); what we were asked and what we did goes in [`FEEDBACK.md`](../packages/arkiv-graph/FEEDBACK.md). No issue had been opened by 23:25 IST.
- **Freeze:** the published versions stay frozen from the submission until judging ends (ADR-0063).

## After Mumbai

- **Keyset paging.** The node already returns a `cursor` with each page; our reads still page by offset under a row cap and mark a cut answer `truncated`. Moving to the cursor removes the repeat-or-skip risk under concurrent writes ([`friction.md`](friction.md)).
- **A proposal for server-side aggregates** (`sum`, `count` by group). With them, tallies become an optimisation rather than a requirement; `count()` already exists and checks our answers.
- **A React kit** on top of the UI-free package; the live site stays the reference app until then (ADR-0076).
- **More graphs:** the leaderboard example is the template for any "who did what to whom, how often" data: follows, reviews, deliveries, attestations.

## Credit

Built on [`@arkiv-network/sdk`](https://www.npmjs.com/package/@arkiv-network/sdk) 1.0.1 and viem. There is another npm package called [`arkiv-graph`](https://www.npmjs.com/package/arkiv-graph) (by SantiagoDevRel), which shows Arkiv entities as interactive graphs and tables; ours is a different project, a data model with traced reads and no user interface, and we did not use its code.
