// One read-only Arkiv engine per server instance for the GraphQL, explain and MCP
// routes (T3; thin routes over @graphpay/money-graph). The backend comes from
// ARKIV_BACKEND (rabdi on Vercel) and the access key from ARKIV_ACCESS_KEY, read on the
// server only; the explain store keeps this instance's last 200 traces.
import { connectArkiv, createGraphEngine } from '@graphpay/money-graph';

type Engine = ReturnType<typeof createGraphEngine>;
let engine: Promise<Engine> | null = null;

export function arkivEngine(): Promise<Engine> {
  engine ??= connectArkiv({ backend: (process.env.ARKIV_BACKEND as 'sim' | 'local' | 'rabdi' | undefined) ?? 'rabdi', env: process.env })
    .then((arkiv) => createGraphEngine(arkiv))
    .catch((error: unknown) => {
      engine = null;
      throw error;
    });
  return engine;
}

// A synthetic city is read only when a request asks for it (`dataset=S`).
export function datasetOf(value: string | null | undefined): 'live' | 'S' | 'M' {
  return value === 'S' || value === 'M' ? value : 'live';
}

// A per-instance limit for the public read routes: `max` requests per minute per client.
const hits = new Map<string, { n: number; at: number }>();
export function allowed(request: Request, max = 60): boolean {
  const who = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  const now = Date.now();
  const h = hits.get(who);
  if (!h || now - h.at > 60_000) {
    hits.set(who, { n: 1, at: now });
    if (hits.size > 5000) hits.clear();
    return true;
  }
  h.n += 1;
  return h.n <= max;
}
