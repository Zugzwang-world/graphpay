// The mirror's acceptance reads (D1, D2, D3, D15; acceptance/mirror.mjs runs them).
//
// D1: what one mirror transaction did on Arkiv (D1): the Rabdi transaction that
// created the W_LEDGER edge with a given `ref`, and each of its operations by entity
// type, decoded from the receipt's entity events (EntityCreated, EntityPatched).

import { ENTITY_EVENTS_ABI, key, str, u64 } from '@arkiv-network/sdk';
import { eq } from '@arkiv-network/sdk/query';
import { countRows, findOne, fromJsonBytes, readAll } from '@graphpay/arkiv-graph';
import { ENTITIES, ENTITY_CONTRACT, tallyRules } from '@graphpay/money-graph';
import { decodeEventLog } from 'viem';

const attr = (e, name) => e?.$attributes?.[name]?.value;

export function entityOps(receipt) {
  const ops = [];
  for (const l of receipt.logs ?? []) {
    if (String(l.address).toLowerCase() !== ENTITY_CONTRACT.toLowerCase()) continue;
    try {
      const d = decodeEventLog({ abi: ENTITY_EVENTS_ABI, topics: l.topics, data: l.data });
      if (d.eventName === 'EntityCreated') ops.push({ op: 'create', key: d.args.entityKey.toLowerCase() });
      else if (d.eventName === 'EntityPatched') ops.push({ op: 'patch', key: d.args.entityKey.toLowerCase() });
      else ops.push({ op: d.eventName, key: String(d.args.entityKey ?? '').toLowerCase() });
    } catch {
      // not an entity event
    }
  }
  return ops;
}

// One entity's type and the attributes that say which row it is.
export async function describe(publicClient, key) {
  const e = await publicClient.getEntity(key);
  const type = attr(e, 'type');
  const out = { type };
  if (type === 'edge') Object.assign(out, { kind: attr(e, 'kind'), ref: attr(e, 'ref') });
  if (type === 'tally') Object.assign(out, { node: attr(e, 'node'), window: attr(e, 'window'), day: attr(e, 'day') === undefined ? undefined : String(attr(e, 'day')) });
  if (type === 'link') Object.assign(out, { kind: attr(e, 'kind'), from: attr(e, 'from_node'), to: attr(e, 'to_node') });
  if (type === 'checkpoint') Object.assign(out, { stream: attr(e, 'stream') });
  if (type === 'node') Object.assign(out, { ens: attr(e, 'ens') });
  return out;
}

// The transaction that created the edge `ref` (owner W_LEDGER), with its operations.
export async function mirrorTxOf(publicClient, { ref, owner }) {
  const edge = await findOne(publicClient, ENTITIES.edge, { owner, where: [eq('ref', str(ref))] });
  if (!edge) return { found: false, ref };
  const block = await publicClient.getBlock({ blockNumber: BigInt(edge.$createdAt), includeTransactions: true });
  const ours = block.transactions.filter((t) => typeof t === 'object' && t.from?.toLowerCase() === owner.toLowerCase());
  for (const t of ours) {
    const receipt = await publicClient.getTransactionReceipt({ hash: t.hash });
    const ops = entityOps(receipt);
    if (!ops.some((o) => o.op === 'create' && o.key === edge.$key)) continue;
    for (const o of ops) Object.assign(o, await describe(publicClient, o.key));
    return {
      found: true,
      ref,
      edgeKey: edge.$key,
      arkivBlock: Number(block.number),
      txHash: t.hash,
      txsByOwnerInBlock: ours.length,
      status: receipt.status,
      gasUsed: Number(receipt.gasUsed),
      ops,
    };
  }
  return { found: false, ref, edgeKey: edge.$key, arkivBlock: Number(block.number), why: 'no W_LEDGER transaction in that block created the edge' };
}

// The checkout events that write exactly one edge (map.mjs); AgentPolicySet patches a
// node's standing and the rest write nothing.
export const EDGE_EVENTS = new Set([
  'OrderCreated',
  'PaymentSettled',
  'PaymentFailed',
  'Refunded',
  'OrderDelivered',
  'OrderCancelled',
  'Disputed',
  'SubscriptionCreated',
  'SubscriptionRenewed',
  'RenewalFailed',
  'SubscriptionCancelled',
]);

// The lab's gas for one mirrored payment (ACCEPTANCE_TESTS.md D1): recorded, not banded.
export const LAB_PAY_GAS = 310_527;

// D1: one transaction holds the pay edge, the shop's and the payer's `all` and day
// tallies, the pair link and the checkpoint patch, and nothing else.
export function d1Verdict(tx, { shopNode, payerNode, stream }) {
  if (!tx.found) return { pass: false, why: tx.why ?? 'no edge with that ref' };
  const is = (o, type) => o.type === type;
  const edges = tx.ops.filter((o) => is(o, 'edge'));
  const tallies = tx.ops.filter((o) => is(o, 'tally'));
  const links = tx.ops.filter((o) => is(o, 'link'));
  const checkpoints = tx.ops.filter((o) => is(o, 'checkpoint'));
  const other = tx.ops.filter((o) => !['edge', 'tally', 'link', 'checkpoint'].includes(o.type));
  // Tally rows are keyed `all` and `day:<n>` (arkiv-graph's planner).
  const tally = (node, window) => tallies.some((t) => t.node?.toLowerCase() === node && (window === 'day' ? String(t.window ?? '').startsWith('day:') : t.window === window));
  const want = {
    'one pay edge create with the ref': edges.length === 1 && edges[0].op === 'create' && edges[0].kind === 'pay' && edges[0].ref === tx.ref,
    'shop all tally': tally(shopNode, 'all'),
    'shop day tally': tally(shopNode, 'day'),
    'payer all tally': tally(payerNode, 'all'),
    'payer day tally': tally(payerNode, 'day'),
    'four tally rows': tallies.length === 4,
    'the pair link': links.some((l) => l.from?.toLowerCase() === payerNode && l.to?.toLowerCase() === shopNode),
    'the checkpoint patch': checkpoints.length === 1 && checkpoints[0].op === 'patch' && checkpoints[0].stream === stream,
    'nothing else': other.length === 0,
    'mined successfully': tx.status === 'success',
  };
  const failed = Object.entries(want).filter(([, ok]) => !ok).map(([k]) => k);
  return {
    pass: failed.length === 0,
    failed,
    gasUsed: tx.gasUsed,
    gasRatioToLab: Math.round((tx.gasUsed / LAB_PAY_GAS) * 1000) / 1000,
    counts: { ops: tx.ops.length, edges: edges.length, tallies: tallies.length, links: links.length, checkpoints: checkpoints.length },
  };
}

// D2 and D15: every event in a window has its one edge (an edge event) or none.
export async function refCounts(publicClient, { owner, events }) {
  const rows = [];
  for (const e of events) {
    const n = Number(await countRows(publicClient, ENTITIES.edge, { owner, where: [eq('ref', str(e.id))] }));
    const want = EDGE_EVENTS.has(e.name) ? 1 : 0;
    rows.push({ id: e.id, name: e.name, block: e.block, edges: n, want, ok: n === want });
  }
  return { pass: rows.every((r) => r.ok), events: rows.length, edgeEvents: rows.filter((r) => r.want === 1).length, wrong: rows.filter((r) => !r.ok) };
}

// D3: the stored all-time tally of a node against its own edges, read in full by paging.
// Counted as the planner counts (tallyRules): every edge adds to both of its ends, at the
// epoch it names, so the edges where the node is either end and at its current epoch.
// Fails also come from W_SYNC's recorder edges, folded by the mirror only when the wallet
// is bound; they are compared by GraphQL's verify (count()), not here.
export async function recount(publicClient, { owner, node, epoch = 0 }) {
  const n = node.toLowerCase();
  const byRef = new Map();
  for (const side of ['from', 'to']) {
    const where = [eq(`${side}_node`, key(n)), eq(`${side}_epoch`, u64(BigInt(epoch)))];
    for (const r of await readAll(publicClient, ENTITIES.edge, { owner, where })) byRef.set(r.ref, r);
  }
  const t = { orders: 0n, refunds: 0n, delivered: 0n, onTime: 0n, paidMicro: 0n, refundedMicro: 0n };
  const field = { orders: 'orders', refunds: 'refunds', delivered: 'delivered', on_time: 'onTime', paid_micro: 'paidMicro', refunded_micro: 'refundedMicro' };
  for (const r of byRef.values()) {
    const reason = fromJsonBytes(r.payload)?.reason;
    const rules = tallyRules({ kind: r.kind, reason }) ?? {};
    for (const [counter, how] of Object.entries(rules)) {
      if (!field[counter]) continue;
      t[field[counter]] += how === 'count' ? 1n : BigInt(r.amount_micro ?? 0);
    }
  }
  return { edges: byRef.size, ...Object.fromEntries(Object.entries(t).map(([k, v]) => [k, String(v)])) };
}

export async function storedTally(publicClient, { owner, node, epoch = 0 }) {
  const t = await findOne(publicClient, ENTITIES.tally, { owner, where: [eq('node', key(node.toLowerCase())), eq('epoch', u64(BigInt(epoch))), eq('window', str('all'))] });
  if (!t) return null;
  return {
    orders: String(t.orders),
    refunds: String(t.refunds),
    delivered: String(t.delivered),
    onTime: String(t.on_time),
    paidMicro: String(t.paid_micro),
    refundedMicro: String(t.refunded_micro),
    fails: String(t.fails),
    synthetic: Boolean(t.synthetic),
  };
}

// The node's current epoch from its W_LEDGER rows (the highest; fresh names are 0).
export async function epochOf(publicClient, { owner, node }) {
  const rows = await readAll(publicClient, ENTITIES.node, { owner, where: [eq('node', key(node.toLowerCase()))] });
  return rows.reduce((m, r) => Math.max(m, Number(r.epoch ?? 0)), 0);
}
