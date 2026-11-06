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
];

/** F3 scaffold: navigation and state previews are real; journey pages follow in F5–F10. */
export function AppPlaceholder({ app }: { app: 'customer' | 'merchant' }) {
  const { snapshot } = useDemo();
  const pages = app === 'customer' ? customerPages : merchantPages;
  const title = app === 'customer' ? story.customer.name : story.shop.name;
  const cap = snapshot?.agents.find((agent) => agent.pass && agent.ref.role === story.spendingPass.payingRole)?.pass?.cap.amount;
  const subtitle = app === 'customer' && cap ? fill(copy.customer.desk.subtitle, { cap }) : undefined;
  return <AppShell app={app} pages={pages} homeTitle={title} subtitle={subtitle} renderPage={(page) => <PlaceholderPage app={app} page={page} pages={pages} />} />;
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

  return <div className="flex flex-col gap-3 px-4 pt-4 pb-8">
    <p className="rounded-card border border-line bg-surface p-4 text-body text-muted shadow-card">{copy.placeholder[app]}</p>
    {home && app === 'merchant' && snapshot && <button type="button" className="min-h-11 rounded-full bg-brand px-4 text-body font-bold text-white" onClick={() => void adapter.setShopOpen(!snapshot.shop.open)}>{snapshot.shop.open ? copy.merchant.home.toggleOpen : copy.merchant.home.toggleClosed}</button>}
    {home && app === 'customer' && snapshot && <button type="button" className="min-h-11 rounded-full bg-brand px-4 text-body font-bold text-white disabled:opacity-50" disabled={snapshot.errandRunning} onClick={() => void adapter.sendPrompt(story.quickPrompts[0]!.text)}>{story.quickPrompts[0]!.text}</button>}
    {home && <ul className="flex flex-col gap-2">{[...orders].reverse().map((order) => <li key={order.id} className="flex items-center justify-between gap-2 rounded-card border border-line bg-surface px-4 py-3 shadow-card"><span className="text-body">#{order.number} {order.items[0]?.name}</span><span className="tabular text-caption text-muted">{formatMoney(order.total)} · {orderChip(order)}</span></li>)}</ul>}
    {!home && <EmptyState title={pageLabel} detail={copy.dev.emptyDetail} action={copy.dev.backHome} onAction={() => navigate(pages[0]!.id)} />}
  </div>;
}

const sampleLink = { label: copy.common.viewTx, url: 'mock:preview', mock: true } as const;

/** A reachable dev gallery for verifying each F3 piece before journey pages exist. */
function ComponentGallery() {
  const [sheet, setSheet] = useState(false);
  const [actions, setActions] = useState(false);
  const [picker, setPicker] = useState<'daily' | 'weekly'>('daily');
  const [segment, setSegment] = useState<'full' | 'partial'>('full');
  const [checked, setChecked] = useState(true);
  const [toast, setToast] = useState(false);
  const [deadline] = useState(() => Date.now() + 90_000);
  return <div className="flex flex-col gap-4 p-4 pb-12">
    <h2 className="font-heading text-section font-bold">{copy.dev.componentTitle}</h2>
    <div className="flex flex-wrap gap-2">{(['thinking', 'checked', 'quoted', 'paid', 'refused', 'idle', 'active', 'paused', 'revoked', 'usedUp', 'expired'] as const).map((status) => <StatusChip key={status} status={status} />)}</div>
    <div className="flex items-center justify-between rounded-card border border-line bg-surface p-4"><MoneyAmount amount={usdt('4.00')} large /><Countdown until={deadline} /></div>
    <ReceiptCard title={copy.dev.successTitle} amount={usdt('4.00')} status="paid" links={[sampleLink]} footer={copy.common.cannotBeEdited} />
    <InlineBanner tone="info">{copy.common.mockLinkNote}</InlineBanner>
    <IosPicker label={copy.dev.pickerLabel} value={picker} options={[{ value: 'daily', label: copy.customer.renewals.frequencies.daily }, { value: 'weekly', label: copy.customer.renewals.frequencies.weekly }]} onChange={setPicker} />
    <SegmentedControl label={copy.dev.segmentLabel} options={[{ value: 'full', label: copy.dev.segmentOne }, { value: 'partial', label: copy.dev.segmentTwo }]} value={segment} onChange={setSegment} />
    <div className="flex items-center justify-between text-body"><span>{copy.dev.switchLabel}</span><Switch label={copy.dev.switchLabel} checked={checked} onChange={setChecked} /></div>
    <div className="flex flex-wrap gap-2"><button className="min-h-11 rounded-full bg-brand px-4 text-body font-bold text-white" onClick={() => setSheet(true)}>{copy.dev.showSheet}</button><button className="min-h-11 rounded-full border border-line px-4 text-body font-bold" onClick={() => setActions(true)}>{copy.dev.showActions}</button><button className="min-h-11 rounded-full border border-line px-4 text-body font-bold" onClick={() => setToast(true)}>{copy.dev.showToast}</button></div>
    <Skeleton className="h-12 w-full" /><LoadingState /><EmptyState title={copy.dev.emptyTitle} /><ErrorState onRetry={() => setToast(true)} />
    <BottomSheet open={sheet} title={copy.dev.sheetTitle} onClose={() => setSheet(false)} actions={<button className="min-h-11 rounded-full bg-brand px-4 text-body font-bold text-white" onClick={() => setSheet(false)}>{copy.common.confirm}</button>}>{copy.dev.sheetBody}</BottomSheet>
    <IosActionSheet open={actions} title={copy.dev.actionTitle} onClose={() => setActions(false)} actions={[{ label: copy.dev.actionOne, onClick: () => setToast(true) }, { label: copy.dev.actionTwo, onClick: () => setToast(true) }]} />
    {toast && <Toast message={copy.dev.toastText} onClose={() => setToast(false)} />}
  </div>;
}
