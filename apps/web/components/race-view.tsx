'use client';

// Race mode (WEBSITE_SPEC.md §6, ADR-0042): plain Arkiv against Graph Arkiv on the
// same question, live and uncached. The result is the number of Arkiv reads each
// side needs (plus bytes), ticking per call. No timer is the result.

import { useRef, useState } from 'react';
import { streamEvents, waitingForIn } from '@/lib/sse-client';
import type { RaceAnswer, RaceCall } from '@/lib/contracts';

export interface RaceQuestion {
  id: string;
  label: string;
}

type Mode = 'graph' | 'plain';
type InFlight = '1' | '8' | 'all';

interface Side {
  status: 'idle' | 'running' | 'done' | 'waiting' | 'error';
  reads: number;
  bytes: number;
  answer: RaceAnswer | null;
  note: string | null;
}

const IDLE: Side = { status: 'idle', reads: 0, bytes: 0, answer: null, note: null };
const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

function badge(answer: RaceAnswer | null): { text: string; tone: 'pista' | 'chilli' | 'kesar' } | null {
  if (!answer) return null;
  if (answer.truthBasis === 'identity') return answer.correct ? { text: 'correct', tone: 'pista' } : { text: 'wrong', tone: 'chilli' };
  return answer.correct ? { text: 'right by name, wrong by identity', tone: 'kesar' } : { text: 'wrong', tone: 'chilli' };
}

function SideCard({ title, side, subtitle }: { title: string; side: Side; subtitle: string }) {
  const b = badge(side.answer);
  return (
    <section className="race-side card" aria-label={title} data-status={side.status}>
      <header>
        <h2>{title}</h2>
        <p className="muted small">{subtitle}</p>
      </header>
      <p className="race-reads" aria-live="polite">
        <span className="num">{side.reads}</span>
        <span className="race-reads-label">Arkiv reads</span>
      </p>
      <p className="muted num">{kb(side.bytes)} moved</p>
      {b ? (
        <span className="chip" data-tone={b.tone}>
          {b.text}
        </span>
      ) : null}
      {side.note ? <p className="answer">{side.note}</p> : null}
    </section>
  );
}

export function RaceView({ questions, size, cityNote }: { questions: RaceQuestion[]; size: string; cityNote: string }) {
  const [question, setQuestion] = useState(questions[0]?.id ?? 'Q2');
  const [inFlight, setInFlight] = useState<InFlight>('8');
  const [graph, setGraph] = useState<Side>(IDLE);
  const [plain, setPlain] = useState<Side>(IDLE);
  const controller = useRef<AbortController | null>(null);
  const running = graph.status === 'running' || plain.status === 'running';

  const runSide = async (mode: Mode, set: (update: (prev: Side) => Side) => void, signal: AbortSignal) => {
    set(() => ({ ...IDLE, status: 'running' }));
    const params = new URLSearchParams({ question, size, mode });
    if (mode === 'plain') params.set('inFlight', inFlight);
    const outcome = await streamEvents(
      `/api/race?${params}`,
      (event, data) => {
        if (event === 'call') {
          const call = JSON.parse(data) as RaceCall;
          set((prev) => ({ ...prev, reads: Math.max(prev.reads, call.call), bytes: prev.bytes + call.bytes }));
        } else if (event === 'error') {
          set((prev) => ({ ...prev, status: 'error', note: 'Arkiv could not be read just now. Try again.' }));
        } else if (event === 'answer') {
          const answer = JSON.parse(data) as RaceAnswer;
          set((prev) => ({ ...prev, status: 'done', answer, reads: answer.calls, bytes: answer.bytes }));
        }
      },
      { signal },
    );
    const waiting = waitingForIn(outcome);
    if (waiting) return set(() => ({ ...IDLE, status: 'waiting', note: `Not live yet: waiting for ${waiting}.` }));
    if (outcome.kind === 'refused' && outcome.status === 429) return set(() => ({ ...IDLE, status: 'error', note: 'Another race is running. Try again in a few seconds.' }));
    if (outcome.kind !== 'ended') set((prev) => ({ ...prev, status: 'error', note: 'The race stream stopped early.' }));
    else set((prev) => (prev.status === 'running' ? { ...prev, status: 'error', note: 'The race stream stopped early.' } : prev));
  };

  const start = () => {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    void Promise.all([runSide('graph', setGraph, c.signal), runSide('plain', setPlain, c.signal)]);
  };

  return (
    <div className="race">
      <form
        className="race-controls card"
        onSubmit={(e) => {
          e.preventDefault();
          start();
        }}
      >
        <label>
          <span className="small muted">Question</span>
          <select value={question} onChange={(e) => setQuestion(e.target.value)}>
            {questions.map((q) => (
              <option key={q.id} value={q.id}>
                {q.id}: {q.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="small muted">City size</span>
          <select value={size} disabled aria-describedby="size-note">
            <option value={size}>{size}</option>
          </select>
        </label>
        <label>
          <span className="small muted">Plain side: pages in flight</span>
          <select value={inFlight} onChange={(e) => setInFlight(e.target.value as InFlight)}>
            <option value="1">one page at a time</option>
            <option value="8">8 in flight</option>
            <option value="all">every page at once</option>
          </select>
        </label>
        <button type="submit" className="btn btn-primary" disabled={running}>
          {running ? 'Racing…' : 'Start the race'}
        </button>
        <p id="size-note" className="small muted">
          {cityNote}
        </p>
      </form>
      <div className="race-sides">
        <SideCard title="Graph Arkiv" subtitle="One GraphQL query over tallies kept as events land" side={graph} />
        <SideCard title="Plain Arkiv" subtitle="Careful plain code: it must read every payment, since Arkiv has no SUM" side={plain} />
      </div>
    </div>
  );
}
