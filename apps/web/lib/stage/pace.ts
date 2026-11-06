// The director's pacing (final website brief §5): the errand's steps are shown one at a time in
// errand-step order. A step is shown once its frame has arrived, the least gap after the step before
// it has passed, and, when it starts a new beat, the beat before it has stayed its least dwell. A run
// that ended (paid, refused or failed) skips the steps that will never come. Pure, so it is tested
// without a clock, and shared by the stage and a phone opened on its own.

import { ERRAND_STEPS, beatOf, type BeatKey, type StepKey } from './scenes.ts';

export interface Pace {
  // Index into ERRAND_STEPS of the last step shown (-1: none yet).
  shown: number;
  shownAt: number;
  beat: BeatKey;
  beatAt: number;
}

export const restPace = (now: number): Pace => ({ shown: -1, shownAt: now, beat: 'film', beatAt: now - 3_600_000 });

export function advance(pace: Pace, arrived: Partial<Record<StepKey, number>>, finished: boolean, now: number): Pace {
  let i = pace.shown + 1;
  // A finished run never sends the steps it skipped (a refusal ends before the quote).
  if (finished) while (i < ERRAND_STEPS.length && arrived[ERRAND_STEPS[i]!.key] === undefined) i += 1;
  const next = ERRAND_STEPS[i];
  const came = next ? arrived[next.key] : undefined;
  if (!next || came === undefined || came > now) return pace;
  if (now - pace.shownAt < next.gapMs) return pace;
  if (next.beat !== pace.beat && now - pace.beatAt < beatOf(pace.beat).minDwellMs) return pace;
  return next.beat === pace.beat ? { ...pace, shown: i, shownAt: now } : { shown: i, shownAt: now, beat: next.beat, beatAt: now };
}

// Every step shown so far, by key.
export function shownSteps(pace: Pace): Set<StepKey> {
  return new Set(ERRAND_STEPS.slice(0, pace.shown + 1).map((s) => s.key));
}

// True when every step that arrived has been shown: the run's end may then be shown too.
export function caughtUp(pace: Pace, arrived: Partial<Record<StepKey, number>>): boolean {
  return ERRAND_STEPS.every((s, i) => i <= pace.shown || arrived[s.key] === undefined);
}
