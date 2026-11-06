import clsx from 'clsx';

export function Switch({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className={clsx('relative h-8 w-[52px] shrink-0 rounded-full font-ios transition-colors disabled:opacity-50', checked ? 'bg-ios-green' : 'bg-ios-key-dark')}>
    <span className={clsx('absolute top-0.5 left-0.5 h-7 w-7 rounded-full bg-white shadow-card transition-transform', checked && 'translate-x-5')} />
  </button>;
}

export interface SegmentOption<T extends string> { value: T; label: string }
export function SegmentedControl<T extends string>({ options, value, onChange, label }: { options: SegmentOption<T>[]; value: T; onChange: (value: T) => void; label: string }) {
  const chooseAdjacent = (step: number) => {
    const index = options.findIndex((item) => item.value === value);
    const next = options[(index + step + options.length) % options.length];
    if (next) onChange(next.value);
  };
  return <div role="tablist" aria-label={label} className="inline-flex max-w-full rounded-input bg-soft p-1 font-ios">
    {options.map((item) => <button key={item.value} type="button" role="tab" aria-selected={value === item.value} onClick={() => onChange(item.value)} onKeyDown={(event) => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); chooseAdjacent(event.key === 'ArrowRight' ? 1 : -1); } }} className={clsx('min-h-9 min-w-0 flex-1 rounded-[9px] px-3 text-body font-semibold whitespace-nowrap', value === item.value ? 'bg-white text-ink shadow-card' : 'text-muted')}>{item.label}</button>)}
  </div>;
}
