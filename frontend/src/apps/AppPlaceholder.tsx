import { useState } from 'react';
import { AppShell, useAppNavigation, type AppPage } from '@/components/shared/AppShell';
import { BottomSheet, IosActionSheet, IosPicker } from '@/components/shared/Overlays';
import { SegmentedControl, Switch } from '@/components/shared/Controls';
import { Countdown, ExplorerLink, MoneyAmount, ReceiptCard, StatusChip } from '@/components/shared/Primitives';
import { EmptyState, ErrorState, InlineBanner, LoadingState, Skeleton, Toast } from '@/components/shared/States';
import { useDemo } from '@/demo/DemoProvider';
import { story } from '@/data/story';
import { copy, fill } from '@/copy';
import { formatMoney, usdt } from '@/lib/money';
import { orderChip } from '@/demo/rules';
import { usePreviewState, setPreviewState } from '@/dev/StateSwitcher';
import { IosTextInput } from '@/components/shared/IosKeyboard';
import { AmountEntry } from '@/components/shared/AmountEntry';
import { AgentAvatar } from '@/components/shared/AgentAvatar';
import { Mascot, type FoxPose } from '@/components/shared/Mascot';
import { StatusTracker } from '@/components/shared/StatusTracker';
import { useSoundPreference } from '@/components/shared/SoundPreference';
import type { Money } from '@/demo/contract';
import { CustomerJourneyProvider, useCustomerJourney } from './customer/CustomerJourneyProvider';
import { CustomerDesk } from './customer/CustomerDesk';
import { CustomerQuoteSheet } from './customer/CustomerQuoteSheet';
import { CustomerOrders } from './customer/CustomerOrders';
import { RefundWizard } from './customer/RefundWizard';
import { MerchantHome } from './merchant/MerchantHome';
import { MerchantOrderDetail } from './merchant/MerchantOrderDetail';
import { MerchantRefunds } from './merchant/MerchantRefunds';

const customerPages: AppPage[] = [
  { id: 'desk', label: copy.customer.pages.desk },
  { id: 'orders', label: copy.customer.pages.orders },
  { id: 'refund', label: copy.customer.pages.refund },
  { id: 'renewals', label: copy.customer.pages.renewals },
  { id: 'agents', label: copy.customer.pages.agents },
];
const merchantPages: AppPage[] = [
  { id: 'home', label: copy.merchant.pages.home },
  { id: 'refunds', label: copy.merchant.pages.refunds },
  { id: 'renewals', label: copy.merchant.pages.renewals },
  { id: 'payouts', label: copy.merchant.pages.payouts },
  { id: 'order-detail', label: copy.merchant.order.title.replace('{number}', ''), hidden: true },
];

/** F3 scaffold: navigation and state previews are real; journey pages follow in F5–F10. */
export function AppPlaceholder({ app }: { app: 'customer' | 'merchant' }) {
  const { snapshot, generation } = useDemo();
  const { muted } = useSoundPreference();
  const [selectedMerchantOrder, setSelectedMerchantOrder] = useState<string | null>(null);
  const [merchantRefundFocus, setMerchantRefundFocus] = useState<string | null>(null);
  const cap = snapshot?.agents.find((agent) => agent.pass && agent.ref.role === story.spendingPass.payingRole)?.pass?.cap.amount;
  if (app === 'customer') return <CustomerJourneyProvider key={generation}><CustomerShell subtitle={cap ? fill(copy.customer.desk.subtitle, { cap }) : undefined} /></CustomerJourneyProvider>;
  const subtitle = snapshot?.shop.open ? muted ? copy.merchant.home.subtitleOpenMuted : copy.merchant.home.subtitleOpen : copy.merchant.home.subtitleClosed;
  const selectedOrder = snapshot?.orders.find((order) => order.id === selectedMerchantOrder);
  return <AppShell app="merchant" pages={merchantPages} homeTitle={story.shop.name} subtitle={subtitle}
    onMenuNavigate={(page) => { if (page === 'refunds') setMerchantRefundFocus(null); }}
    getPageTitle={(page) => page === 'order-detail' && selectedOrder ? fill(copy.merchant.order.title, { number: selectedOrder.number }) : undefined}
    getPageSubtitle={(page) => page === 'order-detail' && selectedOrder ? fill(copy.merchant.order.via, { owner: selectedOrder.owner.name, agent: selectedOrder.buyer.role }) : undefined}
    renderPage={(page) => page === 'home' || page === 'order-detail' || page === 'refunds' ? <MerchantRoute page={page} selectedOrder={selectedMerchantOrder} refundFocus={merchantRefundFocus} onSelectOrder={setSelectedMerchantOrder} onRefundFocus={setMerchantRefundFocus} /> : <PlaceholderPage app="merchant" page={page} pages={merchantPages} />} />;
}

function CustomerShell({ subtitle }: { subtitle?: string }) {
  const { selectOrder } = useCustomerJourney();
  return <AppShell app="customer" pages={customerPages} homeTitle={story.customer.name} subtitle={subtitle}
    onMenuNavigate={(page) => { if (page === 'orders' || page === 'refund') selectOrder(null); }}
    renderPage={(page) => <><PlaceholderPage app="customer" page={page} pages={customerPages} /><LiveQuoteSheet /></>} />;
}

function MerchantRoute({ page, selectedOrder, refundFocus, onSelectOrder, onRefundFocus }: { page: string; selectedOrder: string | null; refundFocus: string | null; onSelectOrder: (id: string) => void; onRefundFocus: (id: string | null) => void }) {
  const { adapter } = useDemo();
  const navigate = useAppNavigation();
  if (page === 'order-detail') return <MerchantOrderDetail orderId={selectedOrder} onRefund={() => { onRefundFocus(selectedOrder); navigate('refunds'); }} />;
  if (page === 'refunds') return <MerchantRefunds focusedOrderId={refundFocus} onHome={() => navigate('home')} />;
  return <MerchantHome onOrderDetails={(id) => { onSelectOrder(id); void adapter.markOrderSeen?.(id); navigate('order-detail'); }} />;
}

function LiveQuoteSheet() {
  const preview = usePreviewState();
  return preview === 'live' ? <CustomerQuoteSheet /> : null;
}

function PlaceholderPage({ app, page, pages }: { app: 'customer' | 'merchant'; page: string; pages: AppPage[] }) {
  const { snapshot, adapter } = useDemo();
  const navigate = useAppNavigation();
  const preview = usePreviewState();
  const orders = snapshot?.orders.filter((order) => app === 'customer' ? order.owner.ens === story.customer.ens : order.status !== 'ordered') ?? [];
  const home = page === pages[0]?.id;
  const pageLabel = pages.find((item) => item.id === page)?.label ?? page;

  if (preview === 'loading' || (!snapshot && preview === 'live')) return <LoadingState />;
  if (preview === 'empty') return <div className="p-4"><EmptyState title={copy.dev.emptyTitle} detail={copy.dev.emptyDetail} action={copy.dev.backHome} onAction={() => navigate(pages[0]!.id)} /></div>;
  if (preview === 'error') return <div className="p-4"><ErrorState onRetry={() => setPreviewState('live')} /></div>;
  if (preview === 'refused') return <div className="flex flex-col gap-3 p-4"><ErrorState message={`${copy.dev.refusedTitle}: ${copy.dev.refusedDetail}`} recoverable={false} /><ExplorerLink link={sampleLink} /></div>;
  if (preview === 'success') return <div className="p-4"><ReceiptCard title={`${pageLabel}: ${copy.dev.successTitle}`} amount={usdt('4.00')} rows={[{ label: copy.customer.quote.total, value: <MoneyAmount amount={usdt('4.00')} /> }]} links={[sampleLink]} footer={copy.common.cannotBeEdited} /></div>;
  if (preview === 'components') return <ComponentGallery />;
  if (app === 'customer' && page === 'desk') return <CustomerDesk />;
  if (app === 'customer' && page === 'orders') return <CustomerOrders />;
  if (app === 'customer' && page === 'refund') return <RefundWizard />;

  return <div className="flex flex-col gap-3 px-4 pt-4 pb-8">
    <p className="rounded-card border border-line bg-surface p-4 text-body text-muted shadow-card">{copy.placeholder[app]}</p>
    {home && app === 'merchant' && snapshot && <button type="button" className="min-h-11 rounded-full bg-brand px-4 text-body font-bold text-white" onClick={() => void adapter.setShopOpen(!snapshot.shop.open)}>{snapshot.shop.open ? copy.merchant.home.toggleOpen : copy.merchant.home.toggleClosed}</button>}
    {home && <ul className="flex flex-col gap-2">{[...orders].reverse().map((order) => <li key={order.id} className="flex items-center justify-between gap-2 rounded-card border border-line bg-surface px-4 py-3 shadow-card"><span className="text-body">#{order.number} {order.items[0]?.name}</span><span className="tabular text-caption text-muted">{formatMoney(order.total)} · {orderChip(order)}</span></li>)}</ul>}
    {!home && <EmptyState title={pageLabel} detail={copy.dev.emptyDetail} action={copy.dev.backHome} onAction={() => navigate(pages[0]!.id)} />}
  </div>;
}

const sampleLink = { label: copy.common.viewTx, url: 'mock:preview', mock: true } as const;

/** A reachable dev gallery for verifying each F3 piece before journey pages exist. */
function ComponentGallery() {
  const { snapshot } = useDemo();
  const sound = useSoundPreference();
  const [sheet, setSheet] = useState(false);
  const [actions, setActions] = useState(false);
  const [picker, setPicker] = useState<'daily' | 'weekly'>('daily');
  const [segment, setSegment] = useState<'full' | 'partial'>('full');
  const [checked, setChecked] = useState(true);
  const [toast, setToast] = useState(false);
  const [deadline] = useState(() => Date.now() + 90_000);
  const [text, setText] = useState('');
  const [amount, setAmount] = useState<Money | null>(null);
  const [progress, setProgress] = useState(1);
  const [foxPose, setFoxPose] = useState<FoxPose>('idle');
  const agent = snapshot?.agents[0];
  return <div className="flex flex-col gap-4 p-4 pb-12">
    <h2 className="font-heading text-section font-bold">{copy.dev.componentTitle}</h2>
    <div className="flex flex-wrap gap-2">{(['thinking', 'checked', 'quoted', 'paid', 'refused', 'idle', 'active', 'paused', 'revoked', 'usedUp', 'expired'] as const).map((status) => <StatusChip key={status} status={status} />)}</div>
    <div className="flex items-center justify-between rounded-card border border-line bg-surface p-4"><MoneyAmount amount={usdt('4.00')} large /><Countdown until={deadline} /></div>
    <ReceiptCard title={copy.dev.successTitle} amount={usdt('4.00')} status="paid" links={[sampleLink]} footer={copy.common.cannotBeEdited} />
    <InlineBanner tone="info">{copy.common.mockLinkNote}</InlineBanner>
    <IosPicker label={copy.dev.pickerLabel} value={picker} options={[{ value: 'daily', label: copy.customer.renewals.frequencies.daily }, { value: 'weekly', label: copy.customer.renewals.frequencies.weekly }]} onChange={setPicker} />
    <SegmentedControl label={copy.dev.segmentLabel} options={[{ value: 'full', label: copy.dev.segmentOne }, { value: 'partial', label: copy.dev.segmentTwo }]} value={segment} onChange={setSegment} />
    <div className="flex items-center justify-between text-body"><span>{copy.dev.switchLabel}</span><Switch label={copy.dev.switchLabel} checked={checked} onChange={setChecked} /></div>
    <StatusTracker label={copy.dev.trackerLabel} steps={[copy.status.ordered, copy.status.paid, copy.status.dispatched, copy.status.delivered].map((label, index) => ({ id: label, label, state: index < progress ? 'done' as const : index === progress ? 'current' as const : 'todo' as const }))} />
    <button type="button" className="min-h-11 rounded-full border border-line px-4 text-body font-bold" onClick={() => setProgress((value) => (value + 1) % 5)}>{copy.dev.advanceTracker}</button>
    <IosTextInput label={copy.dev.textLabel} value={text} onChange={setText} onDone={() => setToast(true)} canDone={text.trim().length > 0} placeholder={copy.customer.desk.composerPlaceholder} returnLabel={copy.customer.desk.send} />
    <AmountEntry label={copy.customer.refund.amountLabel} max={usdt('4.00')} value={amount} onConfirm={setAmount} agent={agent?.ref} agentLabel={agent?.label} />
    {agent && <div className="flex items-center gap-3"><AgentAvatar agent={agent.ref} label={agent.label} status={agent.status} activity="thinking" /><span className="text-body">{agent.label}</span></div>}
    <div className="flex flex-col items-center gap-2"><Mascot size={160} previewPose={foxPose} /><SegmentedControl label={copy.dev.foxLabel} options={[{ value: 'idle', label: copy.dev.foxIdle }, { value: 'wave', label: copy.dev.foxWave }, { value: 'smile', label: copy.dev.foxSmile }, { value: 'squint', label: copy.dev.foxSquint }]} value={foxPose} onChange={setFoxPose} /></div>
    <div className="flex flex-wrap gap-2"><button type="button" className="min-h-11 rounded-full border border-line px-4 text-body font-bold" onClick={sound.playWee}>{copy.dev.playWee}</button><button type="button" className="min-h-11 rounded-full border border-line px-4 text-body font-bold" onClick={sound.playCashRegister}>{copy.dev.playCashRegister}</button><button type="button" className="min-h-11 rounded-full border border-line px-4 text-body font-bold" onClick={sound.playChime}>{copy.dev.playChime}</button></div>
    <div className="flex flex-wrap gap-2"><button className="min-h-11 rounded-full bg-brand px-4 text-body font-bold text-white" onClick={() => setSheet(true)}>{copy.dev.showSheet}</button><button className="min-h-11 rounded-full border border-line px-4 text-body font-bold" onClick={() => setActions(true)}>{copy.dev.showActions}</button><button className="min-h-11 rounded-full border border-line px-4 text-body font-bold" onClick={() => setToast(true)}>{copy.dev.showToast}</button></div>
    <Skeleton className="h-12 w-full" /><LoadingState /><EmptyState title={copy.dev.emptyTitle} /><ErrorState onRetry={() => setToast(true)} />
    <BottomSheet open={sheet} title={copy.dev.sheetTitle} onClose={() => setSheet(false)} actions={<button className="min-h-11 rounded-full bg-brand px-4 text-body font-bold text-white" onClick={() => setSheet(false)}>{copy.common.confirm}</button>}>{copy.dev.sheetBody}</BottomSheet>
    <IosActionSheet open={actions} title={copy.dev.actionTitle} onClose={() => setActions(false)} actions={[{ label: copy.dev.actionOne, onClick: () => setToast(true) }, { label: copy.dev.actionTwo, onClick: () => setToast(true) }]} />
    {toast && <Toast message={copy.dev.toastText} onClose={() => setToast(false)} />}
  </div>;
}
