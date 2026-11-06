import { createPortal } from 'react-dom';
import { AlertCircle, ArrowRight, Info, X } from 'lucide-react';
import clsx from 'clsx';
import { usePhoneLayer } from '@/components/stage/PhoneFrame';
import { copy } from '@/copy';
import type { ReactNode } from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden className={clsx('block animate-pulse rounded-input bg-soft', className)} />;
}

export function LoadingState({ label = copy.common.loading }: { label?: string }) {
  return <div role="status" aria-label={label} className="flex flex-col gap-3 p-4"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-24 w-full" /><Skeleton className="h-16 w-full" /><span className="sr-only">{label}</span></div>;
}

export function EmptyState({ title, detail, action, onAction, icon }: { title: string; detail?: string; action?: string; onAction?: () => void; icon?: ReactNode }) {
  return <section className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface p-6 text-center shadow-card">
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-soft text-brand">{icon ?? <Info size={22} aria-hidden />}</span>
    <h2 className="font-heading text-section font-bold">{title}</h2>
    {detail && <p className="text-body text-muted">{detail}</p>}
    {action && onAction && <button type="button" onClick={onAction} className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-4 text-body font-bold text-white">{action}<ArrowRight size={16} aria-hidden /></button>}
  </section>;
}

export function ErrorState({ message = copy.common.errorGeneric, onRetry, recoverable = true }: { message?: string; onRetry?: () => void; recoverable?: boolean }) {
  return <section role="alert" className="flex flex-col items-center gap-3 rounded-card border border-bad bg-surface p-6 text-center shadow-card">
    <AlertCircle size={28} className="text-bad" aria-hidden />
    <p className="text-body font-bold">{message}</p>
    {recoverable && onRetry && <button type="button" onClick={onRetry} className="min-h-11 rounded-full bg-brand px-4 text-body font-bold text-white">{copy.common.retry}</button>}
  </section>;
}

export function InlineBanner({ tone = 'info', children }: { tone?: 'info' | 'ok' | 'warn' | 'bad'; children: ReactNode }) {
  return <div role={tone === 'bad' ? 'alert' : 'status'} className={clsx('rounded-input border bg-surface px-4 py-3 text-body', tone === 'info' && 'border-info text-info', tone === 'ok' && 'border-ok text-ok', tone === 'warn' && 'border-warn text-warn', tone === 'bad' && 'border-bad text-bad')}>{children}</div>;
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  const layer = usePhoneLayer();
  if (!layer) return null;
  return createPortal(<div role="status" className="absolute inset-x-4 top-16 z-10 flex items-center gap-2 rounded-card bg-ink px-4 py-3 text-body text-white shadow-sheet">
    <span className="min-w-0 flex-1">{message}</span>
    <button type="button" onClick={onClose} aria-label={copy.common.close} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"><X size={16} aria-hidden /></button>
  </div>, layer);
}
