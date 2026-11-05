'use client';

// The middle explainer (WEBSITE_SPEC.md §5): a stepper driven by the current run's
// real events. A step lights up only when an event for it has arrived; nothing
// here is scripted. The run can be replayed from memory.

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { TraceEvent } from '@/lib/contracts';
import { AgentLanes } from './agent-lanes';
import { useSite } from './site-context';

interface StepDef {
  id: string;
  number: string;
  title: string;
  shows: string;
  // The tools whose events belong to this step (planning/SPEC/AGENTS.md §2, §5).
  tools: string[];
}

const STEPS: StepDef[] = [
  { id: 'think', number: '1', title: 'The agents think', shows: 'The buyer team splits the job: scout and analyst work in parallel; code vetoes risky shops.', tools: ['scout', 'analyst', 'directory_list', 'catalog_read', 'ask', 'schema'] },
  { id: 'quote', number: '2', title: 'x402: the 402', shows: 'The shop answers 402 with its terms: scheme, network, asset, amount and who gets paid.', tools: ['get_quote', 'catalog_quote'] },
  { id: 'sign', number: '2b', title: 'The signature', shows: 'The payer agent signs the order terms and a gasless approval. Signed, no gas.', tools: ['pay_shop'] },
  { id: 'settle', number: '2c', title: 'The settlement', shows: 'Our facilitator checks the signature and the ENS gate, then the relayer settles and pays the gas.', tools: ['pay_order'] },
  { id: 'event', number: '3', title: 'The contract event', shows: 'PaymentSettled, with its arguments, block and explorer link.', tools: [] },
  { id: 'write', number: '4', title: 'The Arkiv write', shows: 'The payment becomes a line between two ENS names; the tallies tick; the receipt cannot be edited.', tools: [] },
  { id: 'answer', number: '5', title: 'The GraphQL answer', shows: 'The question, the answer, and the exact Arkiv reads behind it.', tools: ['graphql', 'explain'] },
];

const toolOf = (e: TraceEvent) => (e.type === 'tool.call' || e.type === 'tool.result' ? e.tool : null);

function explainIdIn(events: TraceEvent[]): string | null {
  for (const e of [...events].reverse()) {
    if (e.type !== 'tool.result') continue;
    const id = (e.output as { extensions?: { arkiv?: { explainId?: unknown } } } | null)?.extensions?.arkiv?.explainId;
    if (typeof id === 'string' && /^[0-9a-f]{12}$/.test(id)) return id;
  }
  return null;
}

export function Explainer() {
  const { run, model } = useSite();
  const [replayAt, setReplayAt] = useState<number | null>(null);
  const [shown, setShown] = useState<number>(Number.POSITIVE_INFINITY);

  // Replay: re-reveal the run's events one by one at the motion grammar's pace.
  useEffect(() => {
    if (replayAt === null) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setShown(Number.POSITIVE_INFINITY);
      setReplayAt(null);
      return;
    }
    setShown(0);
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= run.events.length) {
        clearInterval(timer);
        setReplayAt(null);
      }
    }, 450);
    return () => clearInterval(timer);
  }, [replayAt, run.events.length]);

  const events = useMemo(() => run.events.slice(0, shown), [run.events, shown]);
  const lit = useMemo(() => {
    const out = new Set<string>();
    if (events.length > 0) out.add('think');
    for (const e of events) {
      const tool = toolOf(e);
      if (!tool) continue;
      for (const step of STEPS) if (step.tools.includes(tool)) out.add(step.id);
    }
    if (run.result?.receipt && shown === Number.POSITIVE_INFINITY) out.add('event');
    return out;
  }, [events, run.result, shown]);
  const explainId = explainIdIn(events);

  return (
    <section className="explainer" aria-label="How this payment works, step by step">
      <header className="explainer-head">
        <div>
          <h2>What just happened</h2>
          <p className="muted small">
            Identify with ENS, remember with Arkiv, pay on Whitechain. Each step lights up from the live run; every chip opens its explorer page.
          </p>
        </div>
        <button type="button" className="btn btn-quiet" disabled={run.events.length === 0 || replayAt !== null} onClick={() => setReplayAt(Date.now())}>
          Replay the last run
        </button>
      </header>
      <AgentLanes />
      <ol className="steps">
        {STEPS.map((step) => {
          const on = lit.has(step.id);
          return (
            <li key={step.id} className="step" data-on={on ? 'true' : 'false'}>
              <span className="step-no" aria-hidden="true">
                {step.number}
              </span>
              <div className="step-body">
                <h3>{step.title}</h3>
                <p className="muted small">{step.shows}</p>
                {step.id === 'answer' && explainId ? (
                  <Link className="chip" href={`/explain/${explainId}`}>
                    exact reads <span className="mono">{explainId}</span>
                  </Link>
                ) : null}
              </div>
              <span className="step-state small">{on ? 'live' : 'waiting'}</span>
            </li>
          );
        })}
      </ol>
      {run.events.length === 0 ? (
        <div className="waiting">
          <span aria-hidden="true">◌</span>
          <p>
            Send the request on {model.persona.displayName}’s phone and each step fills in with the real messages, signatures, transactions and Arkiv reads as
            they happen.
          </p>
        </div>
      ) : null}
    </section>
  );
}
