// One errand at a time (planning/PROMPTS/15-website.md pitfalls: one relayer nonce
// stream, so the website queues payments and says "busy"). A run's events are kept
// in memory for a few minutes so a second watcher on the same instance can replay
// them; the starting request streams them live, so nothing depends on that.

import type { RunResult, TraceEvent } from './contracts.ts';

export type RunFrame =
  | { event: 'started'; data: { runId: string } }
  | { event: 'trace'; data: TraceEvent }
  | { event: 'result'; data: RunResult }
  | { event: 'failed'; data: { error: string } };

export interface Run {
  id: string;
  frames: RunFrame[];
  done: boolean;
  finishedAt: number | null;
  listeners: Set<(frame: RunFrame) => void>;
}

export interface ErrandInput {
  // The run's id on this site. The runner passes it on as the errand's `runId`, so the
  // handoff and presence rows it writes to Arkiv carry the id the explainer's lanes query by.
  runId: string;
  request: string;
  onEvent: (event: TraceEvent) => void;
  signal: AbortSignal;
}

// Join's M12 wiring supplies the real runner (ENS, Arkiv, the shop and the signer).
export type ErrandRunner = (input: ErrandInput) => Promise<RunResult>;

export interface Registry {
  start(runner: ErrandRunner, request: string): { ok: true; run: Run } | { ok: false; reason: 'busy' };
  get(id: string): Run | null;
}

// The runner's refusals the visitor can act on (live-runner.mjs codes), as fixed lines.
const FAILED_LINES: Record<string, string> = {
  LIVE_RUNNER_BUSY: 'busy: the last errand is still finishing; try again in a minute',
};

const SECRET_NAME = /(?:_PASSCODE|_RPC_URL|_PRIVATE_KEY|_API_KEY|_ACCESS_KEY|_TOKEN|_SECRET)$/;
const MAX_FRAMES = 2000;

// The runner scrubs its own events (guard G14); the result is scrubbed here too, so a
// configured secret value never reaches a browser through the narrative or an error.
export function scrubSecrets<T>(value: T, env: Record<string, string | undefined> = process.env): T {
  const secrets = Object.entries(env).flatMap(([name, v]) => (SECRET_NAME.test(name) && typeof v === 'string' && v.length >= 8 ? [v] : []));
  if (secrets.length === 0) return value;
  let text = JSON.stringify(value);
  for (const secret of secrets) text = text.split(JSON.stringify(secret).slice(1, -1)).join('[redacted]');
  return JSON.parse(text) as T;
}

export function createRegistry({ keepMs = 5 * 60_000, maxRunMs = 280_000, now = Date.now, id = () => crypto.randomUUID() } = {}): Registry {
  const runs = new Map<string, Run>();
  let active: Run | null = null;

  const emit = (run: Run, frame: RunFrame) => {
    if (run.frames.length < MAX_FRAMES || frame.event === 'result' || frame.event === 'failed') run.frames.push(frame);
    for (const listener of run.listeners) {
      try {
        listener(frame);
      } catch {
        // one watcher's failure never stops the others or the run
      }
    }
  };

  const sweep = () => {
    for (const [key, run] of runs) if (run.finishedAt !== null && now() - run.finishedAt > keepMs) runs.delete(key);
  };

  return {
    start(runner, request) {
      sweep();
      if (active && !active.done) return { ok: false, reason: 'busy' };
      const run: Run = { id: id(), frames: [], done: false, finishedAt: null, listeners: new Set() };
      runs.set(run.id, run);
      active = run;
      emit(run, { event: 'started', data: { runId: run.id } });
      const abort = new AbortController();
      const limit = setTimeout(() => abort.abort(), maxRunMs);
      void (async () => {
        try {
          // Raced against the time limit: a runner that ignores the signal cannot pin the slot.
          const limited = new Promise<never>((_, reject) => abort.signal.addEventListener('abort', () => reject(new Error('time limit'))));
          const result = await Promise.race([runner({ runId: run.id, request, signal: abort.signal, onEvent: (event) => emit(run, { event: 'trace', data: event }) }), limited]);
          emit(run, { event: 'result', data: scrubSecrets(result) });
        } catch (error) {
          // The cause can hold a URL or key: only a fixed line leaves the server, chosen by the
          // runner's error code (never its message).
          const code = (error as { code?: unknown } | null)?.code;
          const line = abort.signal.aborted ? 'the errand ran out of time' : typeof code === 'string' && Object.hasOwn(FAILED_LINES, code) ? (FAILED_LINES[code] ?? 'the errand failed') : 'the errand failed';
          emit(run, { event: 'failed', data: { error: line } });
        } finally {
          clearTimeout(limit);
          run.done = true;
          run.finishedAt = now();
        }
      })();
      return { ok: true, run };
    },
    get(key) {
      sweep();
      return runs.get(key) ?? null;
    },
  };
}

const encoder = new TextEncoder();
const frameText = (frame: RunFrame) => `event: ${frame.event}\ndata: ${JSON.stringify(frame.data)}\n\n`;

// A server-sent stream of a run: what has happened so far, then each new frame, with a
// comment every 15 s so proxies keep the connection open; it ends when the run does.
export function streamRun(run: Run, signal?: AbortSignal): Response {
  let cleanup = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const finish = () => {
        if (closed) return;
        closed = true;
        cleanup();
        try {
          controller.close();
        } catch {
          // already closed by the client
        }
      };
      const push = (frame: RunFrame) => {
        if (closed) return;
        controller.enqueue(encoder.encode(frameText(frame)));
        if (frame.event === 'result' || frame.event === 'failed') finish();
      };
      const keepAlive = setInterval(() => !closed && controller.enqueue(encoder.encode(': keep-alive\n\n')), 5_000);
      cleanup = () => {
        clearInterval(keepAlive);
        run.listeners.delete(push);
      };
      for (const frame of run.frames) push(frame);
      if (!closed && run.done) return finish();
      run.listeners.add(push);
      signal?.addEventListener('abort', finish, { once: true });
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(body, {
    headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store, no-transform', 'x-accel-buffering': 'no' },
  });
}
