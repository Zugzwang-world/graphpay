// The renewal cron (apps/web/vercel.json, every minute): Vercel sends CRON_SECRET as a bearer.
import { bearerOk } from '@graphpay/facilitator';
import { jsonNoStore, log, reason } from '../../../../lib/payments.server.ts';
import { renewDue } from '../../../../lib/renew.server.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  if (!bearerOk(request, process.env.CRON_SECRET ?? '')) return jsonNoStore(401, { error: 'unauthorized' });
  try {
    return jsonNoStore(200, await renewDue());
  } catch (e) {
    log(`cron renew: ${reason(e)}`); // a start-up check's name, or the error's name: never a message
    return jsonNoStore(503, { error: 'renewals unavailable' });
  }
}
