import { useEffect, useState } from 'react';
import { AgentAvatar, type AgentVisualState } from './AgentAvatar';
import { IosTextInput } from './IosKeyboard';
import type { AgentRef, Money } from '@/demo/contract';
import { checkAmount, formatMoney } from '@/lib/money';
import { copy, fill } from '@/copy';

export function AmountEntry({ label, max, value, onConfirm, onEdit, agent, agentLabel, readOnly = false, variant = 'default' }: { label: string; max?: Money; value: Money | null; onConfirm: (value: Money) => void; onEdit?: () => void; agent?: AgentRef; agentLabel?: string; readOnly?: boolean; variant?: 'default' | 'cap' }) {
  const [editing, setEditing] = useState(value === null);
  const [draft, setDraft] = useState(value?.amount ?? '');
  const [touched, setTouched] = useState(false);
  const [focusOnMount, setFocusOnMount] = useState(false);
  useEffect(() => {
    if (value === null) { setEditing(true); return; }
    if (!editing) setDraft(value.amount);
  }, [value?.amount, value === null]);

  const result = checkAmount(draft, max);
  const problem = !result.ok && (touched || draft !== '') ? fill(copy.amount.problems[result.problem], { max: max ? formatMoney(max) : '' }) : null;
  const confirm = () => {
    setTouched(true);
    if (!result.ok) return;
    onConfirm(result.value);
    setEditing(false);
    setFocusOnMount(false);
  };
  if (readOnly || (!editing && value)) return <div className="flex min-h-11 items-center justify-between gap-3 rounded-input border border-line bg-surface px-4 text-body">
    <span><span className="text-muted">{label}</span> <strong className="tabular">{value ? formatMoney(value) : max ? formatMoney(max) : ''}</strong></span>
    {!readOnly && <button type="button" onClick={() => { setDraft(value?.amount ?? ''); setTouched(false); setFocusOnMount(true); setEditing(true); onEdit?.(); }} className="min-h-11 px-2 font-bold text-info">{copy.common.edit}</button>}
  </div>;

  const cheeky = result.ok ? null : variant === 'cap' ? copy.amount.capComeOnBro[0] : result.problem === 'above_max' && max ? fill(copy.amount.comeOnBro[0], { max: formatMoney(max) }) : copy.amount.invalidComeOnBro;
  const avatarState: AgentVisualState = problem ? 'disappointed' : 'idle';
  return <div className="flex flex-col gap-2">
    <IosTextInput label={label} value={draft} onChange={(next) => { setDraft(next); setTouched(true); }} onDone={confirm} mode="number" canDone={result.ok} invalid={Boolean(problem)} error={problem ?? undefined} focusOnMount={focusOnMount} />
    <p className="text-caption text-muted">{max ? fill(copy.amount.allowedMax, { max: formatMoney(max) }) : copy.amount.allowedPositive}</p>
    {problem && <div role="note" className="flex items-center gap-3 rounded-card border border-bad bg-surface p-3 text-body">
      {agent && <AgentAvatar agent={agent} label={agentLabel ?? agent.role} activity={avatarState} size={40} />}
      <span>{cheeky}</span>
    </div>}
    <button type="button" onClick={confirm} disabled={!result.ok} className="min-h-11 rounded-full bg-brand px-4 text-body font-bold text-white disabled:opacity-50">{copy.common.done}</button>
  </div>;
}
