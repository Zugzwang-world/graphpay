import type { ReactNode } from 'react';

// A phone on the stage (about 390 × 844). On a real phone the frame melts away and
// the screen fills the viewport.
export function PhoneFrame({ label, tone, children }: { label: string; tone: 'buyer' | 'shop'; children: ReactNode }) {
  return (
    <section className="phone" data-tone={tone} aria-label={label}>
      <div className="phone-screen">{children}</div>
    </section>
  );
}
