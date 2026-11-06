import { createContext, useContext, useState, type ReactNode } from 'react';
import { StatusBar } from './StatusBar';

export const PHONE_W = 390;
export const PHONE_H = 844;
/** Bezel thickness around the 390 × 844 screen. */
export const BEZEL = 12;
export const FRAME_W = PHONE_W + BEZEL * 2;
export const FRAME_H = PHONE_H + BEZEL * 2;

/**
 * The phone's overlay layer. Sheets, toasts and the simulated keyboard render
 * into it (with a portal) so they stay inside the phone screen, above the page.
 */
const PhoneLayerContext = createContext<HTMLElement | null>(null);
export const usePhoneLayer = () => useContext(PhoneLayerContext);

interface PhoneFrameProps {
  /** Accessible name of the phone region, e.g. "Customer app". */
  label: string;
  /** CSS scale applied to the whole frame (from the stage). */
  scale: number;
  /** Drawn without the device bezel (a real phone-width viewport). */
  bare?: boolean;
  children: ReactNode;
}

/**
 * A generic modern phone drawn in CSS (DESIGN_INSTRUCTIONS.md 4.1): 390 × 844
 * logical px, 55 px corners, a thin dark bezel, a soft shadow, a Dynamic
 * Island, an iOS status bar and a home indicator. No real device image.
 * The whole frame scales as one piece, keeping its aspect ratio.
 */
export function PhoneFrame({ label, scale, bare = false, children }: PhoneFrameProps) {
  const [layer, setLayer] = useState<HTMLElement | null>(null);

  const screen = (
    <div
      className="relative overflow-hidden bg-phone text-ink"
      style={{ width: PHONE_W, height: PHONE_H, borderRadius: bare ? 0 : 'calc(var(--radius-phone) - 10px)' }}
    >
      <StatusBar />
      {!bare && (
        <div
          className="pointer-events-none absolute top-[11px] left-1/2 z-[70] h-[37px] w-[126px] -translate-x-1/2 rounded-full bg-island"
          aria-hidden
        />
      )}
      {/* Light theme inside the phone, whatever the browser prefers. */}
      <div className="absolute inset-0 flex flex-col bg-bg" style={{ colorScheme: 'light' }}>
        <PhoneLayerContext.Provider value={layer}>{children}</PhoneLayerContext.Provider>
      </div>
      <div ref={setLayer} className="pointer-events-none absolute inset-0 z-[80] [&>*]:pointer-events-auto" />
      <div className="pointer-events-none absolute bottom-2 left-1/2 z-[90] h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-ink" aria-hidden />
    </div>
  );

  if (bare) {
    return (
      <section aria-label={label} className="relative" style={{ width: PHONE_W, height: PHONE_H }}>
        {screen}
      </section>
    );
  }

  return (
    <div style={{ width: FRAME_W * scale, height: FRAME_H * scale }} className="relative shrink-0">
      <section
        aria-label={label}
        className="absolute top-0 left-0 origin-top-left rounded-phone bg-bezel shadow-phone"
        style={{ width: FRAME_W, height: FRAME_H, padding: BEZEL, transform: `scale(${scale})` }}
      >
        {/* Side buttons, purely decorative. */}
        <span className="absolute top-[180px] -left-[3px] h-[32px] w-[3px] rounded-l bg-bezel-edge" aria-hidden />
        <span className="absolute top-[236px] -left-[3px] h-[62px] w-[3px] rounded-l bg-bezel-edge" aria-hidden />
        <span className="absolute top-[310px] -left-[3px] h-[62px] w-[3px] rounded-l bg-bezel-edge" aria-hidden />
        <span className="absolute top-[260px] -right-[3px] h-[96px] w-[3px] rounded-r bg-bezel-edge" aria-hidden />
        <div className="pointer-events-none absolute inset-[3px] rounded-[52px] ring-1 ring-bezel-edge" aria-hidden />
        {screen}
      </section>
    </div>
  );
}
