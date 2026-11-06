'use client';

// The middle of the live stage at the booth: the draft deck ("Story") while nothing runs, and
// the explainer ("Live run") during an errand, so its explorer chips stay clickable. The live
// view comes up when a run starts and the deck returns a little after the run ends, unless the
// visitor picked a view during that run.

import { useEffect, useRef, useState } from 'react';
import { Explainer } from './explainer';
import { useSite } from './site-context';

type View = 'story' | 'live';

const BACK_TO_STORY_MS = 12_000;

export function MiddleSwitch() {
  const { run } = useSite();
  const [view, setView] = useState<View>('story');
  const picked = useRef(false);
  const back = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!run.runId) return;
    picked.current = false;
    setView('live');
  }, [run.runId]);

  useEffect(() => {
    if (!run.runId || !run.result) return;
    if (picked.current) return;
    back.current = setTimeout(() => setView('story'), BACK_TO_STORY_MS);
    return () => {
      if (back.current) clearTimeout(back.current);
    };
  }, [run.runId, run.result]);

  const choose = (next: View) => {
    picked.current = true;
    if (back.current) clearTimeout(back.current);
    setView(next);
  };

  return (
    <div className="middle-switch">
      <div className="middle-tabs" role="tablist" aria-label="Middle view">
        <button type="button" role="tab" aria-selected={view === 'story'} className="btn btn-quiet" data-on={view === 'story'} onClick={() => choose('story')}>
          Story
        </button>
        <button type="button" role="tab" aria-selected={view === 'live'} className="btn btn-quiet" data-on={view === 'live'} onClick={() => choose('live')}>
          Live run
        </button>
      </div>
      <iframe className="middle-deck" src="/deck/index.html?embed=1" title="The GraphPay story" hidden={view !== 'story'} />
      <div className="middle-live" hidden={view !== 'live'}>
        <Explainer />
      </div>
    </div>
  );
}
