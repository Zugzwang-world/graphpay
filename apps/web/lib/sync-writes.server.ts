// The recorder's key (W_SYNC) writes the customer's refund requests and the shop's declines from this
// instance. They share its nonce with the facilitator's refusal records, so both draw on one cap.
export const MAX_SYNC_WRITES_PER_MINUTE = 6;
const writes: number[] = [];

// Takes one write for now, or refuses (false) when the minute's cap is spent.
export function takeSyncWrite(now: number, max = MAX_SYNC_WRITES_PER_MINUTE): boolean {
  const cutoff = now - 60_000;
  while (writes.length && writes[0]! <= cutoff) writes.shift();
  if (writes.length >= max) return false;
  writes.push(now);
  return true;
}

// For tests only.
export function forgetSyncWrites(): void {
  writes.length = 0;
}
