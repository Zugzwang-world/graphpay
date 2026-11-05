'use client';

// An order's trail from Arkiv: the edges that carry its order id, read through
// Graph Arkiv's GraphQL `order(id)` (planning/SPEC/ARKIV_GRAPH.md §5), oldest first,
// each with its settlement transaction on the explorer. The answer's explain id links
// to the exact reads behind it.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { txUrl } from '@/lib/explorer';
import { formatMicro } from '@/lib/money';
import { localTime } from '@/lib/merchant-feed';
import { netMicro, orderRequestUrl, trailOf, type TrailEdge } from '@/lib/order-trail';
import { ExplorerChip } from './explorer-chip';
import { useSite } from './site-context';

type Loaded = { state: 'loading' } | { state: 'ok'; edges: TrailEdge[]; explainId: string | null } | { state: 'error'; status: number | null };

export function OrderTrail({ orderId }: { orderId: string }) {
  const { model } = useSite();
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });

  useEffect(() => {
    let stopped = false;
    void (async () => {
      const res = await fetch(orderRequestUrl(orderId), { cache: 'no-store' }).catch(() => null);
      if (stopped) return;
      if (!res) return setLoaded({ state: 'error', status: null });
      const body = (await res.json().catch(() => null)) as { data?: { order?: TrailEdge[] }; extensions?: { arkiv?: { explainId?: string } } } | null;
      if (stopped) return;
      if (!res.ok || !body?.data?.order) return setLoaded({ state: 'error', status: res.status });
      setLoaded({ state: 'ok', edges: body.data.order, explainId: body.extensions?.arkiv?.explainId ?? null });
    })();
    return () => {
      stopped = true;
    };
  }, [orderId]);

  if (loaded.state === 'loading') return <p className="muted">Reading the order from Arkiv…</p>;
  if (loaded.state === 'error') return <p className="answer answer-error">The order could not be read{loaded.status ? ` (HTTP ${loaded.status})` : ''}; try again in a moment.</p>;
  if (loaded.edges.length === 0) {
    return <p className="muted">Arkiv holds no record of this order yet. A payment shows here a few seconds after it settles; records are kept for 30 days.</p>;
  }

  const steps = trailOf(loaded.edges);
  const net = netMicro(loaded.edges);
  return (
    <div className="trail" data-order={orderId}>
      <ol className="trace-calls">
        {steps.map((step) => (
          <li key={`${step.kind}-${step.ts}-${step.settlementTx ?? step.from}`} className="card">
            <p>
              <strong>{step.word}</strong>
              {step.amountMicro ? <span className="num"> {formatMicro(step.amountMicro)} {model.token.symbol}</span> : null}
              {step.synthetic ? <span className="muted"> (synthetic)</span> : null}
            </p>
            <p className="small muted">
              {step.from} to {step.to}, {localTime(step.ts, model.city.timeZone)} ({model.city.timeZone})
            </p>
            {step.settlementTx ? (
              <div className="chips">
                <ExplorerChip href={txUrl(model.explorers, 'whitechain', step.settlementTx)} label="settlement" value={step.settlementTx} />
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="small">
        Kept by the shop after refunds: <span className="num">{formatMicro(net < 0n ? 0n : net)} {model.token.symbol}</span>
      </p>
      {loaded.explainId ? (
        <p className="small">
          <Link href={`/explain/${loaded.explainId}`}>See the exact reads behind this answer</Link>
        </p>
      ) : null}
      <p className="small muted">Each receipt cannot be edited; it is read from Arkiv, not from this site.</p>
    </div>
  );
}
