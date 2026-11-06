'use client';

// The stage's top bar (final website brief §4), left to right: the wordmark; labelled links to
// GraphPay's own public records (ENS, Whitechain, Arkiv, Swarm, the facilitator); Proofs, the live
// features that are not in the demo; This run, a chip for each record the demo makes, with its
// network and age; and the repository. Every link is a public page, opened in a new tab.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { addressUrl } from '@/lib/explorer';
import { ago } from '@/lib/stage/format';
import { proofs } from '@/lib/stage/proofs';
import { useSite } from './site-context';

interface SwarmLinks {
  menus?: Record<string, string>;
}

function Menu({ label, children, wide = false }: { label: ReactNode; children: ReactNode; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div className="bar-menu" ref={root}>
      <button type="button" className="bar-link" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {label}
      </button>
      {open ? <div className={`bar-pop${wide ? ' is-wide' : ''}`}>{children}</div> : null}
    </div>
  );
}

const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;

export function TopBar() {
  const { model, chips } = useSite();
  const [swarm, setSwarm] = useState<SwarmLinks | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    fetch('/phones/swarm.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: SwarmLinks | null) => setSwarm(j))
      .catch(() => setSwarm(null));
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const l = model.links;
  const ens = l.ensApp ? `${l.ensApp.replace(/\/+$/, '')}/${model.root}` : null;
  const checkout = addressUrl(model.explorers, 'whitechain', l.checkout);
  const writers = [
    { label: 'The money mirror', href: addressUrl(model.explorers, 'rabdi', l.writers.mirror) },
    { label: 'The shop directory', href: addressUrl(model.explorers, 'rabdi', l.writers.directory) },
    { label: 'The sync writer', href: addressUrl(model.explorers, 'rabdi', l.writers.sync) },
  ].filter((w): w is { label: string; href: string } => w.href !== null);
  const menus = Object.entries(swarm?.menus ?? {}).map(([shop, href]) => ({ label: model.shops.find((s) => s.ens === shop)?.displayName ?? shop, href }));
  const list = proofs(model);
  const latest = [...chips].sort((a, b) => b.at - a.at);
  const shown = latest.slice(0, 3);
  const rest = latest.slice(3);

  return (
    <header className="topbar">
      <a href="/" className="brand" aria-label="GraphPay, the stage">
        <span className="brand-name">GraphPay</span>
      </a>
      <nav className="bar-records" aria-label="GraphPay’s public records">
        {ens ? (
          <a className="bar-link" href={ens} {...ext}>
            ENS
          </a>
        ) : null}
        {checkout ? (
          <a className="bar-link" href={checkout} {...ext}>
            Whitechain
          </a>
        ) : null}
        {writers.length ? (
          <Menu label="Arkiv">
            {writers.map((w) => (
              <a key={w.href} href={w.href} {...ext}>
                {w.label}
              </a>
            ))}
          </Menu>
        ) : null}
        {menus.length ? (
          <Menu label="Swarm">
            {menus.map((m) => (
              <a key={m.href} href={m.href} {...ext}>
                {m.label}’s menu
              </a>
            ))}
          </Menu>
        ) : null}
        <a className="bar-link" href="/api/facilitator/health" {...ext}>
          Facilitator
        </a>
        <Menu label="Proofs" wide>
          {list.map((p) => (
            <div key={p.key} className="bar-proof">
              <p className="bar-proof-title">{p.title}</p>
              <p className="bar-proof-by">{p.activity}</p>
              <div className="bar-proof-links">
                {p.links.map((x) => (
                  <a key={x.href} href={x.href} {...ext}>
                    {x.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </Menu>
      </nav>
      <div className="bar-run" aria-label="This run" aria-live="polite">
        {shown.length ? <span className="bar-run-label">This run</span> : null}
        {shown.map((c) => (
          <a key={c.key} className="run-chip" href={c.href} {...ext}>
            {c.label}: {c.network}, {ago(c.at, now)}
          </a>
        ))}
        {rest.length ? (
          <Menu label={`${rest.length} more`}>
            {rest.map((c) => (
              <a key={c.key} href={c.href} {...ext}>
                {c.label}: {c.network}, {ago(c.at, now)}
              </a>
            ))}
          </Menu>
        ) : null}
      </div>
      {l.repo ? (
        <a className="bar-link bar-repo" href={l.repo} {...ext}>
          GitHub
        </a>
      ) : null}
    </header>
  );
}
