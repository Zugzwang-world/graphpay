import { RUNNER_WAITING_FOR, errandRunner } from '../../../../lib/agents-live.server.ts';
import { badRequest, json, notLive, readJsonObject } from '../../../../lib/http.ts';
import { requirePasscode } from '../../../../lib/passcode.ts';
import { runs } from '../../../../lib/runs.server.ts';
import { streamRun } from '../../../../lib/run-registry.server.ts';

export const dynamic = 'force-dynamic';
// An errand takes minutes: the function may run as long as the platform allows.
export const maxDuration = 300;

const MAX_REQUEST_CHARS = 400;

// Starts one errand and streams it back (server-sent events: started, trace, result).
// The passcode is checked first; the request text is only a request: its budget and
// deadline are read by code (guard G1), never by the model.
export async function POST(request: Request): Promise<Response> {
  const refused = requirePasscode(request);
  if (refused) return refused;
  const body = await readJsonObject(request);
  const text = typeof body?.request === 'string' ? body.request.trim() : '';
  if (text === '' || text.length > MAX_REQUEST_CHARS) return badRequest(`request must be 1 to ${MAX_REQUEST_CHARS} characters`);
  const runner = errandRunner();
  if (!runner) return notLive(RUNNER_WAITING_FOR);
  const started = runs.start(runner, text);
  if (!started.ok) return json({ error: 'busy: one errand at a time' }, 409);
  return streamRun(started.run, request.signal);
}
