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
        {answer.error}
      </p>
    );
  }
  const body = (answer.body ?? {}) as Record<string, unknown>;
  const chips = TX_FIELDS.flatMap(({ field, network, label }) => {
    const value = body[field];
    return typeof value === 'string' ? [<ExplorerChip key={field} href={txUrl(model.explorers, network, value)} label={label} value={value} tone="pista" />] : [];
  });
  return (
    <p className="answer answer-ok" role="status">
      <span aria-hidden="true">✓ </span>Done {chips}
    </p>
  );
}
