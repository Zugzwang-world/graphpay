import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, Coins, X } from 'lucide-react';
import { AgentAvatar } from '@/components/shared/AgentAvatar';
import { useAppNavigation } from '@/components/shared/AppShell';
import { usePhoneLayer } from '@/components/stage/PhoneFrame';
import { Countdown, ExplorerLink, MoneyAmount, ReceiptCard, StatusChip } from '@/components/shared/Primitives';
import { InlineBanner, Skeleton } from '@/components/shared/States';
import { Photo, dishPhoto } from '@/components/shared/Photo';
import { useDemo } from '@/demo/DemoProvider';
import { story } from '@/data/story';
import { copy, fill } from '@/copy';
import { formatMoney } from '@/lib/money';
import { useCustomerJourney } from './CustomerJourneyProvider';

/** C3 appears automatically on quote.created; every phase comes from adapter events. */
export function CustomerQuoteSheet() {
  const layer = usePhoneLayer();
  const { snapshot } = useDemo();
  const navigate = useAppNavigation();
  const { state, setSheetOpen, selectOrder } = useCustomerJourney();
  const quote = state.quote;
  const [expired, setExpired] = useState(false);
  const validUntil = quote?.event.validUntil;
  useEffect(() => setExpired(false), [validUntil]);
  useEffect(() => {
    if (!state.sheetOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setSheetOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.sheetOpen, setSheetOpen]);
  if (!layer || !quote || !state.sheetOpen) return null;

  const { event, phase, links, failure } = quote;
  const payer = snapshot?.agents.find((agent) => agent.ref.role === story.spendingPass.payingRole);
  const storefront = snapshot?.shopAgents.find((agent) => agent.main) ?? snapshot?.shopAgents[0];
  const viewOrder = () => { selectOrder(event.orderId); navigate('orders'); };
  return createPortal(<div className="absolute inset-x-0 top-[118px] bottom-0 z-20">
    <section role="dialog" aria-label={fill(copy.customer.quote.title, { shop: event.shop.name })} className="quote-sheet-enter flex h-full flex-col overflow-hidden rounded-t-sheet bg-bg shadow-sheet">
      <div className="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-4 py-3">
        <h2 className="min-w-0 flex-1 font-heading text-title font-bold">{fill(copy.customer.quote.title, { shop: event.shop.name })}</h2>
        <button type="button" onClick={() => setSheetOpen(false)} aria-label={copy.common.close} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted"><X size={20} aria-hidden /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-8">
        <div className="mb-4 flex items-center justify-between gap-2 text-caption"><StatusChip status={phase === 'paid' ? 'paid' : phase === 'failed' ? 'refused' : 'quoted'} />{phase !== 'paid' && phase !== 'failed' && <span className="text-muted">{expired ? copy.customer.quote.expiredRequoting : <>{copy.customer.quote.validFor.replace('{time}', '')}<Countdown until={event.validUntil} onExpire={() => setExpired(true)} /></>}</span>}</div>
        {expired && phase === 'quoted' ? <div role="status" className="flex flex-col gap-3 rounded-card border border-info bg-surface p-4"><p className="text-body text-info">{copy.customer.quote.expiredRequoting}</p><Skeleton className="h-20 w-full" /></div> : <article className="rounded-card border border-info bg-surface p-4 shadow-card">
          <div className="mb-3 flex items-center gap-2">{storefront && <AgentAvatar agent={storefront.ref} label={storefront.label} size={36} />}<div><Photo src={dishPhoto(event.shop.ens)} className="h-14 w-14 shrink-0 rounded-input object-cover" /><p className="font-heading text-section font-bold">{event.shop.name}</p><p className="text-caption text-muted">{storefront?.label}</p></div></div>
          <div className="flex flex-col gap-2 border-t border-line py-3 text-body">{event.items.map((item, index) => <div key={`${item.name}-${index}`} className="flex justify-between gap-2"><span>{item.name} × {item.qty}</span><MoneyAmount amount={item.price} /></div>)}</div>
          <div className="flex items-center justify-between border-t border-line pt-3"><span className="text-body font-bold">{copy.customer.quote.total}</span><MoneyAmount amount={event.total} large /></div>
          <p className="mt-3 break-all text-caption text-muted">{fill(copy.customer.quote.payTo, { ens: event.shop.ens })}</p>
        </article>}
        {phase !== 'failed' && <div className="mt-4 flex items-center gap-2 rounded-input border border-line bg-surface p-3 text-body"><span className={`flex h-6 w-6 items-center justify-center rounded-full ${phase === 'quoted' ? 'border border-muted text-muted' : 'bg-ok text-white'}`}>{phase === 'quoted' ? '1' : <Check size={15} aria-hidden />}</span>{phase === 'quoted' ? copy.customer.quote.waitingSignature : copy.customer.quote.signed}</div>}
        {phase === 'signed' && <div role="status" className="mt-4 rounded-card border border-warn bg-surface p-4 text-center">
          <div className="flex items-center justify-around gap-2">{payer && <AgentAvatar agent={payer.ref} label={payer.label} activity="thinking" size={44} />}<span className="relative flex h-12 flex-1 items-center justify-center border-b border-dashed border-warn"><Coins size={23} className="payment-coin absolute text-warn" aria-hidden /><ArrowRight size={17} className="ml-auto text-warn" aria-hidden /></span>{storefront && <AgentAvatar agent={storefront.ref} label={storefront.label} size={44} />}</div>
          <p className="mt-3 animate-pulse text-body font-bold text-warn">{fill(copy.customer.quote.paying, { amount: formatMoney(event.total) })}</p>
        </div>}
        {phase === 'paid' && <div className="mt-4 flex flex-col gap-4"><ReceiptCard title={copy.customer.quote.paid} amount={event.total} status="paid" rows={[{ label: copy.customer.quote.from, value: payer?.label ?? story.spendingPass.payingRole }]} links={links} footer={copy.common.gasFree} /><p className="text-body text-ok">{fill(copy.customer.quote.paidOn, { amount: formatMoney(event.total), chain: story.explorers.whitechainLabel })}</p><button type="button" onClick={viewOrder} className="min-h-11 rounded-full bg-brand px-4 text-body font-bold text-white">{copy.customer.quote.viewOrder}</button></div>}
        {phase === 'failed' && <div className="mt-4 flex flex-col items-center gap-3 rounded-card border border-bad bg-surface p-4 text-center">{payer && <AgentAvatar agent={payer.ref} label={payer.label} activity="refused" size={52} />}<h3 className="font-heading text-section font-bold text-bad">{copy.customer.quote.failed}</h3><p className="text-body">{failure}</p><div className="flex flex-wrap gap-2">{links.map((link, index) => <ExplorerLink key={`${link.url}-${index}`} link={link} />)}</div><button type="button" onClick={() => setSheetOpen(false)} className="min-h-11 rounded-full border border-line px-4 text-body font-bold">{copy.common.close}</button></div>}
        {phase === 'quoted' && !expired && <div className="mt-4"><InlineBanner tone="info">{copy.customer.quote.waitingSignature}</InlineBanner></div>}
      </div>
    </section>
  </div>, layer);
}
