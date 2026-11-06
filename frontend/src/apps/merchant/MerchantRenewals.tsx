import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AgentAvatar } from '@/components/shared/AgentAvatar';
import { ExplorerLink, MoneyAmount, StatusChip } from '@/components/shared/Primitives';
import { EmptyState } from '@/components/shared/States';
import { useDemo, useDemoEvents } from '@/demo/DemoProvider';
import type { Order, Renewal } from '@/demo/contract';
import { copy, fill, pick } from '@/copy';
import { formatDate, formatDateTime, formatShortDate } from '@/lib/time';
import { merchantRenewalSections } from '../renewalView';

/** M5 is read-only; every card and history entry comes from the shared snapshot. */
export function MerchantRenewals() {
  const { snapshot } = useDemo();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [recentId, setRecentId] = useState<string | null>(null);
  const [emptyLine] = useState(() => pick(copy.merchant.renewals.empty));
  useDemoEvents((event) => {
    if ((event.type === 'renewal.created' || event.type === 'renewal.charged') && event.renewal.shop.ens === snapshot?.shop.ref.ens) setRecentId(event.renewal.id);
    if (event.type === 'demo.reset') { setExpanded(null); setRecentId(null); }
  });
  useEffect(() => { if (!recentId) return; const timer = setTimeout(() => setRecentId(null), 2400); return () => clearTimeout(timer); }, [recentId]);
  if (!snapshot) return null;
  const sections = merchantRenewalSections(snapshot.renewals, snapshot.shop.ref.ens, snapshot.now);
  const shopAgent = snapshot.shopAgents.find((agent) => agent.main) ?? snapshot.shopAgents[0];
  const render = (renewal: Renewal) => <MerchantRenewalCard key={renewal.id} renewal={renewal} orders={snapshot.orders} expanded={expanded === renewal.id} highlighted={recentId === renewal.id} onToggle={() => setExpanded((id) => id === renewal.id ? null : renewal.id)} />;
  return <div className="flex flex-col gap-4 p-4 pb-8">
    <h2 className="font-heading text-title font-bold">{copy.merchant.renewals.title}</h2>
    {sections.chargedToday.length === 0 && sections.current.length === 0 && sections.cancelled.length === 0 ? <div className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface p-6 text-center shadow-card">{shopAgent && <AgentAvatar agent={shopAgent.ref} label={shopAgent.label} activity="welcoming" size={52} />}<EmptyState title={emptyLine} detail={copy.merchant.renewals.emptyHint} /></div> : <>
      <p className="text-caption text-muted">{copy.merchant.renewals.hint}</p>
      {sections.chargedToday.length > 0 && <section className="flex flex-col gap-2"><h3 className="font-heading text-section font-bold">{copy.merchant.renewals.chargedToday}</h3>{sections.chargedToday.map(render)}</section>}
      {sections.current.length > 0 && <section className="flex flex-col gap-2" aria-label={copy.merchant.renewals.title}>{sections.current.map(render)}</section>}
      {sections.cancelled.length > 0 && <section className="flex flex-col gap-2"><h3 className="font-heading text-section font-bold">{copy.merchant.renewals.cancelledHeading}</h3>{sections.cancelled.map(render)}</section>}
    </>}
  </div>;
}

function MerchantRenewalCard({ renewal, orders, expanded, highlighted, onToggle }: { renewal: Renewal; orders: Order[]; expanded: boolean; highlighted: boolean; onToggle: () => void }) {
  const customerOrders = orders.filter((order) => order.owner.ens === renewal.owner.ens).sort((a, b) => b.createdAt - a.createdAt);
  const refundCount = customerOrders.reduce((count, order) => count + order.refunds.filter((refund) => refund.status === 'refunded').length, 0);
  const firstOrder = customerOrders.at(-1);
  const latest = renewal.charges.at(-1);
  const regular = customerOrders.length >= 3;
  return <article className={clsx('overflow-hidden rounded-card border border-l-4 bg-surface shadow-card', renewal.status === 'cancelled' ? 'border-line opacity-70' : renewal.status === 'skipped' ? 'border-warn' : 'border-ok', highlighted && 'renewal-arrive')}>
    <button type="button" onClick={onToggle} aria-expanded={expanded} aria-label={`${renewal.owner.name}, ${renewal.item}, ${renewal.scheduleShort}`} className="flex min-h-20 w-full items-start gap-3 p-4 text-left">
      <span title={renewal.payingAgent.ens} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-agent-payer bg-surface text-body font-bold">{renewal.payingAgent.role.charAt(0).toUpperCase()}</span>
      <span className="min-w-0 flex-1"><strong className="block truncate text-body">{renewal.owner.name}</strong><span className="block truncate text-caption text-muted" title={renewal.owner.ens}>{renewal.owner.ens}</span><span className="block text-caption text-muted">{renewal.item} · {renewal.scheduleShort}</span><span className="mt-2 flex flex-wrap gap-1"><StatusChip status={renewal.status} />{regular && <StatusChip status="regular" label={`${copy.status.regular} · ${customerOrders.length}`} />}</span></span>
      <span className="flex shrink-0 flex-col items-end gap-1"><MoneyAmount amount={renewal.amount} /><span className="text-caption text-muted">{renewal.status === 'skipped' ? copy.merchant.renewals.whenOpens : renewal.nextChargeAt ? fill(copy.merchant.renewals.next, { date: formatShortDate(renewal.nextChargeAt) }) : ''}</span>{expanded ? <ChevronUp size={17} aria-hidden /> : <ChevronDown size={17} aria-hidden />}</span>
    </button>
    {expanded && <div className="renewal-history-enter flex flex-col gap-3 border-t border-line p-4">
      <p className="text-caption text-muted">{fill(copy.merchant.renewals.refundsCount, { count: refundCount })}{firstOrder && ` · ${fill(copy.merchant.renewals.firstOrdered, { date: formatDate(firstOrder.createdAt) })}`}</p>
      {renewal.status === 'skipped' && <p className="rounded-input bg-warn/10 p-3 text-caption font-bold text-warn">{copy.status.skipped} · {copy.merchant.renewals.whenOpens}</p>}
      {latest && <div className="rounded-input bg-ok/5 p-3"><p className="text-caption font-bold text-ok">{fill(copy.customer.renewals.chargedOn, { amount: `${latest.amount.amount} USDT`, date: formatDateTime(latest.at) })}</p><div className="mt-2 flex flex-wrap gap-2">{latest.links.map((link, index) => <ExplorerLink key={`${link.url}-${index}`} link={link} />)}</div></div>}
      {customerOrders.length === 0 ? <p className="text-caption text-muted">{copy.merchant.renewals.emptyHint}</p> : customerOrders.map((order) => <div key={order.id} className="rounded-input border border-line p-3"><div className="flex justify-between gap-2"><span className="min-w-0"><strong className="block truncate text-body">#{order.number} · {order.items[0]?.name}</strong><span className="text-caption text-muted">{formatDateTime(order.paidAt ?? order.createdAt)}</span></span><MoneyAmount amount={order.total} /></div><div className="mt-2 flex flex-wrap gap-2">{order.kind === 'renewal' && <StatusChip status="renewal" />}<StatusChip status={order.status} />{order.links.map((link, index) => <ExplorerLink key={`${link.url}-${index}`} link={link} />)}</div></div>)}
    </div>}
  </article>;
}
