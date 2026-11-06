import { useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { PhoneFrame, FRAME_H, FRAME_W, PHONE_H, PHONE_W } from './PhoneFrame';
import { DemoStrip } from './DemoStrip';
import { useViewport } from '@/lib/useViewport';
import { copy } from '@/copy';

const STRIP_H = 56;
const CAPTION_H = 36;
const SWITCH_H = 56;
const PAD_Y = 24;
const GAP = 96;
const PAD_X = 32;
/** The design calls for two phones on desktop (1440 px and wider). */
const DESKTOP_WIDTH = 1440;
/** At or below this width the page is a real phone: no bezel, no stage. */
const PHONE_WIDTH = 500;

type Which = 'customer' | 'merchant';

export interface StageLayout {
  mode: 'two-up' | 'single' | 'bare';
  scale: number;
}

/** Pure layout rule, exported for tests and the dev switcher. */
export function stageLayout(width: number, height: number): StageLayout {
  if (width <= PHONE_WIDTH) {
    return { mode: 'bare', scale: Math.min(1, width / PHONE_W, (height - STRIP_H - SWITCH_H) / PHONE_H) };
  }
  const heightScale = (height - STRIP_H - CAPTION_H - PAD_Y * 2) / FRAME_H;
  const twoUp = Math.min(1, heightScale, (width - PAD_X * 2 - GAP) / (2 * FRAME_W));
  if (width >= DESKTOP_WIDTH) return { mode: 'two-up', scale: Math.max(0.4, twoUp) };
  const single = Math.min(1, (height - STRIP_H - SWITCH_H - CAPTION_H - PAD_Y * 2) / FRAME_H, (width - PAD_X * 2) / FRAME_W);
  return { mode: 'single', scale: Math.max(0.4, single) };
}

interface StageProps {
  customer: ReactNode;
  merchant: ReactNode;
}

/**
 * The dark stage (DESIGN_INSTRUCTIONS.md 4.1): the strip on top and the two
 * phones centred side by side, customer left, merchant right, scaled to fit the
 * viewport height so the page never scrolls on desktop. Narrower screens show
 * one phone at a time with a two-option switch. Both apps stay mounted, so a
 * hidden phone keeps its state and keeps receiving events.
 */
export function Stage({ customer, merchant }: StageProps) {
  const vp = useViewport();
  const layout = stageLayout(vp.width, vp.height);
  const [which, setWhich] = useState<Which>('customer');

  const phone = (id: Which, content: ReactNode) => {
    const caption = id === 'customer' ? copy.stage.customerCaption : copy.stage.merchantCaption;
    const hidden = layout.mode !== 'two-up' && which !== id;
    return (
      <div key={id} className={clsx('relative flex flex-col items-center gap-3', hidden && 'hidden')} id={`phone-${id}`}>
        {layout.mode !== 'bare' && (
          <>
            <div
              className="pointer-events-none absolute top-1/2 left-1/2 -z-0 h-[70%] w-[140%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-3xl"
              style={{ background: 'radial-gradient(closest-side, rgb(91 79 214 / 0.22), transparent)' }}
              aria-hidden
            />
            <p className="relative h-6 text-caption font-bold tracking-wide text-stage-muted uppercase">{caption}</p>
          </>
        )}
        <div className="relative">
          {layout.mode === 'bare' ? (
            <div style={{ width: PHONE_W * layout.scale, height: PHONE_H * layout.scale }}>
              <div className="origin-top-left" style={{ transform: `scale(${layout.scale})` }}>
                <PhoneFrame label={caption} scale={1} bare>
                  {content}
                </PhoneFrame>
              </div>
            </div>
          ) : (
            <PhoneFrame label={caption} scale={layout.scale}>
              {content}
            </PhoneFrame>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-stage">
      <DemoStrip compact={layout.mode !== 'two-up'} />
      {layout.mode !== 'two-up' && <AppSwitch which={which} onChange={setWhich} />}
      <main
        className={clsx('flex min-h-0 flex-1 items-center justify-center', layout.mode === 'bare' ? 'items-start' : 'py-6')}
        style={{ gap: GAP }}
      >
        {phone('customer', customer)}
        {phone('merchant', merchant)}
      </main>
    </div>
  );
}

/** The two-option switch shown when only one phone fits (an iOS-style segmented control). */
function AppSwitch({ which, onChange }: { which: Which; onChange: (w: Which) => void }) {
  const options: { id: Which; label: string }[] = [
    { id: 'customer', label: copy.stage.customerTab },
    { id: 'merchant', label: copy.stage.merchantTab },
  ];
  return (
    <div className="flex h-14 shrink-0 items-center justify-center">
      <div role="tablist" aria-label={copy.stage.switchLabel} className="flex rounded-full bg-stage-line p-1 font-ios">
        {options.map((o) => (
          <button
            key={o.id}
            role="tab"
            aria-selected={which === o.id}
            aria-controls={`phone-${o.id}`}
            onClick={() => onChange(o.id)}
            className={clsx(
              'min-h-9 min-w-32 rounded-full px-4 text-body font-semibold transition-colors',
              which === o.id ? 'bg-stage-ink text-stage' : 'text-stage-muted hover:text-stage-ink',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
