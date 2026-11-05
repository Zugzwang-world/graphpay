// The Mumbai map's data (MASTER_PLAN.md item 10): the shop directory, which shops are open now
// and which agents are at work, read from the money graph. Public reads, nothing signs.
import { allowed } from '../graphql/arkiv.server.ts';
import { json } from '../../../lib/http.ts';
import { sharedMap } from '../../../lib/map.server.ts';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request): Promise<Response> {
  if (!allowed(request, 40)) return json({ error: 'too many requests' }, 429);
  try {
    return json(await sharedMap());
  } catch {
    return json({ error: 'the graph did not answer; try again in a moment' }, 502);
  }
}
