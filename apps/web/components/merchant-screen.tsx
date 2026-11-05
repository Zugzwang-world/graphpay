'use client';

// The merchant's phone (WEBSITE_SPEC.md §4). "Open shop" turns sound on (browsers
// need a tap for Web Audio) and starts listening for the shop's new edges; a pay
// edge pops an order with the buyer agent's ENS name. Buttons sign server-side.

import { useEffect, useState } from 'react';
import type { MerchantEdgeEvent } from '@/lib/contracts';
import { entityUrl, txUrl } from '@/lib/explorer';
import { formatMicro, parseUsdt } from '@/lib/money';
import { streamEvents, waitingForIn } from '@/lib/sse-client';
import { ActionAnswer } from './action-answer';
import { ExplorerChip } from './explorer-chip';
import { TiffinBot } from './tiffin-bot';
import { useSite, type ApiAnswer } from './site-context';

type Listening = { state: 'closed' } | { state: 'connecting' } | { state: 'open' } | { state: 'waiting'; waitingFor: string } | { state: 'error' };

export function MerchantScreen() {
  const { model, post, enableSound, sound } = useSite();
  const shop = model.merchant;
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState<Listening>({ state: 'closed' });
  const [edges, setEdges] = useState<MerchantEdgeEvent[]>([]);
  const [popup, setPopup] = useState<MerchantEdgeEvent | null>(null);
  const [refundText, setRefundText] = useState(formatMicro(model.order.refundMicro));
  const [answer, setAnswer] = useState<ApiAnswer | null>(null);
  const [pending, setPending] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);
  // In-page notifications: refused payments, refunds and deliveries, newest first.
  const [toasts, setToasts] = useState<{ id: string; tone: 'chilli' | 'pista'; text: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let retry: ReturnType<typeof setTimeout> | undefined;

    const onEdge = (event: string, data: string) => {
      if (event === 'ready') return setListening({ state: 'open' });
      if (event !== 'edge') return;
      const edge = JSON.parse(data) as MerchantEdgeEvent;
      setEdges((prev) => (prev.some((p) => p.ref === edge.ref && p.kind === edge.kind) ? prev : [edge, ...prev].slice(0, 50)));
      if (edge.kind === 'pay') {
        setPopup(edge);
        sound('settled');
      } else if (edge.kind === 'refund') sound('refund');
      else if (edge.kind === 'fail') sound('stopped');
      const note = edge.kind === 'fail' ? { tone: 'chilli' as const, text: `Refused: ${edge.from} was stopped before paying` } : edge.kind === 'deliver' ? { tone: 'pista' as const, text: 'Marked dispatched' } : null;
      if (note) setToasts((prev) => [{ id: `${edge.kind}-${edge.ref}`, ...note }, ...prev].slice(0, 3));
    };

    const connect = async () => {
      setListening({ state: 'connecting' });
      const outcome = await streamEvents('/api/merchant/events', onEdge, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const waiting = waitingForIn(outcome);
      setListening(waiting ? { state: 'waiting', waitingFor: waiting } : { state: 'error' });
      // The stream closes itself before the function time limit; reconnect at once.
      retry = setTimeout(connect, waiting ? 30_000 : outcome.kind === 'ended' ? 500 : 10_000);
    };

    void connect();
    return () => {
      controller.abort();
      if (retry) clearTimeout(retry);
    };
  }, [open, sound]);

  const openShop = async () => {
    await enableSound();
    setOpen(true);
  };

  const orderId = popup?.orderId ?? edges.find((e) => e.kind === 'pay')?.orderId ?? null;

  const act = async (path: string, body: unknown) => {
    setPending(true);
    setAnswer(await post(path, body));
    setPending(false);
  };

  const partialRefund = () => {
    let amountMicro: string;
    try {
      amountMicro = parseUsdt(refundText.trim()).toString();
    } catch {
      setAnswer({ ok: false, status: 0, body: null, waitingFor: null, error: 'Type an amount like 0.80' });
      return;
    }
    void act('/api/merchant/refund', { orderId, amountMicro });
  };

  const downloadExport = async () => {
    setExportNote(null);
    const res = await fetch('/api/merchant/export.csv', { cache: 'no-store' }).catch(() => null);
    if (!res) return setExportNote('The site did not answer; try again.');
    if (res.status === 503) {
      const body = (await res.json().catch(() => null)) as { waitingFor?: string } | null;
      return setExportNote(`Not live yet: waiting for ${body?.waitingFor ?? 'its source'}.`);
    }
    if (!res.ok) return setExportNote(`The export failed (HTTP ${res.status}).`);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = `${shop.key}-orders.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!open) {
    return (
      <div className="screen merchant">
        <button type="button" className="open-shop" onClick={() => void openShop()}>
          <TiffinBot role="storefront" size={72} title={shop.ens} idle />
          <span className="open-shop-title">Open shop</span>
          <span className="open-shop-sub">
            {shop.displayName} starts listening for orders. Sound turns on with this tap; captions show either way.
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="screen merchant">
      <header className="screen-head">
        <TiffinBot role="storefront" size={42} title={shop.ens} />
        <div className="who">
          <p className="who-name">{shop.displayName}</p>
          <p className="who-ens">{shop.ens}</p>
        </div>
        <span className="chip" data-tone={listening.state === 'open' ? 'pista' : undefined}>
          {listening.state === 'open' ? 'open, listening' : 'open'}
        </span>
      </header>

      {listening.state === 'waiting' ? (
        <div className="waiting">
          <span aria-hidden="true">◌</span>
          <p>
            Orders pop up here the moment the mirror writes them to Arkiv. Waiting for <strong>{listening.waitingFor}</strong>.
          </p>
        </div>
      ) : null}
      {listening.state === 'error' ? <p className="answer answer-error">Lost the order stream; reconnecting…</p> : null}

      {toasts.length > 0 ? (
        <ul className="toasts" aria-live="polite" aria-label="Notifications">
          {toasts.map((t) => (
            <li key={t.id} data-tone={t.tone}>
              <span aria-hidden="true">{t.tone === 'chilli' ? '✕' : '✓'}</span> {t.text}
              <button type="button" className="btn btn-quiet" onClick={() => setToasts((prev) => prev.filter((p) => p.id !== t.id))} aria-label="Dismiss">
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {popup ? (
        <section className="order-pop card rise-in" aria-live="assertive" aria-label="New order">
          <p className="order-pop-title">New order, paid</p>
          <p className="order-pop-buyer">
            <TiffinBot role="payer" size={28} title={popup.from} /> {popup.from}
          </p>
          <p className="order-pop-amount">
            <span className="num">{formatMicro(popup.amountMicro)}</span> {model.token.symbol}
          </p>
          <div className="chips">
            <ExplorerChip href={txUrl(model.explorers, 'whitechain', popup.settlementTx)} label="Settlement" value={popup.settlementTx} tone="pista" />
            <ExplorerChip href={txUrl(model.explorers, 'rabdi', popup.arkivTx)} label="Arkiv write" value={popup.arkivTx} />
            <ExplorerChip href={entityUrl(model.explorers, popup.entityKey)} label="Receipt" value={popup.entityKey} />
          </div>
          <button type="button" className="btn btn-quiet" onClick={() => setPopup(null)}>
            Close
          </button>
        </section>
      ) : null}

      <section className="actions" aria-label="Order actions">
        <div className="action">
          <button type="button" className="btn" onClick={() => void act('/api/merchant/dispatch', { orderId })}>
            Mark dispatched
          </button>
        </div>
        <div className="action refund-row">
          <label className="small" htmlFor="refund-amount">
            Partial refund
          </label>
          <input id="refund-amount" inputMode="decimal" value={refundText} onChange={(e) => setRefundText(e.target.value)} className="num" />
          <button type="button" className="btn" onClick={partialRefund}>
            Refund
          </button>
          <button type="button" className="btn btn-danger" onClick={() => void act('/api/merchant/refund', { orderId, full: true })}>
            Full refund
          </button>
        </div>
        <ActionAnswer answer={answer} pending={pending} />
        <div className="action">
          <button type="button" className="btn" onClick={() => void downloadExport()}>
            Download accountant export
          </button>
          {exportNote ? <p className="answer">{exportNote}</p> : null}
        </div>
      </section>

      <section aria-label="Recent edges">
        <h3 className="section-title">Recent activity</h3>
        {edges.length === 0 ? (
          <p className="muted small">No edges yet for {shop.ens}.</p>
        ) : (
          <ol className="edges">
            {edges.map((edge) => (
              <li key={`${edge.kind}-${edge.ref}`} data-kind={edge.kind}>
                <span className="edge-kind">{edge.kind}</span>
                <span className="edge-from">{edge.from}</span>
                <span className="num">{formatMicro(edge.amountMicro)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
