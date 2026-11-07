// The shop's dispatch mark as the stage and both phones read it: the merchant phone relays the
// route's answer (POST /api/merchant/dispatch) as a `dispatched` event. A fresh mark and an order the
// hosted shop had already marked delivered on chain (alreadyDelivered) read the same: dispatched,
// with its Whitechain link whenever the answer carried the transaction, and the refund unlocks.
export interface Dispatched {
  tx: string | null;
  at: number;
}

export function dispatchedOf(events: readonly { key: string; at: number; data?: Record<string, unknown> }[], orderId: string | null | undefined): Dispatched | null {
  if (!orderId) return null;
  const e = events.find((x) => x.key === 'dispatched' && typeof x.data?.orderId === 'string' && x.data.orderId.toLowerCase() === orderId.toLowerCase());
  if (!e) return null;
  return { tx: typeof e.data?.transaction === 'string' && e.data.transaction ? e.data.transaction : null, at: e.at };
}

// What a dispatch shows: its link, a plain "Dispatched" when no transaction came back, "Dispatching"
// while it is on its way, else nothing.
export function dispatchBadge(dispatched: { tx: string | null } | null, waiting: boolean): 'link' | 'done' | 'pending' | null {
  if (dispatched?.tx) return 'link';
  if (dispatched) return 'done';
  return waiting ? 'pending' : null;
}
