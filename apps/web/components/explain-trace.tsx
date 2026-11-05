'use client';

// One answer's exact reads (WEBSITE_SPEC.md §5 step 5; planning/SPEC/ARKIV_GRAPH.md
// §4, §6): every Arkiv call behind it with its query text, rows and bytes, and the
// entity keys as explorer links. Read from GET /api/explain/:id (Graph Arkiv).

import { useEffect, useState } from 'react';
import { entityUrl } from '@/lib/explorer';
import { ExplorerChip } from './explorer-chip';
import { useSite } from './site-context';

type Loaded =
  | { state: 'loading' }
  | { state: 'ok'; trace: Record<string, unknown> }
  | { state: 'missing' }
  | { state: 'not-deployed' }
  | { state: 'error'; status: number | null };

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const text = (v: unknown): string | null => (typeof v === 'string' || typeof v === 'number' ? String(v) : null);

export function ExplainTrace({ explainId }: { explainId: string }) {
  const { model } = useSite();
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });

  useEffect(() => {
    let stopped = false;
    void (async () => {
      const res = await fetch(`/api/explain/${explainId}`, { cache: 'no-store' }).catch(() => null);
      if (stopped) return;
      if (!res) return setLoaded({ state: 'error', status: null });
      const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
      if (res.status === 404 && !isJson) return setLoaded({ state: 'not-deployed' });
      if (res.status === 404) return setLoaded({ state: 'missing' });
      if (!res.ok || !isJson) return setLoaded({ state: 'error', status: res.status });
      setLoaded({ state: 'ok', trace: (await res.json()) as Record<string, unknown> });
    })();
    return () => {
      stopped = true;
    };
  }, [explainId]);

  if (loaded.state === 'loading') return <p className="muted">Reading the trace…</p>;
  if (loaded.state === 'not-deployed') {
    return (
      <div className="waiting">
        <span aria-hidden="true">◌</span>
        <p>
          The explain route is not deployed yet: it comes with <strong>M7b GraphQL and explain</strong>.
        </p>
      </div>
    );
  }
  if (loaded.state === 'missing') return <p className="muted">No trace with this id. Traces are kept for the latest 200 answers.</p>;
  if (loaded.state === 'error') return <p className="answer answer-error">The trace could not be read{loaded.status ? ` (HTTP ${loaded.status})` : ''}.</p>;

  const trace = loaded.trace;
  const queries = asArray(trace.queries);
  const keys = asArray(trace.entityKeys).filter((k): k is string => typeof k === 'string');
  return (
    <div className="trace">
      <p className="trace-summary">
        <span className="num big">{text(trace.calls) ?? queries.length}</span> Arkiv calls
        {text(trace.blockNumber) ? <span className="muted"> at Rabdi block {text(trace.blockNumber)}</span> : null}
      </p>
      {text(trace.note) ? <p className="muted">{text(trace.note)}</p> : null}
      <ol className="trace-calls">
        {queries.map((raw, i) => {
          const q = (raw ?? {}) as Record<string, unknown>;
          const query = text(q.query) ?? text(q.readable) ?? text(q.readableQuery) ?? JSON.stringify(q);
          return (
            <li key={i} className="card">
              <p className="small muted">
                Call {i + 1}
                {text(q.entity) ? ` on ${text(q.entity)}` : ''}
                {text(q.rows) ? `, ${text(q.rows)} rows` : ''}
                {text(q.bytes) ? `, ${text(q.bytes)} bytes` : ''}
              </p>
              <pre className="mono query">{query}</pre>
            </li>
          );
        })}
      </ol>
      {keys.length > 0 ? (
        <>
          <h3 className="section-title">Entities behind the answer</h3>
          <div className="chips">
            {keys.slice(0, 60).map((key) => (
              <ExplorerChip key={key} href={entityUrl(model.explorers, key)} label="entity" value={key} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
