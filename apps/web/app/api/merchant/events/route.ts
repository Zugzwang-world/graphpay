// The merchant phone's order stream (WEBSITE_SPEC.md §7): the shop's new edges from the
// money graph, polled from GraphQL every 2.5 s (ADR-0055) and sent as SSE. A stream ends
// itself before the function limit; the client reconnects with `since` (the unix second
// of the last edge it saw) so nothing is missed in between.
import { siteModel } from '../../../../lib/site.server.ts';
import { allowed } from '../../graphql/arkiv.server.ts';
import { sharedShopEdges } from '../../../../lib/merchant-feed.server.ts';
import { edgeKey, freshEdges, toEvent } from '../../../../lib/merchant-feed.ts';
import { json } from '../../../../lib/http.ts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const POLL_MS = 2500;
const STREAM_MS = 50_000;
// An edge is written some seconds after its block; a new stream looks this far back.
const LOOKBACK_S = 30;

export async function GET(request: Request): Promise<Response> {
  if (!allowed(request, 30)) return json({ error: 'too many requests' }, 429);
  const sinceParam = new URL(request.url).searchParams.get('since');
  const since = sinceParam !== null && /^\d{1,12}$/.test(sinceParam) ? Number(sinceParam) : null;
  const shop = siteModel().merchant.ens;
  const encoder = new TextEncoder();
  const sent = new Set<string>();
  let cursor = since ?? Math.floor(Date.now() / 1000) - LOOKBACK_S;
  let stopped = false;

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const frame = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      request.signal.addEventListener('abort', () => {
        stopped = true;
      });
      frame('ready', { shop, cursor });
      const end = Date.now() + STREAM_MS;
      try {
        while (!stopped && Date.now() < end) {
          try {
            const { edges } = await sharedShopEdges(shop);
            for (const row of freshEdges(edges, cursor, sent)) {
              const event = toEvent(row);
              sent.add(edgeKey(row));
              if (!event) continue;
              frame('edge', event);
              cursor = Math.max(cursor, Number(row.ts));
            }
          } catch {
            // The graph may be slow for a moment; the next poll tries again.
            controller.enqueue(encoder.encode(': the graph did not answer, retrying\n\n'));
          }
          await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        }
      } finally {
        if (!stopped) controller.close();
      }
    },
    cancel() {
      stopped = true;
    },
  });

  return new Response(body, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store, no-transform', connection: 'keep-alive' } });
}
