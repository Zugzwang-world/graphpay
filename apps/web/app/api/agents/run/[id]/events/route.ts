import { json } from '../../../../../../lib/http.ts';
import { runs } from '../../../../../../lib/runs.server.ts';
import { streamRun } from '../../../../../../lib/run-registry.server.ts';

export const dynamic = 'force-dynamic';

// Replays a run held by this server process (best effort: another instance may hold
// it). The request that starts a run streams it live; this is for a second watcher.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const run = /^[0-9a-f-]{36}$/.test(id) ? runs.get(id) : null;
  if (!run) return json({ error: 'no such run on this server' }, 404);
  return streamRun(run, request.signal);
}
