import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useDemo, useDemoEvents } from '@/demo/DemoProvider';

interface SoundControls {
  muted: boolean;
  toggle: () => void;
  playWee: () => void;
  playCashRegister: () => void;
  playChime: () => void;
}
const SoundContext = createContext<SoundControls | null>(null);

/** One Web Audio source and mute control for both phones. No audio files or autoplay. */
export function SoundPreference({ children }: { children: ReactNode }) {
  const [muted, setMuted] = useState(false);
  const context = useRef<AudioContext | null>(null);
  const { snapshot } = useDemo();
  const shopOpen = useRef(Boolean(snapshot?.shop.open));
  shopOpen.current = Boolean(snapshot?.shop.open);

  useEffect(() => {
    // Create or resume audio only during a user gesture, as browsers require.
    const gesture = () => {
      if (muted) return;
      if (typeof AudioContext === 'undefined') return;
      context.current ??= new AudioContext();
      if (context.current.state === 'suspended') void context.current.resume();
    };
    window.addEventListener('pointerdown', gesture, { capture: true });
    window.addEventListener('keydown', gesture, { capture: true });
    return () => { window.removeEventListener('pointerdown', gesture, { capture: true }); window.removeEventListener('keydown', gesture, { capture: true }); };
  }, [muted]);
  useEffect(() => () => { void context.current?.close(); }, []);

  const audio = () => muted || document.visibilityState === 'hidden' ? null : context.current;
  const tone = (ctx: AudioContext, at: number, from: number, to: number, duration: number, volume: number, type: OscillatorType = 'sine') => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + duration);
    gain.gain.setValueAtTime(0.001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
  };
  const playWee = () => {
    const ctx = audio(); if (!ctx) return;
    const at = ctx.currentTime;
    tone(ctx, at, 470, 900, 0.24, 0.035);
    tone(ctx, at + 0.23, 900, 560, 0.24, 0.028);
  };
  const playCashRegister = () => {
    const ctx = audio(); if (!ctx) return;
    const at = ctx.currentTime;
    tone(ctx, at, 850, 760, 0.32, 0.045);
    tone(ctx, at + 0.06, 1280, 1120, 0.36, 0.025);
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.09), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index++) data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
    const noise = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = 0.015;
    noise.buffer = buffer;
    noise.connect(gain).connect(ctx.destination);
    noise.start(at + 0.1);
  };
  const playChime = () => {
    const ctx = audio(); if (!ctx) return;
    const at = ctx.currentTime;
    tone(ctx, at, 660, 660, 0.3, 0.026);
    tone(ctx, at + 0.13, 880, 880, 0.45, 0.03);
  };

  useDemoEvents((event) => {
    if (event.type === 'shop.status') { shopOpen.current = event.open; if (event.open) playCashRegister(); }
    if (event.type === 'merchant.notification' && (event.kind === 'new_order' || event.kind === 'renewal') && shopOpen.current) playChime();
  });

  return <SoundContext.Provider value={{ muted, toggle: () => setMuted((value) => !value), playWee, playCashRegister, playChime }}>{children}</SoundContext.Provider>;
}

export function useSoundPreference(): SoundControls {
  const value = useContext(SoundContext);
  if (!value) throw new Error('SoundPreference is required');
  return value;
}
