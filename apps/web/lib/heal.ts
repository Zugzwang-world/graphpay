// Self-healing (the W5 Ops brief): a paused agent resumes by itself RESUME_AFTER_S after its
// pause, and the shop listed as closed reopens REOPEN_AFTER_S after it closed. The cron also
// renews a listing about to lapse, so the shop stays open with no merchant page on screen.
// Nothing is stored (ADR-0003): the pause time is the block time of the status record's last
// change on Sepolia, and the close time is the newest listing's open_until on Arkiv. Pure
// decisions here; heal.server.ts reads the chains and acts on them.

export const RESUME_AFTER_S = 120;
export const REOPEN_AFTER_S = 300;
// A live listing with less than this left is renewed. The merchant page renews every 5
// minutes at 10 minutes left, so the cron writes only when no page is renewing. A renewal
// also keeps a closed row on Arkiv for at least 9 minutes, long enough to read its close time.
export const RENEW_BELOW_S = 600;

// The status record's newest change, from its TextUpdated log: the value written and the
// block's time (unix seconds).
export interface StatusChange {
  value: string;
  at: number;
}

export interface AgentPlan {
  // The ENS status record: 'active', 'paused' (anything but 'paused' is active to the gate).
  status: string;
  pausedAt: number | null;
  resumesAt: number | null;
  // unsure: the record says paused but its newest log does not (a lagging log query); the
  // next run decides.
  action: 'none' | 'wait' | 'resume' | 'unsure';
}

// last: the newest status change within the lookback window, or null when there is none.
export function planAgent(status: string, last: StatusChange | null, nowS: number): AgentPlan {
  if (status !== 'paused') return { status, pausedAt: null, resumesAt: null, action: 'none' };
  // Paused, with no change in the window: paused for longer than the window, so resume now.
  if (!last) return { status, pausedAt: null, resumesAt: nowS, action: 'resume' };
  if (last.value !== 'paused') return { status, pausedAt: null, resumesAt: null, action: 'unsure' };
  const resumesAt = last.at + RESUME_AFTER_S;
  return { status, pausedAt: last.at, resumesAt, action: nowS >= resumesAt ? 'resume' : 'wait' };
}

export interface ShopPlan {
  open: boolean;
  openUntil: number | null;
  closedAt: number | null;
  reopensAt: number | null;
  action: 'none' | 'renew' | 'wait' | 'reopen';
}

// listings: the open_until (unix seconds) of each of the shop's rows still on Arkiv.
export function planShop(listings: number[], nowS: number): ShopPlan {
  const newest = listings.length > 0 ? Math.max(...listings) : null;
  if (newest !== null && newest > nowS) {
    return { open: true, openUntil: newest, closedAt: null, reopensAt: null, action: newest - nowS < RENEW_BELOW_S ? 'renew' : 'none' };
  }
  // No row left: the listing lapsed with nobody renewing it (a closed row outlives its close
  // by 9 minutes or more), so reopen now.
  if (newest === null) return { open: false, openUntil: null, closedAt: null, reopensAt: nowS, action: 'reopen' };
  const reopensAt = newest + REOPEN_AFTER_S;
  return { open: false, openUntil: null, closedAt: newest, reopensAt, action: nowS >= reopensAt ? 'reopen' : 'wait' };
}
