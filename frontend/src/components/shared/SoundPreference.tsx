import { createContext, useContext, useState, type ReactNode } from 'react';

const SoundContext = createContext<{ muted: boolean; toggle: () => void } | null>(null);

/** Shared preference for the two phones. F4 adds the Web Audio cues here. */
export function SoundPreference({ children }: { children: ReactNode }) {
  const [muted, setMuted] = useState(false);
  return <SoundContext.Provider value={{ muted, toggle: () => setMuted((value) => !value) }}>{children}</SoundContext.Provider>;
}

export function useSoundPreference() {
  const value = useContext(SoundContext);
  if (!value) throw new Error('SoundPreference is required');
  return value;
}
