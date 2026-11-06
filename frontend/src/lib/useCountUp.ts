import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from './useViewport';

/** Animate integer cents and counts, while respecting reduced motion. */
export function useCountUp(value: number): number {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    if (reduced) { current.current = value; setShown(value); return; }
    const from = current.current;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / 400);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + (value - from) * eased);
      current.current = next;
      setShown(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  return shown;
}
