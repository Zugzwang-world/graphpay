// The mirror (SPEC/INTEGRATION_AND_MIRROR.md §2): checkout events → Graph Arkiv, one
// atomic batch per event with the stream checkpoint, as the single W_LEDGER writer.
//
// Per event: skip it at or before the checkpoint; read the confirmed nonce, then the
// anchors (checkpoint and `ref`), and send at exactly that nonce, so a batch built on
// a stale read cannot land after someone else's (§2, ADR-0023). Events naming an
// unknown actor are parked, and the checkpoint never passes the earliest parked one,
// so a restart finds them again. Any failed write: discard, re-adopt from Arkiv,
// re-read from the checkpoint, rethrow.
//
// The ledger port (Arkiv; the fake in the tests):
//   readCheckpoint(stream) → { block, logIndex, events } | null
//   hasRef(ref) → boolean                      a W_LEDGER edge with this ref exists
//   readActors() → actor rows                  the W_LEDGER node rows
//   confirmedNonce() → number
//   writeEdge(edge, { stream, checkpoint, nonce })
//   writeStanding(standing, { stream, checkpoint, nonce })
//   registerActors(actors, { nonce })          node rows only
// A write whose nonce someone else took throws an error with code 'NONCE_TAKEN'.

import { nodeOf } from './actors.mjs';
import { atOrBefore, before, comparePosition, minPosition } from './ids.mjs';
import { Lock } from './lock.mjs';
import { epochHint, mapEvent, observeEvent } from './map.mjs';
import { ranges } from './source.mjs';

export class Mirror {
  #source;
  #ledger;
  #actors;
  #orders;
  #candidates;
  #parked = new Map();
  #lock = new Lock();
  #stale = false;
  #log;

  constructor({ source, ledger, actors, orders, stream, deployBlock, candidates = new Map(), deliveryPromiseS, log = () => {} }) {
    if (!stream) throw new Error('mirror: a stream name is required');
    if (!Number.isInteger(deployBlock) || deployBlock < 0) throw new Error('mirror: DEPLOY_BLOCK must be the checkout deploy block');
    this.#source = source;
    this.#ledger = ledger;
    this.#actors = actors;
    this.#orders = orders;
    this.#candidates = candidates;
    this.#log = log;
    this.stream = stream;
    this.deployBlock = deployBlock;
    this.deliveryPromiseS = deliveryPromiseS;
    this.checkpoint = null;
    this.cursor = null;
    this.scannedTo = deployBlock - 1;
    this.head = null;
    this.between = null;
    this.stats = { written: 0, standing: 0, skippedCheckpoint: 0, skippedRef: 0, none: 0, unknownLogs: 0, retries: 0, lastWriteAt: null };
  }

  get lock() {
    return this.#lock;
  }

  get parked() {
    return [...this.#parked.values()].map(({ e, why, nodes }) => ({ id: e.id, name: e.name, block: e.block, why, nodes }));
  }

  // (Re)loads everything from Arkiv: the checkpoint, the node rows. Drops the caches.
  async adopt() {
    this.checkpoint = await this.#ledger.readCheckpoint(this.stream);
    for (const row of await this.#ledger.readActors()) this.#actors.register(row);
    this.#orders.clear();
    this.#parked.clear();
    this.cursor = this.checkpoint;
    this.scannedTo = this.checkpoint ? this.checkpoint.block - 1 : this.deployBlock - 1;
  }

  // Registers actors that Arkiv does not hold yet (the bootstrap; a recognised node).
  register(actors) {
    return this.#lock.run(() => this.#register(actors));
  }

  async #register(actors) {
    const fresh = actors.filter((a) => {
      const known = this.#actors.get(a.node ?? nodeOf(a.ens));
      return !known || known.epoch < (a.epoch ?? 0);
    });
    if (fresh.length === 0) return 0;
    const nonce = await this.#ledger.confirmedNonce();
    await this.#ledger.registerActors(fresh, { nonce });
    for (const a of fresh) this.#actors.register(a);
    return fresh.length;
  }

  // One poll: every confirmed block since the last one, then the parked events.
  poll() {
    return this.#lock.run(() => this.#poll());
  }

  // POST /sync: a poll under the same lock; returns only after the writes landed.
  sync() {
    return this.poll();
  }

  async #poll() {
    try {
      // After a failed write, adopt again first (also after a network drop, when the
      // adopt itself could not reach Arkiv).
      if (this.#stale) {
        await this.adopt();
        this.#stale = false;
      }
      this.head = await this.#source.head();
      const safe = this.head - this.#source.confirmations;
      for (const r of ranges(this.scannedTo + 1, safe)) {
        const { events, unknown } = await this.#source.events(r.from, r.to);
        this.stats.unknownLogs += unknown;
        for (const e of events) {
          await this.#process(e);
          // The workers' heartbeat, due or not, between events of a long catch-up.
          if (this.between) await this.between();
        }
        this.scannedTo = r.to;
      }
      await this.#retryParked();
      return this.status();
    } catch (err) {
      this.stats.retries += 1;
      this.#log(`mirror: poll failed (${err.code ?? err.name ?? 'error'}); re-adopting from Arkiv`);
      this.#stale = true;
      try {
        await this.adopt();
        this.#stale = false;
      } catch {
        // Arkiv unreachable: the next poll adopts first.
      }
      throw err;
    }
  }

  // The checkpoint a write may carry: never past the earliest parked event.
  #safe(pos) {
    let out = { block: pos.block, logIndex: pos.logIndex };
    for (const { e } of this.#parked.values()) out = minPosition(out, before(e));
    return out;
  }

  #advance(e) {
    if (!this.cursor || comparePosition(e, this.cursor) > 0) this.cursor = { block: e.block, logIndex: e.logIndex };
  }

  #ctx() {
    return { actors: this.#actors, orders: this.#orders, blockTime: (b) => this.#source.blockTime(b), deliveryPromiseS: this.deliveryPromiseS };
  }

  async #process(e) {
    if (atOrBefore(e, this.checkpoint)) return this.#skip(e, 'skippedCheckpoint');
    // The confirmed nonce first, then the anchors, then the send at exactly that nonce.
    const nonce = await this.#ledger.confirmedNonce();
    const anchor = await this.#ledger.readCheckpoint(this.stream);
    if (atOrBefore(e, anchor)) {
      // Someone moved the checkpoint past this event: our view was stale.
      this.checkpoint = anchor;
      return this.#skip(e, 'skippedCheckpoint');
    }
    if (await this.#ledger.hasRef(e.id)) return this.#skip(e, 'skippedRef');
    const m = await mapEvent(e, this.#ctx());
    // A recognised name is registered first (a write of its own), then the event
    // starts over with a fresh nonce and fresh anchors.
    if (m.action === 'park' && m.nodes.length > 0 && (await this.#recognise(e, m.nodes))) return this.#process(e);
    this.#advance(e);
    await this.#apply(e, m, this.#safe(e), nonce);
  }

  #skip(e, counter) {
    observeEvent(e, this.#ctx());
    this.stats[counter] += 1;
    this.#advance(e);
  }

  async #apply(e, m, checkpoint, nonce) {
    const cp = { ...checkpoint, events: (this.checkpoint?.events ?? 0) + 1 };
    switch (m.action) {
      case 'edge':
        await this.#ledger.writeEdge(m.edge, { stream: this.stream, checkpoint: cp, nonce });
        this.checkpoint = cp;
        this.stats.written += 1;
        this.stats.lastWriteAt = Date.now();
        return;
      case 'standing':
        if (m.unchanged) {
          this.#actors.setStanding(m.node, m);
          this.stats.none += 1;
          return;
        }
        await this.#ledger.writeStanding(m, { stream: this.stream, checkpoint: cp, nonce });
        this.#actors.setStanding(m.node, m);
        this.checkpoint = cp;
        this.stats.standing += 1;
        this.stats.lastWriteAt = Date.now();
        return;
      case 'park':
        this.#parked.set(e.id, { e, why: m.why, nodes: m.nodes });
        this.#log(`mirror: parked ${e.name} ${e.id} (${m.why})`);
        return;
      default:
        this.stats.none += 1;
    }
  }

  // Unknown nodes that are recognisable names (the numbered disposable agents) are
  // registered on the spot, with the epoch the event states (the AgentPolicy's epoch
  // is the ENS epoch) or 0, a fresh ENSv2 name's epoch.
  async #recognise(e, nodes) {
    const found = nodes.map((n) => this.#candidates.get(n.toLowerCase()));
    if (found.some((c) => !c)) return false;
    const actors = found.map((c, i) => ({ ...c, epoch: epochHint(e, nodes[i].toLowerCase()) ?? 0 }));
    await this.#register(actors);
    return true;
  }

  async #retryParked() {
    const waiting = [...this.#parked.values()].sort((a, b) => comparePosition(a.e, b.e));
    for (const { e } of waiting) {
      const m = await mapEvent(e, this.#ctx());
      if (m.action === 'park') continue;
      const nonce = await this.#ledger.confirmedNonce();
      const anchor = await this.#ledger.readCheckpoint(this.stream);
      this.#parked.delete(e.id);
      if (atOrBefore(e, anchor) || (await this.#ledger.hasRef(e.id))) continue;
      await this.#apply(e, m, this.#safe(this.cursor), nonce);
    }
  }

  status() {
    return {
      stream: this.stream,
      checkpoint: this.checkpoint,
      cursor: this.cursor,
      scannedTo: this.scannedTo,
      head: this.head,
      lagBlocks: this.head == null ? null : Math.max(0, this.head - this.scannedTo),
      parked: this.parked,
      actors: this.#actors.size,
      stats: { ...this.stats },
    };
  }
}
