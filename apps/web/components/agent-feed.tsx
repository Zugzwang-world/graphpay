'use client';

// The live feed of the agents (WEBSITE_SPEC.md §3): run-log events as they stream.
// Messages are speech; tool calls show their cost; guards show ticks and red vetoes
// (a cross and text too, so colour is never the only signal).

import Link from 'next/link';
import type { TraceEvent } from '@/lib/contracts';
import { TiffinBot, isBotRole, type BotRole } from './tiffin-bot';

// The speaking agent's role is the first label of its ENS name.
function roleOf(ens: string): BotRole {
  const label = ens.split('.')[0] ?? '';
  return isBotRole(label) ? label : 'concierge';
}

function explainIdOf(output: unknown): string | null {
  const ext = (output as { extensions?: { arkiv?: { explainId?: unknown } } } | null)?.extensions?.arkiv;
  return typeof ext?.explainId === 'string' && /^[0-9a-f]{12}$/.test(ext.explainId) ? ext.explainId : null;
}

function callsOf(output: unknown): number | null {
  const calls = (output as { extensions?: { arkiv?: { calls?: unknown } } } | null)?.extensions?.arkiv?.calls;
  return typeof calls === 'number' ? calls : null;
}

function Row({ event }: { event: TraceEvent }) {
  switch (event.type) {
    case 'message':
      return (
        <li className="feed-row feed-message rise-in">
          <TiffinBot role={roleOf(event.from)} size={30} title={event.from} />
          <div>
            <p className="feed-who">
              {event.from} <span className="muted">to {event.to}</span>
            </p>
            <p className="feed-speech">{event.text}</p>
          </div>
        </li>
      );
    case 'agent.start':
      return (
        <li className="feed-row feed-meta rise-in">
          <TiffinBot role={roleOf(event.agent)} size={22} title={event.agent} idle />
          <p>
            <strong>{event.agent}</strong> <span className="muted">starts: {typeof event.task === 'string' ? event.task : 'its task'}</span>
          </p>
        </li>
      );
    case 'agent.end':
      return (
        <li className="feed-row feed-meta rise-in">
          <TiffinBot role={roleOf(event.agent)} size={22} title={event.agent} />
          <p>
            <strong>{event.agent}</strong> <span className="muted">{event.error ? `stopped: ${event.error}` : 'reported back'}</span>
          </p>
        </li>
      );
    case 'tool.call':
      return (
        <li className="feed-row feed-tool rise-in">
          <span className="tool-name mono">{event.tool}</span>
          <span className="muted">called by {event.agent}</span>
        </li>
      );
    case 'tool.result': {
      const explainId = explainIdOf(event.output);
      const calls = callsOf(event.output);
      return (
        <li className="feed-row feed-tool rise-in">
          <span className="tool-name mono">{event.tool}</span>
          {calls !== null ? <span className="chip">{calls} Arkiv calls</span> : null}
          {explainId ? (
            <Link className="chip" href={`/explain/${explainId}`}>
              explain <span className="mono">{explainId.slice(0, 6)}…</span>
            </Link>
          ) : null}
          {event.error ? <span className="chip" data-tone="chilli">✕ {event.error}</span> : null}
        </li>
      );
    }
    case 'guard':
      return (
        <li className={`feed-row feed-guard rise-in ${event.ok ? 'is-ok' : 'is-veto'}`}>
          <span className="guard-mark" aria-hidden="true">
            {event.ok ? '✓' : '✕'}
          </span>
          <p>
            <span className="visually-hidden">{event.ok ? 'Passed: ' : 'Vetoed: '}</span>
            {event.detail}
          </p>
        </li>
      );
  }
}

export function AgentFeed({ events }: { events: TraceEvent[] }) {
  return (
    <ol className="feed" aria-live="polite" aria-label="What the agents are doing">
      {events.map((event) => (
        <Row key={event.seq} event={event} />
      ))}
    </ol>
  );
}
