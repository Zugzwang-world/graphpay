// One side of race mode (WEBSITE_SPEC.md §7): the question asked of Arkiv live and
// uncached, each read sent as a `call` event as it lands, then the `answer` with its
// reads and bytes. The result is the number of reads, never a clock (ADR-0042).
import { RACE_QUESTIONS } from '@graphpay/money-graph';
import { allowed } from '../graphql/arkiv.server.ts';
import { json } from '../../../lib/http.ts';
import { createRaceLock, parseRaceQuery } from '../../../lib/race.ts';
import { RACE_SIZE, SEEDED_SIZES, plainRaceRefusal, runRace } from '../../../lib/race.server.ts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const lock = createRaceLock();

export async function GET(request: Request): Promise<Response> {
  if (!allowed(request, 20)) return json({ error: 'too many requests' }, 429);
  const query = parseRaceQuery(new URL(request.url).searchParams, RACE_QUESTIONS, { sizes: SEEDED_SIZES, size: RACE_SIZE });
  if ('error' in query) return json({ error: query.error }, 400);
  const release = lock.take(query.mode);
  if (!release) return json({ error: 'a race is already running on this side' }, 429);
  // Every path that does not start the stream releases the lock, a throw included.
  let refused: string | null;
  try {
    refused = plainRaceRefusal(query);
  } catch {
    release();
    return json({ error: 'the race could not start; try again' }, 500);
  }
  if (refused) {
    release();
    return json({ error: refused }, 429);
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const frame = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        await runRace(query, (f) => frame(f.event, f.data));
      } catch {
        // No internals reach the browser; the client shows that the stream stopped early.
        frame('error', { error: 'the race could not read Arkiv; try again' });
      } finally {
        release();
        controller.close();
      }
    },
  });
  return new Response(body, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store, no-transform', connection: 'keep-alive' } });
}
