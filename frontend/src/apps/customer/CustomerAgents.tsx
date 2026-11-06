import { useState } from 'react';
import clsx from 'clsx';
import { RotateCcw } from 'lucide-react';
import { AgentAvatar } from '@/components/shared/AgentAvatar';
import { AmountEntry } from '@/components/shared/AmountEntry';
import { BottomSheet } from '@/components/shared/Overlays';
import { ExplorerLink, StatusChip, type StatusKind } from '@/components/shared/Primitives';
import { EmptyState, InlineBanner } from '@/components/shared/States';
import { useDemo, useDemoEvents } from '@/demo/DemoProvider';
import type { AgentState, Money, RefusedAttempt } from '@/demo/contract';
import { passRemaining } from '@/demo/rules';
import { story } from '@/data/story';
import { copy, fill } from '@/copy';
import { formatMoney, toCents, usdt } from '@/lib/money';
import { formatDateTime } from '@/lib/time';

type Action =
  | { kind: 'pause' | 'resume' | 'revoke' | 'selfRaise'; ens: string }
  | { kind: 'setCap'; ens: string; cap: Money };

export function agentCardStatus(agent: AgentState): StatusKind {
  if (agent.status === 'revoked') return 'revokedFinal';
  if (agent.status === 'paused') return 'paused';
  if (!agent.pass) return 'active';
  if (agent.pass.state === 'used_up') return 'usedUp';
  return agent.pass.state;
}

export function permissionChangeForAction(kind: Action['kind']): 'paused' | 'resumed' | 'revoked' | null {
  if (kind === 'pause') return 'paused';
  if (kind === 'resume') return 'resumed';
  if (kind === 'revoke') return 'revoked';
  return null;
}

function passChip(state: AgentState['pass']): StatusKind {
  if (!state) return 'active';
  return state.state === 'used_up' ? 'usedUp' : state.state;
}

/** C7: all roster, pass and refusal data comes from the shared snapshot. */
export function CustomerAgents() {
  const { snapshot, adapter } = useDemo();
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<{ ens: string; message: string } | null>(null);
  const [lastAction, setLastAction] = useState<Action | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [capTarget, setCapTarget] = useState<string | null>(null);
  const [capDraft, setCapDraft] = useState<Money | null>(null);
  const [capEntryOpen, setCapEntryOpen] = useState(false);
  const [capConfirmOpen, setCapConfirmOpen] = useState(false);

  useDemoEvents((event) => {
    if (event.type === 'demo.reset') { setPending(null); setError(null); setRevokeTarget(null); setCapTarget(null); setCapEntryOpen(false); setCapConfirmOpen(false); return; }
    if (!pending) return;
    if (event.type === 'agent.permission' && event.agent.ens === pending.ens && event.change === permissionChangeForAction(pending.kind)) setPending(null);
    if (event.type === 'agent.cap.changed' && pending.kind === 'setCap' && event.agent.ens === pending.ens) setPending(null);
    if (event.type === 'cap.change.refused' && pending.kind === 'selfRaise' && event.agent.ens === pending.ens) setPending(null);
  });

  const run = async (action: Action) => {
    if (pending) return;
    setPending(action); setError(null); setLastAction(action);
    try {
      switch (action.kind) {
        case 'pause': await adapter.pauseAgent(action.ens); break;
        case 'resume': await adapter.resumeAgent(action.ens); break;
        case 'revoke': await adapter.revokeAgent(action.ens); break;
        case 'selfRaise': await adapter.tryRaiseCap(action.ens, usdt(story.demo.capRaiseAttemptUsdt)); break;
        case 'setCap':
          if (!adapter.setCap) throw new Error(copy.customer.agents.capUnavailable);
          await adapter.setCap(action.ens, action.cap);
          break;
      }
    } catch (cause) { setPending(null); setError({ ens: action.ens, message: cause instanceof Error ? cause.message : copy.common.errorGeneric }); }
  };
  const openCap = (ens: string) => { setCapTarget(ens); setCapDraft(null); setCapEntryOpen(true); };
  const agents = [...(snapshot?.agents ?? [])].sort((a, b) => Number(b.main) - Number(a.main));
  const mainAgent = agents.find((agent) => agent.main);
  const revokeAgent = agents.find((agent) => agent.ref.ens === revokeTarget);
  const capAgent = agents.find((agent) => agent.ref.ens === capTarget);
  return <div className="flex flex-col gap-4 p-4 pb-8">
    <h2 className="font-heading text-title font-bold">{copy.customer.agents.title}</h2>
    {agents.length === 0 && <EmptyState title={copy.customer.agents.empty} />}
    {agents.map((agent) => <AgentCard key={agent.ref.ens} agent={agent} mainLabel={mainAgent?.label} busy={pending !== null} pendingKind={pending?.ens === agent.ref.ens ? pending.kind : null} error={error?.ens === agent.ref.ens ? error.message : null} onRetry={() => { if (lastAction?.ens === agent.ref.ens) void run(lastAction); }} onAction={(kind) => void run({ kind, ens: agent.ref.ens })} onRevoke={() => setRevokeTarget(agent.ref.ens)} onCap={() => openCap(agent.ref.ens)} />)}
    <BottomSheet open={revokeTarget !== null} title={fill(copy.customer.agents.revokeTitle, { agent: revokeAgent?.label ?? '' })} onClose={() => setRevokeTarget(null)} actions={<><button type="button" onClick={() => setRevokeTarget(null)} className="min-h-11 rounded-full border border-line px-4 text-body font-bold">{copy.common.cancel}</button><button type="button" onClick={() => { if (revokeTarget) void run({ kind: 'revoke', ens: revokeTarget }); setRevokeTarget(null); }} className="min-h-11 rounded-full bg-bad px-4 text-body font-bold text-white">{copy.customer.agents.revokeConfirm}</button></>}><p className="text-body">{copy.customer.agents.revokeBody}</p></BottomSheet>
    <BottomSheet open={capEntryOpen} title={fill(copy.customer.agents.capTitle, { agent: capAgent?.label ?? '' })} onClose={() => setCapEntryOpen(false)}>{capAgent && <AmountEntry key={capAgent.ref.ens} label={copy.customer.agents.changeCap} value={capDraft} onConfirm={(amount) => { setCapDraft(amount); setCapEntryOpen(false); setCapConfirmOpen(true); }} agent={capAgent.ref} agentLabel={capAgent.label} variant="cap" />}</BottomSheet>
    <BottomSheet open={capConfirmOpen} title={copy.customer.agents.changeCap} onClose={() => setCapConfirmOpen(false)} actions={<><button type="button" onClick={() => { setCapConfirmOpen(false); setCapEntryOpen(true); }} className="min-h-11 rounded-full border border-line px-4 text-body font-bold">{copy.common.edit}</button><button type="button" disabled={!capDraft || !capTarget} onClick={() => { if (capTarget && capDraft) void run({ kind: 'setCap', ens: capTarget, cap: capDraft }); setCapConfirmOpen(false); }} className="min-h-11 rounded-full bg-brand px-4 text-body font-bold text-white disabled:opacity-50">{copy.common.confirm}</button></>}><p className="text-body">{fill(copy.customer.agents.capConfirm, { amount: capDraft ? formatMoney(capDraft) : '' })}</p></BottomSheet>
  </div>;
}

function AgentCard({ agent, mainLabel, busy, pendingKind, error, onRetry, onAction, onRevoke, onCap }: { agent: AgentState; mainLabel?: string; busy: boolean; pendingKind: Action['kind'] | null; error: string | null; onRetry: () => void; onAction: (kind: 'pause' | 'resume' | 'selfRaise') => void; onRevoke: () => void; onCap: () => void }) {
  const [nameDetails, setNameDetails] = useState(false);
  const progress = agent.pass ? Math.min(100, Math.round(toCents(agent.pass.used) / Math.max(1, toCents(agent.pass.cap)) * 100)) : 0;
  return <article className={clsx('flex flex-col gap-3 rounded-card border bg-surface p-4 shadow-card', agent.status === 'revoked' ? 'border-bad opacity-75' : agent.status === 'paused' ? 'border-warn' : 'border-line')}>
    <div className="flex items-start gap-3"><AgentAvatar agent={agent.ref} label={agent.label} status={agent.status} size={48} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="relative"><button type="button" onClick={() => setNameDetails((value) => !value)} title={`${agent.ref.ens} · ${copy.status[agentCardStatus(agent)]}`} aria-expanded={nameDetails} className="min-h-9 text-left font-heading text-section font-bold">{agent.label}</button>{nameDetails && <span role="tooltip" className="absolute top-full left-0 z-10 w-48 rounded-input bg-ink p-2 text-caption text-white shadow-sheet"><span className="break-all">{agent.ref.ens}</span><span className="block">{copy.status[agentCardStatus(agent)]}</span></span>}</span><StatusChip status={agentCardStatus(agent)} /></div><p className="text-body text-muted">{agent.does}</p>{agent.main ? <p className="text-caption font-bold text-info">{copy.customer.agents.mainAgent}</p> : mainLabel && <p className="text-caption text-muted">{fill(copy.customer.agents.manages, { main: mainLabel })}</p>}</div></div>
    {agent.pass && agent.pays ? <div className="rounded-input border border-line bg-bg p-3"><div className="flex items-center justify-between gap-2"><p className="text-body font-bold">{fill(copy.customer.agents.passUsed, { used: agent.pass.used.amount, cap: agent.pass.cap.amount })}</p><StatusChip status={passChip(agent.pass)} /></div><div role="progressbar" aria-label={copy.customer.agents.passUsed.replace('{used}', agent.pass.used.amount).replace('{cap}', agent.pass.cap.amount)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="mt-3 h-2 w-full overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${progress}%` }} /></div><div className="mt-2 flex justify-between gap-2 text-caption text-muted"><span>{fill(copy.customer.agents.remaining, { amount: formatMoney(passRemaining(agent.pass)) })} · {copy.customer.agents.perDay}</span><span>{fill(copy.customer.agents.expires, { date: formatDateTime(agent.pass.expiresAt) })}</span></div></div> : <p className="rounded-input bg-soft p-3 text-body text-muted">{copy.customer.agents.cannotSpend}</p>}
    {agent.status !== 'revoked' && <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => onAction(agent.status === 'paused' ? 'resume' : 'pause')} className="min-h-11 rounded-full bg-brand px-4 text-body font-bold text-white disabled:opacity-50">{busy && (pendingKind === 'pause' || pendingKind === 'resume') ? `${agent.status === 'paused' ? copy.customer.agents.resume : copy.customer.agents.pause}…` : agent.status === 'paused' ? copy.customer.agents.resume : copy.customer.agents.pause}</button><button type="button" disabled={busy} onClick={onRevoke} className="min-h-11 rounded-full border border-bad px-4 text-body font-bold text-bad disabled:opacity-50">{copy.customer.agents.revoke}</button>{agent.pays && agent.pass && <><button type="button" disabled={busy} onClick={onCap} className="min-h-11 rounded-full border border-line px-4 text-body font-bold disabled:opacity-50">{copy.customer.agents.changeCap}</button><button type="button" disabled={busy} onClick={() => onAction('selfRaise')} className="min-h-11 rounded-full px-4 text-left text-caption font-bold text-info underline disabled:opacity-50">{copy.customer.agents.tryRaise}</button></>}</div>}
    {pendingKind && <p role="status" className="text-caption text-warn">{copy.customer.agents.working}</p>}
    {error && <InlineBanner tone="bad"><span>{error}</span><button type="button" onClick={onRetry} className="ml-2 inline-flex items-center gap-1 font-bold underline"><RotateCcw size={14} aria-hidden />{copy.common.retry}</button></InlineBanner>}
    {agent.refusedAttempts.length > 0 && <div className="flex flex-col gap-2 border-t border-line pt-3">{[...agent.refusedAttempts].reverse().map((attempt) => <RefusedEntry key={attempt.id} agent={agent} attempt={attempt} />)}</div>}
  </article>;
}

function RefusedEntry({ agent, attempt }: { agent: AgentState; attempt: RefusedAttempt }) {
  const capChange = attempt.reason === 'cap_change';
  const reason = capChange ? fill(copy.customer.agents.capRefusedBody, { amount: attempt.attempted ? formatMoney(attempt.attempted) : '', customer: story.customer.name }) : copy.refusal[attempt.reason];
  return <div className="rounded-input border border-bad bg-bad/5 p-3"><div className="flex items-start gap-2"><AgentAvatar agent={agent.ref} label={agent.label} status={agent.status} activity="refused" size={36} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-body text-bad">{capChange ? copy.customer.agents.capRefusedTitle : copy.customer.agents.refusedAttempt}</strong><StatusChip status="refused" label={copy.customer.agents.refusedAttempt} /></div><p className="mt-1 text-body">{reason}</p>{attempt.attempted && !capChange && <p className="text-caption text-muted">{formatMoney(attempt.attempted)}</p>}<p className="text-caption text-muted">{formatDateTime(attempt.at)}</p><div className="mt-2 flex flex-wrap gap-2">{attempt.links.map((link, index) => <ExplorerLink key={`${link.url}-${index}`} link={link} />)}</div></div></div></div>;
}
