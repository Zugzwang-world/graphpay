# @graphpay_ethglobal/arkiv-graph

A graph layer over [Arkiv](https://docs.arkiv.network). You define **nodes**, **edges** and **totals**; the package writes each event as one atomic batch, reads rows back scoped to a wallet you trust, and gives every read an **explain** trace you can show to a user or another program.

Built at ETHGlobal Mumbai for GraphPay, where it holds a live graph. Nothing in this package is specific to GraphPay: it runs a leaderboard as happily as anything else (see [`examples/leaderboard.mjs`](examples/leaderboard.mjs)). MIT licensed.

- **Define** a graph in a few lines: the node and edge columns, and which edge kinds move which counters.
- **Write** with a safe writer: one transaction per event (the edge, both ends' totals, a checkpoint), split by size for bulk loads, found again by its nonce after a lost reply, so a write that may or may not have landed is not written twice.
- **Query** with a plain filter object. Every read is scoped to one owner wallet and every returned row is checked again, so rows written by anyone else are never trusted.
- **Explain** every answer: the exact Arkiv queries behind it and a stable id (the same work gives the same id).
- **Test** with ArkivSim, an in-memory Arkiv node that the stock `@arkiv-network/sdk` talks to over its normal client. No keys, no network.

## Quickstart (5 minutes)

Needs Node 22 or newer.

```bash
mkdir arkiv-graph-demo && cd arkiv-graph-demo
npm init -y && npm pkg set type=module
npm install @graphpay_ethglobal/arkiv-graph
```

Save this as `quickstart.mjs` (it is also in [`examples/quickstart.mjs`](examples/quickstart.mjs)):

```js
import { connect, createStore, defineGraph, nodeKeyOf } from '@graphpay_ethglobal/arkiv-graph';

// 1. Define the graph: node columns, and which edge kinds move which totals.
const graph = defineGraph({
  project: 'quickstart',
  node: { columns: ['handle:str'] },
  totals: {
    counters: ['follows', 'likes'],
    rules: { follow: { follows: 'count' }, like: { likes: 'count' } },
  },
});

// 2. Connect. No URL means ArkivSim: in memory, no keys, nothing to fund.
const arkiv = await connect();
const store = createStore({ graph, arkiv, stream: 'quickstart' });

// 3. Write events. Each is one atomic batch: the edge, both ends' totals, the checkpoint.
const person = (handle) => ({ node: nodeKeyOf(handle), epoch: 0, kind: 'person', columns: { handle } });
const ts = Math.floor(Date.now() / 1000);
await store.write([
  { ref: 'e1', kind: 'follow', from: person('ada'), to: person('grace'), ts },
  { ref: 'e2', kind: 'like', from: person('ada'), to: person('grace'), ts },
  { ref: 'e3', kind: 'like', from: person('linus'), to: person('grace'), ts },
]);

// 4. Query. Reads are scoped to the one wallet that wrote, and every read is traced.
const { rows, explain } = await store.query('totals', {
  filter: { node: { eq: nodeKeyOf('grace') }, window: { eq: 'all' } },
});
console.log('grace:', { follows: rows[0].follows, likes: rows[0].likes });

// 5. Explain: the exact queries behind that answer.
console.log('explain', explain.explainId, `- ${explain.calls} read(s):`);
for (const q of explain.queries) console.log('  ', q);
```

```bash
node quickstart.mjs
```

```
grace: { follows: 1n, likes: 2n }
explain bb8d7bfd1ae4 - 1 read(s):
   project = str('quickstart') AND type = str('totals') AND node = key(0x…) AND window = str('all') AND $owner = addr(0x…) LIMIT 100 OFFSET 0
```

(The sim makes a fresh key on every run, so the owner address and the explain id differ each time; the explain id is a hash of the queries and the backend.)

### The same code on Arkiv Rabdi (testnet)

Replace step 2 with your own node and your own key. **Testnet only**: use a throwaway wallet, never one that holds real funds.

```js
const arkiv = await connect({
  rpcUrl: process.env.ARKIV_RPC_URL,          // https://rpc.rabdi.db-chain.testnet.arkiv.network
  chainId: 7794095,                           // Arkiv Rabdi; checked before anything is signed
  privateKey: process.env.ARKIV_PRIVATE_KEY,  // yours; fund it at https://hub.arkiv.network/faucet
});
```

The network details are on the [Rabdi page of the Arkiv docs](https://docs.arkiv.network/networks/rabdi/). Without `privateKey` the connection is read-only (`arkiv.writer` is `null`) and `createStore` refuses it. The package never reads files or the environment itself, redacts the RPC URL and the key from error messages, and has no wallet or endpoint baked in.

## Concepts

- **Node**: a 32-byte key plus an **epoch**. `nodeKeyOf('ada')` makes a key from any name. A node that starts over gets `epoch + 1` and starts from empty totals.
- **Edge**: `{ ref, kind, from, to, value?, ts }`. `ref` is your unique id for the event. Replay protection needs a `stream` (the checkpoint lives under it; the quickstart passes one) and, for a whole batch, a `position`. Give events a `position` (`{ block, logIndex }`, ascending) and a replay after a restart skips everything the checkpoint has already covered; without one, only the most recent event is recognised as already applied. Edges are readonly rows by default (they cannot be edited after they are written).
- **Totals**: running counters per node, epoch and window (`all`, and `day`). `rules` says which edge kinds move which counters: `'count'` adds 1, `'value'` adds the edge's value, a number adds that. Both ends of an edge get their totals updated. Totals are written as absolute values, so a store must be the only writer for its graph.
- **Link**: a running count and sum per from–to pair and kind.
- **Checkpoint**: per `stream`, the last event applied. It is written in the same batch as the event, so it advances if and only if the rows exist.
- **Owner scope**: every row is stored by a wallet. A store only trusts rows from the wallet that wrote them; `store.owner` is that address.
- **Lifetime**: Arkiv entities expire. `createStore({ days })` sets how long rows live (default 30).

## Querying

```js
const { rows, explain, truncated } = await store.query('totals', {
  filter: { window: { eq: 'all' }, kind: { eq: 'person' } },
  orderBy: { field: 'likes', direction: 'desc' },
  limit: 10,
});
```

Entities are `node`, `edge`, `totals`, `link`, `checkpoint` (plus any you add under `entities`). The filter takes `eq`, `in`, `gt`, `gte`, `lt`, `lte`, `between: [lo, hi]`, `startsWith` and `exists`, combined with `AND` and `OR`. It is typed by the column and rejects, with an error, a field that is unknown or not indexed, a range on anything but `u64` or `i32`, and out-of-range numbers. Mark a column indexed with `/i` (for example `'game:str/i'`) to filter on it; counters and other stored-only `u64` columns can be sorted on (`orderBy`, `'asc'` or `'desc'`, default `'desc'`) but not filtered (GraphPay sorts on its counters this way on Arkiv Rabdi). Rows come back plain: `u64` as `bigint`, `$key` and `$owner` as lower-case hex.

`explain` holds `explainId`, `calls`, `queries`, `ms`, `bytes`, `entityKeys`, `blockNumber`, `warnings` and `truncated`. A query pages by 100 up to your `limit` and says when a cap cut the answer short.

## Testing with ArkivSim

`connect()` with no URL is ArkivSim. It answers the JSON-RPC calls the stock SDK makes (queries, entity writes, receipts, logs) and tracks blocks and entity expiry, so your graph code is the same code in tests and on a node:

```js
import { ArkivSim, connect } from '@graphpay_ethglobal/arkiv-graph';
const arkiv = await connect();           // a fresh sim and a fresh funded key
arkiv.sim.advanceSeconds(3600);          // move time on, so rows can expire
arkiv.sim.injectFault({ method: 'eth_sendRawTransaction', kind: 'apply-then-fail', times: 1 }); // a lost reply
```

## API at a glance

Everything is exported from the package root; [`index.d.ts`](index.d.ts) has the types. A full reference follows in 0.1.x.

| export | what it is |
|---|---|
| `defineGraph(spec)` | the graph: definitions, `plan(events, state)` and `newState()` |
| `connect(options)` | ArkivSim or a node: clients, a safe writer, the owner address |
| `createStore({ graph, arkiv })` | `load()`, `write(events)`, `query(entity, options)` |
| `nodeKeyOf(name)` | a 32-byte node key from a name |
| `createWriter`, `arkivTransport`, `arkivClients`, `assertChain` | the pieces `connect` is made of, for when you want your own |
| `readAll`, `findOne`, `countRows`, `scope`, `checkedOwner` | owner-scoped reads |
| `createEngine`, `compileFilter` | the read engine and the filter compiler under `store.query` |
| `ArkivSim` | the in-memory Arkiv node |

## Not this package

There is another npm package called [`arkiv-graph`](https://www.npmjs.com/package/arkiv-graph) by SantiagoDevRel, described on npm as "Interactive graphs and tables for Arkiv entities, with scoped queries and optional wallet-signed Lifetime Extension". It is a different project and we did not use its code. Theirs shows Arkiv entities; ours defines, writes and reads a graph data model (nodes, edges, totals) and traces each read, with no user interface. Go and have a look at theirs too.

## Feedback

We want to hear what breaks and what is missing: see [FEEDBACK.md](FEEDBACK.md), or [open an issue](https://github.com/Zugzwang-world/graphpay/issues/new?template=arkiv-graph-feedback.yml) with the labels `arkiv-graph` and `feedback`.

## Licence

MIT. See [LICENSE](LICENSE).
