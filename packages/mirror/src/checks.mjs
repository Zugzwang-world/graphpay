// The mirror's acceptance reads (D1, D2, D3, D15; acceptance/mirror.mjs runs them).
//
// D1: what one mirror transaction did on Arkiv (D1): the Rabdi transaction that
// created the W_LEDGER edge with a given `ref`, and each of its operations by entity
// type, decoded from the receipt's entity events (EntityCreated, EntityPatched).

import { ENTITY_EVENTS_ABI, key, str } from '@arkiv-network/sdk';
import { eq } from '@arkiv-network/sdk/query';
import { countRows, findOne, readAll } from '@graphpay/arkiv-graph';
import { ENTITIES, ENTITY_CONTRACT } from '@graphpay/money-graph';
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
  const tally = (node, window) => tallies.some((t) => t.node?.toLowerCase() === node && t.window === window);
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

// D3: the stored tallies of a node against its own edges, read in full by paging.
// Money is counted as the tallies count it: pay and renew add to paid (the renew edge
// carries 0, its PaymentSettled carries the money), refund to refunded, fail to fails.
export async function recount(publicClient, { owner, node, side }) {
  const where = [eq(side === 'shop' ? 'to_node' : 'from_node', key(node.toLowerCase()))];
  const rows = await readAll(publicClient, ENTITIES.edge, { owner, where });
  const sum = (kind) => rows.filter((r) => r.kind === kind).reduce((s, r) => s + BigInt(r.amount_micro ?? 0), 0n);
  const count = (kind) => rows.filter((r) => r.kind === kind).length;
  return {
    edges: rows.length,
    orders: count('order'),
    refunds: count('refund'),
    fails: count('fail'),
    delivered: rows.filter((r) => r.kind === 'deliver' || r.kind === 'late').length,
    paidMicro: String(sum('pay') + sum('renew')),
    refundedMicro: String(sum('refund')),
  };
}

export async function storedTally(publicClient, { owner, node }) {
  const t = await findOne(publicClient, ENTITIES.tally, { owner, where: [eq('node', key(node.toLowerCase())), eq('window', str('all'))] });
  if (!t) return null;
  return {
    orders: Number(t.orders),
    refunds: Number(t.refunds),
    fails: Number(t.fails),
    delivered: Number(t.delivered),
    paidMicro: String(t.paid_micro),
    refundedMicro: String(t.refunded_micro),
    synthetic: Boolean(t.synthetic),
  };
}
