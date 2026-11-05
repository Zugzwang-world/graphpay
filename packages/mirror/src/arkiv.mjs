// The mirror's ledger port on Arkiv, over @graphpay/money-graph (M7a). Three ledgers
// share W_LEDGER's rows: the chain stream (live events), the `recorder` stream (folded
// refusals) and the history stream (the labelled cast history). Each plans absolute
// tallies from its own copy of the rows, so a write through one marks the others stale
// and they re-read from Arkiv before their next write: no plan is ever made from rows
// another stream has moved since.
//
// Checkpoints: a write carries the event's position only when it moves the stream's
// checkpoint forward. While an earlier event is parked the mirror passes a position
// held before it, and the write then carries none, so the checkpoint stays put and the
// event is guarded by its ref alone.

import { ExpirationTime, str, u64 } from '@arkiv-network/sdk';
import { eq, gt, lte, startsWith } from '@arkiv-network/sdk/query';
import { findOne, fromJsonBytes, jsonBytes, LIMITS, operationBytes, readAll } from '@graphpay/arkiv-graph';
import { createLedger, ENTITIES, graph, LIFETIME, nodeOf, normalizedName, readHeartbeats, toGraphEvent, writeHeartbeat, writerAddresses } from '@graphpay/money-graph';
import { BLOCK_DONE, comparePosition } from './ids.mjs';
import { RECORDER_STREAM } from './recorder.mjs';

const num = (v) => (v === undefined || v === null ? undefined : Number(v));
// One unsplit transaction, with room for the encoding's overhead (the writer refuses to
// cut a batch sent at a fixed nonce).
const TX_TARGET_BYTES = Math.floor(LIMITS.splitBytes * 0.85);
const REGISTER_CHUNK = 12;

function ledgerEvent(edge, position) {
  return {
    ref: edge.ref,
    kind: edge.kind,
    from: { ens: edge.fromEns, epoch: edge.fromEpoch, kind: edge.fromKind },
    to: { ens: edge.toEns, epoch: edge.toEpoch, kind: edge.toKind },
    amountMicro: edge.amountMicro,
    ts: edge.ts,
    day: edge.day,
    orderId: edge.orderId ?? undefined,
    payload: edge.payload ? jsonBytes(edge.payload) : undefined,
    reason: edge.payload?.reason,
    counted: edge.counted,
    position,
  };
}

function nodeValues(a, historyDataset) {
  const values = {
    node: nodeOf(a.ens),
    epoch: BigInt(a.epoch ?? 0),
    kind: a.kind,
    ens: normalizedName(a.ens),
    verified: Boolean(a.verified),
    synthetic: Boolean(a.synthetic),
    dataset: a.synthetic ? (a.dataset ?? historyDataset ?? 'synthetic') : 'live',
    owner_node: a.ownerNode,
    category: a.category,
    city: a.city,
    status: a.status ?? 'active',
    cap_micro: a.capMicro === undefined || a.capMicro === null ? undefined : BigInt(a.capMicro),
  };
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined));
}

const edgeOfRow = (r) => ({
  ref: r.ref,
  kind: r.kind,
  fromNode: r.from_node,
  toNode: r.to_node,
  fromEpoch: num(r.from_epoch),
  toEpoch: num(r.to_epoch),
  fromEns: r.from_ens,
  toEns: r.to_ens,
  amountMicro: BigInt(r.amount_micro ?? 0),
  ts: num(r.ts),
  day: num(r.day),
  orderId: r.order_id,
  payload: fromJsonBytes(r.payload),
});

// arkiv: a W_LEDGER connection (connectArkiv). stream: the chain stream's name.
// recorderOwner: W_SYNC's address (the config's; a test passes its own).
export function arkivLedger({ arkiv, stream, recorderOwner, log = () => {} }) {
  if (!arkiv?.writer) throw new Error('mirror: the ledger needs a W_LEDGER connection with a writer');
  const writers = writerAddresses();
  if (arkiv.backend !== 'sim' && arkiv.owner !== writers.W_LEDGER) throw new Error('mirror: the ledger writes as W_LEDGER only');
  const owner = arkiv.owner;
  const pc = arkiv.publicClient;
  const syncOwner = (recorderOwner ?? writers.W_SYNC).toLowerCase();
  const live = createLedger({ arkiv, stream });
  const recorder = createLedger({ arkiv, stream: RECORDER_STREAM });
  const byStream = new Map([[stream, live], [RECORDER_STREAM, recorder]]);
  const ledgers = [live, recorder];
  const stale = new Set(ledgers);
  // The history's stream is named after its parameters, known once the workers have
  // read what Arkiv already holds (openHistory).
  let history = null;
  let historyStream = null;
  let historyDataset = null;

  async function fresh(l) {
    if (stale.has(l) || !l.state) {
      await l.load();
      stale.delete(l);
    }
    return l;
  }

  async function writing(l, fn) {
    await fresh(l);
    try {
      return await fn(l);
    } catch (err) {
      stale.add(l);
      throw err;
    } finally {
      // Whatever landed, the other streams' copies of the shared rows are now old; a
      // failed write left this ledger re-read (or unreadable, then stale).
      for (const x of ledgers) if (x !== l || !x.state) stale.add(x);
    }
  }

  const positionFor = (l, s, checkpoint) => {
    const stored = l.state.checkpoints.get(s)?.values;
    if (!stored || BigInt(stored.events ?? 0) === 0n) return checkpoint;
    return comparePosition(checkpoint, { block: Number(stored.block), logIndex: Number(stored.log_index) }) > 0 ? checkpoint : undefined;
  };

  const kindOf = (state, node, epoch) => state.nodes.get(`${node}:${BigInt(epoch ?? 0)}`)?.values?.kind;

  async function readCheckpoint(s) {
    const row = await findOne(pc, ENTITIES.checkpoint, { owner, where: [eq('stream', str(s))] });
    const l = byStream.get(s);
    const known = l?.state?.checkpoints.get(s)?.values;
    // Someone moved the anchor since this ledger read its rows: re-read before planning.
    if (l && (row ? !known || known.last_event !== row.last_event || BigInt(known.events) !== BigInt(row.events) : Boolean(known))) stale.add(l);
    return row ? { block: num(row.block), logIndex: num(row.log_index), events: num(row.events), lastEvent: row.last_event } : null;
  }


  return {
    owner,

    openHistory(name) {
      if (history && historyStream !== name) throw new Error('mirror: one history stream per process');
      if (!history) {
        historyStream = name;
        historyDataset = name;
        history = createLedger({ arkiv, stream: name, synthetic: { dataset: name } });
        byStream.set(name, history);
        ledgers.push(history);
        stale.add(history);
      }
      return name;
    },

    readCheckpoint,

    hasRef: (ref) => live.edgeExists(ref),

    async readActors() {
      await fresh(live);
      return [...live.state.nodes.values()].map(({ values: v }) => ({
        ens: v.ens,
        kind: v.kind,
        epoch: num(v.epoch),
        ownerNode: v.owner_node || undefined,
        category: v.category || undefined,
        city: v.city || undefined,
        verified: Boolean(v.verified),
        synthetic: Boolean(v.synthetic),
        status: v.status || undefined,
        capMicro: v.cap_micro,
      }));
    },

    confirmedNonce: () => live.confirmedNonce(),

    writeEdge(edge, { stream: s = stream, checkpoint, nonce }) {
      return writing(live, (l) => l.apply(ledgerEvent(edge, positionFor(l, s, checkpoint)), { nonce }));
    },

    writeStanding(m, { stream: s = stream, checkpoint, nonce }) {
      return writing(live, (l) =>
        l.writeStanding({ ref: m.ref, ens: m.ens, epoch: m.epoch, status: m.status, capMicro: m.capMicro, ts: m.ts, position: positionFor(l, s, checkpoint) }, { nonce }),
      );
    },

    // Node rows only, in transactions of at most 12; the first at the caller's nonce.
    async registerActors(actors, { nonce }) {
      let n = nonce;
      try {
        for (let i = 0; i < actors.length; i += REGISTER_CHUNK) {
          const part = actors.slice(i, i + REGISTER_CHUNK);
          const creates = part.map((a) => ({
            def: ENTITIES.node,
            values: nodeValues(a, historyDataset),
            expiration: ExpirationTime.fromDays(a.synthetic ? LIFETIME.syntheticDays : LIFETIME.realDays),
          }));
          const first = creates[0].values;
          const ours = async ([k]) => {
            const e = await pc.getEntity(k);
            const a = e?.$attributes ?? e?.attributes;
            return a?.node?.value?.toLowerCase() === first.node && a?.ens?.value === first.ens;
          };
          await arkiv.writer.send({ creates }, { nonce: n ?? (await live.confirmedNonce()), verifyRecovered: ours });
          n = null;
        }
      } finally {
        for (const l of ledgers) stale.add(l);
      }
    },

    async readRecorderEdges({ sinceTs, untilTs }) {
      const rows = await readAll(pc, ENTITIES.edge, { owner: syncOwner, where: [gt('ts', u64(BigInt(sinceTs))), lte('ts', u64(BigInt(untilTs)))] });
      return rows.map(edgeOfRow);
    },

    // Refusals of one second, folded in one transaction: positions (ts, 0), (ts, 1), …
    // and the last (ts, whole second done).
    // A refusal naming a node with no node row (never mirrored, another epoch) is
    // skipped and reported, never allowed to block the later ones.
    foldRecorder(edges, { nonce }) {
      return writing(recorder, async (l) => {
        const known = edges
          .map((e) => ({ ...e, fromKind: kindOf(l.state, e.fromNode, e.fromEpoch), toKind: kindOf(l.state, e.toNode, e.toEpoch), counted: true }))
          .filter((e) => e.fromKind && e.toKind);
        const skipped = edges.filter((e) => !known.some((k) => k.ref === e.ref)).map((e) => e.ref);
        if (known.length === 0) return { noNode: skipped, applied: [] };
        const events = known.map((e, i) => ledgerEvent(e, { block: e.ts, logIndex: i === known.length - 1 ? BLOCK_DONE : i }));
        const out = await l.foldRecorder(events, { nonce });
        return { ...out, noNode: skipped };
      });
    },

    // The history in parts that each plan into one unsplit transaction, sent at a
    // nonce read before its anchor and checked by its checkpoint if found by nonce, so
    // a part lands whole with its checkpoint or not at all. A shared tally or link row
    // that the history touches is labelled synthetic (it then holds synthetic counts).
    writeEdges(edges, { stream: s, checkpointOf }) {
      if (!history || s !== historyStream) throw new Error(`mirror: no history ledger for stream ${s}`);
      const labels = { synthetic: true, dataset: historyDataset };
      const expiration = ExpirationTime.fromDays(LIFETIME.syntheticDays);
      const planOf = (l, part) => {
        const planned = graph.plan(
          part.map((e) => toGraphEvent(e, labels)),
          l.state,
          { stream: s, labels },
        );
        const real = new Set();
        for (const group of [l.state.totals, l.state.links]) for (const row of group.values()) if (row.values.synthetic === false) real.add(row.key);
        const patches = planned.patches.map((p) => (real.has(p.key) && p.def !== ENTITIES.checkpoint ? { ...p, values: { ...p.values, synthetic: true } } : p));
        return { planned, batch: { creates: planned.creates.map((c) => ({ ...c, expiration })), patches } };
      };
      const size = (batch) => arkiv.writer.operations(batch).reduce((n, op) => n + operationBytes(op), 0);
      const events = edges.map((e) => ledgerEvent(e, checkpointOf(e)));
      return writing(history, async (l) => {
        for (let i = 0; i < events.length; ) {
          const nonce = await live.confirmedNonce();
          await readCheckpoint(s);
          await fresh(l);
          let lo = 1;
          let hi = events.length - i;
          while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            if (size(planOf(l, events.slice(i, i + mid)).batch) <= TX_TARGET_BYTES) lo = mid;
            else hi = mid - 1;
          }
          const part = events.slice(i, i + lo);
          const { planned, batch } = planOf(l, part);
          if (planned.applied.length > 0) {
            const last = planned.applied.at(-1);
            const ours = async () => (await findOne(pc, ENTITIES.checkpoint, { owner, where: [eq('stream', str(s))] }))?.last_event === last;
            const result = await arkiv.writer.send(batch, { nonce, verifyRecovered: ours });
            planned.commit(result.createdKeys);
          }
          i += lo;
        }
      });
    },

    async findStreams(prefix) {
      const rows = await readAll(pc, ENTITIES.checkpoint, { owner, where: [startsWith('stream', str(prefix))] });
      return rows.map((r) => ({ stream: r.stream, block: num(r.block), logIndex: num(r.log_index), events: num(r.events) }));
    },

    // After a restart: who paid for an order and when, from the mirror's own edges.
    async loadOrder(orderId) {
      const where = (kind) => [eq('order_id', str(orderId)), eq('kind', str(kind))];
      const order = await findOne(pc, ENTITIES.edge, { owner, where: where('order') });
      if (!order) return null;
      const pay = await findOne(pc, ENTITIES.edge, { owner, where: where('pay') });
      return { payerNode: order.from_node, shopNode: order.to_node, paidAt: pay ? num(pay.ts) : undefined };
    },

    async loadSub(subId) {
      const sub = await findOne(pc, ENTITIES.edge, { owner, where: [eq('order_id', str(subId)), eq('kind', str('subscribe'))] });
      return sub ? { subscriberNode: sub.from_node, shopNode: sub.to_node } : null;
    },

    // The lease and the lag chip.
    async readHeartbeats() {
      return (await readHeartbeats(pc, { owner })).map((r) => ({
        key: r.$key,
        instance: r.instance,
        state: r.state,
        updatedTs: num(r.updated_ts),
        updatedBlock: typeof r.$updatedAt === 'number' || typeof r.$updatedAt === 'bigint' ? Number(r.$updatedAt) : undefined,
        createdBlock: typeof r.$createdAt === 'number' || typeof r.$createdAt === 'bigint' ? Number(r.$createdAt) : undefined,
        cursorBlock: num(r.cursor_block),
        lagBlocks: num(r.lag_blocks),
      }));
    },

    arkivBlock: async () => Number(await pc.getBlockNumber({ cacheTime: 0 })),

    writeHeartbeat: (values, { key, extend }) => writeHeartbeat(arkiv, values, { key, extend }),

    stats: () => arkiv.stats,
    log,
  };
}
