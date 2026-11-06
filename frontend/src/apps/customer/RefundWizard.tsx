import { useEffect, useRef, useState } from 'react';
import { FileText, ImagePlus, LockKeyhole, RotateCcw } from 'lucide-react';
import { AmountEntry } from '@/components/shared/AmountEntry';
import { useAppNavigation } from '@/components/shared/AppShell';
import { SegmentedControl } from '@/components/shared/Controls';
import { IosTextInput } from '@/components/shared/IosKeyboard';
import { IosActionSheet } from '@/components/shared/Overlays';
import { ExplorerLink, MoneyAmount, StatusChip } from '@/components/shared/Primitives';
import { EmptyState, InlineBanner, Skeleton } from '@/components/shared/States';
import { StatusTracker } from '@/components/shared/StatusTracker';
import { useDemo } from '@/demo/DemoProvider';
import { canRequestRefund, refundableMax } from '@/demo/rules';
import type { Money, Order, Refund } from '@/demo/contract';
import { story } from '@/data/story';
import { copy, fill, pick } from '@/copy';
import { formatMoney } from '@/lib/money';
import { refundTrackerSteps } from '@/lib/refundTracker';
import { canSubmitRefund, validRefundFile } from './refundFlow';
import { useCustomerJourney } from './CustomerJourneyProvider';

export function RefundWizard() {
  const { snapshot } = useDemo();
  const { state, selectOrder } = useCustomerJourney();
  const navigate = useAppNavigation();
  const [emptyLine] = useState(() => pick(copy.customer.refund.noEligible));
  const orders = (snapshot?.orders ?? []).filter((order) => order.owner.ens === story.customer.ens);
  const order = orders.find((entry) => entry.id === state.selectedOrderId);
  if (!order) return <div className="flex flex-col gap-3 p-4"><h2 className="font-heading text-section font-bold">{copy.customer.refund.pickOrder}</h2><p className="text-caption text-muted">{copy.customer.refund.pickOrderHint}</p>{orders.filter((entry) => canRequestRefund(entry).ok).length === 0 ? <EmptyState title={emptyLine} action={copy.customer.orders.title} onAction={() => navigate('orders')} /> : orders.filter((entry) => canRequestRefund(entry).ok).map((entry) => <button key={entry.id} type="button" onClick={() => selectOrder(entry.id)} className="flex min-h-16 items-center justify-between gap-2 rounded-card border border-line bg-surface p-4 text-left shadow-card"><span><strong className="block text-body">{entry.items[0]?.name}</strong><span className="text-caption text-muted">{entry.shop.name}</span></span><MoneyAmount amount={entry.total} /></button>)}</div>;
  return <RefundForm key={order.id} order={order} onBack={() => navigate('orders')} />;
}

function RefundForm({ order, onBack }: { order: Order; onBack: () => void }) {
  const { adapter } = useDemo();
  const [mode, setMode] = useState<'full' | 'partial'>('full');
  const [partial, setPartial] = useState<Money | null>(null);
  const [reasonDraft, setReasonDraft] = useState('');
  const [reasonConfirmed, setReasonConfirmed] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const latest = order.refunds.at(-1);
  const viewingStatus = submitted || (latest && latest.status !== 'declined' && !canRequestRefund(order).ok);
  const max = refundableMax(order);
  const amount = mode === 'full' ? max : partial;
  const payer = order.buyer;

  useEffect(() => {
    if (!photo || !photo.type.startsWith('image/')) { setPhotoPreview(null); return; }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const chosenFile = (file?: File) => {
    if (!file) return;
    if (!validRefundFile(file)) { setFileError(fill(copy.customer.refund.fileRejected, { max: 10 })); return; }
    setFileError(null); setPhoto(file);
  };
  const submit = async () => {
    if (!canSubmitRefund(order, amount, reasonDraft, reasonConfirmed, photo) || !amount || !photo || sending) return;
    setSending(true); setError(null);
    try { await adapter.requestRefund(order.id, { amount, reason: reasonDraft.trim(), photo }); setSubmitted(true); }
    catch (cause) { setSending(false); setError(cause instanceof Error ? cause.message : copy.common.errorGeneric); }
  };
  return <div className="flex flex-col gap-4 p-4 pb-8">
    <div><h2 className="font-heading text-title font-bold">{copy.customer.refund.title}</h2><p className="text-body text-muted">{order.items.map((item) => `${item.name} × ${item.qty}`).join(', ')} · {formatMoney(order.total)}</p></div>
    <StatusTracker label={copy.customer.orders.refundHeading} steps={refundTrackerSteps(latest?.status)} />
    {viewingStatus ? <RefundStatus order={order} refund={latest} onBack={onBack} /> : <>
      <SegmentedControl label={copy.customer.refund.amountLabel} value={mode} onChange={setMode} options={[{ value: 'full', label: copy.customer.refund.full }, { value: 'partial', label: copy.customer.refund.partial }]} />
      {mode === 'full' ? <div className="flex min-h-11 items-center justify-between gap-2 rounded-input border border-line bg-surface p-3 text-body"><span>{copy.customer.refund.amountLabel}</span><span className="flex items-center gap-1 font-bold"><LockKeyhole size={15} aria-hidden /><MoneyAmount amount={max} /></span></div> : <AmountEntry label={copy.customer.refund.amountLabel} max={max} value={partial} onConfirm={setPartial} onEdit={() => setPartial(null)} agent={payer} agentLabel={payer.role} />}
      {amount && <div className="flex flex-col gap-2">{reasonConfirmed ? <div className="flex min-h-11 items-center justify-between gap-2 rounded-input border border-line bg-surface p-3 text-body"><span className="min-w-0"><span className="text-muted">{copy.customer.refund.reasonLabel}: </span>{reasonDraft}</span><button type="button" onClick={() => setReasonConfirmed(false)} className="shrink-0 font-bold text-info">{copy.common.edit}</button></div> : <><IosTextInput label={copy.customer.refund.reasonLabel} value={reasonDraft} onChange={setReasonDraft} onDone={() => { if (reasonDraft.trim()) setReasonConfirmed(true); }} canDone={Boolean(reasonDraft.trim())} returnLabel={copy.common.done} placeholder={copy.customer.refund.reasonPlaceholder} /><button type="button" disabled={!reasonDraft.trim()} onClick={() => setReasonConfirmed(true)} className="min-h-11 self-end rounded-full border border-brand px-4 text-body font-bold text-brand disabled:opacity-50">{copy.common.done}</button></>}</div>}
      {amount && reasonConfirmed && <div className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4 shadow-card"><h3 className="font-heading text-section font-bold">{copy.customer.refund.photoTitle}</h3><p className="text-caption text-muted">{copy.customer.refund.photoNote}</p>{photo ? <div className="flex items-center gap-3">{photoPreview ? <img src={photoPreview} alt={photo.name} className="h-20 w-20 rounded-input object-cover" /> : <FileText size={32} className="text-info" aria-hidden />}<span className="min-w-0 flex-1 truncate text-caption">{photo.name}</span></div> : <ImagePlus size={28} className="text-muted" aria-hidden />}<div className="flex gap-2"><button type="button" onClick={() => setSheetOpen(true)} className="min-h-11 rounded-full border border-brand px-4 text-body font-bold text-brand">{photo ? copy.customer.refund.replace : copy.customer.refund.photoTitle}</button>{photo && <button type="button" onClick={() => setPhoto(null)} className="min-h-11 rounded-full px-4 text-body font-bold text-bad">{copy.customer.refund.remove}</button>}</div>{fileError && <InlineBanner tone="bad">{fileError}</InlineBanner>}</div>}
      <input ref={photoInput} type="file" accept="image/*" className="sr-only" aria-label={copy.customer.refund.choosePhotos} onChange={(event) => { chosenFile(event.target.files?.[0]); event.target.value = ''; }} />
      <input ref={filesInput} type="file" accept="image/*,.pdf,application/pdf" className="sr-only" aria-label={copy.customer.refund.chooseFiles} onChange={(event) => { chosenFile(event.target.files?.[0]); event.target.value = ''; }} />
      <IosActionSheet open={sheetOpen} title={copy.customer.refund.photoTitle} onClose={() => setSheetOpen(false)} actions={[{ label: copy.customer.refund.choosePhotos, onClick: () => photoInput.current?.click() }, { label: copy.customer.refund.chooseFiles, onClick: () => filesInput.current?.click() }]} />
      {error && <InlineBanner tone="bad"><span>{error}</span><button type="button" onClick={() => void submit()} className="ml-2 inline-flex items-center gap-1 font-bold underline"><RotateCcw size={13} aria-hidden />{copy.common.retry}</button></InlineBanner>}
      <button type="button" onClick={() => void submit()} disabled={!canSubmitRefund(order, amount, reasonDraft, reasonConfirmed, photo) || sending} className="min-h-11 rounded-full bg-brand px-4 text-body font-bold text-white disabled:opacity-50">{sending ? `${copy.customer.refund.submit}…` : copy.customer.refund.submit}</button>
    </>}
  </div>;
}

function RefundStatus({ order, refund, onBack }: { order: Order; refund?: Refund; onBack: () => void }) {
  return <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 shadow-card">
    {!refund ? <><Skeleton className="h-16 w-full" /><p role="status" className="text-body text-warn">{copy.customer.refund.waiting}</p></> : <>
      <div className="flex items-center justify-between gap-2"><StatusChip status={refund.status} /><MoneyAmount amount={refund.amount} /></div>
      <p className="text-body">{refund.reason}</p>
      {refund.photoUrl && refund.photoName && refund.photoName.match(/\.(png|jpe?g|webp|gif|svg)$/i) && <img src={refund.photoUrl} alt={refund.photoName} className="max-h-40 w-full rounded-input object-contain" />}
      {refund.photoName && <p className="text-caption text-muted">{refund.photoName}</p>}
      {refund.status === 'requested' && <p role="status" className="animate-pulse text-body text-warn">{copy.customer.refund.waiting}</p>}
      {refund.status === 'accepted' && <p role="status" className="animate-pulse text-body text-info">{copy.customer.refund.accepted}</p>}
      {refund.status === 'refunded' && <><p className="text-body font-bold text-ok">{fill(copy.customer.refund.refunded, { amount: formatMoney(refund.amount) })}</p><div className="flex flex-wrap gap-2">{refund.links.map((link, index) => <ExplorerLink key={`${link.url}-${index}`} link={link} />)}</div></>}
      {refund.status === 'declined' && <div className="rounded-input bg-bad/10 p-3 text-body text-bad"><strong className="block">{copy.customer.refund.declined}</strong>{fill(copy.customer.orders.declinedNote, { note: refund.note ?? '' })} · {order.shop.name}</div>}
    </>}
    <button type="button" onClick={onBack} className="min-h-11 rounded-full bg-brand px-4 text-body font-bold text-white">{copy.customer.refund.backToOrders}</button>
  </div>;
}
