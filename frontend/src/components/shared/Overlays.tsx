import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { usePhoneLayer } from '@/components/stage/PhoneFrame';
import { copy } from '@/copy';

function useEscape(open: boolean, onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
}

export function BottomSheet({ open, title, onClose, children, actions }: { open: boolean; title: string; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  const layer = usePhoneLayer();
  useEscape(open, onClose);
  if (!open || !layer) return null;
  return createPortal(<div className="absolute inset-0 z-20 font-ios">
    <button type="button" className="absolute inset-0 h-full w-full bg-ink/45" aria-label={copy.common.close} onClick={onClose} />
    <section role="dialog" aria-modal="true" aria-label={title} className="absolute inset-x-0 bottom-0 max-h-[78%] overflow-y-auto rounded-t-sheet bg-ios-sheet px-4 pt-3 pb-8 shadow-sheet backdrop-blur">
      <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-ios-key-dark" aria-hidden />
      <div className="mb-4 flex items-center gap-3"><h2 className="min-w-0 flex-1 text-section font-bold">{title}</h2><button type="button" onClick={onClose} autoFocus className="min-h-11 rounded-full px-3 text-body font-bold text-ios-blue">{copy.common.close}</button></div>
      {children}
      {actions && <div className="mt-6 flex justify-end gap-2">{actions}</div>}
    </section>
  </div>, layer);
}

export interface SheetAction { label: string; onClick: () => void; danger?: boolean; disabled?: boolean }
export function IosActionSheet({ open, title, actions, onClose }: { open: boolean; title: string; actions: SheetAction[]; onClose: () => void }) {
  const layer = usePhoneLayer();
  useEscape(open, onClose);
  if (!open || !layer) return null;
  return createPortal(<div className="absolute inset-0 z-20 font-ios">
    <button type="button" className="absolute inset-0 h-full w-full bg-ink/45" aria-label={copy.common.cancel} onClick={onClose} />
    <div role="dialog" aria-modal="true" aria-label={title} className="absolute inset-x-2 bottom-6 flex flex-col gap-2">
      <section className="overflow-hidden rounded-card bg-ios-sheet text-center backdrop-blur">
        <h2 className="border-b border-ios-separator px-4 py-3 text-caption font-semibold text-muted">{title}</h2>
        {actions.map((action) => <button key={action.label} type="button" disabled={action.disabled} onClick={() => { action.onClick(); onClose(); }} className={`block min-h-14 w-full border-b border-ios-separator px-4 text-section disabled:opacity-50 ${action.danger ? 'text-ios-red' : 'text-ios-blue'}`}>{action.label}</button>)}
      </section>
      <button type="button" onClick={onClose} autoFocus className="min-h-14 rounded-card bg-ios-sheet text-section font-bold text-ios-blue backdrop-blur">{copy.common.cancel}</button>
    </div>
  </div>, layer);
}

export interface PickerOption<T extends string> { value: T; label: string }
export function IosPicker<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: PickerOption<T>[]; onChange: (value: T) => void }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label={`${label}: ${options.find((item) => item.value === value)?.label ?? value}`} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-input border border-line bg-surface px-4 font-ios text-body">
      <span className="text-muted">{label}</span><span className="flex items-center gap-2 font-semibold">{options.find((item) => item.value === value)?.label}<ChevronDown size={16} aria-hidden /></span>
    </button>
    <BottomSheet open={open} title={label} onClose={() => setOpen(false)}>
      <div role="listbox" aria-label={label} className="overflow-hidden rounded-input bg-white">
        {options.map((item) => <button key={item.value} type="button" role="option" aria-selected={item.value === value} onClick={() => { onChange(item.value); setOpen(false); }} className="min-h-11 w-full border-b border-ios-separator px-4 text-left text-body last:border-0">{item.label}</button>)}
      </div>
    </BottomSheet>
  </>;
}
