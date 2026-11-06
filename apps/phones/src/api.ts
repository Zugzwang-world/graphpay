// The routes both phones call (BACKEND_FOR_FRONTEND.md §1), on the same origin. Every refusal comes
// back as a plain sentence that says what happened and what to do; no raw error reaches the screen.

export interface CustomerState {
  agent: { ens: string; status: 'ACTIVE' | 'PAUSED' | 'REVOKED' | 'EXPIRED' | 'UNKNOWN' };
  capMicro: string | null;
  spentTodayMicro: string | null;
  lastOrder: { orderId: string; shopEns: string; amountMicro: string; status: string; transaction: string | null } | null;
  subscription: { subId: string; item: string | null; priceMicro: string; renewals: { at: string; transaction: string }[]; status: string; active: boolean } | null;
}

export interface HealState {
  healing: boolean;
  agents: { ens: string; status: string; pausedAt: string | null; resumesAt: string | null }[];
  shop: { ens: string; open: boolean; openUntil: string | null; reopensAt: string | null } | null;
}

export class Refusal extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number, sentence: string) {
    super(sentence);
    this.code = code;
    this.status = status;
  }
}

// The routes' codes in plain words: what happened, then what to do.
const WORDS: Record<string, string> = {
  'busy: one errand at a time': 'Another errand is running. Try again in a minute.',
  TOO_SOON: 'That was just done. Wait a minute, then try again.',
  OVER_REFUNDABLE: 'That is more than is left to refund on this order.',
  FLOAT_LOW: 'The shop’s refund float is low. Try a smaller amount.',
  STILL_PENDING: 'The last transaction for this order is still on its way. Try again in a minute.',
  NO_REQUEST: 'There is no refund request on this order to decline.',
  ALREADY_DECIDED: 'This refund request was already decided.',
  NOT_REORDERABLE: 'This order cannot be ordered again.',
  PRICE_CHANGED: 'The shop’s price changed, so nothing was sent.',
  OVER_DAILY_CAP: 'Refused: over today’s pass. Nothing was sent.',
  PASS_REVOKED: 'Refused: the payer’s pass is revoked. Nothing was sent.',
  SHOP_REFUSED: 'Refused before payment. Nothing was sent.',
  NOT_THIS_ORDER: 'Only the newest order can be changed here. Wait for it to show, then try again.',
  NO_ORDER: 'There is no order yet. Run an errand first.',
  BAD_REASON: 'The reason uses characters the record does not take.',
  NO_PASS: 'This agent has no pass, so it has nothing to pause.',
};

export function plainWords(code: string, status: number): string {
  if (WORDS[code]) return WORDS[code]!;
  if (status === 429) return 'That was just done. Wait a minute, then try again.';
  if (status === 503) return 'This part of the site is starting up. Try again in a minute.';
  if (status >= 500 || status === 0) return 'The site did not answer. Try again in a minute.';
  return 'That did not go through. Try again in a minute.';
}

export async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { cache: 'no-store' });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}), cache: 'no-store' });
  } catch {
    throw new Refusal('NETWORK', 0, plainWords('NETWORK', 0));
  }
  const parsed = (await res.json().catch(() => ({}))) as T & { error?: unknown };
  if (!res.ok) {
    const code = typeof parsed.error === 'string' ? parsed.error : `HTTP_${res.status}`;
    throw new Refusal(code, res.status, plainWords(code, res.status));
  }
  return parsed;
}

// The CSV export reads Arkiv live and can miss once; it is tried a second time before it fails.
export async function getTextRetry(path: string, retryAfterMs = 2_500): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(path, { cache: 'no-store' });
      if (res.ok) return await res.text();
    } catch {
      // try once more
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, retryAfterMs));
  }
  return null;
}
