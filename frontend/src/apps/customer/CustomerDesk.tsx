import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { ArrowRight, RotateCcw, Send } from 'lucide-react';
import { AgentAvatar } from '@/components/shared/AgentAvatar';
import { IosTextInput } from '@/components/shared/IosKeyboard';
import { Mascot } from '@/components/shared/Mascot';
import { Photo, dishPhoto, shopPhoto } from '@/components/shared/Photo';
import { ExplorerLink, MoneyAmount, StatusChip } from '@/components/shared/Primitives';
import { InlineBanner, Skeleton } from '@/components/shared/States';
import { useAppNavigation } from '@/components/shared/AppShell';
import { useDemo } from '@/demo/DemoProvider';
import { agentByEns, story } from '@/data/story';
import { copy, fill, pick } from '@/copy';
import type { ShopChoice } from '@/demo/contract';
import { useCustomerJourney } from './CustomerJourneyProvider';
import type { ThreadItem } from './journey';

export function CustomerDesk() {
  const { state, send, retry, setSheetOpen, selectOrder } = useCustomerJourney();
  const navigate = useAppNavigation();
  const [draft, setDraft] = useState('');
  const [greeting] = useState(() => pick(copy.customer.desk.greeting, { customer: story.customer.name, city: story.city.name }));
  const thread = useRef<HTMLDivElement>(null);
  useEffect(() => { if (thread.current) thread.current.scrollTop = thread.current.scrollHeight; }, [state.items]);

  const submit = () => {
    const text = draft.trim();
    if (!text || state.running) return;
    setDraft('');
    void send(text);
  };
  const openOrder = (orderId: string) => { selectOrder(orderId); navigate('orders'); };
  return <div className="flex h-full min-h-0 flex-col">
    {state.items.length === 0 && <div className="flex flex-wrap gap-2 px-4 pt-4">
      {story.quickPrompts.map((prompt) => <button key={prompt.text} type="button" disabled={state.running} onClick={() => void send(prompt.text)} className="min-h-11 rounded-full border border-brand bg-brand/10 px-3 text-body font-bold text-brand disabled:opacity-50">{prompt.text}</button>)}
    </div>}
    <div ref={thread} role="log" aria-label={copy.customer.desk.threadLabel} aria-live="polite" className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      {state.items.length === 0 ? <div className="flex min-h-full flex-col items-center justify-center gap-3 text-center"><Mascot size={150} /><p className="max-w-72 text-body text-muted">{greeting}</p></div> : <div className="flex flex-col gap-3">
        <div className="flex justify-center"><Mascot size={64} /></div>
        {state.items.map((item) => <ThreadRow key={item.id} item={item} onQuote={() => state.quote?.event.orderId === (item.kind === 'quote' ? item.orderId : '') ? setSheetOpen(true) : item.kind === 'quote' && item.phase === 'paid' ? openOrder(item.orderId) : undefined} />)}
      </div>}
    </div>
    <div className="shrink-0 border-t border-line bg-bg px-4 pt-3 pb-6">
      {state.error && <div className="mb-3"><InlineBanner tone="bad"><div className="flex items-center justify-between gap-2"><span>{state.error.message}</span>{state.error.recoverable && <button type="button" onClick={() => void retry()} className="inline-flex min-h-9 items-center gap-1 rounded-full px-2 font-bold underline"><RotateCcw size={14} aria-hidden />{copy.common.retry}</button>}</div></InlineBanner></div>}
      {state.running && <p role="status" className="mb-2 text-caption text-warn">{copy.customer.desk.composerWaiting}</p>}
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1"><IosTextInput label={copy.customer.desk.composerLabel} value={draft} onChange={setDraft} onDone={submit} canDone={Boolean(draft.trim()) && !state.running} placeholder={copy.customer.desk.composerPlaceholder} returnLabel={copy.customer.desk.send} disabled={state.running} /></div>
        <button type="button" onClick={submit} disabled={!draft.trim() || state.running} aria-label={copy.customer.desk.send} className="mb-0 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white disabled:opacity-50"><Send size={18} aria-hidden /></button>
      </div>
    </div>
  </div>;
}

function ThreadRow({ item, onQuote }: { item: ThreadItem; onQuote: () => void }) {
  const { snapshot } = useDemo();
  if (item.kind === 'user') return <div className="flex justify-end"><p className="thread-user-enter max-w-[85%] rounded-card rounded-br-sm bg-brand px-4 py-3 text-body text-white shadow-card">{item.text}</p></div>;
  if (item.kind === 'agent') {
    const agent = snapshot?.agents.find((entry) => entry.ref.ens === item.agent.ens);
    const name = agent?.label ?? agentByEns(item.agent.ens)?.label ?? item.agent.role;
    const activity = item.status === 'thinking' ? 'thinking' : item.status === 'refused' ? 'refused' : item.status === 'paid' ? 'paid' : item.status === 'checked' ? 'success' : 'talking';
    return <div className="thread-agent-enter flex items-start gap-2">
      <AgentAvatar agent={item.agent} label={name} status={agent?.status} activity={activity} size={36} />
      <div className="min-w-0 max-w-[82%] flex-1"><div className="mb-1 flex flex-wrap items-center gap-1"><span title={item.agent.ens} className="text-caption font-bold">{name}</span><StatusChip status={item.status} /></div>
        <div className={clsx('rounded-card rounded-tl-sm border border-line bg-surface p-3 text-body shadow-card', item.status === 'refused' && 'border-bad')}>{item.text}{item.working && <span aria-label={copy.customer.desk.workingLabel} className="thread-dots ml-1 inline-flex gap-0.5"><i /><i /><i /></span>}{item.reason && !item.text.includes(item.reason) && <p className="mt-2 text-caption text-bad">{item.reason}</p>}{item.links.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{item.links.map((link, index) => <ExplorerLink key={`${link.url}-${index}`} link={link} />)}</div>}</div>
      </div>
    </div>;
  }
  if (item.kind === 'graph') return <div className="thread-agent-enter rounded-input border border-info bg-info/5 p-3 text-caption text-ink"><p className="font-bold">{item.shops === null ? fill(copy.customer.desk.graphReadPending, { reads: item.reads }) : fill(copy.customer.desk.graphRead, { shops: item.shops, reads: item.reads })}</p><div className="mt-2 flex flex-wrap gap-2">{item.links.map((link, index) => <ExplorerLink key={`${link.url}-${index}`} link={link} />)}</div>{item.shops === null && <div aria-hidden className="mt-3 flex flex-col gap-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>}</div>;
  if (item.kind === 'shops') return <div className="thread-agent-enter flex flex-col gap-2">{item.choices.map((choice) => <ShopChoiceCard key={choice.shop.ens} choice={choice} />)}</div>;
  if (item.kind === 'quote') return <button type="button" onClick={onQuote} className="thread-agent-enter flex min-h-16 items-center justify-between gap-3 rounded-card border border-info bg-info/5 p-4 text-left shadow-card"><span className="min-w-0"><strong className="block font-heading text-section">{fill(copy.customer.desk.quoteCardTitle, { shop: item.shop })}</strong><span className="text-caption text-info">{copy.customer.desk.quoteCardView}</span></span><StatusChip status={item.phase === 'paid' ? 'paid' : item.phase === 'failed' ? 'refused' : 'quoted'} /><ArrowRight size={16} className="shrink-0 text-info" aria-hidden /></button>;
  return <div className="thread-agent-enter"><InlineBanner tone="bad"><strong className="block">{copy.customer.desk.refusedCardTitle}</strong><span>{item.reason}</span>{item.links.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{item.links.map((link, index) => <ExplorerLink key={`${link.url}-${index}`} link={link} />)}</div>}</InlineBanner></div>;
}

function ShopChoiceCard({ choice }: { choice: ShopChoice }) {
  return <article className={clsx('rounded-card border border-line border-l-4 bg-surface p-3 shadow-card', choice.verdict === 'chosen' ? 'border-l-ok' : choice.verdict === 'rejected' ? 'border-l-bad' : 'border-l-line')}>
    <Photo src={shopPhoto(choice.shop.ens)} className="-mx-3 -mt-3 mb-2 h-16 w-[calc(100%+1.5rem)] rounded-t-card object-cover" />
    <div className="flex items-start justify-between gap-2"><h3 className="font-heading text-section font-bold">{choice.shop.name}</h3>{choice.verdict !== 'considered' && <StatusChip status={choice.verdict} />}</div>
    <div className="mt-1 flex items-center gap-2"><Photo src={dishPhoto(choice.shop.ens)} className="h-12 w-12 shrink-0 rounded-input object-cover" /><MoneyAmount amount={choice.price} /></div>
    <p className="mt-2 text-caption text-muted">{fill(copy.customer.desk.shopFacts, { distance: choice.distanceKm, paid: choice.paidOrders.toLocaleString('en-IN'), refunds: choice.refundRate, repeat: choice.repeatBuyers?.toLocaleString('en-IN') ?? '' })}</p>
    {choice.reason && <p className="mt-2 text-caption font-bold text-bad">{fill(copy.customer.desk.rejectedReason, { reason: choice.reason })}</p>}
  </article>;
}
