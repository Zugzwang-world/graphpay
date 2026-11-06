// What self-healing does next, read-only (lib/heal.server.ts): each pausable agent's ENS status,
// with when a paused one resumes by itself, and the shop's listing, with when a closed one
// reopens. Times are ISO strings. The answer holds nothing secret, so the CDN keeps it for 10 s
// (a server also keeps its own for 10 s): visitors' polls cost the chains a few reads a minute.
import { json } from '../../../../lib/http.ts';
import { REOPEN_AFTER_S, RESUME_AFTER_S } from '../../../../lib/heal.ts';
import { healState } from '../../../../lib/heal.server.ts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const iso = (s: number | null) => (s !== null && Number.isFinite(s) ? new Date(s * 1000).toISOString() : null);

export async function GET(): Promise<Response> {
  try {
    const { agents, shop } = await healState();
    // With healing off (GRAPHPAY_HEAL=0) nothing resumes or reopens by itself, so no time is promised.
    const healing = process.env.GRAPHPAY_HEAL !== '0';
    const when = (s: number | null) => (healing ? iso(s) : null);
    return json({
      healing,
      resumeAfterS: RESUME_AFTER_S,
      reopenAfterS: REOPEN_AFTER_S,
      agents: agents.map((a) => ({ ens: a.ens, status: a.failed ? 'unknown' : a.status, pausedAt: iso(a.pausedAt), resumesAt: when(a.resumesAt) })),
      shop: shop && { ens: shop.ens, open: shop.failed ? null : shop.open, openUntil: iso(shop.openUntil), closedAt: iso(shop.closedAt), reopensAt: when(shop.reopensAt) },
      at: new Date().toISOString(),
    }, 200, { 'cache-control': 'public, s-maxage=10, stale-while-revalidate=20' });
  } catch {
    return json({ error: 'the state could not be read; try again' }, 502);
  }
}
