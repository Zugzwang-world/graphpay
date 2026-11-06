// What self-healing does next, read-only (lib/heal.server.ts): each pausable agent's ENS status,
// with when a paused one resumes by itself, and the shop's listing, with when a closed one
// reopens. Times are ISO strings; the answer is cached for 10 s per server.
import { json } from '../../../../lib/http.ts';
import { REOPEN_AFTER_S, RESUME_AFTER_S } from '../../../../lib/heal.ts';
import { healState } from '../../../../lib/heal.server.ts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const iso = (s: number | null) => (s === null ? null : new Date(s * 1000).toISOString());

export async function GET(): Promise<Response> {
  try {
    const { agents, shop } = await healState();
    return json({
      resumeAfterS: RESUME_AFTER_S,
      reopenAfterS: REOPEN_AFTER_S,
      agents: agents.map((a) => ({ ens: a.ens, status: a.failed ? 'unknown' : a.status, pausedAt: iso(a.pausedAt), resumesAt: iso(a.resumesAt) })),
      shop: shop && { ens: shop.ens, open: shop.failed ? null : shop.open, openUntil: iso(shop.openUntil), closedAt: iso(shop.closedAt), reopensAt: iso(shop.reopensAt) },
      at: new Date().toISOString(),
    });
  } catch {
    return json({ error: 'the state could not be read; try again' }, 502);
  }
}
