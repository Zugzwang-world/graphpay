import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { CalendarDays, RotateCcw } from 'lucide-react';
import { AgentAvatar } from '@/components/shared/AgentAvatar';
import { useAppNavigation } from '@/components/shared/AppShell';
import { IosPicker } from '@/components/shared/Overlays';
import { BottomSheet } from '@/components/shared/Overlays';
import { ExplorerLink, MoneyAmount, StatusChip } from '@/components/shared/Primitives';
import { EmptyState, InlineBanner, Toast } from '@/components/shared/States';
import { useDemo, useDemoEvents } from '@/demo/DemoProvider';
import { encodeSchedule, type AgentState, type Link, type Order, type Renewal, type RenewalFrequency, type RenewalSchedule } from '@/demo/contract';
import { firstChargeAt } from '@/demo/rules';
import { story } from '@/data/story';
import { copy, fill, pick } from '@/copy';
import { formatMoney } from '@/lib/money';
import { DAY, WEEKDAYS, formatDate, formatShortDate, isoDate, cityWeekday } from '@/lib/time';
import { customerRenewalSections, fitsRenewalPass, renewalSchedule } from '../renewalView';
import { useCustomerJourney } from './CustomerJourneyProvider';

type LastAction = { kind: 'start'; orderId: string; schedule: RenewalSchedule } | { kind: 'cancel'; renewalId: string };

/** C6: setup and cards render from order, pass and renewal snapshots. */
export function CustomerRenewals() {
  const { snapshot, adapter } = useDemo();
  const { state, selectOrder } = useCustomerJourney();
  const navigate = useAppNavigation();
  const [emptyLine] = useState(() => pick(copy.customer.renewals.empty));
  const [pending, setPending] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [recentId, setRecentId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<{ id: string; reason: string; links: Link[] } | null>(null);
  const setupOrder = snapshot?.orders.find((order) => order.id === state.selectedOrderId && order.owner.ens === story.customer.ens);
  const sections = customerRenewalSections(snapshot?.renewals ?? [], story.customer.ens);

  useDemoEvents((event) => {
    if (event.type === 'renewal.created' && event.renewal.owner.ens === story.customer.ens) {
      setPending(null); setError(null); setRecentId(event.renewal.id);
      setNotice(fill(copy.customer.renewals.added, { item: event.renewal.item }));
      if (event.renewal.sourceOrderId === state.selectedOrderId) selectOrder(null);
    }
    if (event.type === 'renewal.charged' && event.renewal.owner.ens === story.customer.ens) {
      setRecentId(event.renewal.id);
      if (event.renewal.status === 'charged') setRefusal(null);
    }
    if (event.type === 'renewal.cancelled') { setPending(null); setConfirmCancel(null); setRecentId(event.renewal.id); }
    if (event.type === 'payment.refused' && event.renewalId) setRefusal({ id: event.renewalId, reason: copy.refusal[event.reason], links: event.links });
    if (event.type === 'demo.reset') { setPending(null); setError(null); setNotice(null); setRecentId(null); setRefusal(null); }
  });
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), 4000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { if (!recentId) return; const timer = setTimeout(() => setRecentId(null), 2400); return () => clearTimeout(timer); }, [recentId]);

  const run = async (action: LastAction) => {
    setPending(action.kind === 'start' ? action.orderId : action.renewalId);
    setError(null); setLastAction(action);
    try {
      if (action.kind === 'start') await adapter.startRenewal(action.orderId, encodeSchedule(action.schedule));
      else await adapter.cancelRenewal(action.renewalId);
    } catch (cause) { setPending(null); setError(cause instanceof Error ? cause.message : copy.common.errorGeneric); }
  };
  const payer = snapshot?.agents.find((agent) => agent.ref.role === story.spendingPass.payingRole);
  const concierge = snapshot?.agents.find((agent) => agent.main) ?? snapshot?.agents[0];
  const existing = setupOrder && sections.current.find((renewal) => renewal.sourceOrderId === setupOrder.id);
  return <div className="flex flex-col gap-4 p-4 pb-8">
    <h2 className="font-heading text-title font-bold">{copy.customer.renewals.title}</h2>
    {setupOrder && !existing && <RenewalSetup key={setupOrder.id} order={setupOrder} now={snapshot?.now ?? Date.now()} payer={payer} pending={pending === setupOrder.id} onStart={(schedule) => void run({ kind: 'start', orderId: setupOrder.id, schedule })} onCancel={() => selectOrder(null)} />}
    {setupOrder && existing && <InlineBanner tone="info"><span>{copy.customer.renewals.alreadySet}</span><button type="button" onClick={() => selectOrder(null)} className="ml-2 font-bold underline">{copy.common.close}</button></InlineBanner>}
    {error && <InlineBanner tone="bad"><span>{error}</span>{lastAction && <button type="button" onClick={() => void run(lastAction)} className="ml-2 inline-flex items-center gap-1 font-bold underline"><RotateCcw size={13} aria-hidden />{copy.common.retry}</button>}</InlineBanner>}
    {sections.current.length === 0 && sections.cancelled.length === 0 && !setupOrder ? <div className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface p-6 text-center shadow-card">{concierge && <AgentAvatar agent={concierge.ref} label={concierge.label} activity="welcoming" size={52} />}<EmptyState title={emptyLine} action={copy.customer.renewals.goToOrders} onAction={() => navigate('orders')} /></div> : <>
      {sections.current.map((renewal) => <RenewalCard key={renewal.id} renewal={renewal} payer={snapshot?.agents.find((agent) => agent.ref.ens === renewal.payingAgent.ens)} highlighted={recentId === renewal.id} refusal={refusal?.id === renewal.id ? refusal : null} pending={pending === renewal.id} onCancel={() => setConfirmCancel(renewal.id)} />)}
      {sections.cancelled.length > 0 && <><h3 className="font-heading text-section font-bold">{copy.customer.renewals.cancelledHeading}</h3>{sections.cancelled.map((renewal) => <RenewalCard key={renewal.id} renewal={renewal} payer={snapshot?.agents.find((agent) => agent.ref.ens === renewal.payingAgent.ens)} highlighted={recentId === renewal.id} refusal={null} pending={false} onCancel={() => {}} />)}</>}
    </>}
    <BottomSheet open={confirmCancel !== null} title={copy.customer.renewals.cancel} onClose={() => setConfirmCancel(null)} actions={<><button type="button" onClick={() => setConfirmCancel(null)} className="min-h-11 rounded-full border border-line px-4 text-body font-bold">{copy.customer.renewals.keep}</button><button type="button" onClick={() => { if (confirmCancel) void run({ kind: 'cancel', renewalId: confirmCancel }); setConfirmCancel(null); }} className="min-h-11 rounded-full bg-bad px-4 text-body font-bold text-white">{copy.common.confirm}</button></>}><p className="text-body">{copy.customer.renewals.cancelConfirm}</p></BottomSheet>
    {notice && <Toast message={notice} onClose={() => setNotice(null)} />}
  </div>;
}

function RenewalSetup({ order, now, payer, pending, onStart, onCancel }: { order: Order; now: number; payer?: AgentState; pending: boolean; onStart: (schedule: RenewalSchedule) => void; onCancel: () => void }) {
  const [frequency, setFrequency] = useState<RenewalFrequency>('weekly');
  const [weekday, setWeekday] = useState(String(cityWeekday(now)));
  const [dayOfMonth, setDayOfMonth] = useState(String(Number(isoDate(now).slice(8, 10)) > 28 ? 28 : Number(isoDate(now).slice(8, 10))));
  const [startDate, setStartDate] = useState(() => isoDate(now + DAY));
  const schedule = renewalSchedule(frequency, startDate, Number(weekday), Number(dayOfMonth));
  const first = firstChargeAt(schedule);
  const fits = fitsRenewalPass(order.total, payer?.pass);
  const frequencyOptions = (['daily', 'weekly', 'biweekly', 'monthly'] as const).map((value) => ({ value, label: copy.customer.renewals.frequencies[value] }));
  const weekdays = WEEKDAYS.map((label, index) => ({ value: String(index), label }));
  const dates = Array.from({ length: 28 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }));
  const startOptions = Array.from({ length: 31 }, (_, index) => { const date = isoDate(now + (index + 1) * DAY); return { value: date, label: formatDate(firstChargeAt({ frequency: 'daily', startDate: date })) }; });
  return <div className="flex flex-col gap-3 rounded-card border border-info bg-surface p-4 shadow-card">
    <h3 className="font-heading text-section font-bold">{copy.customer.renewals.setupTitle}</h3>
    <p className="text-body">{order.items.map((item) => `${item.name} × ${item.qty}`).join(', ')} · {order.shop.name}</p>
    <MoneyAmount amount={order.total} />
    <IosPicker label={copy.customer.renewals.howOften} value={frequency} onChange={setFrequency} options={frequencyOptions} />
    {(frequency === 'weekly' || frequency === 'biweekly') && <IosPicker label={copy.customer.renewals.weekday} value={weekday} onChange={setWeekday} options={weekdays} />}
    {frequency === 'monthly' && <IosPicker label={copy.customer.renewals.dayOfMonth} value={dayOfMonth} onChange={setDayOfMonth} options={dates} />}
    <IosPicker label={copy.customer.renewals.startDate} value={startDate} onChange={setStartDate} options={startOptions} />
    <p className="flex items-center gap-2 text-caption text-muted"><CalendarDays size={15} aria-hidden />{fill(copy.customer.renewals.next, { date: formatShortDate(first) })}</p>
    {fits ? <InlineBanner tone="ok">{fill(copy.customer.renewals.fits, { amount: formatMoney(order.total) })}</InlineBanner> : <InlineBanner tone="bad">{fill(copy.customer.renewals.overPass, { amount: formatMoney(order.total), cap: payer?.pass ? formatMoney(payer.pass.cap) : '0.00 USDT' })}</InlineBanner>}
    <div className="flex gap-2"><button type="button" onClick={onCancel} className="min-h-11 flex-1 rounded-full border border-line px-3 text-body font-bold">{copy.common.cancel}</button><button type="button" disabled={!fits || pending} onClick={() => onStart(schedule)} className="min-h-11 flex-1 rounded-full bg-brand px-3 text-body font-bold text-white disabled:opacity-50">{pending ? `${copy.customer.renewals.start}…` : copy.customer.renewals.start}</button></div>
  </div>;
}

function RenewalCard({ renewal, payer, highlighted, refusal, pending, onCancel }: { renewal: Renewal; payer?: AgentState; highlighted: boolean; refusal: { reason: string; links: Link[] } | null; pending: boolean; onCancel: () => void }) {
  const latest = renewal.charges.at(-1);
  const payerLabel = payer?.label ?? renewal.payingAgent.role;
  const fits = fitsRenewalPass(renewal.amount, payer?.pass);
  return <article className={clsx('flex flex-col gap-3 rounded-card border border-l-4 bg-surface p-4 shadow-card', renewal.status === 'cancelled' ? 'border-line opacity-70' : renewal.status === 'skipped' ? 'border-warn' : 'border-ok', highlighted && 'renewal-arrive')}>
    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="font-heading text-section font-bold">{renewal.item}</h3><p className="text-caption text-muted">{renewal.scheduleText}</p></div><StatusChip status={renewal.status} /></div>
    <p className="break-all text-caption text-muted">{renewal.shop.name} · {renewal.shop.ens}</p>
    <p className="text-body font-bold">{formatMoney(renewal.amount)}</p>
    {payer?.pass && <p className={clsx('text-caption', fits ? 'text-ok' : 'text-bad')}>{fits ? fill(copy.customer.renewals.withinPass, { amount: formatMoney(renewal.amount) }) : fill(copy.customer.renewals.overPass, { amount: formatMoney(renewal.amount), cap: formatMoney(payer.pass.cap) })}</p>}
    {renewal.status === 'skipped' ? <InlineBanner tone="warn">{copy.customer.renewals.skippedLine}</InlineBanner> : renewal.nextChargeAt && <p className="text-caption text-muted">{fill(copy.customer.renewals.next, { date: formatShortDate(renewal.nextChargeAt) })}</p>}
    {refusal && renewal.status !== 'skipped' && <InlineBanner tone="bad"><span>{refusal.reason}</span><div className="mt-2 flex flex-wrap gap-2">{refusal.links.map((link, index) => <ExplorerLink key={`${link.url}-${index}`} link={link} />)}</div></InlineBanner>}
    <div className="flex items-center gap-2"><AgentAvatar agent={renewal.payingAgent} label={payerLabel} size={36} /><span className="text-caption text-muted">{copy.customer.renewals.paidBy} {payerLabel}</span></div>
    {latest && <div className="rounded-input bg-ok/5 p-3"><p className="text-caption font-bold text-ok">{fill(copy.customer.renewals.chargedOn, { amount: formatMoney(latest.amount), date: formatDate(latest.at) })}</p><div className="mt-2 flex flex-wrap gap-2">{latest.links.map((link, index) => <ExplorerLink key={`${link.url}-${index}`} link={link} />)}</div></div>}
    {renewal.status !== 'cancelled' && <button type="button" onClick={onCancel} disabled={pending} className="min-h-11 self-start rounded-full border border-line px-4 text-body font-bold text-bad disabled:opacity-50">{copy.customer.renewals.cancel}</button>}
  </article>;
}
