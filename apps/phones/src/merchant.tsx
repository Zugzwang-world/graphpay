// The shop’s phone on the stage (final website brief §4 and §5): one screen, no order log. The
// header with the Open switch, the shop's three agents as a team, their own conversation and cards
// (the bill, the refund request, the refused payment), today's earnings. The errand reaches this
// phone through the stage (`graphpay.relay`), so the bill shows the moment the payer's answer comes;
// the merchant stream's edges confirm it on Arkiv later and are forwarded to the stage.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { story } from '@/data/story';
import { foldAll } from '../../web/lib/stage/errand.ts';
import { merchantErrandLines, pauseLines, refundLines, type Line as LineData } from '../../web/lib/stage/lines.ts';
import { stepIndex, type BeatKey } from '../../web/lib/stage/scenes.ts';
import { microUsdt, orderNumber, usdt } from '../../web/lib/stage/format.ts';
import { getJson, getTextRetry, postJson, Refusal, type HealState } from './api';
import { cast, links, networks, order, productOf, timeZone } from './cast';
import { foldOrders, rowFromEdge, rowKey, rowsFromCsv, type LedgerRow } from './orders';
import { embedded, postEvent, useNow, useStage } from './stage-link';
import { ArkivPending, Card, Line, ProofLink, SwarmPhoto, TeamStrip, useAutoScroll, type TeamMember } from './ui';
import { AgentsView, ProofList, ScoreboardView, type ProofItem } from './views';

const RECONNECT_MS = 1_500;
const RECONNECT_MAX_MS = 30_000;
const RENEW_OPEN_MS = 300_000;

interface RefundAsk {
  orderId: string;
  amountMicro: string;
  swarmRef: string | null;
  file: string | null;
  arkivTx: string | null;
  entityKey: string | null;
  at: number;
  phase: 'asked' | 'accepting' | 'refunded' | 'declining' | 'declined' | 'error';
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
    for (const e of stage.events.slice(seen.current)) {
      if (e.key === 'refund-request' && typeof e.data?.orderId === 'string') {
        const d = e.data;
        setAsk({
          orderId: e.data.orderId,
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
        });
      } else if (e.key === 'reorder-refused') {
        setRefused({ at: e.at, code: typeof e.data?.code === 'string' ? e.data.code : '' });
      } else if (e.key === 'refund-start' || e.key === 'pause-start') {
        if (e.key === 'pause-start') setRefused(null);
      }
    }
    seen.current = stage.events.length;
  }, [stage.events]);

  const accept = async () => {
    if (!ask || ask.phase !== 'asked') return;
    setAsk({ ...ask, phase: 'accepting', error: null });
    try {
      const answer = await postJson<{ transaction?: string | null; amountMicro?: string }>('/api/merchant/refund', { orderId: ask.orderId, amountMicro: ask.amountMicro });
      const tx = answer.transaction ?? null;
      setAsk((a) => (a ? { ...a, phase: 'refunded', tx, decisionAt: Date.now() } : a));
      postEvent('refund', tx ? [{ label: 'Refund on Whitechain', href: links.whitechainTx(tx) }] : [], { orderId: ask.orderId, amountMicro: answer.amountMicro ?? ask.amountMicro, transaction: tx });
    } catch (error) {
      setAsk((a) => (a ? { ...a, phase: 'asked', error: error instanceof Refusal ? error.message : 'The refund did not go through. Try again in a minute.' } : a));
    }
  };
  const decline = async () => {
    if (!ask || ask.phase !== 'asked') return;
    setAsk({ ...ask, phase: 'declining', error: null });
    try {
      const answer = await postJson<{ arkivTx?: string | null; entityKey?: string | null }>('/api/merchant/refund-decline', { orderId: ask.orderId });
      setAsk((a) => (a ? { ...a, phase: 'declined', tx: answer.arkivTx ?? null, decisionAt: Date.now() } : a));
      postEvent('refund-declined', answer.arkivTx ? [{ label: 'Decline on Arkiv', href: links.arkivTx(answer.arkivTx) }] : [], { orderId: ask.orderId, arkivTx: answer.arkivTx ?? null, entityKey: answer.entityKey ?? null });
    } catch (error) {
      setAsk((a) => (a ? { ...a, phase: 'asked', error: error instanceof Refusal ? error.message : 'The decline did not go through. Try again in a minute.' } : a));
    }
  };

  // The `req:` edge of the request confirms it on Arkiv.
  const reqEdge = ask ? rows.find((r) => r.kind === 'request' && r.ref.startsWith(`req:${ask.orderId}`)) : undefined;
  const reqKey = lastEdge && ask && lastEdge.row.ref.startsWith(`req:${ask.orderId}`) ? lastEdge.entityKey : null;

  const errandLines = useMemo(() => merchantErrandLines(model, cast).filter((l) => stepIndex(l.step) <= shownIndex), [model, shownIndex]);
  const scroller = useAutoScroll(`${errandLines.length}|${ask?.phase}|${refused?.at}|${beat}`);
  const speaking = refused ? 'storefront' : ask ? 'storefront' : (errandLines[errandLines.length - 1]?.role ?? null);
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
          <h1 className="font-heading text-title leading-tight font-bold text-ink">{story.shop.name}</h1>
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
          <MerchantLedger rows={shopRows.length} model={model} ask={ask} now={now} received={received} refundedMicro={refundedMicro} count={count} />
        ) : view === 'replay' ? (
          <ProofList title="This run" items={replayItems(model, ask, refused)} now={now} replay empty="No run reached the shop yet." />
        ) : errandLines.length === 0 && !ask && !refused ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="font-heading text-title font-bold text-ink">{open === false ? 'Closed for now' : 'Open for orders'}</p>
            <p className="max-w-[260px] text-body text-muted">{`${cast.agents.storefront?.label}, ${cast.agents.risk?.label} and ${cast.agents.dispatch?.label} are ready.`}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {errandLines.map((l) => (
              <Line key={l.key} role={l.role} text={l.text} tone={l.tone}>
                {l.card ? <ShopCard line={l} model={model} now={now} rows={rows} /> : null}
              </Line>
            ))}
            {ask ? (
              <Line role="storefront" text={refundLines.shopRequest(cast, ask.amountMicro)}>
                <Card tone="bad" className="stage-slide">
                  {ask.swarmRef && ask.file ? <SwarmPhoto swarm={links.swarm(ask.swarmRef, ask.file)} local={null} className="mb-2 h-36 w-full rounded-input object-cover" /> : null}
                  <p className="text-caption text-muted">Order {orderNumber(ask.orderId)} from {cast.agents.payer?.ens}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ask.swarmRef && ask.file ? <ProofLink href={links.swarm(ask.swarmRef, ask.file)} network={networks.swarm} label="Photo" at={ask.at} now={now} /> : null}
                    {reqEdge || reqKey || ask.entityKey ? <ProofLink href={ask.entityKey ? links.arkivEntity(ask.entityKey) : ask.arkivTx ? links.arkivTx(ask.arkivTx) : null} network={networks.arkiv} label={reqEdge ? 'Confirmed' : 'Request'} at={ask.at} now={now} /> : <ArkivPending />}
                  </div>
                  {ask.phase === 'asked' ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => void accept()} className="stage-accept rounded-full bg-ok px-4 py-3 text-body font-bold text-white">
                        Accept
                      </button>
                      <button type="button" onClick={() => void decline()} className="rounded-full border border-line bg-surface px-4 py-3 text-body font-bold text-ink">
                        Decline
                      </button>
                    </div>
                  ) : null}
                  {ask.phase === 'accepting' || ask.phase === 'declining' ? <p className="mt-3 text-caption font-bold text-muted">{ask.phase === 'accepting' ? `Sending the money back on ${networks.whitechain}.` : `Writing the decline to ${networks.arkiv}.`}</p> : null}
                  {ask.error ? <p className="mt-2 text-caption font-bold text-bad">{ask.error}</p> : null}
                </Card>
              </Line>
            ) : null}
            {ask?.phase === 'refunded' ? (
              <Line role="storefront" text={refundLines.shopRefunded(cast, ask.amountMicro)} tone="ok">
                <div className="flex flex-wrap gap-2">{ask.tx ? <ProofLink href={links.whitechainTx(ask.tx)} network={networks.whitechain} at={ask.decisionAt} now={now} /> : null}</div>
              </Line>
            ) : null}
            {ask?.phase === 'declined' ? (
              <Line role="storefront" text={refundLines.shopDeclined()}>
                <div className="flex flex-wrap gap-2">{ask.tx ? <ProofLink href={links.arkivTx(ask.tx)} network={networks.arkiv} at={ask.decisionAt} now={now} /> : null}</div>
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

function ShopCard({ line, model, now, rows }: { line: LineData; model: ReturnType<typeof foldAll>; now: number; rows: LedgerRow[] }) {
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
          <span className="text-caption font-bold text-ok">Received</span>
          <ProofLink href={links.whitechainTx(model.paid.tx)} network={networks.whitechain} at={model.arrived.settled} now={now} />
          {edge ? <span className="text-caption font-bold text-muted">On {networks.arkiv}</span> : <ArkivPending />}
        </div>
      </Card>
    );
  }
  return null;
}

function MerchantLedger({ rows, model, ask, now, received, refundedMicro, count }: { rows: number; model: ReturnType<typeof foldAll>; ask: RefundAsk | null; now: number; received: bigint; refundedMicro: bigint; count: number }) {
  const [exporting, setExporting] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');
  const items: ProofItem[] = [];
  if (model.paid) items.push({ key: 'paid', label: `Received from ${cast.agents.payer?.ens}`, amount: usdt(model.paid.amountUsdt), href: links.whitechainTx(model.paid.tx), network: networks.whitechain, at: model.arrived.settled ?? null, tone: 'ok' });
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

function replayItems(model: ReturnType<typeof foldAll>, ask: RefundAsk | null, refused: { at: number } | null): ProofItem[] {
  const items: ProofItem[] = [];
  if (model.quote) items.push({ key: 'order', label: `Quote ${orderNumber(model.quote.orderId)} for ${cast.agents.payer?.ens}`, href: null, network: '', at: null });
  if (model.quote) items.push({ key: 'bill', label: 'Bill sent', amount: usdt(model.quote.priceUsdt), href: null, network: '', at: null });
  if (model.paid) items.push({ key: 'paid', label: 'Received', amount: usdt(model.paid.amountUsdt), href: links.whitechainTx(model.paid.tx), network: networks.whitechain, at: model.arrived.settled ?? null, tone: 'ok' });
  if (ask?.phase === 'refunded') items.push({ key: 'refund', label: 'Refunded', amount: microUsdt(ask.amountMicro), href: ask.tx ? links.whitechainTx(ask.tx) : null, network: networks.whitechain, at: ask.decisionAt });
  if (refused) items.push({ key: 'refused', label: 'Refused: payer paused, nothing received', href: null, network: '', at: refused.at, tone: 'bad' });
  return items;
}
