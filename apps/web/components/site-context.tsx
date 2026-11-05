'use client';

// Shared client state: the site model (from the config files), the passcode (in
// sessionStorage for this browser session only, never in a URL), sound with its
// captions, and the current agent run that the stage's explainer replays.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SiteModel } from '@/lib/site.server';
import { PASSCODE_HEADER } from '@/lib/passcode-header';
import { streamEvents, type StreamOutcome } from '@/lib/sse-client';
import { SOUND_CAPTIONS, playSound, unlockAudio, type SoundKind } from '@/lib/sound';
import type { RunResult, TraceEvent } from '@/lib/contracts';

const STORAGE_KEY = 'graphpay.passcode';

export interface ApiAnswer<T = unknown> {
  ok: boolean;
  status: number;
  body: T | null;
  waitingFor: string | null;
  error: string | null;
}

export interface RunState {
  runId: string | null;
  events: TraceEvent[];
  result: RunResult | null;
  startedAt: number | null;
}

interface SiteContextValue {
  model: SiteModel;
  passcode: string | null;
  setPasscode: (value: string | null) => void;
  unlockOpen: boolean;
  requestUnlock: () => Promise<string | null>;
  settleUnlock: (value: string | null) => void;
  post: <T>(path: string, body: unknown) => Promise<ApiAnswer<T>>;
  // A passcode-gated POST answered as a server-sent stream; null when the user cancels the lock.
  stream: (path: string, body: unknown, onEvent: (event: string, data: string) => void) => Promise<StreamOutcome | null>;
  soundOn: boolean;
  enableSound: () => Promise<void>;
  setSoundOn: (on: boolean) => void;
  sound: (kind: SoundKind) => void;
  caption: { text: string; at: number } | null;
  run: RunState;
  setRun: (update: (prev: RunState) => RunState) => void;
}

const SiteContext = createContext<SiteContextValue | null>(null);

function readStored(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function SiteProvider({ model, children }: { model: SiteModel; children: ReactNode }) {
  // Read after mount, so the server's render and the first client render agree.
  const [passcode, setPasscodeState] = useState<string | null>(null);
  useEffect(() => setPasscodeState(readStored()), []);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const waiters = useRef<((value: string | null) => void)[]>([]);
  const [soundOn, setSoundOnState] = useState(false);
  const [caption, setCaption] = useState<{ text: string; at: number } | null>(null);
  const [run, setRunState] = useState<RunState>({ runId: null, events: [], result: null, startedAt: null });

  const setPasscode = useCallback((value: string | null) => {
    setPasscodeState(value);
    try {
      if (value) window.sessionStorage.setItem(STORAGE_KEY, value);
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage blocked: keep it in memory for this page only
    }
  }, []);

  const requestUnlock = useCallback(() => {
    setUnlockOpen(true);
    return new Promise<string | null>((resolve) => waiters.current.push(resolve));
  }, []);

  const settleUnlock = useCallback(
    (value: string | null) => {
      if (value) setPasscode(value);
      setUnlockOpen(false);
      const pending = waiters.current;
      waiters.current = [];
      for (const resolve of pending) resolve(value);
    },
    [setPasscode],
  );

  const post = useCallback(
    async <T,>(path: string, body: unknown): Promise<ApiAnswer<T>> => {
      let code = passcode ?? readStored();
      if (!code) code = await requestUnlock();
      if (!code) return { ok: false, status: 0, body: null, waitingFor: null, error: 'locked: enter the passcode to use this button' };
      let res: Response;
      try {
        res = await fetch(path, {
          method: 'POST',
          headers: { 'content-type': 'application/json', [PASSCODE_HEADER]: code },
          body: JSON.stringify(body ?? {}),
          cache: 'no-store',
        });
      } catch {
        return { ok: false, status: 0, body: null, waitingFor: null, error: 'the site did not answer; try again' };
      }
      const parsed = (await res.json().catch(() => null)) as (T & { error?: unknown; waitingFor?: unknown }) | null;
      if (res.status === 401) setPasscode(null);
      const waitingFor = res.status === 503 && typeof parsed?.waitingFor === 'string' ? parsed.waitingFor : null;
      const error = res.ok ? null : typeof parsed?.error === 'string' ? parsed.error : `HTTP ${res.status}`;
      return { ok: res.ok, status: res.status, body: parsed, waitingFor, error };
    },
    [passcode, requestUnlock, setPasscode],
  );

  const stream = useCallback(
    async (path: string, body: unknown, onEvent: (event: string, data: string) => void): Promise<StreamOutcome | null> => {
      let code = passcode ?? readStored();
      if (!code) code = await requestUnlock();
      if (!code) return null;
      const outcome = await streamEvents(path, onEvent, { method: 'POST', body, headers: { [PASSCODE_HEADER]: code } });
      if (outcome.kind === 'refused' && outcome.status === 401) setPasscode(null);
      return outcome;
    },
    [passcode, requestUnlock, setPasscode],
  );

  const sound = useCallback(
    (kind: SoundKind) => {
      setCaption({ text: SOUND_CAPTIONS[kind], at: Date.now() });
      if (soundOn) playSound(kind);
    },
    [soundOn],
  );

  const enableSound = useCallback(async () => {
    setSoundOnState(await unlockAudio());
  }, []);

  const setSoundOn = useCallback((on: boolean) => {
    if (!on) setSoundOnState(false);
    else void unlockAudio().then(setSoundOnState);
  }, []);

  const setRun = useCallback((update: (prev: RunState) => RunState) => setRunState(update), []);

  const value = useMemo<SiteContextValue>(
    () => ({ model, passcode, setPasscode, unlockOpen, requestUnlock, settleUnlock, post, stream, soundOn, enableSound, setSoundOn, sound, caption, run, setRun }),
    [model, passcode, setPasscode, unlockOpen, requestUnlock, settleUnlock, post, stream, soundOn, enableSound, setSoundOn, sound, caption, run, setRun],
  );

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteContextValue {
  const value = useContext(SiteContext);
  if (!value) throw new Error('useSite outside SiteProvider');
  return value;
}
