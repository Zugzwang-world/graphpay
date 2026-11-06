import { useCityClock } from '@/lib/useCityClock';

/** iOS status bar: time on the left, signal, Wi-Fi and battery on the right. Decorative. */
export function StatusBar() {
  const time = useCityClock();
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[60] flex h-[54px] items-center justify-between px-8 pt-1 font-ios text-ink" aria-hidden>
      <span className="tabular w-[72px] text-center text-section font-semibold">{time}</span>
      <span className="flex w-[72px] items-center justify-center gap-1">
        <SignalIcon />
        <WifiIcon />
        <BatteryIcon />
      </span>
    </div>
  );
}

function SignalIcon() {
  return (
    <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor">
      <rect x="0" y="8" width="3" height="4" rx="1" />
      <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
      <rect x="10" y="3" width="3" height="9" rx="1" />
      <rect x="15" y="0" width="3" height="12" rx="1" />
    </svg>
  );
}

function WifiIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
      <path d="M8 2.2c2.4 0 4.6.9 6.3 2.5.2.2.5.2.7 0l.8-.8c.2-.2.2-.5 0-.7A11 11 0 0 0 8 0 11 11 0 0 0 .2 3.2c-.2.2-.2.5 0 .7l.8.8c.2.2.5.2.7 0A9 9 0 0 1 8 2.2Z" />
      <path d="M8 5.8c1.4 0 2.6.5 3.6 1.4.2.2.5.2.7 0l.8-.8c.2-.2.2-.5 0-.7A7.3 7.3 0 0 0 8 3.6c-1.9 0-3.7.8-5.1 2.1-.2.2-.2.5 0 .7l.8.8c.2.2.5.2.7 0 1-.9 2.2-1.4 3.6-1.4Z" />
      <path d="M10.4 9c.2-.2.2-.5 0-.7a3.5 3.5 0 0 0-4.8 0c-.2.2-.2.5 0 .7l2 2c.2.2.6.2.8 0l2-2Z" />
    </svg>
  );
}

function BatteryIcon() {
  return (
    <svg width="27" height="13" viewBox="0 0 27 13" fill="none">
      <rect x="0.5" y="0.5" width="22" height="12" rx="3.5" stroke="currentColor" opacity="0.4" />
      <rect x="2" y="2" width="17" height="9" rx="2" fill="currentColor" />
      <path d="M24.5 4.5v4c.8-.3 1.5-1.1 1.5-2s-.7-1.7-1.5-2Z" fill="currentColor" opacity="0.45" />
    </svg>
  );
}
