// Synthesised sounds (Web Audio, no files; WEBSITE_SPEC.md §9). Silent until the
// merchant's "Open shop" tap creates the audio context: browsers need a gesture.

export type SoundKind = 'settled' | 'refund' | 'query' | 'stopped';

export const SOUND_CAPTIONS: Record<SoundKind, string> = {
  settled: 'cha-ching: payment settled',
  refund: 'wah-wah: refund sent',
  query: 'blip: a query ran',
  stopped: 'game over: agent paused or revoked',
};

let context: AudioContext | null = null;

export async function unlockAudio(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return false;
  context ??= new window.AudioContext();
  if (context.state === 'suspended') await context.resume();
  return context.state === 'running';
}

function tone(ctx: AudioContext, at: number, frequency: number, duration: number, type: OscillatorType, peak: number, endFrequency?: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, at);
  if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, at + duration);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

export function playSound(kind: SoundKind): void {
  const ctx = context;
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + 0.01;
  switch (kind) {
    case 'settled':
      tone(ctx, t, 1318.5, 0.18, 'triangle', 0.25);
      tone(ctx, t + 0.09, 1760, 0.5, 'triangle', 0.22);
      tone(ctx, t + 0.09, 3520, 0.3, 'sine', 0.05);
      break;
    case 'refund':
      tone(ctx, t, 392, 0.32, 'sawtooth', 0.08, 349);
      tone(ctx, t + 0.34, 349, 0.55, 'sawtooth', 0.08, 262);
      break;
    case 'query':
      tone(ctx, t, 880, 0.07, 'sine', 0.06);
      break;
    case 'stopped':
      tone(ctx, t, 220, 0.25, 'square', 0.05, 196);
      tone(ctx, t + 0.26, 175, 0.6, 'square', 0.05, 98);
      break;
  }
}
