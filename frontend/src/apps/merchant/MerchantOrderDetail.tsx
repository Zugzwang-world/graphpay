import { useState } from 'react';
import clsx from 'clsx';
import { AgentAvatar } from '@/components/shared/AgentAvatar';
import { ExplorerLink, MoneyAmount, StatusChip } from '@/components/shared/Primitives';
import { InlineBanner } from '@/components/shared/States';
import { StatusTracker } from '@/components/shared/StatusTracker';
import { useDemo, useDemoEvents } from '@/demo/DemoProvider';
import type { Order, RefundStatus } from '@/demo/contract';
import { refundableMax } from '@/demo/rules';
import { copy, fill } from '@/copy';
import { formatMoney, isZero } from '@/lib/money';

const refundSteps: RefundStatus[] = ['requested', 'accepted', 'refunded'];

/** M3: Dispatch starts an adapter action; the next two tracker states arrive as order.updated events. */
export function MerchantOrderDetail({ orderId, onRefund }: { orderId: string | null; onRefund: () => void }) {
  const { snapshot, adapter } = useDemo();
  const order = snapshot?.orders.find((entry) => entry.id === orderId);
  const [dispatching, setDispatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useDemoEvents((event) => {
    if (event.type === 'order.updated' && event.order.id === orderId && event.order.status !== 'paid') setDispatching(false);
  });
  if (!order) return <div className="p-4"><InlineBanner tone="bad">{copy.common.errorGeneric}</InlineBanner></div>;
  const dispatchOrder = async () => {
    if (dispatching || order.status !== 'paid') return;
    setDispatching(true);
    setError(null);
    try { await adapter.dispatch(order.id); }
    catch (cause) { setDispatching(false); setError(cause instanceof Error ? cause.message : copy.common.errorGeneric); }
  };
  const refund = order.refunds.at(-1);
  const refundDisabled = order.status === 'ordered' || isZero(refundableMax(order));
  const refundReason = order.status === 'ordered' ? copy.merchant.order.refundNotPaid : copy.merchant.order.refundFull;
  return <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
    <StatusTracker label={copy.merchant.order.title.replace('{number}', order.number)} steps={(['paid', 'dispatched', 'delivered'] as const).map((step, index) => {
      const current = ['paid', 'dispatched', 'delivered'].indexOf(order.status);
      return { id: step, label: copy.status[step], state: (index < current || order.status === 'delivered' ? 'done' : index === current ? 'current' : 'todo') as 'done' | 'current' | 'todo' };
    })} />
    {refund && <div className="rounded-card border border-line bg-surface p-3"><StatusTracker label={copy.merchant.pages.refunds} steps={refundSteps.map((step, index) => ({ id: step, label: copy.status[step], state: refund.status === 'declined' ? index === 0 ? 'failed' as const : 'todo' as const : index < refundSteps.indexOf(refund.status) || refund.status === 'refunded' ? 'done' as const : index === refundSteps.indexOf(refund.status) ? 'current' as const : 'todo' as const }))} /></div>}
    <BuyerCard order={order} />
    <div className="rounded-card border border-line bg-surface p-4 shadow-card"><div className="flex justify-between gap-2 text-body font-bold"><span>{copy.merchant.order.payment}</span><MoneyAmount amount={order.total} /></div><div className="mt-2 flex flex-wrap gap-2">{order.links.map((link, index) => <ExplorerLink key={`${link.url}-${index}`} link={link} />)}</div></div>
    {refund && refund.status === 'refunded' && <div className="rounded-card border border-info bg-info/5 p-4"><p className="text-body font-bold">{fill(copy.merchant.order.refundedAmount, { amount: formatMoney(refund.amount) })}</p><div className="mt-2 flex flex-wrap gap-2">{refund.links.map((link, index) => <ExplorerLink key={`${link.url}-${index}`} link={link} />)}</div></div>}
    {error && <InlineBanner tone="bad">{error}</InlineBanner>}
    {order.status === 'paid' ? <button type="button" onClick={() => void dispatchOrder()} disabled={dispatching} className="min-h-11 rounded-full bg-brand px-4 text-body font-bold text-white disabled:opacity-50">{dispatching ? `${copy.merchant.order.dispatch}…` : copy.merchant.order.dispatch}</button> : <p className="rounded-full bg-soft px-4 py-3 text-center text-body font-bold text-muted">{order.status === 'dispatched' ? copy.merchant.order.alreadyDispatched : copy.merchant.home.delivered}</p>}
    <button type="button" onClick={onRefund} disabled={refundDisabled} title={refundDisabled ? refundReason : undefined} className="min-h-11 rounded-full border border-brand px-4 text-body font-bold text-brand disabled:border-line disabled:text-muted">{copy.merchant.order.refund}{refund?.status === 'requested' && <span className="ml-2"><StatusChip status="requested" label={copy.merchant.order.refundRequestedBadge} /></span>}</button>
    {refundDisabled && <p className="text-center text-caption text-muted">{refundReason}</p>}
  </div>;
}

function BuyerCard({ order }: { order: Order }) {
  const riskWarn = order.risk.level !== 'safe';
  const verdict = fill(riskWarn ? copy.merchant.home.riskWarn : copy.merchant.home.riskSafe, { verdict: order.risk.text });
  return <article className="rounded-card border border-line bg-surface p-4 shadow-card">
    <h2 className="font-heading text-section font-bold">{copy.merchant.order.buyer}</h2>
    <div className="mt-3 flex items-center gap-2"><AgentAvatar agent={order.buyer} label={order.buyer.role} size={42} /><div className="min-w-0 text-body"><p className="truncate font-bold" title={order.buyer.ens}>{order.buyer.ens}</p><p className="text-muted">{fill(copy.merchant.home.owner, { owner: order.owner.name })}</p></div></div>
    <p className="mt-2 text-caption text-muted">{fill(copy.merchant.home.reputation, { orders: order.reputation.orders, refunds: order.reputation.refunds, since: order.reputation.since })}</p>
    <p className={clsx('mt-3 rounded-input p-2 text-caption font-bold', riskWarn ? 'bg-bad/10 text-bad' : 'bg-ok/10 text-ok')}>{verdict}</p>
    <h3 className="mt-4 border-t border-line pt-3 text-body font-bold">{copy.merchant.order.items}</h3>
    <div className="mt-2 flex flex-col gap-2 text-body">{order.items.map((item, index) => <div key={`${item.name}-${index}`} className="flex justify-between gap-2"><span>{item.name} × {item.qty}</span><MoneyAmount amount={item.price} /></div>)}</div>
    <div className="mt-3 flex justify-between border-t border-line pt-3 text-body font-bold"><span>{copy.customer.quote.total}</span><MoneyAmount amount={order.total} /></div>
  </article>;
}
