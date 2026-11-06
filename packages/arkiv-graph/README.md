# @graphpay_ethglobal/arkiv-graph

A graph layer over [Arkiv](https://docs.arkiv.network). You define **nodes**, **edges** and **totals**; the package writes each event as one atomic batch, reads rows back scoped to a wallet you trust, and gives every read an **explain** trace you can show to a user or another program. Test on ArkivSim, an in-memory Arkiv node with no keys, then run the same code on Arkiv Rabdi (testnet). No user interface; MIT licensed.

**Reference app:** [GraphPay](https://graphpay-event.vercel.app), live on Arkiv Rabdi, keeps its money graph with this package ([source](https://github.com/Zugzwang-world/graphpay); what it uses is under [Reference app](#reference-app)).

## Quickstart (5 minutes)

Needs Node 22 or newer.

```bash
mkdir arkiv-graph-demo && cd arkiv-graph-demo
npm init -y && npm pkg set type=module
npm install @graphpay_ethglobal/arkiv-graph
cp node_modules/@graphpay_ethglobal/arkiv-graph/examples/quickstart.mjs .   # or paste the code below into quickstart.mjs
node quickstart.mjs
```

The whole of [`examples/quickstart.mjs`](examples/quickstart.mjs):

```js
// The quickstart: a small social graph. Runs on ArkivSim (in memory, no keys) as it is.
// Point it at a node with ARKIV_RPC_URL, ARKIV_CHAIN_ID and ARKIV_PRIVATE_KEY (testnet only).
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

// 2. Connect. No URL means ArkivSim; a URL means that node (the chain id is checked before signing).
const arkiv = await connect(
  process.env.ARKIV_RPC_URL
    ? { rpcUrl: process.env.ARKIV_RPC_URL, chainId: Number(process.env.ARKIV_CHAIN_ID), privateKey: process.env.ARKIV_PRIVATE_KEY }
    : {},
);
const store = createStore({ graph, arkiv, stream: 'quickstart' });

// 3. Write events. Each call is one atomic batch: the edges, both ends' totals, the checkpoint.
// A position (ascending) lets a replay skip what the checkpoint already counted.
const person = (handle) => ({ node: nodeKeyOf(handle), epoch: 0, kind: 'person', columns: { handle } });
const ts = Math.floor(Date.now() / 1000);
await store.write([
  { ref: 'e1', kind: 'follow', from: person('ada'), to: person('grace'), ts, position: { block: 1, logIndex: 0 } },
  { ref: 'e2', kind: 'like', from: person('ada'), to: person('grace'), ts, position: { block: 1, logIndex: 1 } },
  { ref: 'e3', kind: 'like', from: person('linus'), to: person('grace'), ts, position: { block: 1, logIndex: 2 } },
]);

// 4. Query. Reads are scoped to the one wallet you trust, and every read is traced.
const { rows, explain } = await store.query('totals', {
  filter: { node: { eq: nodeKeyOf('grace') }, window: { eq: 'all' } },
});
console.log('grace:', { follows: rows[0].follows, likes: rows[0].likes });

// 5. Explain: the exact queries behind that answer, and an id that is the same for the same work.
console.log('explain', explain.explainId, `- ${explain.calls} read(s):`);
for (const q of explain.queries) console.log('  ', q);
```

It prints:

```
grace: { follows: 1n, likes: 2n }
explain bb8d7bfd1ae4 - 1 read(s):
   project = str('quickstart') AND type = str('totals') AND node = key(0x…) AND window = str('all') AND $owner = addr(0x…) LIMIT 100 OFFSET 0
```

The sim makes a fresh key on every run, so the owner address and the explain id differ each time (the explain id is a hash of the queries and the backend).

### The same file on Arkiv Rabdi (testnet)

With `ARKIV_RPC_URL` set, the quickstart connects to that node instead of the sim. **Testnet only:** use a throwaway key, never one that holds real funds. Put the three values in a `.env` file that you never commit:

```bash
ARKIV_RPC_URL=https://rpc.rabdi.db-chain.testnet.arkiv.network
ARKIV_CHAIN_ID=7794095
ARKIV_PRIVATE_KEY=0x…   # your own testnet key; fund it at https://hub.arkiv.network/faucet
```

```bash
node --env-file=.env quickstart.mjs
```

Its events carry a `position`, so running it again on the node skips all three and prints the same totals. In your own code, pass the same three values to `connect`:

```js
const arkiv = await connect({ rpcUrl, chainId: 7794095, privateKey });   // the chain id is checked before anything is signed
```

The network details are on the [Rabdi page of the Arkiv docs](https://docs.arkiv.network/networks/rabdi/). Without `privateKey` the connection is read-only (`arkiv.writer` is `null`) and `createStore` refuses it. The package never reads files or the environment itself (the example does), redacts the RPC URL and the key from error messages, and has no wallet or endpoint baked in.

The second example, [`examples/leaderboard.mjs`](examples/leaderboard.mjs), is a leaderboard: players, games and points, read back as one sorted query. Nothing in this package is specific to GraphPay.

## What it does

- **Define** a graph in a few lines: the node and edge columns, and which edge kinds move which counters.
- **Write** with a safe writer: each call is one atomic transaction (the edges, both ends' totals, a checkpoint), or for bulk loads several, each holding whole events with their checkpoint. A transaction is found again by its nonce after a lost reply, so a write that may or may not have landed is not written twice.
- **Query** with a plain filter object. Every read is scoped to one owner wallet and every returned row is checked again, so rows written by anyone else are never trusted.
- **Explain** every answer: the exact Arkiv queries behind it and a stable id (the same work gives the same id).
- **Test** with ArkivSim, an in-memory Arkiv node that the stock `@arkiv-network/sdk` talks to over its normal client. No keys, no network.

## Concepts

- **Node**: a 32-byte key plus an **epoch**. `nodeKeyOf('ada')` makes a key from any name, trimmed and lower-cased first (so `'Ada '` is the same node). A node that starts over gets `epoch + 1` and starts from empty totals.
- **Edge**: `{ ref, kind, from, to, value?, ts }`. `ref` is your unique id for the event. Edges are readonly rows by default (they cannot be edited after they are written).
- **Totals**: running counters per node, epoch and window. The windows are `all` and one per UTC day, stored as `window: 'day:<n>'` with `n = dayOf(ts)` (also in the `day` column). `rules` says which edge kinds move which counters: `'count'` adds 1, `'value'` adds the edge's value, a number adds that. Both ends of an edge get their totals updated (so an edge from a node to itself moves its totals twice). Totals are written as absolute values, so a store must be the only writer for its graph.
- **Link**: a running count and sum per from–to pair and kind, for the edge kinds that move a counter (only those in `link.kinds`, when you give it).
- **Checkpoint**: per `stream`, the last event applied. It is written in the same transaction as the events, so it advances if and only if their rows exist.
- **Replays**: replay protection needs a `stream` (the checkpoint lives under it). Give events a `position` (`{ block, logIndex }`, strictly ascending: no two events share one) and a replay after a restart skips everything the checkpoint has already covered. Without positions, an event is recognised as already applied only when its `ref` is the last event of the checkpoint or of a totals row it moves, so replaying a batch of several events counts most of them again.
- **Owner scope**: every row is stored by a wallet. A store only trusts rows from the wallet that wrote them; `store.owner` is that address.
- **Lifetime**: Arkiv entities expire. `createStore({ days })` sets how long rows live (default 30, at most 182). A row the store patches is extended to `days` again once half its lifetime has passed, so running totals stay alive while the graph is written; rows left unwritten for `days` expire.

## Querying

```js
const { rows, explain, truncated } = await store.query('totals', {
  filter: { window: { eq: 'all' }, kind: { eq: 'person' } },
  orderBy: { field: 'likes', direction: 'desc' },
  limit: 10,
});
```

Entities are `node`, `edge`, `totals`, `link`, `checkpoint` (plus any you add under `entities`). The filter takes `eq`, `in`, `gt`, `gte`, `lt`, `lte`, `between: [lo, hi]`, `startsWith` and `exists: true`, combined with `AND` and `OR`. It is typed by the column and rejects, with an error, a field that is unknown or not indexed, a range on anything but `u64` or `i32`, `startsWith` on anything but `str`, and out-of-range or inexact numbers. An empty `in` list matches nothing and sends no query. Arkiv allows 64 predicates in one query, and the scope and owner take 3, so an `in` list holds at most 61 values; a longer filter is refused before it is sent.

Mark a column indexed with `/i` (for example `'game:str/i'`) to filter on it. Counters and other stored-only `u64` columns can be sorted on (`orderBy`, `'asc'` or `'desc'`, default `'desc'`) but not filtered; GraphPay sorts on its counters this way on Arkiv Rabdi. Rows come back plain: `u64` as `bigint`, `i32` as a number, `key`, `addr`, `$key` and `$owner` as lower-case hex.

A query pages by 100 up to your `limit` (default 100). It returns at most 500 rows: `truncated` says that cap may have cut the answer (a `limit` you set is not a cut). Rows that match but do not fit the schema (written before a column was added, say) are left out and counted in `explain.warnings`. `explain` holds `explainId`, `backend`, `calls`, `queries`, `ms`, `bytes`, `entityKeys`, `blockNumber`, `warnings`, `notes`, `truncated` and `reads` (one entry per Arkiv call). The store keeps the last 200 traces: `store.explainStore.get(explainId)`.

## Testing with ArkivSim

`connect()` with no URL is ArkivSim. It answers the JSON-RPC calls the stock SDK makes (queries, entity writes, receipts with their logs; not `eth_getLogs` or filters) and tracks blocks and entity expiry, so your graph code is the same code in tests and on a node:

```js
import { connect } from '@graphpay_ethglobal/arkiv-graph';

const arkiv = await connect();               // a fresh sim and a fresh funded key
arkiv.sim.advanceSeconds(3600);              // move time on, so rows can expire
arkiv.sim.injectFault({ method: 'eth_sendRawTransaction', kind: 'apply-then-fail', times: 1 }); // a lost reply
const other = await connect({ sim: arkiv.sim });   // a second wallet on the same sim
```

## API reference

Everything is exported from the package root, and [`index.d.ts`](index.d.ts) has the types. Most programs need only the first table.

### Graph, store and connection

| export | what it is |
|---|---|
| `defineGraph({ project, schemaVersion?, types?, node?, edge?, totals?, link?, checkpoint?, entities? })` | the graph. `node`, `edge`, `link` and `checkpoint` take extra `columns`; `node`, `edge`, `totals` and `link` take `index` (column names to index); `edge.value` names the value column (default `value`) and `edge.readonly` (default `true`); `totals` takes `counters`, `rules` (an object or a function of the event), `windows` (default `['all', 'day']`) and `columns`; `link` takes `sum` (default `sum`) and `kinds` (default: every kind that moves a counter); `entities` adds entity types of your own. Throws on a bad definition. Returns `{ project, schemaVersion, names, defs, counters, windows, valueColumn, sumColumn, newState(), plan(events, state, options?), incrementsOf(event) }` |
| `connect({ rpcUrl?, chainId?, privateKey?, log?, sim? })` | no `rpcUrl`: ArkivSim (a new one, or the `sim` you pass) with a fresh funded key unless you pass `privateKey`. With `rpcUrl`, `chainId` is required and checked with `eth_chainId` first. Returns `{ backend: 'sim' \| 'node', publicClient, walletClient, writer, owner, stats, sim, chainId }`; without a key, `walletClient`, `writer` and `owner` are `null` |
| `createStore({ graph, arkiv, stream?, days?, labels?, createNodes? })` | one graph over one connection with a key; throws on a read-only connection. `stream`: the checkpoint's name (none by default, and then no replay protection). `days`: row lifetime (default 30, at most 182; patched rows are extended). `labels`: column values added to each new row that has those columns. `createNodes` (default `true`): write a node row for each new edge end. Returns `{ owner, graph, load(), write(events, { split? }), query(entity, { filter?, orderBy?, limit? }), explainStore }` |
| `store.write(events, { split? })` | plans the events into one batch and sends it as one transaction; returns `{ applied, skipped, txs }` (event refs, and the transactions). Writes are queued, one at a time. A transaction holds about 120 KB: five of the quickstart's events when each adds new rows (about 22 KB each; an event that only updates rows takes less). A bigger write is refused unless you pass `split: true`, which sends as many transactions as it needs, each holding whole events with their checkpoint (only an event too big for a transaction of its own goes out in parts) |
| `store.load()` | reads the store's rows from Arkiv (totals, links, nodes, the checkpoint), so the next write continues from them; `write` calls it on first use |
| `store.query(entity, { filter?, orderBy?, limit? })` | `{ rows, explain, truncated }`; see [Querying](#querying) |
| `nodeKeyOf(name)` | a 32-byte node key: the sha256 of the trimmed, lower-cased name |
| `dayOf(ts)` | the UTC day number (days since 1970-01-01) of a unix time in seconds |

An event (`store.write`, `graph.plan`) is `{ ref, kind, from, to, value?, ts, day?, position?, columns?, labels? }`, where `from` and `to` are `{ node, epoch, kind, columns? }`. `columns` fills the edge's extra columns (and, on an end, the node row's); `labels` adds column values for this event. Two more fields are for mirrors that share a graph: `existingEdge: true` folds an edge another writer already created into the totals only, and `counted: false` writes the edge without moving any counter. A node update, `{ ref, nodeUpdate: { node, epoch, values }, position? }`, patches a node row the graph already holds instead of adding an edge.

### Entities and values

| export | what it is |
|---|---|
| `defineEntity(type, { columns?, readonly? }, { project, schemaVersion? })` | one entity type with the convention columns `project`, `type` and `schema_v` |
| `parseColumns(specs)` | column specs `'name:type'` with optional flags after a slash: `i` indexed, `o` optional (for example `'owner:addr/i'`, `'note:str/o'`). Types: `addr`, `bool`, `bytes`, `i32`, `key`, `str`, `u64` (`bytes` cannot be indexed) |
| `checkDefinition(def, { noBytes? })` | the problems with a definition, as strings: more than 30 attributes, a name that is not snake_case of at most 32 bytes, a missing convention column, an indexed or (with `noBytes`) any `bytes` column |
| `checkIndexes(def, filtered)` | the problems when the indexed columns differ from the columns your queries filter on |
| `LIMITS` | Arkiv's limits as measured on its testnet: `userAttributes` 30, `nameBytes` 32, `stringBytes` 128, `pageSize` 100, `predicateLeaves` 64, `requestBodyBytes` 262,144, `splitBytes` 122,880, `maxLifetimeBlocks` 7,884,000n, `blockSeconds` 2 |
| `typed(type, value)` | one value typed for its column (`u64` takes a bigint, a safe integer or a decimal string; `key` and `addr` are lower-cased) |
| `entityValues(def, values)`, `patchValues(def, values)` | the typed values of a create (with the convention columns) or of a patch; an unknown column is an error |
| `plainRow(row)` | an SDK row as plain values (as `query` returns them) |
| `jsonBytes(value)`, `fromJsonBytes(hex)` | JSON to a hex `bytes` value and back (`null` if it does not parse) |

### Reads

| export | what it is |
|---|---|
| `readAll(publicClient, def, { owner, where?, cap?, truncate? })` | every row of a type owned by `owner` that matches `where` (SDK query expressions), paged by `$key`, reading past matches that do not fit the schema. Once it has covered `cap` matches (default 50,000; rows left out for the schema count too) with more to come, it throws, or stops there with `truncate: true` |
| `findOne(publicClient, def, { owner, where? })` | the first matching row, or `null`; a first match that does not fit the schema is read past |
| `countRows(publicClient, def, { owner, where? })` | the number of matching rows |
| `checkedOwner(address, label?)` | the lower-cased address; throws on a blank, malformed or zero address |
| `scope(def)` | the `project` and `type` filters every query of a type starts with |
| `trustedRows(def, owner, entities)` | the rows that pass the owner and schema-version checks, as plain rows |
| `compileFilter(def, filter)` | a filter object as SDK expressions to AND, or `null` when an empty `in` means no row can match |
| `createEngine({ publicClient, backend, stats?, rowCap?, explainStore?, budget? })` | the read engine under `store.query`. `engine.context({ rowCap?, callBudget? })` gives one request's reads: `query(def, { where?, owners, orderBy?, want? })`, `queryAny(def, { where?, terms, owners, orderBy?, want?, maxTerms? })` (an OR list chunked to fit the predicate budget), `count(def, { where?, owners })` and `explain()`. Defaults: 500 rows, 60 calls a request, 64 predicates |
| `createExplainStore(max?)` | the store of recent traces (default 200): `put`, `get(explainId)`, `size()` |
| `explainIdOf(backend, queries)` | the explain id: the first 12 hex digits of the sha256 of the backend and the sorted queries |

### Writes

| export | what it is |
|---|---|
| `createWriter({ walletClient, publicClient, entityContract, splitBytes?, recoveryMs?, pollMs?, maxSends?, sentHashes?, log? })` | the safe writer `connect` makes for you. `send({ creates?, patches?, deletes?, extensions? }, { split?, nonce?, verifyRecovered? })` returns `{ txs, createdKeys }` (a fixed `nonce` needs `verifyRecovered(createdKeys)`, which says whether a transaction found at that nonce is this batch); `confirmedNonce()` is the wallet's confirmed nonce; `operations(batch)` is the SDK operations a batch becomes. Pass `sentHashes` (`transport.sent`) so a transaction that took your nonce is never adopted as yours |
| `WriteRevertedError` | the batch reverted (`txHash`) |
| `WriteUncertainError` | the writer could not confirm what landed (`nonce`); re-read the state before writing again |
| `WriteNonceTakenError` | `code: 'NONCE_TAKEN'`: a send pinned to a `nonce` found it taken, and nothing was sent |
| `operationBytes(op)` | the encoded size of one entity operation, as the writer measures batches |
| `ExpirationTime` | the Arkiv SDK's row lifetime helper, re-exported (for example `ExpirationTime.fromDays(30)`) |

### Transport

| export | what it is |
|---|---|
| `arkivTransport({ url, fallbackUrl?, fallbackMs?, fetchFn?, secrets?, timeout?, stats?, log?, lowWater? })` | a viem HTTP transport with no retries and a 15 s timeout that meters calls and bytes (`.stats`), waits when the node's `ratelimit` header runs low, redacts `secrets` and the URL from errors, records the hashes it sends (`.sent`), and with `fallbackUrl` repeats a 429 `QUOTA_EXCEEDED` on that endpoint for `fallbackMs` (default 10 minutes) |
| `arkivChain({ id, name?, symbol? })` | a viem chain for an Arkiv network id, with no RPC URL in it |
| `arkivClients({ transport, chain, account?, pollingInterval? })` | the stock SDK's clients over one transport: `{ publicClient, walletClient, chain, stats, sentHashes }` (`walletClient` is `null` without an account) |
| `assertChain(publicClient, expected)` | throws unless the node answers chain id `expected` |
| `newStats()`, `parseRateLimit(header)` | an empty stats object; a `ratelimit` header as `{ limit, remaining, reset? }` |
| `redactError(error, secrets)`, `isRequestTooLarge(error)` | replaces every secret in an error and its causes; finds an HTTP 413 in the cause chain |
| `ENTITY_ADDRESS` | the address Arkiv sends entity operations to on every network |

### ArkivSim

| export | what it is |
|---|---|
| `new ArkivSim({ chainId, entityContract, startBlock?, blockTime?, requestLimit?, gasPrice?, rateLimit? })` | the in-memory node. `fetch` is its HTTP endpoint (pass it as a transport's `fetchFn`); `blockNumber`, `stats`, `advanceBlocks(n)`, `advanceSeconds(s)`, `injectFault({ method, kind: 'apply-then-fail' \| 'fail', times? })` and `dispatch(method, params)` |
| `EXECUTE_ABI`, `EVENTS_ABI` | the entity contract's call and event ABI, as the sim decodes it |
| `parseQuery(text)`, `renderQuery(node)` | the sim's parser for Arkiv's query language, and back to text |

## Reference app

[GraphPay](https://graphpay-event.vercel.app) ("ask before you pay") runs its money graph on Arkiv Rabdi with this package: every payment, refusal, refund request and quote is a row, and any agent can ask the graph about a shop before it pays, with the explain trace of every read. Try a live read: the [top shops by orders](https://graphpay-event.vercel.app/api/graphql?query=%7Btop(kind%3A%22shop%22%2Cby%3A%22orders%22%2Climit%3A3)%7Bnode%7Bens%20category%7Dvalue%7D%7D), sorted on a stored-only counter, with its trace under `extensions.arkiv`. In [its source](https://github.com/Zugzwang-world/graphpay):

- the graph's definition: [`packages/money-graph/src/model.mjs`](https://github.com/Zugzwang-world/graphpay/blob/main/packages/money-graph/src/model.mjs) (`defineGraph`, `defineEntity`);
- the connection and the safe writer: [`packages/money-graph/src/connect.mjs`](https://github.com/Zugzwang-world/graphpay/blob/main/packages/money-graph/src/connect.mjs) (`arkivTransport` with a `fallbackUrl`, `arkivClients`, `createWriter`);
- the reads behind the GraphQL and MCP endpoints, each with its trace: [`packages/money-graph/src/graphql.mjs`](https://github.com/Zugzwang-world/graphpay/blob/main/packages/money-graph/src/graphql.mjs) (`createEngine`, `createExplainStore`);
- the mirror that writes each on-chain payment to Arkiv: [`packages/mirror/src/arkiv.mjs`](https://github.com/Zugzwang-world/graphpay/blob/main/packages/mirror/src/arkiv.mjs) (`graph.plan`, the writer's `send` pinned to a `nonce` with `verifyRecovered`, `operationBytes`, `readAll`).

## Limits

- Totals are written as absolute values, so one process should write one graph.
- `store.load()` reads up to 50,000 rows per entity and throws past that, so a very large graph cannot be loaded yet.
- A query returns at most 500 rows (past that it is marked `truncated`), and its filter holds at most 64 predicates, so an `in` list holds at most 61 values.
- Events need strictly ascending positions for replay protection; without them a replayed batch is counted again.
- Rows the store does not write for `days` expire (Arkiv allows at most 182 days).
- `connect` and `createStore` are tested on ArkivSim; the writer and the read engine under them also run GraphPay's graph on Arkiv Rabdi.

## Not this package

There is another npm package called [`arkiv-graph`](https://www.npmjs.com/package/arkiv-graph) by SantiagoDevRel, described on npm as "Interactive graphs and tables for Arkiv entities, with scoped queries and optional wallet-signed Lifetime Extension". It is a different project and we did not use its code. Theirs shows Arkiv entities; ours defines, writes and reads a graph data model (nodes, edges, totals) and traces each read, with no user interface. Go and have a look at theirs too.

## Feedback

We want to hear what breaks and what is missing: see [FEEDBACK.md](FEEDBACK.md), or [open an issue](https://github.com/Zugzwang-world/graphpay/issues/new?template=arkiv-graph-feedback.yml) with the labels `arkiv-graph` and `feedback`.

## Licence

MIT. See [LICENSE](LICENSE).
