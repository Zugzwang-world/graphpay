// Reads a server-sent event stream with fetch rather than EventSource, so the
// caller sees the HTTP status first: a 503 "not live yet" answer is JSON, and a
// race or a run is never opened twice just to learn why it failed.

export type StreamOutcome = { kind: 'ended' } | { kind: 'refused'; status: number; body: unknown } | { kind: 'failed' };

export function parseFrames(buffer: string): { frames: { event: string; data: string }[]; rest: string } {
  const frames: { event: string; data: string }[] = [];
  const parts = buffer.split(/\r?\n\r?\n/);
  const rest = parts.pop() ?? '';
  for (const part of parts) {
    let event = 'message';
    const data: string[] = [];
    for (const line of part.split(/\r?\n/)) {
      if (line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
      if (field === 'event') event = value;
      else if (field === 'data') data.push(value);
    }
    if (data.length > 0) frames.push({ event, data: data.join('\n') });
  }
  return { frames, rest };
}

export async function streamEvents(
  url: string,
  onEvent: (event: string, data: string) => void,
  { signal, headers = {} }: { signal?: AbortSignal; headers?: Record<string, string> } = {},
): Promise<StreamOutcome> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: 'text/event-stream', ...headers }, signal, cache: 'no-store' });
  } catch {
    return { kind: 'failed' };
  }
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || !type.includes('text/event-stream') || !res.body) {
    const body: unknown = await res.json().catch(() => null);
    return { kind: 'refused', status: res.status, body };
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const { frames, rest } = parseFrames(buffer);
      buffer = rest;
      for (const frame of frames) onEvent(frame.event, frame.data);
    }
  } catch {
    return signal?.aborted ? { kind: 'ended' } : { kind: 'failed' };
  }
  return { kind: 'ended' };
}

export function waitingForIn(outcome: StreamOutcome): string | null {
  if (outcome.kind !== 'refused' || outcome.status !== 503) return null;
  const body = outcome.body as { error?: unknown; waitingFor?: unknown } | null;
  return body?.error === 'not live yet' && typeof body.waitingFor === 'string' ? body.waitingFor : null;
}
