// The self-healing cron (apps/web/vercel.json, every minute): Vercel sends CRON_SECRET as a
// bearer. A paused agent resumes after RESUME_AFTER_S; the shop's listing is renewed before it
// lapses and reopened REOPEN_AFTER_S after a close (lib/heal.server.ts).
import { bearerOk } from '@graphpay/facilitator';
import { json } from '../../../../lib/http.ts';
import { heal } from '../../../../lib/heal.server.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A resume waits for its Sepolia receipt and read-back; a listing write for Arkiv's.
export const maxDuration = 300;

export async function GET(request: Request): Promise<Response> {
  if (!bearerOk(request, process.env.CRON_SECRET ?? '')) return json({ error: 'unauthorized' }, 401);
  const run = heal();
  if (!run) return json({ skipped: 'the previous run on this server is still going' });
  return json(await run);
}
