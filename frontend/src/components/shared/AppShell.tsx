import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { AppHeader } from './AppHeader';
import { Toast } from './States';
import { useDemo, useDemoEvents } from '@/demo/DemoProvider';
import { copy, fill } from '@/copy';
import type { DemoEvent } from '@/demo/contract';

export interface AppPage { id: string; label: string }
type Navigate = (id: string) => void;
const NavigationContext = createContext<Navigate | null>(null);
export function useAppNavigation(): Navigate {
  const navigate = useContext(NavigationContext);
  if (!navigate) throw new Error('useAppNavigation must be used inside AppShell');
  return navigate;
}

function destination(app: 'customer' | 'merchant', event: DemoEvent): string | null {
  if (app === 'merchant') {
    if (event.type === 'merchant.notification') return event.kind === 'refund_request' ? 'refunds' : event.kind === 'renewal' ? 'renewals' : 'home';
    return null;
  }
  if (event.type === 'order.updated') return 'orders';
  if (event.type === 'refund.settled') return 'orders';
  if (event.type === 'renewal.created' || event.type === 'renewal.charged' || event.type === 'renewal.cancelled') return 'renewals';
  if (event.type === 'agent.permission' || event.type === 'cap.change.refused') return 'agents';
  return null;
}

/** Shared navigation, arrival dot and page transition. Business pages supply only their content. */
export function AppShell({ app, pages, homeTitle, subtitle, renderPage }: { app: 'customer' | 'merchant'; pages: AppPage[]; homeTitle: string; subtitle?: string; renderPage: (id: string) => ReactNode }) {
  const { generation } = useDemo();
  const [page, setPage] = useState(pages[0]?.id ?? '');
  const [menuOpen, setMenuOpen] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [unread, setUnread] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    setPage(pages[0]?.id ?? '');
    setUnread([]);
    setToast(null);
    setMenuOpen(false);
  }, [generation, pages]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  useDemoEvents((event) => {
    const target = destination(app, event);
    if (!target || target === page || unread.includes(target)) return;
    setUnread((current) => current.includes(target) ? current : [...current, target]);
    setToast(fill(copy.common.newOnPage, { page: pages.find((item) => item.id === target)?.label ?? target }));
  });

  const navigate: Navigate = (id) => {
    if (!pages.some((item) => item.id === id)) return;
    setDirection((pages.findIndex((item) => item.id === id) >= pages.findIndex((item) => item.id === page)) ? 'forward' : 'backward');
    setPage(id);
    setUnread((current) => current.filter((item) => item !== id));
    setToast(null);
    setMenuOpen(false);
  };
  const title = page === pages[0]?.id ? homeTitle : pages.find((item) => item.id === page)?.label ?? homeTitle;

  return <NavigationContext.Provider value={navigate}>
    <div className="relative flex h-full flex-col pt-[54px]">
      <AppHeader title={title} subtitle={page === pages[0]?.id ? subtitle : undefined} menuOpen={menuOpen} hasUnread={unread.length > 0} onMenu={() => setMenuOpen((open) => !open)} onHome={() => navigate(pages[0]!.id)} />
      {menuOpen && <>
        <button type="button" className="absolute inset-0 z-20 cursor-default" aria-label={copy.common.closeMenu} onClick={() => setMenuOpen(false)} />
        <nav aria-label={copy.common.pages} className="absolute inset-x-0 top-[118px] z-30 flex gap-2 overflow-x-auto border-b border-line bg-surface px-4 py-3 shadow-card [scrollbar-width:none]">
          {pages.map((item) => <button key={item.id} type="button" onClick={() => navigate(item.id)} aria-current={page === item.id ? 'page' : undefined} className={clsx('relative min-h-11 shrink-0 rounded-card border px-4 text-body font-bold whitespace-nowrap', page === item.id ? 'border-brand bg-brand text-white' : 'border-line bg-bg text-ink')}>
            {item.label}
            {unread.includes(item.id) && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-bad" aria-hidden />}
          </button>)}
        </nav>
      </>}
      <main key={page} className={clsx('min-h-0 flex-1 overflow-y-auto pb-6', direction === 'forward' ? 'page-enter-forward' : 'page-enter-backward')}>
        {renderPage(page)}
      </main>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  </NavigationContext.Provider>;
}
