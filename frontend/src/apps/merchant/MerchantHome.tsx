import { useState } from 'react';
import clsx from 'clsx';
import { ArrowRight, Package, RotateCcw, Store, Truck } from 'lucide-react';
import { AgentAvatar } from '@/components/shared/AgentAvatar';
import { Switch } from '@/components/shared/Controls';
import { MoneyAmount, StatusChip } from '@/components/shared/Primitives';
import { EmptyState, InlineBanner } from '@/components/shared/States';
import { useDemo, useDemoEvents } from '@/demo/DemoProvider';
import type { Order } from '@/demo/contract';
import { copy, fill, pick } from '@/copy';
import { formatAmount, formatMoney, toCents, usdt } from '@/lib/money';
import { formatTime } from '@/lib/time';
import { useCountUp } from '@/lib/useCountUp';
import { merchantDay } from './homeData';

function Stat({ label, value, money = false, sub }: { label: string; value: number; money?: boolean; sub?: string }) {
  const shown = useCountUp(value);
  return <div className="min-w-0 flex-1 rounded-card border border-line bg-surface p-3 shadow-card">
    <p className="text-caption text-muted">{label}</p>
    <p className="mt-1 truncate font-heading text-section font-bold tabular">{money ? formatAmount(usdt(shown / 100)) : shown.toLocaleString('en-IN')}</p>
    {money ? <p className="text-caption text-muted">USDT</p> : sub && <p className="truncate text-caption text-muted">{sub}</p>}
  </div>;
}

/** M1: all cards and totals come from the same snapshot both phones share. */
export function MerchantHome({ onOrderDetails }: { onOrderDetails: (orderId: string) => void }) {
  const { snapshot, adapter } = useDemo();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memes] = useState(() => ({ open: pick(copy.merchant.home.memeOpen), closed: pick(copy.merchant.home.memeClosed) }));
  useDemoEvents((event) => {
    if (event.type === 'shop.status') { setToggling(false); setError(null); }
    if (event.type === 'demo.reset') { setToggling(false); setExpanded(null); setError(null); }
  });
  if (!snapshot) return null;
  const day = merchantDay(snapshot.orders, snapshot.shop.ref.ens, snapshot.now);
  const storefront = snapshot.shopAgents.find((agent) => agent.main) ?? snapshot.shopAgents[0];
  const toggle = async (open: boolean) => {
    if (toggling) return;
    setError(null);
    setToggling(true);
    try { await adapter.setShopOpen(open); }
    catch (cause) { setToggling(false); setError(cause instanceof Error ? cause.message : copy.common.errorGeneric); }
  };
  return <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
    <div key={snapshot.shop.open ? 'open' : 'closed'} className={clsx('merchant-meme-enter flex items-center gap-3 rounded-card border p-4 shadow-card', snapshot.shop.open ? 'border-ok bg-ok/5' : 'border-line bg-surface')}>
      {storefront && <AgentAvatar agent={storefront.ref} label={storefront.label} activity={snapshot.shop.open ? 'welcoming' : 'disappointed'} size={48} />}
      <p className="text-body font-bold">{snapshot.shop.open ? memes.open : memes.closed}</p>
    </div>
    <div className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
      <span className="flex items-center gap-2 text-body font-bold"><Store size={19} className="text-brand" aria-hidden />{snapshot.shop.open ? copy.merchant.home.toggleOpen : copy.merchant.home.toggleClosed}</span>
      <Switch label={snapshot.shop.open ? copy.merchant.home.toggleOpen : copy.merchant.home.toggleClosed} checked={snapshot.shop.open} disabled={toggling} onChange={(open) => void toggle(open)} />
    </div>
    {error && <InlineBanner tone="bad"><div className="flex items-center justify-between gap-2"><span>{error}</span><button type="button" className="inline-flex min-h-9 items-center gap-1 font-bold underline" onClick={() => void toggle(!snapshot.shop.open)}><RotateCcw size={14} aria-hidden />{copy.common.retry}</button></div></InlineBanner>}
    <div className="flex gap-2" aria-label={copy.merchant.home.todaysLog}>
      <Stat label={copy.merchant.home.earnedToday} value={toCents(day.earned)} money />
      <Stat label={copy.merchant.home.orders} value={day.orderCount} />
      <Stat label={copy.merchant.home.refunds} value={day.refundCount} sub={formatMoney(day.refunded)} />
    </div>
    <section aria-labelledby="merchant-day-log" className="flex flex-col gap-2">
      <h2 id="merchant-day-log" className="font-heading text-section font-bold">{copy.merchant.home.todaysLog}</h2>
      {day.orders.length === 0 ? <div className="rounded-card border border-line bg-surface p-4 text-center shadow-card">{storefront && <div className="mb-2 flex justify-center"><AgentAvatar agent={storefront.ref} label={storefront.label} size={48} /></div>}<EmptyState title={copy.merchant.home.empty[0]} /></div> : day.orders.map((order) => <OrderLogRow key={order.id} order={order} expanded={expanded === order.id} onExpand={() => setExpanded((current) => current === order.id ? null : order.id)} onDetails={() => onOrderDetails(order.id)} />)}
    </section>
  </div>;
}

function orderAction(order: Order): string {
  if (order.refunds.some((refund) => refund.status === 'requested')) return copy.merchant.home.refundRequested;
  if (order.refunds.some((refund) => refund.status === 'refunded')) return copy.merchant.home.refunded;
  if (order.status === 'delivered') return copy.merchant.home.delivered;
  if (order.status === 'dispatched') return copy.merchant.home.dispatched;
  return copy.merchant.home.canDispatch;
}

function OrderLogRow({ order, expanded, onExpand, onDetails }: { order: Order; expanded: boolean; onExpand: () => void; onDetails: () => void }) {
  const riskWarn = order.risk.level !== 'safe';
  const refund = order.refunds.at(-1);
  const kind = refund?.status === 'requested' ? copy.merchant.home.kinds.refund_request : refund?.status === 'refunded' ? copy.merchant.home.kinds.refunded : order.kind === 'renewal' ? copy.merchant.home.kinds.renewal : order.status === 'dispatched' || order.status === 'delivered' ? copy.merchant.home.kinds.dispatched : copy.merchant.home.kinds.new_order;
  const status = refund?.status === 'requested' || refund?.status === 'refunded' ? refund.status : order.status;
  const activityAt = refund?.status === 'refunded' ? refund.settledAt : refund?.status === 'requested' ? refund.requestedAt : order.deliveredAt ?? order.dispatchedAt ?? order.paidAt ?? order.createdAt;
  const riskLine = fill(riskWarn ? copy.merchant.home.riskWarn : copy.merchant.home.riskSafe, { verdict: order.risk.text });
  return <article className={clsx('overflow-hidden rounded-card border bg-surface shadow-card', order.isNew ? 'merchant-new-row border-brand border-l-4' : 'border-line')}>
    <button type="button" onClick={onExpand} aria-expanded={expanded} aria-label={`${kind} ${order.number}, ${order.owner.name}, ${formatMoney(order.total)}`} className="flex w-full flex-col gap-2 p-3 text-left">
      <div className="flex w-full items-start gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">{order.status === 'dispatched' || order.status === 'delivered' ? <Truck size={17} aria-hidden /> : <Package size={17} aria-hidden />}</span>
        <span title={order.buyer.ens} aria-label={order.buyer.ens} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-agent-payer bg-surface text-caption font-bold">{order.buyer.role.charAt(0).toUpperCase()}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-body font-bold">{kind} #{order.number}</span><span className="block truncate text-caption text-muted">{fill(order.kind === 'renewal' ? copy.merchant.home.renewalFrom : copy.merchant.home.from, { name: order.buyer.ens })}</span></span>
        <span className="shrink-0 text-right"><span className="block text-body font-bold tabular">{formatMoney(order.total)}</span><span className="text-caption text-muted">{formatTime(activityAt ?? order.createdAt)}</span></span>
      </div>
      <div className="flex w-full items-center gap-2">{order.isNew && <StatusChip status="new" />}<StatusChip status={status} /><span className={clsx('min-w-0 flex-1 truncate text-caption', riskWarn ? 'text-bad' : 'text-ok')}>{riskLine}</span></div>
    </button>
    {expanded && <div className="merchant-summary-enter flex flex-col gap-3 border-t border-line px-3 py-4">
      <div className="flex items-center gap-2"><AgentAvatar agent={order.buyer} label={order.buyer.role} size={36} /><p className="min-w-0 text-body"><strong className="block truncate">{order.buyer.ens}</strong>{fill(copy.merchant.home.owner, { owner: order.owner.name })}</p></div>
      <p className="text-caption text-muted">{fill(copy.merchant.home.reputation, { orders: order.reputation.orders, refunds: order.reputation.refunds, since: order.reputation.since })}</p>
      <p className={clsx('rounded-input p-2 text-caption font-bold', riskWarn ? 'bg-bad/10 text-bad' : 'bg-ok/10 text-ok')}>{riskLine}</p>
      <div className="border-t border-line pt-2 text-body">{order.items.map((item, index) => <div key={`${item.name}-${index}`} className="flex justify-between gap-2"><span>{item.name} × {item.qty}</span><MoneyAmount amount={item.price} /></div>)}</div>
      <div className="flex justify-between border-t border-line pt-2 text-body font-bold"><span>{copy.customer.quote.total}</span><MoneyAmount amount={order.total} /></div>
      <p className="text-caption text-muted">{orderAction(order)}</p>
      <button type="button" onClick={onDetails} className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand px-4 text-body font-bold text-white">{copy.merchant.home.viewDetails}<ArrowRight size={16} aria-hidden /></button>
    </div>}
  </article>;
}
