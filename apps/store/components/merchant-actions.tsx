'use client';

import { useState } from 'react';
import { usePasscode } from './passcode';

// Dispatch and refund run on the server with the shop's own key, behind the demo passcode.
export function MerchantActions({ orderId }: { orderId: string }) {
  const passcode = usePasscode();
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async (path: string, body: object) => {
    setBusy(true);
    setNote(null);
    const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-demo-passcode': passcode() ?? '' }, body: JSON.stringify(body) }).catch(() => null);
    const answer = (await res?.json().catch(() => null)) as { transaction?: string; error?: string } | null;
    const reasons: Record<string, string> = { NOT_DELIVERABLE: 'It is not in a state that can be marked dispatched.', NOT_REFUNDABLE: 'It cannot be refunded in this state.', OVER_REFUNDABLE: 'More than is left to refund.', NO_REFUND_FLOAT: 'The shop wallet lacks the balance or approval for this refund.' };
    setNote(res?.ok ? `Done${answer?.transaction ? `: ${answer.transaction.slice(0, 10)}…` : ''}` : (reasons[answer?.error ?? ''] ?? answer?.error ?? 'The store did not answer.'));
    setBusy(false);
  };
  return (
    <span>
      <button type="button" className="quiet" disabled={busy} onClick={() => void send('/api/merchant/dispatch', { orderId })}>
        Mark dispatched
      </button>{' '}
      <button type="button" className="quiet" disabled={busy} onClick={() => window.confirm('Refund what is left of this order to the buyer?') && void send('/api/merchant/refund', { orderId, full: true })}>
        Refund in full
      </button>
      {note ? <span className="small" role="status"> {note}</span> : null}
    </span>
  );
}
