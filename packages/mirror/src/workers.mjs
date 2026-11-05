// The workers process (E-2): exactly one, on the founder's Mac. Start order
// (SPEC/INTEGRATION_AND_MIRROR.md §2, §4 step 5): the lease, the heartbeat row, the
// cast registered, the labelled history, then the chain source every 2 s, the
// heartbeat every 30 s and the recorder fold. Every Arkiv write goes through the
// mirror's lock: one wallet, one writer.

import { historyDecision, historyBuyers, planHistory, writeHistory } from './history.mjs';
import { utcDay } from './ids.mjs';
import { dropClaim, HEARTBEAT_EVERY_MS, heartbeatAgeS, leaseDecision, newInstanceId, pidAlive, readClaim, writeClaim } from './lease.mjs';
import { foldRecorder } from './recorder.mjs';

const EXTEND_EVERY_MS = 6 * 60 * 60 * 1000;

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
  log = () => {},
  redact = (s) => s,
}) {
  const startedTs = Math.floor(now() / 1000);
  const timers = new Set();
  const state = { instance, startedTs, running: false, lease: null, history: null, lastPollOk: null, lastError: null, recorder: null, heartbeatKey: null };
  let lastExtend = now();
  let recorderSince = 0;

  const errText = (err) => redact(err?.shortMessage ?? err?.message ?? String(err));

  async function lease() {
    const rows = await ledger.readHeartbeats();
    const arkivBlock = await ledger.arkivBlock();
    const nowS = Math.floor(now() / 1000);
    const c = readClaim(claimPath);
    const claim = c ? { ...c, alive: c.pid !== process.pid && pidAlive(c.pid) } : null;
    for (const row of rows) {
      const d = leaseDecision({ row, instance, ageS: heartbeatAgeS(row, { arkivBlock, nowS }), claim });
      if (!d.ok) throw Object.assign(new Error(`workers: refused to start: ${d.why}`), { code: 'LEASE_HELD' });
    }
    writeClaim({ instance, pid: process.pid, startedTs }, claimPath);
    state.lease = { ok: true, rows: rows.length };
  }

  // Two instances that started together both saw no fresh heartbeat: after writing our
  // own row, the smaller instance id keeps running and the other stops.
  async function raceCheck() {
    const rows = await ledger.readHeartbeats();
    const arkivBlock = await ledger.arkivBlock();
    const nowS = Math.floor(now() / 1000);
    const rival = rows.find((r) => r.instance !== instance && r.state !== 'stopped' && heartbeatAgeS(r, { arkivBlock, nowS }) <= 90 && r.instance < instance);
    if (rival) throw Object.assign(new Error(`workers: another instance (${rival.instance}) started at the same time; this one stops`), { code: 'LEASE_HELD' });
  }

  async function beat(phase = 'running') {
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
    await mirror.lock.run(async () => {
      state.heartbeatKey = await ledger.writeHeartbeat(values, { key: state.heartbeatKey, extend });
    });
    if (extend) lastExtend = now();
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
    await mirror.register(historyBuyers().map((b) => ({ ...b, dataset: plan.stream })));
    state.history = { stream: plan.stream, total: plan.events.length, written: null };
    const out = await writeHistory({ ledger, plan, actors, run: (fn) => mirror.lock.run(fn), log });
    state.history.written = out.written;
    state.history.done = true;
  }

  function every(ms, fn) {
    const tick = async () => {
      timers.delete(handle);
      if (!state.running) return;
      await fn();
      if (state.running) {
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

  async function heartbeat() {
    try {
      await beat();
    } catch (err) {
      log(`heartbeat: failed: ${errText(err)}`);
    }
  }

  return {
    state,
    beat,
    poll,
    fold,

    async start() {
      await lease();
      await mirror.adopt();
      await beat('running');
      await raceCheck();
      const registered = await mirror.register(bootstrap);
      log(`workers: ${registered} cast node(s) registered, ${actors.size} known`);
      if (history) await runHistory();
      // The cast and the history are in place; now the chain source.
      await poll();
      state.running = true;
      every(pollMs, poll);
      every(beatMs, heartbeat);
      every(foldMs, fold);
      return state;
    },

    async stop() {
      state.running = false;
      for (const t of timers) clearTimeout(t);
      timers.clear();
      await mirror.lock.run(() => {});
      try {
        await beat('stopped');
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
