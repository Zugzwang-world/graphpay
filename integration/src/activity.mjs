// The agents' live presence and handoff hooks (MASTER_PLAN §4 item 3), written by
// W_DIRECTORY as T3's `agent_presence` and `handoff` rows (packages/money-graph,
// Friday item 1), batched: a hook call only queues its row and returns at once, so it
// never blocks an agent step, and the queue goes out as one Arkiv transaction a phase
// (every `flushMs` while calls arrive, and on `flush()` at the end of a run). A presence
// renewal extends the row it created. A failed batch is logged and dropped: presence and
// handoffs are display, never evidence of money.

import { ExpirationTime } from '@arkiv-network/sdk';
import { ENTITIES, LIFETIME, normalizedName } from '@graphpay/money-graph';

const MAX_OPS = 20; // one unsplit transaction, well under the 120 KB batch target

export function batchedActivity(arkiv, { flushMs = 2_000, log = () => {}, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  if (!arkiv?.writer) throw new Error('activity: needs a W_DIRECTORY connection with a writer');
  const keys = new Map(); // agent|session → presence row key
  const pending = new Set(); // presence ids queued for creation
  const renewals = new Set();
  let queue = [];
  let timer = null;
  let chain = Promise.resolve();
  let held = null; // while set, no batch goes out (another writer with this key is sending)
  const stats = { queued: 0, written: 0, dropped: 0, txs: 0 };

  function schedule() {
    if (timer) return;
    timer = setTimer(() => {
      timer = null;
      chain = chain.then(flushOnce);
    }, flushMs);
  }

  async function flushOnce() {
    if (held) await held;
    const items = queue.slice(0, MAX_OPS);
    queue = queue.slice(items.length);
    const ext = [...renewals].filter((id) => keys.has(id)).slice(0, MAX_OPS - items.length);
    for (const id of ext) renewals.delete(id);
    if (queue.length > 0) schedule();
    if (items.length === 0 && ext.length === 0) return;
    const creates = items.map((it) => ({ def: it.def, values: it.values, expiration: ExpirationTime.fromMinutes(it.minutes) }));
    const extensions = ext.map((id) => ({ key: keys.get(id), expiration: ExpirationTime.fromMinutes(LIFETIME.presenceMinutes) }));
    // A transaction found by nonce is ours if its first create carries our first row.
    const ours = async ([k]) => {
      if (!k) return creates.length === 0;
      const a = (await arkiv.publicClient.getEntity(k).catch(() => null))?.$attributes;
      return Object.entries(creates[0].values).every(([c, v]) => String(a?.[c]?.value) === String(v));
    };
    try {
      const { createdKeys, txs } = await arkiv.writer.send({ creates, extensions }, { verifyRecovered: ours });
      items.forEach((it, i) => {
        if (it.id) {
          keys.set(it.id, createdKeys[i]);
          pending.delete(it.id);
        }
      });
      stats.written += items.length + ext.length;
      stats.txs += txs.length;
    } catch (err) {
      for (const it of items) if (it.id) pending.delete(it.id);
      stats.dropped += items.length + ext.length;
      log(`activity: a batch of ${items.length + ext.length} dropped (${err.code ?? err.name})`);
    }
  }

  return {
    stats,
    presence(_phase, { agentEns, ownerEns, role, session }) {
      const id = `${normalizedName(agentEns)}|${session}`;
      if (keys.has(id) || pending.has(id)) renewals.add(id);
      else {
        pending.add(id);
        queue.push({ id, def: ENTITIES.agent_presence, minutes: LIFETIME.presenceMinutes, values: { agent_ens: normalizedName(agentEns), owner_ens: normalizedName(ownerEns), role: String(role), session: String(session) } });
        stats.queued += 1;
      }
      schedule();
    },
    handoff(from, to, step, { requestId }) {
      queue.push({ def: ENTITIES.handoff, minutes: LIFETIME.handoffMinutes, values: { request_id: String(requestId), from_agent: normalizedName(from), to_agent: normalizedName(to), step: String(step) } });
      stats.queued += 1;
      schedule();
    },
    // Holds the batches back while another process writes with the same key (the hosted shop's
    // quote at the 402 step): flush first, then hold; the returned function releases them.
    async hold() {
      await this.flush();
      let release;
      held = new Promise((ok) => (release = ok));
      return () => {
        held = null;
        release();
      };
    },
    // Sends everything queued now (the end of a run); resolves when it has landed or dropped.
    async flush() {
      if (timer) {
        clearTimer(timer);
        timer = null;
      }
      while (queue.length > 0 || [...renewals].some((id) => keys.has(id))) {
        chain = chain.then(flushOnce);
        await chain;
        if (timer) {
          clearTimer(timer);
          timer = null;
        }
      }
      await chain;
      return { ...stats };
    },
  };
}
