import clsx from 'clsx';
import { copy } from '@/copy';
import { useDemo } from '@/demo/DemoProvider';

/**
 * Shown whenever the adapter is in mock mode (DESIGN_INSTRUCTIONS.md 6).
 * `stage` is light-on-dark for the strip; `app` sits in a phone header.
 */
export function MockBadge({ tone = 'app', long = false }: { tone?: 'app' | 'stage'; long?: boolean }) {
  const { adapter } = useDemo();
  if (adapter.mode !== 'mock') return null;
  return (
    <span
      className={clsx(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-caption font-bold tracking-wide uppercase',
        tone === 'stage' ? 'bg-stage-line text-stage-ink' : 'bg-soft text-muted',
      )}
      title={copy.stage.mockBadgeLong}
    >
      <span className={clsx('h-2 w-2 rounded-full', tone === 'stage' ? 'bg-stage-muted' : 'bg-muted')} aria-hidden />
      {long ? copy.stage.mockBadgeLong : copy.stage.mockBadge}
    </span>
  );
}
