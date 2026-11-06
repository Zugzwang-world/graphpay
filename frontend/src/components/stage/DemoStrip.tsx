import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Repeat, Store } from 'lucide-react';
import clsx from 'clsx';
import { useDemo, useDemoEvents } from '@/demo/DemoProvider';
import { MockBadge } from '@/components/shared/MockBadge';
import { copy } from '@/copy';

type Notice = { kind: 'pending' | 'info' | 'error'; text: string } | null;

/**
 * The thin top strip (DESIGN_INSTRUCTIONS.md 1): the Mock badge and the two
 * demo controls that have no button inside the phones. Nothing else.
 */
export function DemoStrip({ compact = false }: { compact?: boolean }) {
  const { adapter, snapshot } = useDemo();
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [renewalPending, setRenewalPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flash = (n: Notice, ms = 3500) => {
    clearTimeout(timer.current);
    setNotice(n);
    if (n && n.kind !== 'pending') timer.current = setTimeout(() => setNotice(null), ms);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  useDemoEvents((e) => {
    if (!renewalPending) {
      if (e.type === 'demo.reset') flash({ kind: 'info', text: copy.stage.resetDone });
      return;
    }
    if (e.type === 'renewal.charged' || (e.type === 'payment.refused' && e.renewalId)) {
      setRenewalPending(false);
      flash(null);
    } else if (e.type === 'error') {
      setRenewalPending(false);
      flash({ kind: 'error', text: e.message }, 5000);
    }
  });

  const runRenewal = async () => {
    setRenewalPending(true);
    flash({ kind: 'pending', text: copy.stage.renewalPending });
    try {
      await adapter.runNextRenewal();
    } catch (err) {
      setRenewalPending(false);
      flash({ kind: 'error', text: (err as Error).message || copy.common.errorGeneric }, 5000);
    }
  };

  const reset = async () => {
    setConfirmReset(false);
    setRenewalPending(false);
    await adapter.resetDemo();
  };

  const shopClosed = snapshot ? !snapshot.shop.open : false;

  return (
    <header className="relative z-10 flex h-14 shrink-0 items-center gap-3 border-b border-stage-line bg-stage-2/80 px-4 text-stage-ink backdrop-blur">
      <span className="font-heading text-section font-bold whitespace-nowrap">GraphPay</span>
      <MockBadge tone="stage" long={!compact} />

      <div className="min-w-0 flex-1 truncate text-caption text-stage-muted" role="status" aria-live="polite">
        {notice ? (
          <span className={clsx(notice.kind === 'error' && 'text-stage-ink', notice.kind === 'pending' && 'animate-pulse')}>{notice.text}</span>
        ) : shopClosed && !compact ? (
          <span className="inline-flex items-center gap-1">
            <Store size={14} aria-hidden /> {copy.stage.openShopHint}
          </span>
        ) : null}
      </div>

      <nav aria-label={copy.stage.demoControls} className="flex items-center gap-2">
        <StripButton onClick={runRenewal} disabled={renewalPending} icon={<Repeat size={16} aria-hidden />} label={copy.stage.runNextRenewal} compact={compact} />
        <StripButton onClick={() => setConfirmReset((value) => !value)} icon={<RotateCcw size={16} aria-hidden />} label={copy.stage.resetDemo} compact={compact} />
      </nav>
      {confirmReset && (
        <div role="alertdialog" aria-label={copy.stage.resetDemo} aria-describedby="reset-confirmation" className="absolute top-full right-4 z-20 mt-2 w-80 max-w-[calc(100vw-32px)] rounded-card border border-stage-line bg-stage-2 p-4 shadow-phone">
          <p id="reset-confirmation" className="text-body">{copy.stage.resetConfirm}</p>
          <div className="mt-4 flex justify-end gap-2 text-body font-bold">
            <button className="min-h-11 rounded-full px-4 hover:bg-stage-line" onClick={() => setConfirmReset(false)} autoFocus>{copy.common.cancel}</button>
            <button className="min-h-11 rounded-full bg-stage-ink px-4 text-stage" onClick={reset}>{copy.stage.resetYes}</button>
          </div>
        </div>
      )}
    </header>
  );
}

function StripButton({ onClick, disabled, icon, label, compact }: { onClick: () => void; disabled?: boolean; icon: React.ReactNode; label: string; compact: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={compact ? label : undefined}
      title={label}
      className="inline-flex min-h-9 items-center gap-2 rounded-full border border-stage-line px-3 text-caption font-bold whitespace-nowrap text-stage-ink hover:bg-stage-line disabled:opacity-50"
    >
      {icon}
      {!compact && label}
    </button>
  );
}
