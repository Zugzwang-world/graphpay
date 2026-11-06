import clsx from 'clsx';

export interface TrackerStep { id: string; label: string; state: 'done' | 'current' | 'todo' | 'failed' }

/** Business-agnostic order and refund tracker. The caller supplies every state. */
export function StatusTracker({ steps, label }: { steps: TrackerStep[]; label: string }) {
  return <ol aria-label={label} className="flex w-full items-start">
    {steps.map((step, index) => <li key={step.id} className="relative flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      <span className={clsx('relative z-10 flex h-8 w-8 items-center justify-center', step.state === 'current' && 'tracker-current')}>
        {step.state === 'done' ? <svg viewBox="0 0 36 36" className="h-8 w-8 text-ok" fill="none" aria-hidden>
          <path d="M18 2.8c8.6-.5 15.2 6.2 15.3 14.8.4 8.7-6.1 15.7-15 15.6C9.4 33.4 2.9 27 2.6 18.3 2.3 9.5 8.8 3.1 18 2.8Z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path className="tracker-check" d="m10.5 18.6 5.5 5.3 10-11.2" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="22" />
        </svg> : <span className={clsx('flex h-8 w-8 items-center justify-center rounded-full border-2 text-body font-bold', step.state === 'current' && 'border-warn bg-warn/10 text-warn', step.state === 'failed' && 'border-bad text-bad', step.state === 'todo' && 'border-dashed border-muted text-muted')}>{step.state === 'failed' ? '×' : index + 1}</span>}
      </span>
      {index < steps.length - 1 && <svg aria-hidden viewBox="0 0 100 8" preserveAspectRatio="none" className={clsx('absolute top-3 left-[calc(50%+18px)] h-3 w-[calc(100%-36px)]', step.state === 'done' ? 'text-ok' : 'text-line')}><path d="M0 4h94m-5-3 5 3-5 3" stroke="currentColor" strokeWidth="2" fill="none" /></svg>}
      <span className={clsx('max-w-full text-caption font-bold leading-tight', step.state === 'done' && 'text-ok', step.state === 'current' && 'text-warn', step.state === 'failed' && 'text-bad', step.state === 'todo' && 'text-muted')}>{step.label}</span>
      <span className="sr-only">{step.state}</span>
    </li>)}
  </ol>;
}
