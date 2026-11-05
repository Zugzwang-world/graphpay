// The shop's 402 API on the production domain: /api/shop/{catalog,quote} (open),
// /api/shop/orders/:id/{pay,reorder} (X-Demo-Passcode), /api/shop/health. M4.
import { jsonNoStore, route, shop } from '../../../../lib/payments.server.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const handle = route('shop', async () => {
  const s = await shop();
  return async (request: Request) => {
    if (request.method === 'GET' && new URL(request.url).pathname.replace(/\/+$/, '').endsWith('/health')) {
      const ok = await s.ready().then(() => true, () => false);
      return jsonNoStore(ok ? 200 : 503, { ok, startup: ok ? 'ok' : 'failed' });
    }
    return s.handle(request);
  };
});
export const GET = handle;
export const POST = handle;
