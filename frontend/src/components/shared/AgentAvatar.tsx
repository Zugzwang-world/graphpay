import { useState } from 'react';
import clsx from 'clsx';
import type { AgentRef, AgentStatus } from '@/demo/contract';
import { copy } from '@/copy';
import { story } from '@/data/story';

export type AgentVisualState = 'idle' | 'thinking' | 'checking' | 'paid' | 'success' | 'refused' | 'rejected' | 'disappointed' | 'paused' | 'revoked' | 'approving' | 'declining' | 'welcoming' | 'talking';

const ring: Record<string, string> = {
  concierge: 'var(--color-agent-concierge)', scout: 'var(--color-agent-scout)', analyst: 'var(--color-agent-analyst)', payer: 'var(--color-agent-payer)',
  storefront: 'var(--color-agent-storefront)', risk: 'var(--color-agent-risk)', dispatch: 'var(--color-agent-dispatch)',
};

// Grok's figurine for the agent's state: <avatar>-<state>.png (idle, thinking, talking, success, refused).
const figurine = (visual: string): string =>
  visual === 'thinking' || visual === 'checking' ? 'thinking' : visual === 'success' || visual === 'paid' || visual === 'approving' || visual === 'welcoming' ? 'success' : visual === 'refused' || visual === 'rejected' || visual === 'declining' || visual === 'disappointed' ? 'refused' : visual === 'talking' ? 'talking' : 'idle';

/** Grok's figurine for the agent when the story names one, else the initial. The ring and motion follow the agent's role and activity. The ring and motion follow the agent's role and activity. */
export function AgentAvatar({ agent, label, status = 'active', activity = 'idle', size = 48 }: { agent: AgentRef; label: string; status?: AgentStatus; activity?: AgentVisualState; size?: number }) {
  const [details, setDetails] = useState(false);
  const [broken, setBroken] = useState(false);
  const color = ring[agent.role] ?? 'var(--color-agent-fallback)';
  const base = [...story.agents, ...story.shop.agents].find((a) => a.role === agent.role)?.avatar ?? null;
  const visual = activity === 'refused' || activity === 'rejected' ? activity : status === 'revoked' ? 'revoked' : status === 'paused' ? 'paused' : activity;
  return <span className="relative inline-flex shrink-0 flex-col items-center gap-1">
    <button type="button" onClick={() => setDetails((value) => !value)} aria-label={`${label}, ${agent.ens}, ${status}`} aria-expanded={details} title={`${agent.ens} · ${status}`} className={clsx('relative flex items-center justify-center rounded-full border-[3px] bg-surface font-heading font-bold text-ink shadow-card', `avatar-${visual}`, visual === 'revoked' && 'grayscale opacity-60')} style={{ width: size, height: size, borderColor: color }}>
      {base && !broken ? <img src={`${base}-${figurine(visual)}.png`} alt="" onError={() => setBroken(true)} className="h-full w-full rounded-full object-cover" /> : <span style={{ fontSize: size * 0.43 }}>{label.charAt(0).toUpperCase()}</span>}
      {(visual === 'refused' || visual === 'rejected') && <span className="absolute -right-1 bottom-0 text-caption text-info" aria-hidden>💧</span>}
      {visual === 'paused' && <span className="absolute -right-1 -top-1 text-caption" aria-hidden>z</span>}
      {visual === 'revoked' && <span className="absolute inset-0 flex items-center justify-center rounded-full bg-ink/50 text-title text-white" aria-hidden>×</span>}
      {(visual === 'success' || visual === 'paid' || visual === 'approving') && <span className="absolute -right-1 -top-1 text-caption text-ok" aria-hidden>✓</span>}
      {visual === 'declining' && <span className="absolute -right-1 -top-1 text-caption text-bad" aria-hidden>✋</span>}
    </button>
    {details && <span role="tooltip" className="absolute top-full left-1/2 z-20 mt-1 w-max max-w-52 -translate-x-1/2 rounded-input bg-ink px-3 py-2 text-caption text-white shadow-card"><span className="block font-bold">{label}</span><span className="break-all">{agent.ens}</span><span className="block">{copy.status[status]}</span></span>}
  </span>;
}
