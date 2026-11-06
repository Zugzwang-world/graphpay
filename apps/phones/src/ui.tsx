// The pieces both stage phones share, in the team's visual language (their tokens, type scale,
// figurines and cards): an agent's line, a proof link with its network and age, the team strip,
// the activity row, a photo loaded from Swarm with its link.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { ExternalLink } from 'lucide-react';
import type { AgentStatus } from '@/demo/contract';
import { ago } from '../../web/lib/stage/format.ts';
import { agentOf } from './cast';

export function ProofLink({ href, network, at, now, label }: { href: string | null; network: string; at?: number | null; now: number; label?: string }) {
  if (!href) return null;
  const age = at ? ago(at, now) : '';
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="stage-proof inline-flex min-h-8 items-center gap-1 rounded-full bg-info/10 px-3 text-caption font-bold text-info">
      <ExternalLink size={12} aria-hidden />
      {label ? `${label}: ` : ''}
      {network}
      {age ? `, ${age}` : ''}
    </a>
  );
}

// "Writing to Arkiv" until the record's edge lands; then its link.
export function ArkivPending() {
  return <span className="inline-flex min-h-8 items-center gap-2 rounded-full bg-soft px-3 text-caption font-bold text-muted"><span className="stage-pulse-dot" aria-hidden />Writing to Arkiv</span>;
}

export type Activity = 'idle' | 'thinking' | 'talking' | 'success' | 'refused';

// Grok's figurine for the agent in one of its five states (the team's AgentAvatar art, drawn here
// without its own button so a card can be the tap target).
export function Figure({ role, activity = 'idle', status = 'active', size }: { role: string; activity?: Activity; status?: AgentStatus; size: number }) {
  const a = agentOf(role);
  const base = a?.avatar ?? null;
  const state = status === 'revoked' ? 'refused' : activity;
  const [failed, setFailed] = useState<string | null>(null);
  const src = base ? `${base}-${state}.png` : null;
  if (!src || failed === src) return <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-soft font-heading font-bold text-ink" style={{ width: size * 0.7, height: size * 0.7, margin: size * 0.15 }}>{(a?.label ?? role).charAt(0)}</span>;
  return (
    <span className={clsx('stage-figure inline-flex shrink-0', `avatar-${state === 'talking' ? 'idle' : state}`, (status === 'paused' || status === 'revoked') && 'grayscale opacity-60')} style={{ width: size, height: size }}>
      <img src={src} alt="" className="h-full w-full object-contain" onError={() => setFailed(src)} />
    </span>
  );
}

export function Line({ role, text, tone, children, mine = false }: { role: string; text: string; tone?: 'ok' | 'bad'; children?: ReactNode; mine?: boolean }) {
  const a = agentOf(role);
  if (mine) {
    return (
      <div className="stage-line flex justify-end">
        <p className="max-w-[86%] rounded-[20px] rounded-br-[6px] bg-brand px-4 py-3 text-section leading-snug font-semibold text-white">{text}</p>
      </div>
    );
  }
  return (
    <div className="stage-line flex items-start gap-2">
      {a ? <Figure role={role} activity={tone === 'bad' ? 'refused' : tone === 'ok' ? 'success' : 'talking'} size={40} /> : null}
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-caption font-bold text-muted">{a?.label ?? role}</p>
        <p className={clsx('rounded-[18px] rounded-tl-[6px] border px-4 py-3 text-section leading-snug', tone === 'bad' ? 'border-bad/30 bg-bad/10 text-ink' : tone === 'ok' ? 'border-ok/30 bg-ok/10 text-ink' : 'border-line bg-surface text-ink')}>{text}</p>
        {children ? <div className="mt-2 flex flex-col gap-2">{children}</div> : null}
      </div>
    </div>
  );
}

export function Card({ children, tone, className }: { children: ReactNode; tone?: 'ok' | 'bad' | 'brand'; className?: string }) {
  return <div className={clsx('stage-card rounded-card border bg-surface p-3 shadow-card', tone === 'ok' ? 'border-ok/40' : tone === 'bad' ? 'border-bad/40' : tone === 'brand' ? 'border-brand/40' : 'border-line', className)}>{children}</div>;
}

// A photo from Swarm (the gateway link), falling back to the site's copy of the same file when the
// gateway is slow or does not answer, so a card never shows an empty frame.
export function SwarmPhoto({ swarm, local, className }: { swarm: string | null; local: string | null; className: string }) {
  const [src, setSrc] = useState(swarm ?? local);
  const loaded = useRef(false);
  useEffect(() => {
    if (!swarm || !local) return;
    const t = setTimeout(() => {
      if (!loaded.current) setSrc(local);
    }, 1500);
    return () => clearTimeout(t);
  }, [swarm, local]);
  if (!src) return null;
  return <img src={src} alt="" className={className} onLoad={() => (loaded.current = true)} onError={() => setSrc((s) => (s !== local && local ? local : null))} />;
}

export interface TeamMember {
  role: string;
  status: AgentStatus;
  activity: Activity;
}

export function TeamStrip({ members, speaking, onTap, selected }: { members: TeamMember[]; speaking: string | null; onTap?: (role: string) => void; selected?: string | null }) {
  return (
    <div className="flex items-end justify-center gap-3 px-4 pb-2">
      {members.map((m) => {
        const a = agentOf(m.role);
        if (!a) return null;
        const big = speaking === m.role;
        return (
          <button
            key={m.role}
            type="button"
            onClick={() => onTap?.(m.role)}
            className={clsx('stage-member flex flex-col items-center gap-1 rounded-card px-1 pt-1 pb-1', selected === m.role && 'bg-brand/10')}
            data-big={big ? 'true' : 'false'}
            aria-pressed={selected === m.role}
            aria-label={`${a.label}, ${a.ens}`}
          >
            <Figure role={m.role} activity={m.activity} status={m.status} size={big ? 74 : 44} />
            <span className={clsx('text-caption font-bold', m.status === 'paused' ? 'text-warn' : m.status === 'revoked' ? 'text-bad' : 'text-ink')}>{a.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export type ActivityState = 'idle' | 'on' | 'done' | 'blocked';

export function ActivityRow({ items }: { items: { label: string; state: ActivityState }[] }) {
  return (
    <div className="grid grid-cols-4 gap-2 border-t border-line bg-surface px-4 pt-3 pb-8">
      {items.map((i) => (
        <div key={i.label} className="stage-activity flex flex-col items-center gap-1 rounded-input py-2" data-state={i.state}>
          <span className="stage-activity-dot" aria-hidden />
          <span className="text-caption font-bold">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

// Keeps a scrolling panel at its newest line whenever `key` changes.
export function useAutoScroll(key: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const t = setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }), 60);
    return () => clearTimeout(t);
  }, [key]);
  return ref;
}
