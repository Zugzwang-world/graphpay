'use client';

// The agent lanes under the explainer's title: Ask → Check → Check back → 402 quote → Pay.
// Each handoff the agents wrote to Arkiv for this run is a chip (who handed to whom) that
// opens its record on the explorer; the Pay lane also carries the settlement transaction and
// the order's trail from the run's result.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { entityUrl, txUrl } from '@/lib/explorer';
import { agentLabel, handoffsUrl, lanesOf, reached, type HandoffRow } from '@/lib/lanes';
import { usePoll } from '@/lib/use-poll';
import { ExplorerChip } from './explorer-chip';
import { useSite } from './site-context';

interface Answer {
  data?: { handoffs?: HandoffRow[] };
  errors?: { message: string }[];
}

export function AgentLanes() {
  const { run, model } = useSite();
  const root = useRef<HTMLDivElement>(null);
  // Poll while the run is going and for a few seconds after it ends (the rows land a moment late).
  const [grace, setGrace] = useState(true);
  const finished = run.result !== null;
  useEffect(() => {
    if (!finished) return setGrace(true);
    const timer = setTimeout(() => setGrace(false), 10_000);
    return () => clearTimeout(timer);
  }, [finished, run.runId]);
  const url = run.runId && (!finished || grace) ? handoffsUrl(run.runId) : null;
  const state = usePoll<Answer>(url, 3000, root);
  // The last answer is kept after polling stops: the rows live 30 minutes on Arkiv.
  const [rows, setRows] = useState<HandoffRow[]>([]);
  useEffect(() => {
    if (state.status === 'ok' && state.data.data?.handoffs) setRows(state.data.data.handoffs);
  }, [state]);
  useEffect(() => setRows([]), [run.runId]);

  if (!run.runId) return null;
  const { lanes, other } = lanesOf(rows);
  const at = reached(rows);
  const receipt = run.result?.receipt ?? null;

  return (
    <div ref={root} className="lanes" aria-label="Which agent handed what to whom">
      <h3 className="section-title">The agents hand off</h3>
      <ol className="lane-list">
        {lanes.map(({ def, rows: laneRows }, i) => (
          <li key={def.step} className="lane" data-on={laneRows.length > 0 ? 'true' : 'false'} data-now={i === at && !finished ? 'true' : 'false'}>
            <p className="lane-title">{def.title}</p>
            <p className="muted small">{def.shows}</p>
            <div className="chips">
              {laneRows.map((r) => (
                <ExplorerChip key={r.key} href={entityUrl(model.explorers, r.key)} label={`${agentLabel(r.from.ens)} to ${agentLabel(r.to.ens)}`} />
              ))}
              {def.step === 'pay' && receipt ? <ExplorerChip href={txUrl(model.explorers, 'whitechain', receipt.transaction)} label="settlement" value={receipt.transaction} tone="pista" /> : null}
            </div>
            {def.step === 'pay' && run.result?.orderId ? (
              <Link className="small" href={`/order/${run.result.orderId}`}>
                the order&rsquo;s trail on Arkiv
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
      {other.length > 0 ? (
        <div className="chips" aria-label="Other handoffs">
          {other.map((r) => (
            <ExplorerChip key={r.key} href={entityUrl(model.explorers, r.key)} label={`${agentLabel(r.from.ens)} to ${agentLabel(r.to.ens)}: ${r.step}`} />
          ))}
        </div>
      ) : null}
      {rows.length === 0 ? <p className="muted small">{finished ? 'No handoff records for this run (the live hooks may be off).' : 'Waiting for the first handoff to reach Arkiv…'}</p> : null}
    </div>
  );
}
