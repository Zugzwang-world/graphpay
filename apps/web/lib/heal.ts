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
  // The ENS status record. The gate pays only an agent whose record reads 'active'; the cron
  // resumes only one whose record reads 'paused'.
  status: string;
  pausedAt: number | null;
  resumesAt: number | null;
  // unsure: the record and its history disagree (a log query on a node a block behind); the
  // next run decides.
  action: 'none' | 'wait' | 'resume' | 'unsure';
}

// last: the newest status change within the lookback window, or null when there is none.
// pausedEarlier: with no change found, whether the record already read 'paused' RESUME_AFTER_S
// ago; null when it was not read.
export function planAgent(status: string, last: StatusChange | null, nowS: number, pausedEarlier: boolean | null = null): AgentPlan {
  if (status !== 'paused') return { status, pausedAt: null, resumesAt: null, action: 'none' };
  // No change in the window: an old pause only if the record was paused RESUME_AFTER_S ago
  // too. A brand-new pause on a node that has not served its log yet reads active back then.
  if (!last) return pausedEarlier === true ? { status, pausedAt: null, resumesAt: nowS, action: 'resume' } : { status, pausedAt: null, resumesAt: null, action: 'unsure' };
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

// listings: the open_until (unix seconds) of each of the shop's rows still on Arkiv. A value
// that is not a number is left out.
export function planShop(listings: number[], nowS: number): ShopPlan {
  const valid = listings.filter((t) => Number.isFinite(t));
  const newest = valid.length > 0 ? Math.max(...valid) : null;
  if (newest !== null && newest > nowS) {
    return { open: true, openUntil: newest, closedAt: null, reopensAt: null, action: newest - nowS < RENEW_BELOW_S ? 'renew' : 'none' };
  }
  // No row left: the listing lapsed with nobody renewing it (a closed row outlives its close
  // by 9 minutes or more), so reopen now.
  if (newest === null) return { open: false, openUntil: null, closedAt: null, reopensAt: nowS, action: 'reopen' };
  const reopensAt = newest + REOPEN_AFTER_S;
  return { open: false, openUntil: null, closedAt: newest, reopensAt, action: nowS >= reopensAt ? 'reopen' : 'wait' };
}
