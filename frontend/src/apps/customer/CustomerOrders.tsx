import { useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { AgentAvatar } from '@/components/shared/AgentAvatar';
import { useAppNavigation } from '@/components/shared/AppShell';
import { ExplorerLink, MoneyAmount, StatusChip } from '@/components/shared/Primitives';
import { EmptyState, InlineBanner } from '@/components/shared/States';
import { StatusTracker } from '@/components/shared/StatusTracker';
import { useDemo } from '@/demo/DemoProvider';
import { canRequestRefund, isFullyRefunded } from '@/demo/rules';
import type { Order, Refund } from '@/demo/contract';
import { story } from '@/data/story';
import { copy, fill, pick } from '@/copy';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/time';
import { refundTrackerSteps } from '@/lib/refundTracker';
import { useCustomerJourney } from './CustomerJourneyProvider';

const orderSteps = ['ordered', 'paid', 'dispatched', 'delivered'] as const;

export function CustomerOrders() {
  const { snapshot } = useDemo();
  const { state, selectOrder, reorder } = useCustomerJourney();
  const navigate = useAppNavigation();
  const [emptyLine] = useState(() => pick(copy.customer.orders.empty));
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const orders = (snapshot?.orders ?? []).filter((order) => order.owner.ens === story.customer.ens).sort((a, b) => b.createdAt - a.createdAt);
  const selected = orders.find((order) => order.id === state.selectedOrderId);
  const startReorder = async (order: Order) => {
    if (reordering) return;
    setReordering(true); setError(null);
    try { await reorder(order.id); navigate('desk'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : copy.common.errorGeneric); setReordering(false); }
  };
  if (selected) return <OrderDetail order={selected} onBack={() => selectOrder(null)} onRefund={() => navigate('refund')} onRenewal={() => navigate('renewals')} onReorder={() => void startReorder(selected)} reordering={reordering} error={error} />;
  const concierge = snapshot?.agents.find((agent) => agent.main) ?? snapshot?.agents[0];
  return <div className="flex flex-col gap-3 p-4 pb-8">
    <h2 className="font-heading text-section font-bold">{copy.customer.orders.title}</h2>
    {orders.length === 0 ? <div className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface p-6 text-center shadow-card">{concierge && <AgentAvatar agent={concierge.ref} label={concierge.label} activity="welcoming" size={52} />}<EmptyState title={emptyLine} action={copy.customer.orders.askAgents} onAction={() => navigate('desk')} /></div> : orders.map((order) => <button key={order.id} type="button" onClick={() => selectOrder(order.id)} className="flex min-h-20 items-center justify-between gap-3 rounded-card border border-line bg-surface p-4 text-left shadow-card">
      <span className="min-w-0"><strong className="block truncate font-heading text-section">{order.items.map((item) => `${item.name} × ${item.qty}`).join(', ')}</strong><span className="block truncate text-caption text-muted">{order.shop.name} · {formatDate(order.createdAt)}</span><span className="mt-2 inline-block"><StatusChip status={isFullyRefunded(order) ? 'refunded' : order.status} /></span></span>
      <span className="flex shrink-0 items-center gap-1"><MoneyAmount amount={order.total} /><ArrowRight size={16} className="text-muted" aria-hidden /></span>
    </button>)}
  </div>;
}

function OrderDetail({ order, onBack, onRefund, onRenewal, onReorder, reordering, error }: { order: Order; onBack: () => void; onRefund: () => void; onRenewal: () => void; onReorder: () => void; reordering: boolean; error: string | null }) {
  const step = orderSteps.indexOf(order.status);
  const refund = order.refunds.at(-1);
  const eligibility = canRequestRefund(order);
  const refundReason = eligibility.ok ? null : eligibility.why === 'not_paid' ? copy.customer.orders.refundNotPaid : eligibility.why === 'fully_refunded' ? copy.customer.orders.refundFull : copy.customer.orders.refundPending;
  return <div className="flex flex-col gap-4 p-4 pb-8">
    <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 self-start rounded-full text-body font-bold text-brand"><ArrowLeft size={17} aria-hidden />{copy.customer.orders.title}</button>
    <article className="rounded-card border border-line bg-surface p-4 shadow-card"><h2 className="font-heading text-section font-bold">{fill(copy.customer.orders.detailTitle, { number: order.number })}</h2><p className="mt-2 text-body font-bold">{order.items.map((item) => `${item.name} × ${item.qty}`).join(', ')}</p><p className="text-caption text-muted">{order.shop.name} · {order.shop.ens}</p><p className="mt-2 text-caption text-muted">{formatDate(order.createdAt)}</p><div className="mt-3"><MoneyAmount amount={order.total} large /></div><div className="mt-3 flex flex-wrap gap-2">{order.links.map((link, index) => <ExplorerLink key={`${link.url}-${index}`} link={link} />)}</div></article>
    <StatusTracker label={fill(copy.customer.orders.detailTitle, { number: order.number })} steps={orderSteps.map((name, index) => ({ id: name, label: copy.status[name], state: index < step || order.status === 'delivered' ? 'done' as const : index === step ? 'current' as const : 'todo' as const }))} />
    {refund && <RefundProgress refund={refund} shop={order.shop.name} />}
    {error && <InlineBanner tone="bad"><span>{error}</span><button type="button" onClick={onReorder} className="ml-2 inline-flex items-center gap-1 font-bold underline"><RotateCcw size={13} aria-hidden />{copy.common.retry}</button></InlineBanner>}
    <button type="button" onClick={onRefund} disabled={!eligibility.ok} className="min-h-11 rounded-full bg-brand px-4 text-body font-bold text-white disabled:opacity-50">{copy.customer.orders.requestRefund}</button>
    {refundReason && <p className="-mt-2 text-center text-caption text-muted">{refundReason}</p>}
    <button type="button" onClick={onReorder} disabled={reordering} className="min-h-11 rounded-full border border-brand px-4 text-body font-bold text-brand disabled:opacity-50">{reordering ? copy.customer.orders.reordering : copy.customer.orders.reorder}</button>
    <button type="button" onClick={onRenewal} className="min-h-11 rounded-full border border-line px-4 text-body font-bold">{copy.customer.orders.makeRenewal}</button>
  </div>;
}

export function RefundProgress({ refund, shop }: { refund: Refund; shop: string }) {
  return <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
    <div className="flex items-center justify-between gap-2"><h3 className="font-heading text-section font-bold">{copy.customer.orders.refundHeading}</h3><StatusChip status={refund.status} /></div>
    <StatusTracker label={copy.customer.orders.refundHeading} steps={refundTrackerSteps(refund.status)} />
    <p className="text-body">{formatMoney(refund.amount)} · {refund.reason}</p>
    {refund.status === 'declined' && <p className="rounded-input bg-bad/10 p-3 text-body text-bad">{fill(copy.customer.orders.declinedNote, { note: refund.note ?? '' })} · {shop}</p>}
    {refund.status === 'refunded' && <div className="flex flex-wrap gap-2">{refund.links.map((link, index) => <ExplorerLink key={`${link.url}-${index}`} link={link} />)}</div>}
  </div>;
}
