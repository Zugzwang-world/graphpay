// The workers process (E-2): exactly one, on the founder's Mac. Start order
// (SPEC/INTEGRATION_AND_MIRROR.md §2, §4 step 5): the lease, the heartbeat row, the
// cast registered, the labelled history, then the chain source every 2 s and the
// recorder fold. Every Arkiv write goes through the mirror's lock: one wallet, one
// writer.
//
// The heartbeat beats from the first moment on, also during the history and inside a
// long catch-up (between events), so the lease never lapses while this process writes.
// Every beat looks for a rival: of two running instances, the one whose heartbeat row
// was created first keeps the lease, and the other stops itself.

import { historyDecision, historyBuyers, planHistory, writeHistory } from './history.mjs';
import { utcDay } from './ids.mjs';
import { dropClaim, HEARTBEAT_EVERY_MS, heartbeatAgeS, leaseDecision, newInstanceId, pidAlive, readClaim, STALE_AFTER_S, takeClaim } from './lease.mjs';
import { foldRecorder } from './recorder.mjs';

const EXTEND_EVERY_MS = 6 * 60 * 60 * 1000;

// A send at a nonce the RPC had not caught up with, right after our own write (a
// load-balanced RPC can lag one behind): safe to try again shortly.
export const retryableWrite = (err) => err?.code === 'NONCE_TAKEN' || /nonce \d+ is ahead of the confirmed/.test(err?.message ?? '');

export function createWorkers({
  mirror,
  ledger,
  actors,
  bootstrap = [],
  history = null,
  bindings = null,
  instance = newInstanceId(),
  claimPath,
  pollMs = 2_000,
  beatMs = HEARTBEAT_EVERY_MS,
  foldMs = 10_000,
  now = () => Date.now(),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  onLost = () => {},
  log = () => {},
  redact = (s) => s,
}) {
  const startedTs = Math.floor(now() / 1000);
  const timers = new Set();
  const state = { instance, startedTs, alive: false, running: false, lease: null, history: null, lastPollOk: null, lastError: null, recorder: null, heartbeatKey: null, lastBeat: null };
  const dead = new Set(); // instances the lease accepted as exited or stopped
  let lastExtend = now();
  let recorderSince = 0;

  const errText = (err) => redact(err?.shortMessage ?? err?.message ?? String(err));
  const leaseHeld = (why) => Object.assign(new Error(`workers: refused to run: ${why}`), { code: 'LEASE_HELD' });

  async function retrying(fn, tries = 5) {
    for (let i = 1; ; i += 1) {
      try {
        return await fn();
      } catch (err) {
        if (i >= tries || !retryableWrite(err)) throw err;
        await sleep(2_000);
      }
    }
  }

  async function lease() {
    const claim = readClaim(claimPath);
    if (claim && claim.instance !== instance && claim.pid !== process.pid && pidAlive(claim.pid)) {
      throw leaseHeld(`another workers process (pid ${claim.pid}) is running on this machine`);
    }
    const rows = await ledger.readHeartbeats();
    const arkivBlock = await ledger.arkivBlock();
    const nowS = Math.floor(now() / 1000);
    for (const row of rows) {
      const ageS = heartbeatAgeS(row, { arkivBlock, nowS });
      const d = leaseDecision({ row, instance, ageS, claim: claim ? { ...claim, alive: false } : null });
      if (!d.ok) throw leaseHeld(d.why);
      if (ageS <= STALE_AFTER_S) dead.add(row.instance);
    }
    takeClaim({ instance, pid: process.pid, startedTs }, claimPath);
    state.lease = { ok: true, rows: rows.length };
  }

  // A running instance whose heartbeat row was created before ours (by Arkiv block;
  // a tie goes to the smaller id), not one the lease accepted as gone.
  async function rival() {
    const rows = await ledger.readHeartbeats();
    const mine = rows.find((r) => r.instance === instance);
    if (!mine || mine.createdBlock == null) return null;
    const arkivBlock = await ledger.arkivBlock();
    const nowS = Math.floor(now() / 1000);
    return (
      rows.find(
        (r) =>
          r.instance !== instance &&
          r.state === 'running' &&
          !dead.has(r.instance) &&
          heartbeatAgeS(r, { arkivBlock, nowS }) <= STALE_AFTER_S &&
          r.createdBlock != null &&
          (r.createdBlock < mine.createdBlock || (r.createdBlock === mine.createdBlock && r.instance < instance)),
      ) ?? null
    );
  }

  // One heartbeat write; the caller holds the mirror's lock.
  async function beatLocked(phase = 'running') {
    const s = mirror.status();
    const cursor = s.cursor ?? { block: Math.max(0, s.scannedTo), logIndex: 0 };
    const extend = state.heartbeatKey !== null && now() - lastExtend >= EXTEND_EVERY_MS;
    const values = {
      instance,
      state: phase,
      cursorBlock: Math.max(0, cursor.block),
      cursorLog: Math.max(0, cursor.logIndex),
      headBlock: Math.max(0, s.head ?? 0),
      lagBlocks: Math.max(0, s.lagBlocks ?? 0),
      updatedTs: Math.floor(now() / 1000),
    };
    state.heartbeatKey = await retrying(() => ledger.writeHeartbeat(values, { key: state.heartbeatKey, extend }));
    state.lastBeat = now();
    if (extend) lastExtend = now();
  }

  async function lost(r) {
    state.alive = false;
    state.running = false;
    for (const t of timers) clearTimeout(t);
    timers.clear();
    log(`workers: instance ${r.instance} holds the lease (its heartbeat row is older); stopping`);
    dropClaim(instance, claimPath);
    onLost(r);
  }

  async function beatIfDue({ force = false } = {}) {
    if (!state.alive || (!force && state.lastBeat !== null && now() - state.lastBeat < beatMs)) return;
    try {
      await beatLocked();
      const r = await rival();
      if (r) await lost(r);
    } catch (err) {
      log(`heartbeat: failed: ${errText(err)}`);
    }
  }

  async function runHistory() {
    const existing = await ledger.findStreams('history:');
    if (existing.length > 1) {
      state.history = { refused: `${existing.length} history streams on Arkiv` };
      log(`history: refused: ${state.history.refused}`);
      return;
    }
    const decision = historyDecision(existing[0] ?? null, history.paramsFor);
    if (decision.action === 'refuse') {
      state.history = { refused: decision.why };
      log(`history: refused: ${decision.why}`);
      return;
    }
    const endDay = decision.action === 'resume' ? decision.endDay : utcDay(Math.floor(now() / 1000));
    const plan = planHistory(history.paramsFor(endDay));
    ledger.openHistory(plan.stream);
    await retrying(() => mirror.register(historyBuyers().map((b) => ({ ...b, dataset: plan.stream }))));
    state.history = { stream: plan.stream, total: plan.events.length, written: null };
    const out = await writeHistory({
      ledger,
      plan,
      actors,
      run: (fn) => mirror.lock.run(() => retrying(fn)),
      stopped: () => !state.alive,
      log,
    });
    state.history.written = out.written;
    state.history.done = out.done;
  }

  function every(ms, fn) {
    const tick = async () => {
      timers.delete(handle);
      if (!state.alive) return;
      await fn();
      if (state.alive) {
        handle = setTimeout(tick, ms);
        timers.add(handle);
      }
    };
    let handle = setTimeout(tick, ms);
    timers.add(handle);
  }

  async function poll() {
    try {
      await mirror.poll();
      state.lastPollOk = now();
    } catch (err) {
      state.lastError = { at: now(), code: err.code ?? err.name, message: errText(err) };
      log(`mirror: poll failed: ${state.lastError.message}`);
    }
  }

  async function fold() {
    if (!bindings) return;
    try {
      const out = await mirror.lock.run(() => foldRecorder({ ledger, bindings, nowS: Math.floor(now() / 1000), since: recorderSince }));
      recorderSince = out.sinceTs;
      state.recorder = { ...out, at: now() };
      if (out.folded) log(`recorder: folded ${out.folded} refusal(s)`);
    } catch (err) {
      log(`recorder: fold failed: ${errText(err)}`);
    }
  }

  return {
    state,
    poll,
    fold,
    beat: () => mirror.lock.run(() => beatIfDue({ force: true })),

    async start() {
      await lease();
      await mirror.adopt();
      state.alive = true;
      await mirror.lock.run(() => beatLocked());
      // Beats from now on: on a timer between writes, and between events of a long poll.
      every(Math.max(1_000, Math.floor(beatMs / 3)), () => mirror.lock.run(() => beatIfDue()));
      mirror.between = () => beatIfDue();
      const r = await rival();
      if (r) {
        await lost(r);
        throw leaseHeld(`instance ${r.instance} started first`);
      }
      const registered = await retrying(() => mirror.register(bootstrap));
      log(`workers: ${registered} cast node(s) registered, ${actors.size} known`);
      if (history && state.alive) await runHistory();
      if (!state.alive) return state;
      // The cast and the history are in place; now the chain source.
      await poll();
      state.running = true;
      every(pollMs, poll);
      every(foldMs, fold);
      return state;
    },

    async stop() {
      const wasAlive = state.alive;
      state.alive = false;
      state.running = false;
      for (const t of timers) clearTimeout(t);
      timers.clear();
      mirror.between = null;
      await mirror.lock.run(() => {});
      try {
        if (wasAlive) await mirror.lock.run(() => beatLocked('stopped'));
      } finally {
        dropClaim(instance, claimPath);
      }
    },

    health() {
      return { ok: state.running && state.lastPollOk !== null && now() - state.lastPollOk < 30_000, instance, running: state.running, lastPollOk: state.lastPollOk };
    },

    status() {
      return { ...state, mirror: mirror.status() };
    },

    sync: () => mirror.sync(),
  };
}
