import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useDemo, useDemoEvents } from '@/demo/DemoProvider';
import { useKeyboardLayout } from './AppShell';
import { usePrefersReducedMotion } from '@/lib/useViewport';

export type FoxPose = 'wave' | 'idle' | 'smile' | 'squint';
let wavedThisSession = false;

/** Fox timing and priority: keyboard > success > welcome > squint > idle. */
export function useMascot() {
  const { snapshot } = useDemo();
  const { open: keyboardOpen } = useKeyboardLayout();
  const reduced = usePrefersReducedMotion();
  const [pose, setPose] = useState<FoxPose>(() => wavedThisSession ? 'idle' : 'wave');
  const [visible, setVisible] = useState(true);
  const [viewportShrunk, setViewportShrunk] = useState(false);
  const element = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSquint = useRef(0);
  const squints = useRef(0);
  const poseRef = useRef(pose);
  poseRef.current = pose;
  const busy = Boolean(snapshot?.errandRunning);
  const headOnly = keyboardOpen || viewportShrunk;

  useEffect(() => {
    if (pose !== 'wave') return;
    wavedThisSession = true;
    poseTimer.current = setTimeout(() => setPose('idle'), 3300);
    return () => { if (poseTimer.current) clearTimeout(poseTimer.current); };
  }, []);

  useEffect(() => {
    const baseHeight = window.innerHeight;
    const check = () => setViewportShrunk(Boolean(window.visualViewport && window.visualViewport.height < baseHeight - 120));
    window.visualViewport?.addEventListener('resize', check);
    return () => window.visualViewport?.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)));
    if (element.current) observer.observe(element.current);
    const onVisibility = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);

  useEffect(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (reduced || busy || headOnly || !visible || squints.current >= 3) return;
    const schedule = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      const delay = Math.max(20_000, 60_000 - (Date.now() - lastSquint.current));
      idleTimer.current = setTimeout(() => {
        if (squints.current >= 3) return;
        squints.current++;
        lastSquint.current = Date.now();
        setPose('squint');
        poseTimer.current = setTimeout(() => { setPose('idle'); schedule(); }, 5000);
      }, delay);
    };
    const activity = (event: Event) => {
      if (poseRef.current === 'squint') {
        if (poseTimer.current) clearTimeout(poseTimer.current);
        setPose(event.type === 'pointerdown' || event.type === 'keydown' ? 'smile' : 'idle');
        if (event.type === 'pointerdown' || event.type === 'keydown') poseTimer.current = setTimeout(() => setPose('idle'), 2500);
      }
      schedule();
    };
    const events = ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart'];
    for (const name of events) window.addEventListener(name, activity, { passive: true });
    schedule();
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current); for (const name of events) window.removeEventListener(name, activity); };
  }, [reduced, busy, headOnly, visible]);

  useEffect(() => {
    if (headOnly && poseRef.current === 'squint') setPose('idle');
  }, [headOnly]);

  useDemoEvents((event) => {
    if (event.type !== 'payment.settled' && !(event.type === 'agent.status' && event.status === 'checked')) return;
    if (reduced) return;
    if (poseTimer.current) clearTimeout(poseTimer.current);
    setPose('smile');
    poseTimer.current = setTimeout(() => setPose('idle'), 2500);
  });

  return { element, pose: reduced ? 'idle' as FoxPose : headOnly ? 'idle' as FoxPose : pose, headOnly, paused: !visible || document.visibilityState === 'hidden' };
}

/** Code-native SVG redraw of the supplied orange fox; no external image request. */
export function Mascot({ size = 180, previewPose }: { size?: number; previewPose?: FoxPose }) {
  const mascot = useMascot();
  const pose = previewPose ?? mascot.pose;
  return <div ref={mascot.element} aria-hidden className={clsx('pointer-events-none shrink-0 transition-[width,height] duration-200 ease-out', `fox-${pose}`, mascot.paused && 'fox-paused')} style={{ width: mascot.headOnly ? size * 0.72 : size, height: mascot.headOnly ? size * 0.68 : size * 1.2 }}>
    <svg viewBox={mascot.headOnly ? '0 0 200 165' : '0 0 200 240'} className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="100" cy="233" rx="70" ry="6" fill="#401225" opacity=".25" />
      <g className="fox-body"><path d="M55 174Q29 196 42 236H158Q171 197 145 174Z" fill="#FF7207" /><path d="M72 238Q68 194 100 191Q132 194 128 238Z" fill="#FFE8B6" /><path d="M46 200Q24 204 32 220Q38 228 55 218Z" fill="#FF7207" /></g>
      <g className="fox-paw"><path d="M148 187Q180 170 183 191Q182 205 159 208Z" fill="#FF7207" /><path d="M172 182v-10M180 185l5-8" stroke="#D65405" strokeWidth="3" strokeLinecap="round" /></g>
      <g className="fox-ear-left"><path d="M45 91Q14 55 28 8Q69 20 85 66Z" fill="#FF7207" /><path d="M30 10Q37 11 50 19L37 32Z" fill="#401225" /><path d="M45 78Q31 52 39 31Q66 42 73 70Z" fill="#FFE8B6" /></g>
      <g className="fox-ear-right"><path d="M155 91Q186 55 172 8Q131 20 115 66Z" fill="#FF7207" /><path d="M170 10Q163 11 150 19L163 32Z" fill="#401225" /><path d="M155 78Q169 52 161 31Q134 42 127 70Z" fill="#FFE8B6" /></g>
      <path d="M55 80Q100 33 145 80Q177 109 166 145Q143 174 100 178Q57 174 34 145Q23 109 55 80Z" fill="#FF7207" />
      <path d="M100 111Q78 75 55 98Q32 106 18 134Q45 157 80 163Q95 166 100 160Z" fill="#FFE8B6" /><path d="M100 111Q122 75 145 98Q168 106 182 134Q155 157 120 163Q105 166 100 160Z" fill="#FFE8B6" />
      <g className="fox-eyes-open"><ellipse cx="70" cy="111" rx="17" ry="25" fill="#fff" /><ellipse cx="130" cy="111" rx="17" ry="25" fill="#fff" /><ellipse cx="73" cy="108" rx="7" ry="12" fill="#401225" /><ellipse cx="127" cy="108" rx="7" ry="12" fill="#401225" /></g>
      <g className="fox-eyes-smile" fill="none" stroke="#401225" strokeWidth="4" strokeLinecap="round"><path d="M57 111q13-15 26 0M117 111q13-15 26 0" /></g>
      <g className="fox-eyes-squint" fill="none" stroke="#401225" strokeWidth="4" strokeLinecap="round"><path d="M57 106q13 7 26 0M117 106q13 7 26 0M55 89l22-6M123 83l22 6" /></g>
      <ellipse cx="52" cy="137" rx="9" ry="5" fill="#F64AA3" /><ellipse cx="148" cy="137" rx="9" ry="5" fill="#F64AA3" />
      <ellipse cx="100" cy="142" rx="12" ry="10" fill="#401225" /><ellipse cx="106" cy="138" rx="3" ry="2" fill="#fff" />
      <path className="fox-mouth-normal" d="M100 151v10q14 1 25-14" fill="none" stroke="#401225" strokeWidth="3" strokeLinecap="round" />
      <path className="fox-mouth-smile" d="M82 154q18 27 36 0Z" fill="#401225" stroke="#401225" strokeWidth="2" />
      <path d="M58 165Q100 178 142 165L147 177Q105 191 54 177Z" fill="#00A8DF" /><path d="M62 174Q52 188 46 207L70 214Q77 194 79 181Z" fill="#0088C9" />
    </svg>
  </div>;
}
