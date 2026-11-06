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
