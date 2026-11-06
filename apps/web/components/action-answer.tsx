'use client';

// What a passcode-gated button's route answered: its transaction with the explorer
// link, a refusal, or "not live yet" with the milestone it waits for.

import { txUrl, type NetworkKey } from '@/lib/explorer';
import { ExplorerChip } from './explorer-chip';
import { useSite, type ApiAnswer } from './site-context';

const TX_FIELDS: { field: string; network: NetworkKey; label: string }[] = [
  { field: 'transaction', network: 'whitechain', label: 'Whitechain tx' },
  { field: 'sepoliaTx', network: 'sepolia', label: 'Sepolia tx' },
  { field: 'arkivTx', network: 'rabdi', label: 'Arkiv tx' },
];

// What a refusal code from a signing route means, in the words a person reads.
const REASONS: Record<string, string> = {
  NO_SUCH_ORDER: 'No such order.',
  NOT_OURS: 'That order belongs to another shop.',
  NOT_DELIVERABLE: 'That order is not waiting to be dispatched.',
  NOT_REFUNDABLE: 'That order cannot be refunded in its state.',
  OVER_REFUNDABLE: 'That is more than is left to refund.',
  BAD_AMOUNT: 'Nothing is left to refund.',
  FLOAT_LOW: 'The shop wallet lacks the balance or the approval for this refund.',
  NO_ORDER: 'There is no order to act on yet.',
  NOT_THIS_ORDER: 'That is not the latest order.',
  BAD_REASON: 'The reason must be short plain text.',
  TOO_SOON: 'One was just sent or is still settling. Wait a few minutes before trying again.',
  NOT_REORDERABLE: 'The last order has to be paid before it can be ordered again.',
  PRICE_CHANGED: 'The shop now quotes a different price or quantity. Nothing was paid.',
  NOT_PAID: 'The payment did not go through. Nothing was paid.',
  OVER_PERIOD_CAP: 'That would pass the agent\'s spending cap. Nothing was paid.',
  OVER_DAILY_CAP: 'That would pass the agent\'s daily cap. Nothing was paid.',
  PASS_REVOKED: 'The agent\'s spending pass is revoked. Nothing was paid.',
  PASS_EXPIRED: 'The agent\'s spending pass has expired. Nothing was paid.',
  GAS_LOW: 'The shop wallet has no gas coin left.',
  STILL_PENDING: 'The last send for this order is still confirming. Check the explorer before trying again.',
};

export function ActionAnswer({ answer, pending }: { answer: ApiAnswer | null; pending: boolean }) {
  const { model } = useSite();
  if (pending) {
    return (
      <p className="answer" role="status">
        Sending…
      </p>
    );
  }
  if (!answer) return null;
  if (answer.waitingFor) {
    return (
      <p className="answer" role="status">
        Not live yet: waiting for <strong>{answer.waitingFor}</strong>.
      </p>
    );
  }
  if (!answer.ok) {
    return (
      <p className="answer answer-error" role="alert">
        <span aria-hidden="true">✕ </span>
        {REASONS[answer.error ?? ''] ?? answer.error}
      </p>
    );
  }
  const body = (answer.body ?? {}) as Record<string, unknown>;
  const chips = TX_FIELDS.flatMap(({ field, network, label }) => {
    const value = body[field];
    return typeof value === 'string' ? [<ExplorerChip key={field} href={txUrl(model.explorers, network, value)} label={label} value={value} tone="pista" />] : [];
  });
  const stillConfirming = body.status === 'pending';
  return (
    <p className="answer answer-ok" role="status">
      <span aria-hidden="true">✓ </span>
      {stillConfirming ? 'Sent, still confirming: check the explorer before trying again ' : 'Done '}
      {chips}
    </p>
  );
}
