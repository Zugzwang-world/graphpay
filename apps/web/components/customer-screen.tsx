'use client';

// The customer's phone (WEBSITE_SPEC.md §3): who is paying and how much is left
// today, the request, the agents' live feed, the result, and the actions. Every
// figure comes from a route; until a route is live the screen says what it waits for.

import { useRef, useState } from 'react';
import type { AgentStatus, CustomerState, RunResult, RunStarted, TraceEvent } from '@/lib/contracts';
import { txUrl } from '@/lib/explorer';
import { formatMicro } from '@/lib/money';
import { streamEvents, waitingForIn } from '@/lib/sse-client';
import { usePoll, waitingForOf } from '@/lib/use-poll';
import { ActionAnswer } from './action-answer';
import { AgentFeed } from './agent-feed';
import { ExplorerChip } from './explorer-chip';
import { Person, TiffinBot } from './tiffin-bot';
import { useSite, type ApiAnswer } from './site-context';

const STATUS_TONE: Record<AgentStatus, 'pista' | 'chilli' | undefined> = {
  ACTIVE: 'pista',
  PAUSED: 'chilli',
  REVOKED: 'chilli',
  EXPIRED: 'chilli',
  UNKNOWN: undefined,
};

type ActionKey = 'refund' | 'reorder' | 'subscribe' | 'unsubscribe' | 'pause' | 'resume' | 'kill';

export function CustomerScreen() {
  const { model, post, run, setRun, sound } = useSite();
  const root = useRef<HTMLDivElement>(null);
  const state = usePoll<CustomerState>('/api/state/customer', 5000, root);
  const live = state.status === 'ok' ? state.data : null;
  const stateWaiting = waitingForOf(state);

  const [request, setRequest] = useState(model.order.request);
  const [sending, setSending] = useState(false);
  const [runAnswer, setRunAnswer] = useState<ApiAnswer | null>(null);
  const [answers, setAnswers] = useState<Partial<Record<ActionKey, ApiAnswer>>>({});
  const [pending, setPending] = useState<ActionKey | null>(null);
  const [period, setPeriod] = useState<string>(model.renewal.demoPeriod.id);

  const act = async (key: ActionKey, path: string, body: unknown) => {
    setPending(key);
    const answer = await post(path, body);
    setPending(null);
    setAnswers((prev) => ({ ...prev, [key]: answer }));
    if (answer.ok && (key === 'pause' || key === 'kill')) sound('stopped');
  };

  const send = async () => {
    setSending(true);
    setRunAnswer(null);
    const answer = await post<RunStarted>('/api/agents/run', { request });
    setRunAnswer(answer);
    setSending(false);
    if (!answer.ok || !answer.body?.runId) return;
    const runId = answer.body.runId;
    setRun(() => ({ runId, events: [], result: null, startedAt: Date.now() }));
    const outcome = await streamEvents(`/api/agents/run/${encodeURIComponent(runId)}/events`, (event, data) => {
      if (event === 'trace') {
        const trace = JSON.parse(data) as TraceEvent;
        setRun((prev) => (prev.runId === runId ? { ...prev, events: [...prev.events, trace] } : prev));
      } else if (event === 'result') {
        const result = JSON.parse(data) as RunResult;
        setRun((prev) => (prev.runId === runId ? { ...prev, result } : prev));
        if (result.status === 'paid') sound('settled');
      }
    });
    if (outcome.kind !== 'ended') {
      const waiting = waitingForIn(outcome);
      setRunAnswer({ ok: false, status: outcome.kind === 'refused' ? outcome.status : 0, body: null, waitingFor: waiting, error: waiting ? null : 'Lost the run’s live feed.' });
    }
  };

  const status = live?.agent.status ?? 'UNKNOWN';
  const paused = status === 'PAUSED';
  const result = run.result;

  return (
    <div className="screen customer" ref={root}>
      <header className="screen-head">
        <Person size={42} title={model.persona.displayName} />
        <div className="who">
          <p className="who-name">{model.persona.displayName}</p>
          <p className="who-ens">{model.persona.ens}</p>
        </div>
      </header>

      <div className="pass" aria-label="Spending pass">
        <div className="pass-row">
          <TiffinBot role="payer" size={30} title={model.payer.ens} />
          <div className="pass-who">
            <p className="pass-name">{model.payer.ens}</p>
            <p className="muted small">pays for the team, within its cap</p>
          </div>
          <span className="chip" data-tone={STATUS_TONE[status]}>
            {live ? status.toLowerCase() : 'status —'}
          </span>
        </div>
        {live ? (
          <div className="pass-meter">
            <p>
              <span className="num">{formatMicro(live.spentTodayMicro)}</span> <span className="muted">of</span>{' '}
              <span className="num">{formatMicro(live.capMicro)}</span> {model.token.symbol} <span className="muted">today</span>
            </p>
            <meter min={0} max={Number(live.capMicro)} value={Number(live.spentTodayMicro)} aria-label="Spent today against the daily cap" />
          </div>
        ) : (
          <p className="muted small">
            {stateWaiting ? (
              <>
                Cap and today’s spend appear here from the on-chain policy (waiting for <strong>{stateWaiting}</strong>).
              </>
            ) : (
              'Reading the spending pass…'
            )}
          </p>
        )}
      </div>

      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label htmlFor="ask-text" className="small muted">
          Ask your agents
        </label>
        <textarea id="ask-text" rows={3} value={request} onChange={(e) => setRequest(e.target.value)} maxLength={400} />
        <div className="ask-row">
          <p className="muted small">Budget and deadline are read by code from your words, never by the model.</p>
          <button type="submit" className="btn btn-primary" disabled={sending || request.trim() === '' || paused}>
            {sending ? 'Starting…' : 'Send'}
          </button>
        </div>
        <ActionAnswer answer={runAnswer?.ok ? null : runAnswer} pending={false} />
      </form>

      {run.events.length > 0 ? <AgentFeed events={run.events} /> : null}

      {result ? (
        <section className="result card rise-in" aria-label="Result">
          <p className="result-status">{result.status === 'paid' ? 'Paid' : result.status}</p>
          {result.chosenShop ? <p className="result-shop">{result.chosenShop}</p> : null}
          {result.priceUsdt ? (
            <p className="result-price">
              <span className="num">{result.priceUsdt}</span> {model.token.symbol}
            </p>
          ) : null}
          <ol className="ranking">
            {result.ranking.map((shop) => (
              <li key={shop.ens} className={shop.eligible ? '' : 'is-out'}>
                <span className="rank-name">{shop.eligible ? shop.ens : <s>{shop.ens}</s>}</span>
                <span className="num">{shop.score.toFixed(3)}</span>
                {shop.eligible ? null : <span className="rank-why">✕ {shop.reasons.join('; ')}</span>}
              </li>
            ))}
          </ol>
          {result.receipt ? <ExplorerChip href={txUrl(model.explorers, 'whitechain', result.receipt.transaction)} label="Receipt" value={result.receipt.transaction} tone="pista" /> : null}
        </section>
      ) : null}

      <section className="actions" aria-label="Actions">
        <div className="action">
          <button
            type="button"
            className="btn"
            onClick={() => void act('refund', '/api/customer/refund-request', { orderId: live?.lastOrder?.orderId ?? null, amountMicro: model.order.refundMicro, reason: model.order.refundReason })}
          >
            Request refund <span className="muted num">{formatMicro(model.order.refundMicro)}</span>
          </button>
          <ActionAnswer answer={answers.refund ?? null} pending={pending === 'refund'} />
        </div>
        <div className="action">
          <button
            type="button"
            className="btn"
            onClick={() => void act('reorder', '/api/customer/reorder', { parentOrderId: live?.lastOrder?.orderId ?? null, qty: model.order.reorder.quantity })}
          >
            Re-order {model.order.reorder.quantity} <span className="muted num">{formatMicro(model.order.reorder.priceMicro)}</span>
          </button>
          <ActionAnswer answer={answers.reorder ?? null} pending={pending === 'reorder'} />
        </div>
        <div className="action">
          {live?.subscription?.active ? (
            <button type="button" className="btn" onClick={() => void act('unsubscribe', '/api/customer/unsubscribe', { subId: live.subscription?.subId })}>
              Cancel {model.renewal.item}
            </button>
          ) : (
            <div className="subscribe">
              <button type="button" className="btn" onClick={() => void act('subscribe', '/api/customer/subscribe', { plan: model.renewal.plan, period })}>
                {model.renewal.item} <span className="muted num">{formatMicro(model.renewal.priceMicro)}</span>
              </button>
              <label className="small">
                <span className="visually-hidden">Renewal period</span>
                <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                  <option value={model.renewal.demoPeriod.id}>{model.renewal.demoPeriod.label}</option>
                  <option value={model.renewal.period}>{model.renewal.period}</option>
                </select>
              </label>
            </div>
          )}
          <ActionAnswer answer={answers.subscribe ?? answers.unsubscribe ?? null} pending={pending === 'subscribe' || pending === 'unsubscribe'} />
        </div>
        <div className="action">
          {paused ? (
            <button type="button" className="btn" onClick={() => void act('resume', '/api/customer/resume', {})}>
              Resume my agent
            </button>
          ) : (
            <button type="button" className="btn btn-danger" onClick={() => void act('pause', '/api/customer/pause', {})}>
              Pause my agent
            </button>
          )}
          <ActionAnswer answer={answers.pause ?? answers.resume ?? null} pending={pending === 'pause' || pending === 'resume'} />
        </div>
        <details className="advanced">
          <summary>Advanced</summary>
          <p className="muted small">Gives a fresh agent its own name and wallet, pays once with it, then unregisters it: the next payment is refused.</p>
          <button type="button" className="btn btn-danger" onClick={() => void act('kill', '/api/customer/kill-disposable', {})}>
            Kill a disposable agent
          </button>
          <ActionAnswer answer={answers.kill ?? null} pending={pending === 'kill'} />
        </details>
      </section>
    </div>
  );
}
