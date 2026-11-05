// The workers process's local endpoints (SPEC/INTEGRATION_AND_MIRROR.md §2), bound to
// the loopback address only: GET /health, GET /status, POST /sync (a poll under the
// mirror's lock that returns only after its writes landed; the e2e run calls it after
// each chain step). Nothing here is reachable from another machine.

import { createServer } from 'node:http';

export const DEFAULT_PORT = 8788;

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
};

// app: { health() → object, status() → object, sync() → Promise<object> }. redact: the
// process's redactor (scripts/lib/redact.mjs): viem errors quote RPC URLs, which can
// carry keys.
export function startServer(app, { port = DEFAULT_PORT, host = '127.0.0.1', log = () => {}, redact = (s) => s } = {}) {
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://local').pathname;
    try {
      if (req.method === 'GET' && path === '/health') return json(res, 200, app.health());
      if (req.method === 'GET' && path === '/status') return json(res, 200, app.status());
      if (req.method === 'POST' && path === '/sync') return json(res, 200, await app.sync());
      return json(res, 404, { error: 'not found' });
    } catch (err) {
      log(`server: ${req.method} ${path} failed (${err.code ?? err.name ?? 'error'})`);
      return json(res, 503, { error: err.code ?? 'unavailable', message: redact(err.shortMessage ?? err.message) });
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}
