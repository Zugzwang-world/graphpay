// GraphQL over the money graph on Arkiv (planning/SPEC/ARKIV_GRAPH.md §5): queries only;
// every answer carries extensions.arkiv, the explain trace of its reads. GET is cached
// briefly for the website; POST is never cached (agents).
import { runGraphql } from '@graphpay/money-graph';
import { allowed, arkivEngine, datasetOf } from './arkiv.server.ts';

export const dynamic = 'force-dynamic';

const json = (body: unknown, status: number, cache: string): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': cache } });

export async function GET(request: Request): Promise<Response> {
  if (!allowed(request)) return json({ errors: [{ message: 'too many requests' }] }, 429, 'no-store');
  const url = new URL(request.url);
  const query = url.searchParams.get('query') ?? '';
  let variables: Record<string, unknown> = {};
  try {
    variables = JSON.parse(url.searchParams.get('variables') ?? '{}');
  } catch {
    return json({ errors: [{ message: 'variables is not JSON' }] }, 400, 'no-store');
  }
  const result = await runGraphql({ engine: await arkivEngine(), query, variables, dataset: datasetOf(url.searchParams.get('dataset')) });
  return json(result, result.data === undefined ? 400 : 200, 's-maxage=5, stale-while-revalidate=10');
}

export async function POST(request: Request): Promise<Response> {
  if (!allowed(request)) return json({ errors: [{ message: 'too many requests' }] }, 429, 'no-store');
  let body: { query?: string; variables?: Record<string, unknown>; dataset?: string };
  try {
    body = await request.json();
  } catch {
    return json({ errors: [{ message: 'the body is not JSON' }] }, 400, 'no-store');
  }
  const dataset = datasetOf(body.dataset ?? new URL(request.url).searchParams.get('dataset'));
  const result = await runGraphql({ engine: await arkivEngine(), query: body.query ?? '', variables: body.variables ?? {}, dataset });
  return json(result, result.data === undefined ? 400 : 200, 'no-store');
}
