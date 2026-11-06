import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import clsx from 'clsx';
import { MockBadge } from './MockBadge';
import { useSoundPreference } from './SoundPreference';
import { copy } from '@/copy';

export interface AppHeaderProps {
  title: string;
  subtitle?: string;
  menuOpen: boolean;
  hasUnread: boolean;
  onMenu: () => void;
  onHome: () => void;
  showBack?: boolean;
  onBack?: () => void;
}

/** One header for the customer and merchant apps. */
export function AppHeader({ title, subtitle, menuOpen, hasUnread, onMenu, onHome, showBack = false, onBack }: AppHeaderProps) {
  const { muted, toggle } = useSoundPreference();
  return (
    <header className="relative z-30 flex min-h-[64px] shrink-0 items-center gap-1 border-b border-line bg-bg px-2">
      <button type="button" className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-input" aria-label={`${menuOpen ? copy.common.closeMenu : copy.common.openMenu}${hasUnread ? `, ${copy.common.newActivity}` : ''}`} aria-expanded={menuOpen} onClick={onMenu}>
        <CoinMenuIcon open={menuOpen} />
        {hasUnread && <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full border-2 border-bg bg-bad" aria-hidden />}
      </button>
      {showBack && <button type="button" className="flex h-10 w-8 shrink-0 items-center justify-center rounded-input text-brand" aria-label={copy.common.back} onClick={onBack}><ArrowLeft size={19} aria-hidden /></button>}
      <button type="button" className="min-w-0 flex-1 rounded-input px-1 text-left" onClick={onHome} title={title}>
        <span className="block truncate font-heading text-title font-bold leading-tight">{title}</span>
        {subtitle && <span className="block truncate text-caption text-muted">{subtitle}</span>}
      </button>
      <MockBadge />
      <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-input text-muted" aria-label={muted ? copy.common.unmute : copy.common.mute} aria-pressed={muted} onClick={toggle}>
        {muted ? <VolumeX size={19} aria-hidden /> : <Volume2 size={19} aria-hidden />}
      </button>
    </header>
  );
}

/** Three Ethereum-coin pills that turn into a close mark. */
function CoinMenuIcon({ open }: { open: boolean }) {
  return (
    <span className="relative block h-6 w-6" aria-hidden>
      {[0, 1, 2].map((index) => (
        <svg key={index} viewBox="0 0 24 7" className={clsx('absolute left-0 h-[7px] w-6 origin-center transition-transform duration-200 ease-out', open && index === 0 && 'translate-y-[8px] rotate-45', open && index === 1 && 'scale-0', open && index === 2 && '-translate-y-[8px] -rotate-45')} style={{ top: index * 8 }}>
          <rect x="0.5" y="0.5" width="23" height="6" rx="3" fill={index === 1 ? 'var(--color-ink)' : 'var(--color-brand)'} />
          <path d="m12 1.2 1.4 2.1L12 5.1l-1.4-1.8L12 1.2Z" fill="var(--color-phone)" />
        </svg>
      ))}
    </span>
  );
}
