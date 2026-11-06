import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import type { Link, Money } from '@/demo/contract';
import { copy } from '@/copy';
import { formatMoney } from '@/lib/money';
import { formatCountdown } from '@/lib/time';

export type StatusKind = keyof typeof copy.status;

const tones: Record<StatusKind, 'ok' | 'warn' | 'bad' | 'info' | 'muted'> = {
  thinking: 'warn', checked: 'info', quoted: 'info', paid: 'ok', refused: 'bad', idle: 'muted',
  ordered: 'warn', dispatched: 'warn', delivered: 'ok', refunded: 'ok', requested: 'warn', accepted: 'ok', declined: 'bad',
  active: 'ok', paused: 'warn', revoked: 'bad', revokedFinal: 'bad', usedUp: 'warn', expired: 'bad',
  charged: 'ok', cancelled: 'muted', skipped: 'warn', new: 'info', renewal: 'info', chosen: 'ok', rejected: 'bad',
  open: 'ok', closed: 'muted', regular: 'info',
};

export function StatusChip({ status, label }: { status: StatusKind; label?: string }) {
  const tone = tones[status];
  return <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-1 text-caption font-bold whitespace-nowrap', tone === 'ok' && 'bg-ok/10 text-ok', tone === 'warn' && 'bg-warn/10 text-warn', tone === 'bad' && 'bg-bad/10 text-bad', tone === 'info' && 'bg-info/10 text-info', tone === 'muted' && 'bg-soft text-muted')}>
    <span className={clsx('h-1.5 w-1.5 rounded-full', tone === 'ok' && 'bg-ok', tone === 'warn' && 'bg-warn', tone === 'bad' && 'bg-bad', tone === 'info' && 'bg-info', tone === 'muted' && 'bg-muted')} aria-hidden />
    {label ?? copy.status[status]}
  </span>;
}

export function MoneyAmount({ amount, large = false, sign = false }: { amount: Money | string; large?: boolean; sign?: boolean }) {
  return <span className={clsx('tabular whitespace-nowrap font-heading font-bold', large ? 'text-amount' : 'text-body')}>{formatMoney(amount, { sign })}</span>;
}

export function Countdown({ until, onExpire, lowAt = 60_000 }: { until: number; onExpire?: () => void; lowAt?: number }) {
  const [now, setNow] = useState(Date.now());
  const expired = useRef(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const left = Math.max(0, until - now);
  useEffect(() => {
    if (left > 0) expired.current = false;
    else if (!expired.current) { expired.current = true; onExpire?.(); }
  }, [left, onExpire]);
  const state = left === 0 ? 'expired' : left <= lowAt ? 'low' : 'running';
  return <span role="timer" aria-label={`${state}: ${formatCountdown(left)}`} className={clsx('tabular text-caption font-bold', state === 'expired' ? 'text-bad' : state === 'low' ? 'text-warn' : 'text-info')}>{formatCountdown(left)}</span>;
}

export function ExplorerLink({ link }: { link: Link }) {
  const [showMock, setShowMock] = useState(false);
  if (link.mock) return <span className="inline-flex flex-col items-start gap-1">
    <button type="button" onClick={() => setShowMock((value) => !value)} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-info/10 px-3 text-caption font-bold text-info" aria-expanded={showMock}>
      <ExternalLink size={13} aria-hidden />{link.label} · {copy.stage.mockBadge}
    </button>
    {showMock && <span className="text-caption text-muted">{copy.common.mockLinkNote}</span>}
  </span>;
  return <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1 rounded-full bg-info/10 px-3 text-caption font-bold text-info"><ExternalLink size={13} aria-hidden />{link.label}</a>;
}

export function ReceiptCard({ title, amount, status = 'paid', rows = [], links = [], footer }: { title: string; amount: Money; status?: StatusKind; rows?: { label: string; value: ReactNode }[]; links?: Link[]; footer?: ReactNode }) {
  return <article className="rounded-card border border-line bg-surface p-4 shadow-card">
    <div className="flex items-start justify-between gap-3"><h2 className="font-heading text-section font-bold">{title}</h2><StatusChip status={status} /></div>
    <div className="mt-3"><MoneyAmount amount={amount} large /></div>
    {rows.length > 0 && <dl className="mt-4 flex flex-col gap-2 border-t border-line pt-3 text-body">{rows.map((row) => <div key={row.label} className="flex justify-between gap-3"><dt className="text-muted">{row.label}</dt><dd className="m-0 text-right font-bold">{row.value}</dd></div>)}</dl>}
    {links.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{links.map((link, index) => <ExplorerLink key={`${link.url}-${index}`} link={link} />)}</div>}
    {footer && <div className="mt-4 border-t border-line pt-3 text-caption text-muted"><Check size={14} className="mr-1 inline text-ok" aria-hidden />{footer}</div>}
  </article>;
}
