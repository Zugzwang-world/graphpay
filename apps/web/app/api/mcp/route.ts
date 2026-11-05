// The hosted MCP endpoint (ADR-0037): read-only tools schema, ask, graphql and explain
// over Streamable HTTP, stateless, rate-limited. Its URL is site.url + site.mcpPath.
import { handleMcpRequest } from '@graphpay/money-graph';
import { allowed, arkivEngine, datasetOf } from '../graphql/arkiv.server.ts';

export const dynamic = 'force-dynamic';

async function handle(request: Request): Promise<Response> {
  if (!allowed(request, 120)) return new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'too many requests' }, id: null }), { status: 429, headers: { 'content-type': 'application/json' } });
  const dataset = datasetOf(new URL(request.url).searchParams.get('dataset'));
  return handleMcpRequest(request, { engine: await arkivEngine(), dataset });
}

export const POST = handle;

// Stateless: no server-sent stream and no session to delete.
const notAllowed = (): Response => new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'use POST' }, id: null }), { status: 405, headers: { 'content-type': 'application/json', allow: 'POST' } });
export const GET = notAllowed;
export const DELETE = notAllowed;
