// The shop’s phone on the stage (final website brief §4 and §5): one screen, no order log. The
// header with the Open switch, the shop's three agents as a team, their own conversation and cards
// (the bill, the refund request, the refused payment), today's earnings. The errand reaches this
// phone through the stage (`graphpay.relay`), so the bill shows the moment the payer's answer comes;
// the merchant stream's edges confirm it on Arkiv later and are forwarded to the stage.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { story } from '@/data/story';
import { foldAll } from '../../web/lib/stage/errand.ts';
import { dispatchLines, merchantErrandLines, pauseLines, refundLines, type Line as LineData } from '../../web/lib/stage/lines.ts';
import { stepIndex, type BeatKey } from '../../web/lib/stage/scenes.ts';
import { microUsdt, orderNumber, usdt } from '../../web/lib/stage/format.ts';
import { getJson, getTextRetry, postJson, Refusal, type HealState } from './api';
import { cast, links, networks, order, productOf, timeZone } from './cast';
import { foldOrders, rowFromEdge, rowKey, rowsFromCsv, type LedgerRow } from './orders';
import { embedded, postEvent, useNow, useStage } from './stage-link';
import { ArkivPending, Card, Line, Pending, ProofLink, SwarmPhoto, TeamStrip, useAutoScroll, type TeamMember } from './ui';
import { AgentsView, ProofList, ScoreboardView, type ProofItem } from './views';

const RECONNECT_MS = 1_500;
const RECONNECT_MAX_MS = 30_000;
const RENEW_OPEN_MS = 300_000;
// The routes allow one shop action per order every 30 s (ORDER_COOLDOWN_MS on the server): the refund
// waits that out after the dispatch, with a little margin, and a TOO_SOON answer is waited out again.
const ORDER_GUARD_MS = 32_000;
const RETRY_MS = 4_000;
const RETRIES = 10;
// Answers that only mean "not yet" (the order not readable as paid yet, a send still running, the guard).
const NOT_YET = new Set(['NOT_DELIVERABLE', 'NO_SUCH_ORDER', 'STILL_PENDING', 'TOO_SOON']);
const notYet = (error: unknown) => error instanceof Refusal && (NOT_YET.has(error.code) || error.status === 429);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Dispatch {
  orderId: string;
  phase: 'sending' | 'dispatched' | 'error';
  tx: string | null;
  // When the dispatch that went through was asked for: the per-order guard counts from about then.
  sentAt: number;
  at: number | null;
  error: string | null;
}

interface RefundAsk {
  orderId: string;
  amountMicro: string;
  swarmRef: string | null;
  file: string | null;
  arkivTx: string | null;
  entityKey: string | null;
  at: number;
  phase: 'asked' | 'accepting' | 'refunded' | 'error';
  tx: string | null;
  decisionAt: number | null;
  error: string | null;
}

// Today in the city's zone, as a date string, for the earnings.
const dayOf = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);

function useLedger() {
  const [rows, setRows] = useState<Map<string, LedgerRow>>(new Map());
  const [exportOk, setExportOk] = useState<boolean | null>(null);
  const add = useCallback((list: LedgerRow[]) => {
    setRows((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const r of list) {
        const k = rowKey(r);
        if (!next.has(k)) {
          next.set(k, r);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);
  // The day so far from the accountant's export (it reads Arkiv live, so it is tried twice).
  useEffect(() => {
    void getTextRetry('/api/merchant/export.csv').then((csv) => {
      if (!csv) return setExportOk(false);
      try {
        add(rowsFromCsv(csv));
        setExportOk(true);
      } catch {
        setExportOk(false);
      }
    });
  }, [add]);
  // New edges from the merchant stream; each is forwarded to the stage, which opens no stream itself.
  const [lastEdge, setLastEdge] = useState<{ row: LedgerRow; entityKey: string | null; arkivTx: string | null; at: number } | null>(null);
  useEffect(() => {
    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;
    let cursor = Math.floor(Date.now() / 1000) - 15 * 60;
    let stopped = false;
    const connect = () => {
      if (stopped) return;
      source = new EventSource(`/api/merchant/events?since=${cursor}`);
      source.addEventListener('ready', () => {
        failures = 0;
      });
      source.addEventListener('edge', (msg) => {
        try {
          const e = JSON.parse((msg as MessageEvent<string>).data) as { kind: string; from: string; to: string; amountMicro: string; orderId: string | null; ref: string; ts: string; settlementTx: string | null; entityKey?: string | null; arkivTx?: string | null };
          const row = rowFromEdge(e, story.shop.ens);
          cursor = Math.max(cursor, row.ts);
          add([row]);
          const entityKey = typeof e.entityKey === 'string' ? e.entityKey : null;
          const arkivTx = typeof e.arkivTx === 'string' ? e.arkivTx : null;
          setLastEdge({ row, entityKey, arkivTx, at: Date.now() });
          postEvent('edge', [], { kind: e.kind, from: e.from, to: e.to, amountMicro: e.amountMicro, orderId: e.orderId, ref: e.ref, ts: e.ts, settlementTx: e.settlementTx, entityKey, arkivTx });
        } catch {
          // an edge that is not JSON is skipped
        }
      });
      source.addEventListener('error', () => {
        source?.close();
        source = null;
        const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_MS * 2 ** failures) * (0.75 + Math.random() / 2);
        failures += 1;
        timer = setTimeout(connect, delay);
      });
    };
    connect();
    return () => {
      stopped = true;
      source?.close();
      if (timer) clearTimeout(timer);
    };
  }, [add]);
  return { rows: [...rows.values()], lastEdge, exportOk };
}

export function MerchantPhone() {
  const stage = useStage('merchant');
  const now = useNow(1000);
  const { rows, lastEdge, exportOk } = useLedger();
  const model = useMemo(() => foldAll(stage.frames), [stage.frames]);
  const shownIndex = embedded && stage.scene && stage.scene.runId === model.runId ? stage.scene.step : -1;
  const beat: BeatKey = stage.scene?.beat ?? 'film';
  const [heal, setHeal] = useState<HealState | null>(null);
  const [open, setOpen] = useState<boolean | null>(null);
  const [openBusy, setOpenBusy] = useState(false);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const renewing = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const read = async () => {
      const h = await getJson<HealState>('/api/state/heal');
      if (h) {
        setHeal(h);
        if (!openBusy && h.shop) setOpen(h.shop.open);
      }
    };
    void read();
    const t = setInterval(() => void read(), 30_000);
    return () => clearInterval(t);
  }, [openBusy]);
  useEffect(() => () => {
    if (renewing.current) clearInterval(renewing.current);
  }, []);

  const toggleOpen = async () => {
    const on = !(open ?? false);
    setOpenBusy(true);
    setOpenNote(null);
    try {
      await postJson('/api/merchant/open', { on });
      setOpen(on);
      if (renewing.current) clearInterval(renewing.current);
      // The listing lasts 15 minutes on Arkiv; it is renewed while this page keeps it open.
      renewing.current = on ? setInterval(() => void postJson('/api/merchant/open', { on: true }).catch(() => undefined), RENEW_OPEN_MS) : null;
      postEvent('shop-open', [], { open: on });
    } catch (error) {
      setOpenNote(error instanceof Refusal ? error.message : 'The switch did not go through. Try again in a minute.');
    } finally {
      setOpenBusy(false);
    }
  };

  // Scene 5: the request arrives through the stage the moment the payer's answer comes back.
  const [ask, setAsk] = useState<RefundAsk | null>(null);
  const [refused, setRefused] = useState<{ at: number; code: string } | null>(null);
  const seen = useRef(0);
  useEffect(() => {
    // A new errand: the stage replaced the relayed list, so this phone starts over too.
    if (stage.events.length < seen.current) {
      seen.current = 0;
      setAsk(null);
      setRefused(null);
    }
    const same = (a: { orderId: string } | null, id: unknown) => a !== null && typeof id === 'string' && a.orderId.toLowerCase() === id.toLowerCase();
    for (const e of stage.events.slice(seen.current)) {
      if (e.key === 'refund-request' && typeof e.data?.orderId === 'string') {
        const d = e.data;
        // One refund per order: a second request for an order already being refunded changes nothing.
        setAsk((a) =>
          same(a, d.orderId) && a!.phase !== 'asked' && a!.phase !== 'error'
            ? a
            : {
                orderId: d.orderId as string,
                amountMicro: typeof d.amountMicro === 'string' ? d.amountMicro : order.refundMicro,
                swarmRef: typeof d.swarmRef === 'string' ? d.swarmRef : null,
                file: typeof d.file === 'string' ? d.file : null,
                arkivTx: typeof d.arkivTx === 'string' ? d.arkivTx : null,
                entityKey: typeof d.entityKey === 'string' ? d.entityKey : null,
                at: e.at,
                phase: 'asked',
                tx: null,
                decisionAt: null,
                error: null,
              },
        );
      } else if ((e.key === 'refund-accepted' || e.key === 'refund') && typeof e.data?.orderId === 'string') {
        // This phone's own answers, sent back by the stage after a reload: never accepted twice.
        const d = e.data;
        accepting.current = (d.orderId as string).toLowerCase();
        setAsk((a) => (same(a, d.orderId) ? (e.key === 'refund' ? { ...a!, phase: 'refunded', tx: typeof d.transaction === 'string' ? d.transaction : a!.tx, decisionAt: e.at } : a!.phase === 'refunded' ? a : { ...a!, phase: 'accepting' }) : a));
      } else if (e.key === 'dispatched' && typeof e.data?.orderId === 'string') {
        // Likewise for the dispatch: shown as it was, never sent twice.
        const id = e.data.orderId;
        dispatching.current = id;
        setDispatch({ orderId: id, phase: 'dispatched', tx: typeof e.data.transaction === 'string' ? e.data.transaction : null, sentAt: e.at, at: e.at, error: null });
      } else if (e.key === 'reorder-refused') {
        setRefused({ at: e.at, code: typeof e.data?.code === 'string' ? e.data.code : '' });
      } else if (e.key === 'refund-start' || e.key === 'pause-start') {
        if (e.key === 'pause-start') setRefused(null);
      }
    }
    seen.current = stage.events.length;
  }, [stage.events]);

  // Right after the payment settles, the shop marks the order dispatched on chain (POST
  // /api/merchant/dispatch), once per order, with no wait for a delivery time. Only the errand that
  // reached this shop, on the stage, dispatches.
  const [dispatch, setDispatch] = useState<Dispatch | null>(null);
  const dispatchRef = useRef<Dispatch | null>(null);
  dispatchRef.current = dispatch;
  const ours = (model.order?.shop ?? model.best) === cast.merchant.ens;
  const paidOrderId = embedded && ours && model.paid ? model.paid.orderId : null;
  const dispatching = useRef<string | null>(null);
  useEffect(() => {
    if (!paidOrderId || dispatching.current === paidOrderId) return;
    dispatching.current = paidOrderId;
    const orderId = paidOrderId;
    void (async () => {
      setDispatch({ orderId, phase: 'sending', tx: null, sentAt: Date.now(), at: null, error: null });
      for (let attempt = 0; attempt < RETRIES; attempt++) {
        const sentAt = Date.now();
        try {
          const answer = await postJson<{ transaction?: string | null; status?: string }>('/api/merchant/dispatch', { orderId });
          const tx = answer.transaction ?? null;
          if (dispatching.current !== orderId) return;
          setDispatch({ orderId, phase: 'dispatched', tx, sentAt, at: Date.now(), error: null });
          postEvent('dispatched', tx ? [{ label: 'Dispatched on Whitechain', href: links.whitechainTx(tx) }] : [], { orderId, transaction: tx });
          return;
        } catch (error) {
          if (!notYet(error) || attempt === RETRIES - 1) {
            if (dispatching.current === orderId) setDispatch({ orderId, phase: 'error', tx: null, sentAt, at: null, error: error instanceof Refusal ? error.message : 'The dispatch did not go through.' });
            return;
          }
          await sleep(RETRY_MS);
        }
      }
    })();
  }, [paidOrderId]);

  // Scene 5: the shop accepts the refund by itself once the request lands. Its risk agent says what
  // it checked, then the real refund goes out (POST /api/merchant/refund), after the per-order guard.
  const accepting = useRef<string | null>(null);
  useEffect(() => {
    if (!ask || ask.phase !== 'asked' || accepting.current === ask.orderId.toLowerCase()) return;
    accepting.current = ask.orderId.toLowerCase();
    const { orderId, amountMicro } = ask;
    void (async () => {
      setAsk((a) => (a ? { ...a, phase: 'accepting', error: null } : a));
      postEvent('refund-accepted', [], { orderId, amountMicro });
      const d = dispatchRef.current;
      const wait = d && d.orderId.toLowerCase() === orderId.toLowerCase() ? d.sentAt + ORDER_GUARD_MS - Date.now() : 0;
      if (wait > 0) await sleep(wait);
      for (let attempt = 0; attempt < RETRIES; attempt++) {
        try {
          const answer = await postJson<{ transaction?: string | null; amountMicro?: string }>('/api/merchant/refund', { orderId, amountMicro });
          const tx = answer.transaction ?? null;
          setAsk((a) => (a ? { ...a, phase: 'refunded', tx, decisionAt: Date.now() } : a));
          postEvent('refund', tx ? [{ label: 'Refund on Whitechain', href: links.whitechainTx(tx) }] : [], { orderId, amountMicro: answer.amountMicro ?? amountMicro, transaction: tx });
          return;
        } catch (error) {
          if (!notYet(error) || attempt === RETRIES - 1) {
            setAsk((a) => (a ? { ...a, phase: 'error', error: error instanceof Refusal ? error.message : 'The refund did not go through. Try again in a minute.' } : a));
            return;
          }
          await sleep(error instanceof Refusal && error.code === 'TOO_SOON' ? 8_000 : RETRY_MS);
        }
      }
    })();
  }, [ask]);

  // The `req:` edge of the request confirms it on Arkiv.
  const reqEdge = ask ? rows.find((r) => r.kind === 'request' && r.ref.startsWith(`req:${ask.orderId}`)) : undefined;
  const reqKey = lastEdge && ask && lastEdge.row.ref.startsWith(`req:${ask.orderId}`) ? lastEdge.entityKey : null;

  const errandLines = useMemo(() => merchantErrandLines(model, cast).filter((l) => stepIndex(l.step) <= shownIndex), [model, shownIndex]);
  // This run's dispatch, shown with the payment once the director has reached it.
  const shownDispatch = dispatch && model.paid && dispatch.orderId === model.paid.orderId && shownIndex >= stepIndex('paid') ? dispatch : null;
  const scroller = useAutoScroll(`${errandLines.length}|${shownDispatch?.phase}|${ask?.phase}|${refused?.at}|${beat}`);
  const speaking = refused ? 'storefront' : ask ? (ask.phase === 'accepting' ? 'risk' : 'storefront') : shownDispatch ? 'dispatch' : (errandLines[errandLines.length - 1]?.role ?? null);
  const awake = shownIndex >= stepIndex('order');
  const members: TeamMember[] = ['storefront', 'risk', 'dispatch'].map((role) => ({
    role,
    status: 'active',
    activity: role === speaking ? 'talking' : role === 'risk' && shownIndex >= stepIndex('vet') && shownIndex < stepIndex('verdict') ? 'thinking' : awake && role === 'storefront' && shownIndex < stepIndex('paid') ? 'thinking' : shownIndex >= stepIndex('paid') && role === 'dispatch' ? 'success' : 'idle',
  }));

  // Today's earnings: the day's payments, the bill of this run until its edge lands, less refunds.
  const today = dayOf(now);
  const todays = rows.filter((r) => dayOf(r.ts * 1000) === today);
  const paidTx = new Set(todays.filter((r) => r.kind === 'pay' || r.kind === 'renew').map((r) => r.tx));
  let received = todays.filter((r) => r.kind === 'pay' || r.kind === 'renew').reduce((s, r) => s + r.amountMicro, 0n);
  let count = paidTx.size;
  if (model.paid && shownIndex >= stepIndex('paid') && !paidTx.has(model.paid.tx)) {
    received += BigInt(Math.round(Number(model.paid.amountUsdt) * 1e6));
    count += 1;
  }
  const refundTx = new Set(todays.filter((r) => r.kind === 'refund').map((r) => r.tx));
  let refundedMicro = todays.filter((r) => r.kind === 'refund').reduce((s, r) => s + r.amountMicro, 0n);
  if (ask?.phase === 'refunded' && ask.tx && !refundTx.has(ask.tx)) refundedMicro += BigInt(ask.amountMicro);
  const earnings = exportOk === null && count === 0 ? '' : `${microUsdt(String(received - refundedMicro))} USDT today, ${count} ${count === 1 ? 'order' : 'orders'}`;

  const view = beat === 'arkiv' ? 'scoreboard' : beat === 'ens' ? 'agents' : beat === 'whitechain' ? 'history' : beat === 'close' ? 'replay' : 'thread';
  const shopRows = foldOrders(rows, { persona: { name: story.customer.name, ens: story.customer.ens }, shops: [{ ens: story.shop.ens, name: story.shop.name }], products: [], txLink: (tx) => ({ label: networks.whitechain, url: links.whitechainTx(tx) }) });

  return (
    <div className="flex h-full flex-col bg-bg pt-[54px]">
      <header className="flex items-center gap-3 border-b border-line bg-surface px-4 pt-1 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate font-heading text-title leading-tight font-bold text-ink">{story.shop.name}</h1>
            <span className="stage-role" data-side="merchant">Merchant</span>
          </div>
          <p className="truncate text-caption text-muted">{openNote ?? (open === null ? '' : open ? 'Open, taking orders' : heal?.shop?.reopensAt ? `Closed. Opens again by itself.` : 'Closed')}</p>
        </div>
        <button type="button" onClick={() => void toggleOpen()} disabled={openBusy || open === null} className={clsx('stage-switch', open ? 'is-on' : 'is-off')} aria-pressed={open ?? false} aria-label={open ? 'Open: tap to close the shop' : 'Closed: tap to open the shop'}>
          <span />
        </button>
      </header>

      <div className="border-b border-line bg-surface pt-2">
        <TeamStrip members={members} speaking={speaking} />
      </div>

      <div ref={scroller} className="stage-scroll flex-1 overflow-y-auto px-4 py-4">
        {view === 'scoreboard' ? (
          <ScoreboardView ens={story.shop.ens} title={`${story.shop.name}’s scoreboard`} />
        ) : view === 'agents' ? (
          <AgentsView side="merchant" state={null} heal={heal} />
        ) : view === 'history' ? (
          <MerchantLedger rows={shopRows.length} model={model} dispatch={shownDispatch} ask={ask} now={now} received={received} refundedMicro={refundedMicro} count={count} />
        ) : view === 'replay' ? (
          <ProofList title="This run" items={replayItems(model, shownDispatch, ask, refused)} now={now} replay empty="No run reached the shop yet." />
        ) : errandLines.length === 0 && !ask && !refused ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="font-heading text-title font-bold text-ink">{open === false ? 'Closed for now' : 'Open for orders'}</p>
            <p className="max-w-[260px] text-body text-muted">{`${cast.agents.storefront?.label}, ${cast.agents.risk?.label} and ${cast.agents.dispatch?.label} are ready.`}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {errandLines.map((l) => (
              <Line key={l.key} role={l.role} text={l.text} tone={l.tone}>
                {l.card ? <ShopCard line={l} model={model} dispatch={shownDispatch} now={now} rows={rows} /> : null}
              </Line>
            ))}
            {shownDispatch ? (
              <Line role="dispatch" text={shownDispatch.phase === 'dispatched' ? dispatchLines.shopDone() : shownDispatch.phase === 'error' ? (shownDispatch.error ?? '') : dispatchLines.sending()} tone={shownDispatch.phase === 'dispatched' ? 'ok' : shownDispatch.phase === 'error' ? 'bad' : undefined}>
                {shownDispatch.tx ? (
                  <div className="flex flex-wrap gap-2">
                    <ProofLink href={links.whitechainTx(shownDispatch.tx)} network={networks.whitechain} label="Dispatched" at={shownDispatch.at} now={now} />
                  </div>
                ) : null}
              </Line>
            ) : null}
            {ask ? (
              <Line role="storefront" text={refundLines.shopRequest(cast, ask.amountMicro)}>
                <Card tone="bad" className="stage-slide">
                  {ask.swarmRef && ask.file ? <SwarmPhoto swarm={links.swarm(ask.swarmRef, ask.file)} local={null} className="mb-2 h-36 w-full rounded-input object-cover" /> : null}
                  <p className="text-caption text-muted">Order {orderNumber(ask.orderId)} from {cast.agents.payer?.ens}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ask.swarmRef && ask.file ? <ProofLink href={links.swarm(ask.swarmRef, ask.file)} network={networks.swarm} label="Photo" at={ask.at} now={now} /> : null}
                    {reqEdge || reqKey || ask.entityKey ? <ProofLink href={ask.entityKey ? links.arkivEntity(ask.entityKey) : ask.arkivTx ? links.arkivTx(ask.arkivTx) : null} network={networks.arkiv} label={reqEdge ? 'Confirmed' : 'Request'} at={ask.at} now={now} /> : <ArkivPending />}
                  </div>
                </Card>
              </Line>
            ) : null}
            {ask && ask.phase !== 'asked' ? (
              <Line role="risk" text={refundLines.riskAccept(ask.amountMicro, model.paid?.amountUsdt ?? null, Boolean(ask.swarmRef))} tone="ok">
                {ask.phase === 'accepting' ? <p className="text-caption font-bold text-muted">Sending the money back on {networks.whitechain}.</p> : null}
                {ask.error ? <p className="text-caption font-bold text-bad">{ask.error}</p> : null}
              </Line>
            ) : null}
            {ask?.phase === 'refunded' ? (
              <Line role="storefront" text={refundLines.shopRefunded(cast, ask.amountMicro)} tone="ok">
                <div className="flex flex-wrap gap-2">{ask.tx ? <ProofLink href={links.whitechainTx(ask.tx)} network={networks.whitechain} at={ask.decisionAt} now={now} /> : null}</div>
              </Line>
            ) : null}
            {refused ? <Line role="storefront" text={pauseLines.shopRefused(cast)} tone="bad" /> : null}
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-line bg-surface px-4 pt-3 pb-8">
        <span className="text-caption font-bold text-muted">Earnings</span>
        <span className="stage-earnings tabular text-body font-bold text-ink" key={earnings}>
          {earnings}
        </span>
      </footer>
    </div>
  );
}

function ShopCard({ line, model, dispatch, now, rows }: { line: LineData; model: ReturnType<typeof foldAll>; dispatch: Dispatch | null; now: number; rows: LedgerRow[] }) {
  if (line.card === 'quote-request') {
    const product = productOf(cast.merchant.ens, model.offers.find((o) => o.shop === cast.merchant.ens)?.sku ?? order.sku);
    return (
      <Card className="stage-slide flex items-center gap-3 p-2">
        <SwarmPhoto swarm={product?.swarm ?? null} local={product?.image ?? null} className="h-12 w-12 shrink-0 rounded-input object-cover" />
        <p className="min-w-0 flex-1 text-caption text-muted">from {cast.agents.payer?.ens}</p>
      </Card>
    );
  }
  if (line.card === 'shop-bill' && model.paid) {
    const product = productOf(cast.merchant.ens, model.offers.find((o) => o.shop === cast.merchant.ens)?.sku ?? order.sku);
    const edge = rows.find((r) => r.kind === 'pay' && r.tx === model.paid?.tx);
    return (
      <Card tone="ok" className="stage-slide">
        <div className="flex gap-3">
          <SwarmPhoto swarm={product?.swarm ?? null} local={product?.image ?? null} className="h-16 w-16 shrink-0 rounded-input object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-caption text-muted">Order {orderNumber(model.paid.orderId)}</p>
            <p className="line-clamp-2 text-body font-bold text-ink">{product?.name ?? cast.order.item}</p>
            <p className="truncate text-caption text-muted">from {cast.agents.payer?.ens}</p>
          </div>
          <p className="tabular font-heading text-amount font-bold text-ink">{usdt(model.paid.amountUsdt)}</p>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ProofLink href={links.whitechainTx(model.paid.tx)} network={networks.whitechain} label="Received" at={model.arrived.settled} now={now} />
          {dispatch?.tx ? <ProofLink href={links.whitechainTx(dispatch.tx)} network={networks.whitechain} label="Dispatched" at={dispatch.at} now={now} /> : dispatch?.phase === 'sending' ? <Pending>Dispatching</Pending> : null}
          {edge ? <span className="text-caption font-bold text-muted">On {networks.arkiv}</span> : <ArkivPending />}
        </div>
      </Card>
    );
  }
  return null;
}

function MerchantLedger({ rows, model, dispatch, ask, now, received, refundedMicro, count }: { rows: number; model: ReturnType<typeof foldAll>; dispatch: Dispatch | null; ask: RefundAsk | null; now: number; received: bigint; refundedMicro: bigint; count: number }) {
  const [exporting, setExporting] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');
  const items: ProofItem[] = [];
  if (model.paid) items.push({ key: 'paid', label: `Received from ${cast.agents.payer?.ens}`, amount: usdt(model.paid.amountUsdt), href: links.whitechainTx(model.paid.tx), network: networks.whitechain, at: model.arrived.settled ?? null, tone: 'ok' });
  if (dispatch?.tx) items.push({ key: 'dispatched', label: 'Dispatched', href: links.whitechainTx(dispatch.tx), network: networks.whitechain, at: dispatch.at });
  if (ask?.phase === 'refunded') items.push({ key: 'refund', label: 'Refunded', amount: microUsdt(ask.amountMicro), href: ask.tx ? links.whitechainTx(ask.tx) : null, network: networks.whitechain, at: ask.decisionAt });
  const download = async () => {
    setExporting('busy');
    const csv = await getTextRetry('/api/merchant/export.csv');
    if (!csv) return setExporting('failed');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${story.shop.ens.split('.')[0]}-orders.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting('done');
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-2">
          <p className="text-caption text-muted">Received</p>
          <p className="tabular font-heading text-section font-bold text-ink">{microUsdt(String(received))}</p>
        </Card>
        <Card className="p-2">
          <p className="text-caption text-muted">Refunded</p>
          <p className="tabular font-heading text-section font-bold text-ink">{microUsdt(String(refundedMicro))}</p>
        </Card>
        <Card className="p-2">
          <p className="text-caption text-muted">Orders</p>
          <p className="tabular font-heading text-section font-bold text-ink">{count}</p>
        </Card>
      </div>
      <ProofList title="This run" items={items} now={now} empty="No payment from this run yet." />
      <button type="button" onClick={() => void download()} disabled={exporting === 'busy'} className="rounded-full border border-line bg-surface px-4 py-3 text-body font-bold text-ink">
        {exporting === 'busy' ? 'Reading the graph' : exporting === 'failed' ? 'The export did not answer. Try again.' : exporting === 'done' ? 'Exported' : `Export ${rows} orders as CSV`}
      </button>
      <p className="text-caption text-muted">Every row comes from the graph on {networks.arkiv}, with its {networks.whitechain} link.</p>
    </div>
  );
}

function replayItems(model: ReturnType<typeof foldAll>, dispatch: Dispatch | null, ask: RefundAsk | null, refused: { at: number } | null): ProofItem[] {
  const items: ProofItem[] = [];
  if (model.quote) items.push({ key: 'order', label: `Quote ${orderNumber(model.quote.orderId)} for ${cast.agents.payer?.ens}`, href: null, network: '', at: null });
  if (model.quote) items.push({ key: 'bill', label: 'Bill sent', amount: usdt(model.quote.priceUsdt), href: null, network: '', at: null });
  if (model.paid) items.push({ key: 'paid', label: 'Received', amount: usdt(model.paid.amountUsdt), href: links.whitechainTx(model.paid.tx), network: networks.whitechain, at: model.arrived.settled ?? null, tone: 'ok' });
  if (dispatch?.tx) items.push({ key: 'dispatched', label: 'Dispatched', href: links.whitechainTx(dispatch.tx), network: networks.whitechain, at: dispatch.at });
  if (ask?.phase === 'refunded') items.push({ key: 'refund', label: 'Refunded', amount: microUsdt(ask.amountMicro), href: ask.tx ? links.whitechainTx(ask.tx) : null, network: networks.whitechain, at: ask.decisionAt });
  if (refused) items.push({ key: 'refused', label: 'Refused: payer paused, nothing received', href: null, network: '', at: refused.at, tone: 'bad' });
  return items;
}
