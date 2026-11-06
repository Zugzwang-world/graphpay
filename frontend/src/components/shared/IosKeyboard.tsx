import { useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { Delete, CornerDownLeft, ArrowBigUp } from 'lucide-react';
import clsx from 'clsx';
import { usePhoneLayer } from '@/components/stage/PhoneFrame';
import { useKeyboardLayout } from './AppShell';
import { useIsTouch } from '@/lib/useViewport';
import { copy } from '@/copy';

export type KeyboardMode = 'text' | 'number';
const letters = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const symbols = ['1234567890', '@#$%&-+()', '*/:;!?'];
const KEYBOARD_HEIGHT = 316;

export interface IosTextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onDone?: () => void;
  mode?: KeyboardMode;
  returnLabel?: string;
  canDone?: boolean;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  error?: string;
  focusOnMount?: boolean;
  labelHidden?: boolean;
  className?: string;
}

/** A controlled field with one shared iOS-style text or number keyboard. */
export function IosTextInput({ label, value, onChange, onDone, mode = 'text', returnLabel = copy.common.done, canDone = true, placeholder, multiline = false, disabled = false, invalid = false, error, focusOnMount = false, labelHidden = false, className }: IosTextInputProps) {
  const id = useId();
  const layer = usePhoneLayer();
  const { setKeyboard } = useKeyboardLayout();
  const isTouch = useIsTouch();
  const nativeKeyboard = isTouch && window.innerWidth <= 500;
  const input = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const [open, setOpen] = useState(false);
  const [symbolsOpen, setSymbolsOpen] = useState(false);
  const [shifted, setShifted] = useState(true);
  const [caps, setCaps] = useState(false);
  const [pressed, setPressed] = useState<string | null>(null);
  const [pop, setPop] = useState<string | null>(null);
  const lastShift = useRef(0);
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const repeatDelay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = () => { setOpen(false); setKeyboard(false, 0); input.current?.blur(); };
  useEffect(() => {
    const frame = focusOnMount ? requestAnimationFrame(() => input.current?.focus()) : null;
    return () => { if (frame !== null) cancelAnimationFrame(frame); setKeyboard(false, 0); };
    // Focus only on mount. The parent remounts this field when Edit is pressed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (input.current?.contains(target) || (target instanceof Element && target.closest('[data-ios-keyboard]'))) return;
      close();
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  });
  useEffect(() => () => {
    if (repeat.current) clearInterval(repeat.current);
    if (repeatDelay.current) clearTimeout(repeatDelay.current);
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  const flash = (key: string) => {
    setPressed(key);
    setPop(key.length === 1 && key !== ' ' ? key : null);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => { setPressed(null); setPop(null); }, 180);
  };

  const commit = (next: string, caret: number) => {
    valueRef.current = next;
    onChange(next);
    requestAnimationFrame(() => input.current?.setSelectionRange(caret, caret));
  };

  const insert = (character: string) => {
    const field = input.current;
    if (!field) return;
    const start = field.selectionStart ?? valueRef.current.length;
    const end = field.selectionEnd ?? start;
    const next = `${valueRef.current.slice(0, start)}${character}${valueRef.current.slice(end)}`;
    if (mode === 'number' && !/^\d*(?:\.\d{0,2})?$/.test(next)) return;
    commit(next, start + character.length);
    if (mode === 'text' && !caps) setShifted(next.length === 0 || /[.!?]\s*$/.test(next));
  };

  const remove = () => {
    const field = input.current;
    if (!field) return;
    const start = field.selectionStart ?? valueRef.current.length;
    const end = field.selectionEnd ?? start;
    if (start === 0 && end === 0) return;
    const from = start === end ? start - 1 : start;
    const next = `${valueRef.current.slice(0, from)}${valueRef.current.slice(end)}`;
    commit(next, from);
    if (mode === 'text' && !caps) setShifted(next.length === 0 || /[.!?]\s*$/.test(next));
  };

  const press = (key: string) => {
    flash(key);
    if (key === 'delete') { remove(); return; }
    if (key === 'done') { if (canDone) { onDone?.(); close(); } return; }
    if (key === 'shift') {
      const now = Date.now();
      if (now - lastShift.current < 350) { setCaps(true); setShifted(true); }
      else if (caps) { setCaps(false); setShifted(false); }
      else setShifted((current) => !current);
      lastShift.current = now;
      return;
    }
    if (key === 'symbols') { setSymbolsOpen((current) => !current); return; }
    if (key === 'emoji') { insert('😊'); return; }
    const char = mode === 'text' && /[a-z]/i.test(key) && key.length === 1 && !symbolsOpen && (shifted || caps) ? key.toUpperCase() : key;
    insert(char);
  };

  const physicalKey = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key;
    if (nativeKeyboard) {
      if (key === 'Enter') { event.preventDefault(); if (canDone) { onDone?.(); close(); } }
      return;
    }
    if (key === 'Tab' || key.startsWith('Arrow')) return;
    if (key === 'Enter') { event.preventDefault(); press('done'); return; }
    if (key === 'Backspace') { event.preventDefault(); press('delete'); return; }
    if (key === 'Shift') { event.preventDefault(); press('shift'); return; }
    if (key.length === 1) { event.preventDefault(); press(key); }
  };

  const stopDelete = () => {
    if (repeatDelay.current) clearTimeout(repeatDelay.current);
    if (repeat.current) clearInterval(repeat.current);
    repeatDelay.current = null;
    repeat.current = null;
  };
  useEffect(() => {
    if (!open) return;
    window.addEventListener('pointerup', stopDelete);
    window.addEventListener('pointercancel', stopDelete);
    return () => { window.removeEventListener('pointerup', stopDelete); window.removeEventListener('pointercancel', stopDelete); };
  }, [open]);
  const startDelete = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    press('delete');
    repeatDelay.current = setTimeout(() => { repeat.current = setInterval(() => press('delete'), 75); }, 400);
  };

  const fieldClass = clsx('min-h-11 w-full rounded-input border bg-surface px-4 py-3 font-body text-body text-ink placeholder:text-muted focus:outline-none', invalid ? 'border-bad' : 'border-line', multiline && 'min-h-24 resize-none', className);
  const common = { id, value, placeholder, disabled, 'aria-invalid': invalid, 'aria-describedby': error ? `${id}-error` : undefined, onFocus: () => { setOpen(true); setKeyboard(true, nativeKeyboard ? 0 : KEYBOARD_HEIGHT); }, onBlur: () => { setOpen(false); setKeyboard(false, 0); }, onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { valueRef.current = event.target.value; onChange(event.target.value); }, onKeyDown: physicalKey, className: fieldClass };

  return <>
    <label htmlFor={id} className={clsx('mb-2 block text-body font-bold', labelHidden && 'sr-only')}>{label}</label>
    {multiline ? <textarea {...common} ref={input as Ref<HTMLTextAreaElement>} /> : <input {...common} ref={input as Ref<HTMLInputElement>} type="text" inputMode={mode === 'number' ? 'decimal' : 'text'} />}
    {error && <p id={`${id}-error`} role="alert" className="mt-1 text-caption text-bad">{error}</p>}
    {open && !nativeKeyboard && layer && createPortal(<div data-ios-keyboard className="absolute inset-x-0 bottom-0 z-[35] h-[316px] bg-ios-keyboard px-1 pt-2 pb-7 font-ios text-ink shadow-sheet keyboard-enter" onPointerUp={stopDelete} onPointerCancel={stopDelete}>
      {mode === 'number' ? <div className="grid h-full grid-cols-3 grid-rows-5 gap-1 pb-1">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'delete'].map((key) => <KeyButton key={key} value={key} pressed={pressed === key} pop={pop === key} onClick={() => key !== 'delete' && press(key)} onPointerDown={key === 'delete' ? startDelete : undefined} />)}
        <button type="button" disabled={!canDone} onPointerDown={(event) => event.preventDefault()} onClick={() => press('done')} className="col-span-3 min-h-11 rounded-input bg-ios-blue text-body font-bold text-white disabled:opacity-50">{returnLabel}</button>
      </div> : <>
        {(symbolsOpen ? symbols : letters).map((row, rowIndex) => <div key={rowIndex} className="mb-2 flex justify-center gap-1">
          {rowIndex === 2 && <KeyButton value="shift" pressed={pressed === 'shift' || caps} onClick={() => press('shift')} />}
          {[...row].map((key) => <KeyButton key={key} value={shifted || caps ? key.toUpperCase() : key} pressed={pressed?.toLowerCase() === key.toLowerCase()} pop={pop?.toLowerCase() === key.toLowerCase()} onClick={() => press(key)} />)}
          {rowIndex === 2 && <KeyButton value="delete" pressed={pressed === 'delete'} onClick={() => {}} onPointerDown={startDelete} />}
        </div>)}
        <div className="flex gap-1"><KeyButton value="symbols" label={symbolsOpen ? copy.common.letters : copy.common.numbers} pressed={pressed === 'symbols'} wide onClick={() => press('symbols')} /><KeyButton value="emoji" label="☺" pressed={pressed === 'emoji'} onClick={() => press('emoji')} /><KeyButton value=" " label={copy.common.space} pressed={pressed === ' '} grow onClick={() => press(' ')} /><KeyButton value="done" label={returnLabel} pressed={pressed === 'done'} disabled={!canDone} accent onClick={() => press('done')} /></div>
      </>}
    </div>, layer)}
  </>;
}

function KeyButton({ value, label, pressed, pop = false, disabled = false, wide = false, grow = false, accent = false, onClick, onPointerDown }: { value: string; label?: string; pressed: boolean; pop?: boolean; disabled?: boolean; wide?: boolean; grow?: boolean; accent?: boolean; onClick: () => void; onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void }) {
  return <button type="button" disabled={disabled} onPointerDown={onPointerDown ?? ((event) => event.preventDefault())} onClick={onClick} aria-label={value === 'delete' ? copy.common.delete : value === 'shift' ? copy.common.shift : value === ' ' ? copy.common.space : label ?? value} className={clsx('relative flex h-11 min-w-0 items-center justify-center rounded-[5px] text-section shadow-card disabled:opacity-50', grow ? 'flex-1' : wide ? 'w-12' : 'flex-1', accent ? 'bg-ios-blue font-bold text-white' : value === 'shift' || value === 'delete' || value === 'symbols' ? 'bg-ios-key-dark' : 'bg-ios-key', pressed && 'brightness-90')}>
    {pop && <span aria-hidden className="absolute -top-10 left-1/2 z-20 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-[6px] bg-white text-title shadow-card">{label ?? value}</span>}
    {value === 'delete' ? <Delete size={19} aria-hidden /> : value === 'shift' ? <ArrowBigUp size={19} aria-hidden /> : value === 'done' && !label ? <CornerDownLeft size={18} aria-hidden /> : <span className={clsx((wide || accent) && 'text-caption font-bold')}>{label ?? value}</span>}
  </button>;
}
