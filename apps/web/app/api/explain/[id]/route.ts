// The explain trace of an earlier GraphQL or MCP answer on this instance, by explain id.
import { arkivEngine } from '../../graphql/arkiv.server.ts';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };
  if (!/^[0-9a-f]{12}$/.test(id)) return new Response(JSON.stringify({ error: 'an explain id is 12 hex characters' }), { status: 400, headers });
  const trace = (await arkivEngine()).explainStore.get(id);
  if (!trace) return new Response(JSON.stringify({ error: 'no trace for this id on this instance (the last 200 are kept)' }), { status: 404, headers });
  return new Response(JSON.stringify(trace), { status: 200, headers });
}
