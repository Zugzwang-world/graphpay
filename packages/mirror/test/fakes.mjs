// Test doubles: an in-memory ledger with Arkiv's nonce rule (one write per confirmed
// nonce), a chain source over pre-decoded events, the cast as actors, and a fold of
// the tally rules (SPEC/ARKIV_GRAPH.md §3) to check what the edges add up to. The real
// tally planner and ArkivSim come from @graphpay_ethglobal/arkiv-graph (M7a).

import { activeCast, config } from '@graphpay/config';
import { keccak256, toHex } from 'viem';
import { Actors, castActors, nodeOf } from '../src/actors.mjs';
import { eventId, ZERO_NODE } from '../src/ids.mjs';

export const CHAIN = config.networks.whitechain.chainId;

export function nonceTaken() {
  const err = new Error('nonce too low: another writer used it');
  err.code = 'NONCE_TAKEN';
  return err;
}

export class FakeLedger {
  nonce = 0;
  edges = [];
  nodes = new Map();
  standing = [];
  checkpoints = new Map();
  batches = [];
  // Runs once before the next send: simulates a concurrent writer.
  beforeSend = null;
  failNext = null;

  async readCheckpoint(stream) {
    const cp = this.checkpoints.get(stream);
    return cp ? { ...cp } : null;
  }

  async hasRef(ref) {
    return this.edges.some((e) => e.ref === ref);
  }

  async readActors() {
    return [...this.nodes.values()].map((n) => ({ ...n }));
  }

  async confirmedNonce() {
    return this.nonce;
  }

  #send(nonce, ops, apply) {
    if (this.beforeSend) {
      const hook = this.beforeSend;
      this.beforeSend = null;
      hook(this);
    }
    if (this.failNext) {
      const err = this.failNext;
      this.failNext = null;
      throw err;
    }
    if (nonce !== this.nonce) throw nonceTaken();
    apply();
    this.batches.push({ nonce, ops });
    this.nonce += 1;
  }

  async writeEdge(edge, { stream, checkpoint, nonce }) {
    this.#send(nonce, ['edge', 'tallies', 'link', 'checkpoint'], () => {
      this.edges.push(edge);
      this.checkpoints.set(stream, checkpoint);
    });
  }

  async writeStanding(s, { stream, checkpoint, nonce }) {
    this.#send(nonce, ['node patch', 'checkpoint'], () => {
      this.standing.push(s);
      const n = this.nodes.get(s.node);
      if (n && n.epoch === s.epoch) Object.assign(n, { status: s.status, capMicro: s.capMicro });
      this.checkpoints.set(stream, checkpoint);
    });
  }

  async registerActors(actors, { nonce }) {
    this.#send(nonce, actors.map(() => 'node create'), () => {
      for (const a of actors) this.nodes.set(nodeOf(a.ens), { ...a, node: nodeOf(a.ens) });
    });
  }

  refCount(ref) {
    return this.edges.filter((e) => e.ref === ref).length;
  }

  // A logical batch, split here into transactions of `perTx` edges as the writer splits by bytes.
  perTx = 10;

  async writeEdges(edges, { stream, checkpointOf, nonce }) {
    let n = nonce;
    for (let i = 0; i < edges.length; i += this.perTx) {
      const part = edges.slice(i, i + this.perTx);
      this.#send(n, ['edges', 'tallies', 'links', 'checkpoint'], () => {
        this.edges.push(...part);
        this.checkpoints.set(stream, checkpointOf(part.at(-1)));
      });
      n += 1;
    }
  }

  async findStreams(prefix) {
    return [...this.checkpoints.entries()].filter(([s]) => s.startsWith(prefix)).map(([stream, cp]) => ({ stream, ...cp }));
  }

  heartbeat = null;
  arkivBlockNumber = 1000;

  async readHeartbeat() {
    return this.heartbeat ? { ...this.heartbeat } : null;
  }

  async arkivBlock() {
    return this.arkivBlockNumber;
  }

  async writeHeartbeat(row, { nonce }) {
    this.#send(nonce, ['heartbeat'], () => {
      this.heartbeat = { ...row, updatedBlock: this.arkivBlockNumber };
    });
  }

  // The recorder's W_SYNC edges, and what the mirror folded from them.
  recorderEdges = [];
  folded = [];

  async readRecorderEdges({ sinceTs, untilTs }) {
    return this.recorderEdges.filter((e) => e.ts > sinceTs && e.ts <= untilTs).map((e) => ({ ...e }));
  }

  async foldRecorder(edges, { stream, checkpoint, nonce }) {
    this.#send(nonce, ['tallies', 'checkpoint'], () => {
      this.folded.push(...edges);
      this.checkpoints.set(stream, checkpoint);
    });
  }
}

export function fakeSource(events, { confirmations = 2, head, times = {} } = {}) {
  const src = {
    confirmations,
    headBlock: head ?? Math.max(0, ...events.map((e) => e.block)) + confirmations,
    calls: [],
    async head() {
      return src.headBlock;
    },
    async events(from, to) {
      src.calls.push({ from, to });
      return { events: events.filter((e) => e.block >= from && e.block <= to), unknown: 0 };
    },
    async blockTime(block) {
      return times[block] ?? 1_762_400_000 + block;
    },
  };
  return src;
}

// The cast as the mirror's actors, with the persona, the shops and the paying agents
// found by role (never by story literal).
export function cast() {
  const c = activeCast();
  const actors = castActors({ cast: c });
  const root = config.root.ens;
  const persona = `${c.persona.label}.${root}`;
  const agent = (key) => `${[...c.buyerAgents, ...c.workingAgents].find((a) => a.key === key).label}.${persona}`;
  const shop = (role) => `${c.shops.find((s) => s.storyRole === role).label}.${root}`;
  return {
    cast: c,
    actors,
    names: { persona, payer: agent('payer'), scout: agent('scout'), rehearsal: agent('rehearsal'), good: shop('good'), trap: shop('trap'), runnerUp: shop('runner-up') },
    node: (ens) => nodeOf(ens),
  };
}

export function actorsWith(list) {
  const a = new Actors();
  for (const x of list) a.register(x);
  return a;
}

export const hash = (s) => keccak256(toHex(s));

// One decoded event at (block, logIndex), as decodeLogs would return it.
export function ev(name, args, block, logIndex = 0) {
  const txHash = hash(`tx:${block}`);
  return { id: eventId(CHAIN, txHash, logIndex), name, args, block, logIndex, txHash, address: '0x' };
}

export const ZERO = ZERO_NODE;

// The tally rules of SPEC/ARKIV_GRAPH.md §3, over all windows, for one node.
export function fold(edges, node) {
  const t = { orders: 0, paidMicro: 0n, refunds: 0, refundedMicro: 0n, fails: 0, delivered: 0, onTime: 0, cancels: 0, disputes: 0 };
  for (const e of edges) {
    if (e.fromNode !== node && e.toNode !== node) continue;
    if (e.kind === 'order' || e.kind === 'subscribe') t.orders += 1;
    if (e.kind === 'pay' || e.kind === 'renew') t.paidMicro += e.amountMicro;
    if (e.kind === 'refund') {
      t.refunds += 1;
      t.refundedMicro += e.amountMicro;
    }
    if (e.kind === 'fail' && e.counted) t.fails += 1;
    if (e.kind === 'deliver') {
      t.delivered += 1;
      t.onTime += 1;
    }
    if (e.kind === 'late') t.delivered += 1;
    if (e.kind === 'cancel') t.cancels += 1;
    if (e.kind === 'dispute') t.disputes += 1;
  }
  return t;
}
