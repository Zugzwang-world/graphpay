import { useState, type ReactNode } from 'react';
import { ArrowDownLeft, ArrowRight, CalendarDays, ChevronDown, Download, RotateCcw, Scale, Wallet } from 'lucide-react';
import { AgentAvatar } from '@/components/shared/AgentAvatar';
import { BottomSheet, IosPicker } from '@/components/shared/Overlays';
import { ExplorerLink, StatusChip } from '@/components/shared/Primitives';
import { EmptyState, InlineBanner, LoadingState } from '@/components/shared/States';
import { useDemo, useDemoEvents } from '@/demo/DemoProvider';
import { copy, fill, pick } from '@/copy';
import { formatAmount, formatMoney, toCents, usdt } from '@/lib/money';
import { formatDateTime, isoDate } from '@/lib/time';
import { useCountUp } from '@/lib/useCountUp';
import { payoutLedger, payoutRange, validPayoutRange, type PayoutPeriod, type PayoutRow } from './payoutData';

function SummaryCard({ label, cents, icon, tone }: { label: string; cents: number; icon: ReactNode; tone: 'ok' | 'info' | 'brand' | 'bad' }) {
  const shown = useCountUp(cents);
  const color = tone === 'ok' ? 'text-ok' : tone === 'info' ? 'text-info' : tone === 'bad' ? 'text-bad' : 'text-brand';
  return <div className="min-w-0 flex-1 rounded-card border border-line bg-surface p-3 shadow-card">
    <div className={`flex items-center gap-1 text-caption font-bold ${color}`}>{icon}<span>{label}</span></div>
    <p className={`mt-2 truncate font-heading text-section font-bold tabular ${color}`} title={formatMoney(usdt(cents / 100))}>{formatAmount(usdt(shown / 100))}</p>
    <p className="text-caption text-muted">USDT</p>
  </div>;
}

function DateSheetPicker({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label={`${label}: ${value}`} className="flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-input border border-line bg-surface px-3 font-ios text-body">
      <span className="text-muted">{label}</span><span className="flex min-w-0 items-center gap-1 font-semibold"><span className="truncate">{value}</span><ChevronDown size={15} aria-hidden /></span>
    </button>
    <BottomSheet open={open} title={label} onClose={() => setOpen(false)} actions={<button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-full bg-brand px-4 text-body font-bold text-white">{copy.common.done}</button>}>
      <label className="flex flex-col gap-2 text-body font-bold"><span className="flex items-center gap-2"><CalendarDays size={17} aria-hidden />{label}</span><input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="min-h-12 w-full rounded-input border border-line bg-white px-3 font-ios text-body text-ink" /></label>
    </BottomSheet>
  </>;
}

/** M6: the visible log and totals derive from the same settled rows as the CSV. */
export function MerchantPayouts({ onOrderDetails }: { onOrderDetails: (orderId: string) => void }) {
  const { snapshot, adapter } = useDemo();
  const [period, setPeriod] = useState<PayoutPeriod>('week');
  const [custom, setCustom] = useState(() => ({ from: isoDate(Date.now()), to: isoDate(Date.now()) }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<{ file: string; rows: number } | null>(null);
  const [emptyLine] = useState(() => pick(copy.merchant.payouts.empty));
  useDemoEvents((event) => {
    if (event.type === 'demo.reset') { setPeriod('week'); setCustom({ from: isoDate(Date.now()), to: isoDate(Date.now()) }); setBusy(false); setError(null); setReady(null); }
  });
  if (!snapshot) return <LoadingState />;
  const range = payoutRange(period, snapshot.now, custom);
  const valid = validPayoutRange(range);
  const ledger = payoutLedger(snapshot.orders, snapshot.shop.ref.ens, range);
  const shopAgent = snapshot.shopAgents.find((agent) => agent.main) ?? snapshot.shopAgents[0];
  const periods = (['today', 'week', 'month', 'custom'] as const).map((value) => ({ value, label: copy.merchant.payouts.periods[value] }));
  const exportFile = async () => {
    if (busy || !valid || ledger.rows.length === 0) return;
    const file = `graphpay-payouts-${range.from}-to-${range.to}.csv`;
    const rowCount = ledger.rows.length;
    setBusy(true); setError(null); setReady(null);
    try {
      const blob = await adapter.exportCsv(range);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = file;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setReady({ file, rows: rowCount });
    } catch (cause) { setError(cause instanceof Error ? cause.message : copy.common.errorGeneric); }
    finally { setBusy(false); }
  };
  return <div className="flex flex-col gap-4 p-4 pb-8">
    <h2 className="font-heading text-title font-bold">{copy.merchant.payouts.title}</h2>
    <IosPicker label={copy.merchant.payouts.periodLabel} value={period} options={periods} onChange={(value) => { setPeriod(value); setReady(null); setError(null); }} />
    {period === 'custom' && <div className="grid grid-cols-2 gap-2">
      <DateSheetPicker label={copy.merchant.payouts.from} value={custom.from} onChange={(from) => { setCustom((range) => ({ ...range, from })); setReady(null); }} />
      <DateSheetPicker label={copy.merchant.payouts.to} value={custom.to} onChange={(to) => { setCustom((range) => ({ ...range, to })); setReady(null); }} />
    </div>}
    {!valid && <InlineBanner tone="bad">{copy.merchant.payouts.invalidRange}</InlineBanner>}
    <div className="flex gap-2" aria-label={copy.merchant.payouts.summary}>
      <SummaryCard label={copy.merchant.payouts.received} cents={valid ? toCents(ledger.received) : 0} icon={<ArrowDownLeft size={15} aria-hidden />} tone="ok" />
      <SummaryCard label={copy.merchant.payouts.refunded} cents={valid ? toCents(ledger.refunded) : 0} icon={<RotateCcw size={15} aria-hidden />} tone="info" />
      <SummaryCard label={copy.merchant.payouts.net} cents={valid ? toCents(ledger.net) : 0} icon={<Scale size={15} aria-hidden />} tone={valid && toCents(ledger.net) < 0 ? 'bad' : 'brand'} />
    </div>
    <button type="button" disabled={busy || !valid || ledger.rows.length === 0} onClick={() => void exportFile()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand px-4 text-body font-bold text-white disabled:opacity-50"><Download size={17} aria-hidden />{busy ? copy.merchant.payouts.exporting : copy.merchant.payouts.exportCsv}</button>
    {valid && ledger.rows.length === 0 && <p className="text-center text-caption text-muted">{copy.merchant.payouts.exportEmptyHint}</p>}
    {error && <InlineBanner tone="bad"><span>{error}</span><button type="button" disabled={busy} onClick={() => void exportFile()} className="ml-2 inline-flex items-center gap-1 font-bold underline"><RotateCcw size={14} aria-hidden />{copy.common.retry}</button></InlineBanner>}
    {ready && <InlineBanner tone="ok">{fill(copy.merchant.payouts.exportReady, ready)}</InlineBanner>}
    <section className="flex flex-col gap-2" aria-label={copy.merchant.payouts.log}>
      <h3 className="font-heading text-section font-bold">{copy.merchant.payouts.log}</h3>
      {!valid || ledger.rows.length === 0 ? <div className="flex flex-col items-center gap-3">{shopAgent && <AgentAvatar agent={shopAgent.ref} label={shopAgent.label} activity="disappointed" size={48} />}<EmptyState title={emptyLine} detail={copy.merchant.payouts.chooseAnother} icon={<Wallet size={22} aria-hidden />} /></div> : ledger.rows.map((row) => <PayoutLogRow key={row.id} row={row} onOpen={() => onOrderDetails(row.orderId)} />)}
    </section>
  </div>;
}

function PayoutLogRow({ row, onOpen }: { row: PayoutRow; onOpen: () => void }) {
  const refund = row.type === 'refund';
  return <article className="rounded-card border border-line bg-surface p-3 shadow-card">
    <button type="button" onClick={onOpen} className="flex min-h-16 w-full items-start gap-3 text-left">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${refund ? 'bg-info/10 text-info' : 'bg-ok/10 text-ok'}`}>{refund ? <RotateCcw size={18} aria-hidden /> : <ArrowDownLeft size={18} aria-hidden />}</span>
      <span className="min-w-0 flex-1"><strong className="block text-body">{fill(refund ? copy.merchant.payouts.refundRow : copy.merchant.payouts.orderRow, { number: row.number })}</strong><span className="block truncate text-caption text-muted" title={row.buyerEns}>{row.buyerEns}</span><span className="block text-caption text-muted">{formatDateTime(row.at)}</span></span>
      <span className="flex shrink-0 flex-col items-end gap-1"><span className={`font-heading text-body font-bold tabular ${refund ? 'text-info' : 'text-ok'}`}>{formatMoney(row.amount, { sign: true })}</span><StatusChip status={row.status} /></span><ArrowRight size={15} className="shrink-0 text-muted" aria-hidden />
    </button>
    <div className="mt-2 flex flex-wrap gap-2 border-t border-line pt-2">{row.links.map((link, index) => <ExplorerLink key={`${link.url}-${index}`} link={link} />)}</div>
  </article>;
}
