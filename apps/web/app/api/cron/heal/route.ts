// The self-healing cron (apps/web/vercel.json, every minute): Vercel sends CRON_SECRET as a
// bearer. A paused agent resumes after RESUME_AFTER_S; the shop's listing is renewed before it
// lapses and reopened REOPEN_AFTER_S after a close (lib/heal.server.ts). GRAPHPAY_HEAL=0 in the
// server's env turns it off (an emergency pause that must hold; it takes a redeploy).
import { bearerOk } from '@graphpay/facilitator';
import { json } from '../../../../lib/http.ts';
import { heal } from '../../../../lib/heal.server.ts';
import { failureKind } from '../../../../lib/owner-actions.server.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A resume waits for its Sepolia receipt and read-back; a listing write for Arkiv's.
export const maxDuration = 300;

export async function GET(request: Request): Promise<Response> {
  if (!bearerOk(request, process.env.CRON_SECRET ?? '')) return json({ error: 'unauthorized' }, 401);
  if (process.env.GRAPHPAY_HEAL === '0') return json({ off: 'GRAPHPAY_HEAL=0' });
  const run = heal();
  if (!run) return json({ skipped: 'the previous run on this server is still going' });
  try {
    return json(await run);
  } catch (error) {
    // The kind only: a chain error's message can carry an RPC URL.
    console.error('cron heal failed:', failureKind(error));
    return json({ error: 'the heal run failed' }, 503);
  }
}
