import { useEffect, useState } from 'react';
import { ArrowLeft, FileText, Image as ImageIcon, RotateCcw } from 'lucide-react';
import { AgentAvatar, type AgentVisualState } from '@/components/shared/AgentAvatar';
import { AmountEntry } from '@/components/shared/AmountEntry';
import { SegmentedControl } from '@/components/shared/Controls';
import { IosTextInput } from '@/components/shared/IosKeyboard';
import { BottomSheet } from '@/components/shared/Overlays';
import { ExplorerLink, MoneyAmount, StatusChip } from '@/components/shared/Primitives';
import { EmptyState, InlineBanner } from '@/components/shared/States';
import { StatusTracker } from '@/components/shared/StatusTracker';
import { useDemo, useDemoEvents } from '@/demo/DemoProvider';
import type { Money, Order, Refund } from '@/demo/contract';
import { refundableMax } from '@/demo/rules';
import { copy, fill, pick } from '@/copy';
import { formatMoney, isZero } from '@/lib/money';
import { formatDateTime } from '@/lib/time';
import { refundTrackerSteps } from '@/lib/refundTracker';

/** M4 inbox. A detail entry can also be opened directly from M3 without a customer request. */
export function MerchantRefunds({ focusedOrderId, onHome }: { focusedOrderId: string | null; onHome: () => void }) {
  const { snapshot } = useDemo();
  const [selected, setSelected] = useState<{ orderId: string; refundId?: string } | null>(focusedOrderId ? { orderId: focusedOrderId } : null);
  const [emptyLine] = useState(() => pick(copy.merchant.refunds.empty));
  useEffect(() => setSelected(focusedOrderId ? { orderId: focusedOrderId } : null), [focusedOrderId]);
  const entries = (snapshot?.orders ?? []).filter((order) => order.shop.ens === snapshot?.shop.ref.ens).flatMap((order) => order.refunds.map((refund) => ({ order, refund })));
  const selectedOrder = snapshot?.orders.find((order) => order.id === selected?.orderId);
  if (selectedOrder) return <RefundDecision key={`${selectedOrder.id}-${selected?.refundId ?? 'direct'}`} order={selectedOrder} refundId={selected?.refundId} onInbox={() => setSelected(null)} />;
  const waiting = entries.filter((entry) => entry.refund.status === 'requested').sort((a, b) => b.refund.requestedAt - a.refund.requestedAt);
  const done = entries.filter((entry) => entry.refund.status !== 'requested').sort((a, b) => (b.refund.decidedAt ?? 0) - (a.refund.decidedAt ?? 0));
  const storefront = snapshot?.shopAgents.find((agent) => agent.main) ?? snapshot?.shopAgents[0];
  return <div className="flex flex-col gap-4 p-4 pb-8">
    <div><h2 className="font-heading text-title font-bold">{copy.merchant.refunds.title}</h2><p className="text-caption text-muted">{fill(copy.merchant.refunds.waiting, { count: waiting.length })}</p></div>
    {entries.length === 0 ? <div className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface p-6 shadow-card">{storefront && <AgentAvatar agent={storefront.ref} label={storefront.label} size={52} />}<EmptyState title={emptyLine} action={copy.merchant.refunds.backHome} onAction={onHome} /></div> : <>
      {waiting.map(({ order, refund }) => <RefundInboxCard key={refund.id} order={order} refund={refund} onOpen={() => setSelected({ orderId: order.id, refundId: refund.id })} />)}
      {done.length > 0 && <><h3 className="font-heading text-section font-bold">{copy.merchant.refunds.doneHeading}</h3>{done.map(({ order, refund }) => <RefundInboxCard key={refund.id} order={order} refund={refund} onOpen={() => setSelected({ orderId: order.id, refundId: refund.id })} />)}</>}
    </>}
  </div>;
}

function RefundInboxCard({ order, refund, onOpen }: { order: Order; refund: Refund; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className="flex min-h-20 w-full items-start gap-3 rounded-card border border-line bg-surface p-4 text-left shadow-card">
    {refund.photoUrl && refund.photoName?.match(/\.(png|jpe?g|webp|gif|svg)$/i) ? <img src={refund.photoUrl} alt="" className="h-12 w-12 shrink-0 rounded-input object-cover" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-input bg-soft"><FileText size={22} aria-hidden /></span>}
    <span className="min-w-0 flex-1"><strong className="block truncate text-body">{fill(copy.merchant.refunds.asks, { number: order.number, amount: formatMoney(refund.amount) })}</strong><span className="block truncate text-caption text-muted">{order.owner.name} · {order.items[0]?.name}</span><span className="block truncate text-caption text-muted">{refund.reason}</span><span className="mt-1 inline-block"><StatusChip status={refund.status} /></span></span>
    <span className="shrink-0 text-caption text-muted">{formatDateTime(refund.requestedAt)}</span>
  </button>;
}

function RefundDecision({ order, refundId, onInbox }: { order: Order; refundId?: string; onInbox: () => void }) {
  const { adapter, snapshot } = useDemo();
  const refund = refundId ? order.refunds.find((entry) => entry.id === refundId) : order.refunds.at(-1);
  const max = refundableMax(order);
  const actionable = refundId ? refund?.status === 'requested' : refund?.status !== 'accepted' && !isZero(max);
  const [alternate, setAlternate] = useState(false);
  const [mode, setMode] = useState<'full' | 'partial'>('full');
  const [partial, setPartial] = useState<Money | null>(null);
  const [note, setNote] = useState('');
  const [noteSheet, setNoteSheet] = useState(false);
  const [confirm, setConfirm] = useState<'approve' | 'decline' | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [hover, setHover] = useState<AgentVisualState>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAttempt, setLastAttempt] = useState<'approve' | 'decline' | null>(null);
  const agent = snapshot?.shopAgents.find((entry) => entry.main) ?? snapshot?.shopAgents[0];
  const amount = alternate ? mode === 'full' ? max : partial : refund?.status === 'requested' ? refund.amount : max;
  useDemoEvents((event) => {
    if (event.type === 'order.updated' && event.order.id === order.id && event.order.refunds.at(-1)?.status !== 'requested') setBusy(false);
    if (event.type === 'demo.reset') setBusy(false);
  });
  const approve = async () => {
    if (!amount || busy) return;
    setLastAttempt('approve');
    setBusy(true); setError(null); setConfirm(null);
    try { await adapter.approveRefund(order.id, amount); }
    catch (cause) { setBusy(false); setError(cause instanceof Error ? cause.message : copy.common.errorGeneric); }
  };
  const decline = async () => {
    if (!note.trim() || busy || refund?.status !== 'requested') return;
    setLastAttempt('decline');
    setBusy(true); setError(null); setConfirm(null);
    try { await adapter.declineRefund(order.id, note.trim()); }
    catch (cause) { setBusy(false); setError(cause instanceof Error ? cause.message : copy.common.errorGeneric); }
  };
  return <div className="flex flex-col gap-4 p-4 pb-8">
    <button type="button" onClick={onInbox} className="inline-flex min-h-11 items-center gap-2 self-start text-body font-bold text-brand"><ArrowLeft size={17} aria-hidden />{copy.merchant.refunds.title}</button>
    <h2 className="font-heading text-title font-bold">{fill(copy.merchant.order.title, { number: order.number })}</h2>
    <div className="rounded-card border border-line bg-surface p-4 shadow-card"><p className="text-body font-bold">{order.items.map((item) => `${item.name} × ${item.qty}`).join(', ')}</p><p className="text-caption text-muted">{order.shop.name} · {order.owner.name}</p><div className="mt-3 flex items-center gap-2"><AgentAvatar agent={order.buyer} label={order.buyer.role} size={36} /><span className="min-w-0 truncate text-caption" title={order.buyer.ens}>{order.buyer.ens}</span></div><div className="mt-3 flex justify-between border-t border-line pt-3 text-body"><span>{copy.merchant.refunds.paid}</span><MoneyAmount amount={order.total} /></div>{refund && <div className="mt-2 flex justify-between text-body"><span>{copy.merchant.refunds.asked}</span><MoneyAmount amount={refund.amount} /></div>}<div className="mt-2 flex flex-wrap gap-2">{order.links.map((link, index) => <ExplorerLink key={`${link.url}-${index}`} link={link} />)}</div></div>
    {refund ? <><StatusTracker label={copy.merchant.pages.refunds} steps={refundTrackerSteps(refund.status)} /><div className="rounded-card border border-line bg-surface p-4 shadow-card"><div className="flex justify-between gap-2"><strong className="text-body">{copy.merchant.refunds.reason}</strong><StatusChip status={refund.status} /></div><p className="mt-2 text-body">{refund.reason}</p><p className="mt-1 text-caption text-muted">{formatDateTime(refund.requestedAt)}</p>{refund.photoUrl && <button type="button" onClick={() => setPhotoOpen(true)} className="mt-3 flex min-h-11 items-center gap-2 text-body font-bold text-info">{refund.photoName?.match(/\.(png|jpe?g|webp|gif|svg)$/i) ? <img src={refund.photoUrl} alt={refund.photoName} className="h-16 w-16 rounded-input object-cover" /> : <FileText size={22} aria-hidden />}{copy.merchant.refunds.photoAttached}</button>}{refund.photoUrl && <p className="text-caption text-muted">{copy.customer.refund.photoNote}</p>}</div></> : <InlineBanner tone="info">{copy.merchant.refunds.noRequest}</InlineBanner>}
    {!refundId && refund && refund.status !== 'requested' && actionable && <InlineBanner tone="info">{copy.merchant.refunds.noRequest}</InlineBanner>}
    {refund?.status === 'accepted' && <p role="status" className="animate-pulse text-body text-info">{copy.merchant.refunds.settling}</p>}
    {refund?.status === 'refunded' && <div className="rounded-card border border-ok bg-ok/5 p-4"><p className="text-body font-bold text-ok">{fill(copy.merchant.refunds.refundedLine, { amount: formatMoney(refund.amount) })}</p><div className="mt-2 flex flex-wrap gap-2">{refund.links.map((link, index) => <ExplorerLink key={`${link.url}-${index}`} link={link} />)}</div></div>}
    {refund?.status === 'declined' && <InlineBanner tone="bad">{fill(copy.merchant.refunds.declinedLine, { note: refund.note ?? '' })}</InlineBanner>}
    {actionable && <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center gap-2">{agent && <AgentAvatar agent={agent.ref} label={agent.label} activity={hover} size={44} />}<p className="text-caption text-muted">{agent?.label}</p></div>
      {alternate && <><SegmentedControl label={copy.customer.refund.amountLabel} value={mode} onChange={setMode} options={[{ value: 'full', label: copy.customer.refund.full }, { value: 'partial', label: copy.customer.refund.partial }]} />{mode === 'full' ? <div className="flex min-h-11 items-center justify-between rounded-input border border-line p-3 text-body"><span>{copy.customer.refund.full}</span><MoneyAmount amount={max} /></div> : <AmountEntry label={copy.customer.refund.amountLabel} max={max} value={partial} onConfirm={setPartial} onEdit={() => setPartial(null)} agent={agent?.ref} agentLabel={agent?.label} />}</>}
      <button type="button" disabled={!amount || busy} onClick={() => setConfirm('approve')} onPointerEnter={() => setHover('approving')} onPointerLeave={() => setHover('idle')} onPointerDown={() => setHover('approving')} onPointerUp={() => setHover('idle')} className="min-h-11 rounded-full bg-ok px-4 text-body font-bold text-white disabled:opacity-50">{busy ? copy.merchant.refunds.settling : fill(copy.merchant.refunds.approve, { amount: amount ? formatMoney(amount) : '' })}</button>
      <button type="button" onClick={() => setAlternate((value) => !value)} onPointerEnter={() => setHover('approving')} onPointerLeave={() => setHover('idle')} onPointerDown={() => setHover('approving')} onPointerUp={() => setHover('idle')} className="min-h-11 rounded-full border border-line px-4 text-body font-bold text-brand">{copy.merchant.refunds.approveOther}</button>
      {refund?.status === 'requested' && <button type="button" onClick={() => setNoteSheet(true)} onPointerEnter={() => setHover('declining')} onPointerLeave={() => setHover('idle')} onPointerDown={() => setHover('declining')} onPointerUp={() => setHover('idle')} className="min-h-11 rounded-full px-4 text-body font-bold text-bad">{copy.merchant.refunds.decline}</button>}
    </div>}
    {error && <InlineBanner tone="bad"><span>{error}</span>{lastAttempt && <button type="button" onClick={() => void (lastAttempt === 'approve' ? approve() : decline())} className="ml-2 inline-flex items-center gap-1 font-bold underline"><RotateCcw size={13} aria-hidden />{copy.common.retry}</button>}</InlineBanner>}
    <BottomSheet open={noteSheet} title={copy.merchant.refunds.declineTitle} onClose={() => setNoteSheet(false)} actions={<button type="button" disabled={!note.trim()} onClick={() => { setNoteSheet(false); setConfirm('decline'); }} className="min-h-11 rounded-full bg-bad px-4 text-body font-bold text-white disabled:opacity-50">{copy.merchant.refunds.sendDecline}</button>}><IosTextInput label={copy.merchant.refunds.declineTitle} value={note} onChange={setNote} multiline placeholder={copy.merchant.refunds.notePlaceholder} returnLabel={copy.common.done} onDone={() => {}} /><p className="mt-2 text-caption text-muted">{copy.merchant.refunds.noteRequired}</p></BottomSheet>
    <BottomSheet open={confirm !== null} title={confirm === 'approve' ? copy.merchant.refunds.approveOther : copy.merchant.refunds.declineTitle} onClose={() => setConfirm(null)} actions={<button type="button" onClick={() => void (confirm === 'approve' ? approve() : decline())} className="min-h-11 rounded-full bg-brand px-4 text-body font-bold text-white">{copy.common.confirm}</button>}><p className="text-body">{confirm === 'approve' && amount ? fill(copy.merchant.refunds.confirmApprove, { amount: formatMoney(amount), buyer: order.owner.name }) : fill(copy.merchant.refunds.confirmDecline, {})}</p>{confirm === 'decline' && <p className="mt-2 rounded-input bg-surface p-3 text-body">{note}</p>}</BottomSheet>
    <BottomSheet open={photoOpen} title={copy.merchant.refunds.photoAttached} onClose={() => setPhotoOpen(false)}>{refund?.photoUrl && refund.photoName?.match(/\.(png|jpe?g|webp|gif|svg)$/i) ? <img src={refund.photoUrl} alt={refund.photoName} className="max-h-[50vh] w-full object-contain" /> : refund?.photoUrl ? <a href={refund.photoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-info underline"><ImageIcon size={18} aria-hidden />{refund.photoName}</a> : null}</BottomSheet>
  </div>;
}
