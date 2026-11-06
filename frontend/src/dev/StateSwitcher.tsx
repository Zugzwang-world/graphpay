import { useEffect, useState } from 'react';
import { copy } from '@/copy';

export type PreviewState = 'live' | 'loading' | 'empty' | 'success' | 'refused' | 'error' | 'components';
const states: PreviewState[] = ['live', 'loading', 'empty', 'success', 'refused', 'error', 'components'];
const eventName = 'graphpay:preview-state';

function readState(): PreviewState {
  if (!import.meta.env.DEV) return 'live';
  const value = new URLSearchParams(window.location.search).get('state');
  return states.includes(value as PreviewState) ? value as PreviewState : 'live';
}

export function setPreviewState(value: PreviewState) {
  if (!import.meta.env.DEV) return;
  const url = new URL(window.location.href);
  if (value === 'live') url.searchParams.delete('state');
  else url.searchParams.set('state', value);
  window.history.replaceState({}, '', url);
  window.dispatchEvent(new Event(eventName));
}

export function usePreviewState(): PreviewState {
  const [state, setState] = useState(readState);
  useEffect(() => {
    const update = () => setState(readState());
    window.addEventListener('popstate', update);
    window.addEventListener(eventName, update);
    return () => { window.removeEventListener('popstate', update); window.removeEventListener(eventName, update); };
  }, []);
  return state;
}

export function StateSwitcher() {
  const state = usePreviewState();
  const [open, setOpen] = useState(false);
  if (!import.meta.env.DEV) return null;
  return <div className="fixed bottom-3 left-3 z-[100] font-ios text-caption text-stage-ink">
    {open && <div className="mb-2 flex flex-col gap-1 rounded-card border border-stage-line bg-stage-2 p-3 shadow-phone">
      <label htmlFor="preview-state" className="font-bold">{copy.dev.stateLabel}</label>
      <select id="preview-state" value={state} onChange={(event) => setPreviewState(event.target.value as PreviewState)} className="min-h-11 rounded-input border border-stage-line bg-stage px-3">
        {states.map((item) => <option key={item} value={item}>{copy.dev.states[item]}</option>)}
      </select>
      <span className="max-w-48 text-stage-muted">{copy.dev.hint}</span>
    </div>}
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="min-h-9 rounded-full border border-stage-line bg-stage-2 px-3 font-bold shadow-card">{copy.dev.preview}</button>
  </div>;
}
