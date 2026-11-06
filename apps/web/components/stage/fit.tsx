'use client';

// A scene is drawn at one design size and scaled as a whole to fit the middle, so nothing is ever
// clipped or reflowed between 1440 × 900 and 1920 × 1080.

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export const DESIGN_W = 920;
export const DESIGN_H = 1000;

export function Fit({ children, w = DESIGN_W, h = DESIGN_H }: { children: ReactNode; w?: number; h?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setScale(Math.min(r.width / w, r.height / h));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h]);
  return (
    <div className="fit" ref={box}>
      <div className="fit-inner" style={{ width: w, height: h, transform: `translate(-50%, -50%) scale(${scale})`, opacity: scale ? 1 : 0 }}>
        {children}
      </div>
    </div>
  );
}
