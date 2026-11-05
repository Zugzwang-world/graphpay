// The money ledger: GraphPay events into the graph through the safe writer (ADR-0023).
// Live (the mirror, W_LEDGER, one process): one transaction per event with the edge,
// the four tally rows, the pair link and the stream checkpoint, so the checkpoint
// advances if and only if the rows exist; before writing, the checkpoint and an edge
// with the same ref are checked. Seeding (a seed wallet): many events per batch, split
// by bytes. On any failed write the planned rows are discarded and the state is read
// back from Arkiv (`load`), never patched from memory.
//
// An event: { ref, kind, from: { ens, epoch, kind }, to: { ens, epoch, kind },
//   amountMicro, ts, orderId?, reason?, payload?, position?: { block, logIndex },
//   existingEdge? (fold a recorder edge into the tallies without writing it again),
//   counted? (false: an edge that moves no tally, such as a DUPLICATE refusal) }
// Every live write takes an optional `nonce` the caller read before its anchors; the
// writer refuses with NONCE_TAKEN if another transaction holds it.

import { ExpirationTime } from '@arkiv-network/sdk';
import { str } from '@arkiv-network/sdk';
import { eq } from '@arkiv-network/sdk/query';
import { findOne, readAll } from '@graphpay/arkiv-graph';
import { normalizedName, nodeOf } from './identity.mjs';
import { ENTITIES, LIFETIME, graph } from './model.mjs';

export function toGraphEvent(e, labels) {
  if (!e || typeof e.ref !== 'string' || e.ref === '') throw new Error('money-graph: an event needs a ref');
  const end = (x) => {
    const ens = normalizedName(x.ens);
    return { node: nodeOf(ens), epoch: BigInt(x.epoch ?? 0), kind: x.kind, ens, columns: { ens, verified: Boolean(x.verified), ...(x.columns ?? {}) } };
  };
  const from = end(e.from);
  const to = end(e.to);
  return {
    ref: e.ref,
    kind: e.kind,
    reason: e.reason,
    counted: e.counted,
    from,
    to,
    value: BigInt(e.amountMicro ?? 0),
    ts: e.ts,
    day: e.day,
    position: e.position,
    existingEdge: Boolean(e.existingEdge),
    labels,
    columns: { from_ens: from.ens, to_ens: to.ens, order_id: e.orderId, payload: e.payload },
  };
}

export function createLedger({ arkiv, stream = null, synthetic = null, lifetimeDays, createNodes = false } = {}) {
  if (!arkiv?.writer) throw new Error('money-graph: the ledger needs a connection with a writer');
  const owner = arkiv.owner;
  const labels = synthetic ? { synthetic: true, dataset: synthetic.dataset } : { synthetic: false, dataset: 'live' };
  const days = lifetimeDays ?? (synthetic ? LIFETIME.syntheticDays : LIFETIME.realDays);
  const expiration = () => ExpirationTime.fromDays(days);
  let state = graph.newState();

  // Re-adopts the owner's tally, link, node and checkpoint rows from Arkiv.
  async function load() {
    const next = graph.newState();
    const strip = (row) => {
      const values = {};
      for (const [k, v] of Object.entries(row)) if (!k.startsWith('$')) values[k] = v;
      return { key: row.$key, values };
    };
    for (const row of await readAll(arkiv.publicClient, ENTITIES.tally, { owner })) next.totals.set(`${row.node}:${row.epoch}:${row.window}`, strip(row));
    for (const row of await readAll(arkiv.publicClient, ENTITIES.link, { owner })) {
      next.links.set(`${row.from_node}:${row.from_epoch}:${row.to_node}:${row.to_epoch}:${row.kind}`, strip(row));
    }
    for (const row of await readAll(arkiv.publicClient, ENTITIES.node, { owner })) next.nodes.set(`${row.node}:${row.epoch}`, strip(row));
    if (stream) {
      const cp = await findOne(arkiv.publicClient, ENTITIES.checkpoint, { owner, where: [eq('stream', str(stream))] });
      if (cp) next.checkpoints.set(stream, strip(cp));
    }
    state = next;
    return state;
  }

  async function edgeExists(ref) {
    return (await findOne(arkiv.publicClient, ENTITIES.edge, { owner, where: [eq('ref', str(ref))] })) !== null;
  }

  async function write(events, { split, nonce = null }) {
    const planned = graph.plan(events, state, { stream, createNodes, labels });
    if (planned.creates.length === 0 && planned.patches.length === 0) return { skipped: planned.skipped, applied: [], txs: [], edgeKeys: {} };
    let result;
    try {
      result = await arkiv.writer.send(
        { creates: planned.creates.map((c) => ({ ...c, expiration: expiration() })), patches: planned.patches },
        { split, nonce },
      );
    } catch (error) {
      await load(); // discard the plan and re-adopt what Arkiv holds
      throw error;
    }
    const edgeKeys = planned.commit(result.createdKeys);
    return { skipped: planned.skipped, applied: planned.applied, txs: result.txs, edgeKeys };
  }

  // One live event: anchor and ref checks, then one atomic transaction.
  async function apply(event, { nonce = null } = {}) {
    const ge = toGraphEvent(event, labels);
    if (!ge.existingEdge && (await edgeExists(ge.ref))) return { skipped: [ge.ref], applied: [], txs: [], edgeKeys: {} };
    return write([ge], { split: false, nonce });
  }

  // Recorder edges (W_SYNC) folded into the tallies in one transaction, no edge created.
  async function foldRecorder(events, { nonce = null } = {}) {
    return write(
      events.map((e) => toGraphEvent({ ...e, existingEdge: true }, labels)),
      { split: false, nonce },
    );
  }

  // A standing change of one node row (status, cap) plus the checkpoint, same epoch only.
  async function writeStanding({ ref, ens, epoch, status, capMicro, ts, position }, { nonce = null } = {}) {
    const node = nodeOf(ens);
    const values = {};
    if (status !== undefined) values.status = status;
    if (capMicro !== undefined) values.cap_micro = BigInt(capMicro);
    return write([{ ref, ts, position, nodeUpdate: { node, epoch: BigInt(epoch ?? 0), values } }], { split: false, nonce });
  }

  // Many events (seeding): one logical batch, split by bytes.
  async function applyBatch(events) {
    return write(
      events.map((e) => toGraphEvent(e, labels)),
      { split: true },
    );
  }

  return {
    owner,
    load,
    apply,
    applyBatch,
    foldRecorder,
    writeStanding,
    edgeExists,
    confirmedNonce: () => arkiv.writer.confirmedNonce(),
    get state() {
      return state;
    },
  };
}
