'use client';

// Small pieces every scene of the middle shares: a link chip with its network and age, a figurine,
// the ENS name page of a name, and the scene's heading.

import { useEffect, useState, type ReactNode } from 'react';
import { ago } from '@/lib/stage/format';
import type { SiteModel } from '@/lib/site.server';

export function useClock(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function NetLink({ href, network, at, label, now }: { href: string | null | undefined; network: string; at?: number | null; label?: string; now: number }) {
  if (!href) return null;
  const age = at ? ago(at, now) : '';
  return (
    <a className="net-link" href={href} target="_blank" rel="noopener noreferrer">
      {label ? <span className="net-link-label">{label}</span> : null}
      <span>
        {network}
        {age ? `, ${age}` : ''}
      </span>
    </a>
  );
}

export function Pending({ children }: { children: ReactNode }) {
  return (
    <span className="net-pending">
      <i aria-hidden />
      {children}
    </span>
  );
}

export type FigureState = 'idle' | 'thinking' | 'talking' | 'success' | 'refused';

export function Figurine({ avatar, state = 'idle', size, className }: { avatar: string | null; state?: FigureState; size: number; className?: string }) {
  if (!avatar) return null;
  return <img className={className ? `figurine ${className}` : 'figurine'} src={`${avatar}-${state}.png`} alt="" width={size} height={size} style={{ width: size, height: size }} />;
}

export const ensPage = (model: SiteModel, name: string): string | null => (model.links.ensApp ? `${model.links.ensApp.replace(/\/+$/, '')}/${name}` : null);

export function SceneHead({ number, title, children }: { number: number; title: string; children?: ReactNode }) {
  return (
    <header className="scene-head">
      <span className="scene-number">{number}</span>
      <h2>{title}</h2>
      {children ? <div className="scene-head-side">{children}</div> : null}
    </header>
  );
}

export const roleOf = (ens: string): string => ens.split('.')[0] ?? ens;
