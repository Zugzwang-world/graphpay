// The phones' views for scenes 7 to 10: a scoreboard read from the graph, the team with its ENS
// names and switches, a plain list of this run's payments, and the same list replayed fast.

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { percent, microUsdt } from '../../web/lib/stage/format.ts';
import type { CustomerState, HealState } from './api';
import { agentOf, cast, links, networks } from './cast';
import { Card, Figure, ProofLink } from './ui';

const BOARD = 'query Board($ens: String!) { node(ens: $ens) { ens key tally(window: "all") { orders paidMicro refunds refundedMicro } reputation(window: D90) { orders refunds refundRate onTimeRate synthetic } } }';

interface Board {
  ens: string;
  key: string | null;
  tally: { orders: string; paidMicro: string; refunds: string; refundedMicro: string } | null;
  reputation: { orders: string; refunds: string; refundRate: string; onTimeRate: string; synthetic: boolean } | null;
}

// One read of a node's scoreboard from the graph (GET /api/graphql), when the view opens.
export function ScoreboardView({ ens, title }: { ens: string; title: string }) {
  const [board, setBoard] = useState<Board | null | 'none'>(null);
  useEffect(() => {
    let live = true;
    const params = new URLSearchParams({ query: BOARD, variables: JSON.stringify({ ens }) });
    fetch(`/api/graphql?${params.toString()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { data?: { node?: Board | null } } | null) => live && setBoard(body?.data?.node ?? 'none'))
      .catch(() => live && setBoard('none'));
    return () => {
      live = false;
    };
  }, [ens]);
  const b = board && board !== 'none' ? board : null;
  return (
    <div className="flex flex-col gap-3">
      <p className="font-heading text-title font-bold text-ink">{title}</p>
      <p className="truncate text-caption text-muted">{ens}</p>
      {board === null ? <p className="stage-fade text-body text-muted">Reading the graph on {networks.arkiv}.</p> : null}
      {board === 'none' ? <p className="text-body text-muted">The graph did not answer. It is read again when this scene opens.</p> : null}
      {b ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Orders" value={b.tally?.orders ?? b.reputation?.orders ?? ''} />
            <Stat label="Refunds" value={b.tally?.refunds ?? b.reputation?.refunds ?? ''} />
            <Stat label="Paid" value={b.tally ? `${microUsdt(b.tally.paidMicro)}` : ''} />
            <Stat label="Refund rate" value={b.reputation ? percent(Number(b.reputation.refundRate)) : ''} />
          </div>
          {b.reputation?.synthetic ? <p className="text-caption text-muted">Includes sample data, labelled on the graph.</p> : null}
          {b.key ? <ProofLink href={links.arkivEntity(b.key)} network={networks.arkiv} label="Scoreboard" now={Date.now()} /> : null}
          <p className="text-caption text-muted">Kept current in the same write as each payment.</p>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  if (value === '') return null;
  return (
    <Card className="stage-slide p-3">
      <p className="text-caption text-muted">{label}</p>
      <p className="tabular font-heading text-amount font-bold text-ink">{value}</p>
    </Card>
  );
}

export function AgentsView({ side, state, heal }: { side: 'customer' | 'merchant'; state: CustomerState | null; heal: HealState | null }) {
  const roles = side === 'customer' ? ['concierge', 'scout', 'analyst', 'payer'] : ['storefront', 'risk', 'dispatch'];
  return (
    <div className="flex flex-col gap-2">
      <p className="font-heading text-title font-bold text-ink">{side === 'customer' ? 'Each agent, its own name' : 'The shop’s agents'}</p>
      {roles.map((role) => {
        const a = agentOf(role);
        if (!a) return null;
        const ens = a.ens;
        const raw = role === 'payer' ? state?.agent.status?.toLowerCase() : heal?.agents.find((x) => x.ens === ens)?.status;
        const pausable = role === 'payer' || role === 'scout';
        const paused = raw === 'paused';
        return (
          <Card key={role} className="stage-slide flex items-center gap-3 p-2">
            <Figure role={role} status={paused ? 'paused' : 'active'} size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-body font-bold text-ink">{a.label}</p>
              {links.ensName(ens) ? (
                <a href={links.ensName(ens)!} target="_blank" rel="noopener noreferrer" className="block truncate text-caption font-bold text-info">
                  {ens}
                </a>
              ) : (
                <p className="truncate text-caption text-muted">{ens}</p>
              )}
            </div>
            {pausable ? (
              <span className={clsx('stage-switch', paused ? 'is-off' : 'is-on')} role="img" aria-label={paused ? 'paused' : 'active'}>
                <span />
              </span>
            ) : (
              <span className="text-caption text-muted">{side === 'customer' ? 'no pass' : ''}</span>
            )}
          </Card>
        );
      })}
      <p className="text-caption text-muted">Only the owner can pause an agent or change its cap.</p>
    </div>
  );
}

export interface ProofItem {
  key: string;
  label: string;
  amount?: string;
  href: string | null;
  network: string;
  at: number | null;
  tone?: 'ok' | 'bad';
}

// A plain list of this run's payments; `replay` plays it again fast, one row after another.
export function ProofList({ title, items, now, replay = false, empty }: { title: string; items: ProofItem[]; now: number; replay?: boolean; empty: string }) {
  const [shown, setShown] = useState(replay ? 0 : items.length);
  useEffect(() => {
    if (!replay) {
      setShown(items.length);
      return;
    }
    setShown(0);
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= items.length) clearInterval(t);
    }, 650);
    return () => clearInterval(t);
  }, [replay, items.length]);
  return (
    <div className="flex flex-col gap-2">
      <p className="font-heading text-title font-bold text-ink">{title}</p>
      {items.length === 0 ? <p className="text-body text-muted">{empty}</p> : null}
      {items.slice(0, shown).map((i) => (
        <Card key={i.key} tone={i.tone} className={clsx('flex items-center gap-3 p-3', replay ? 'stage-replay' : 'stage-slide')}>
          <div className="min-w-0 flex-1">
            <p className="text-body font-bold text-ink">{i.label}</p>
            <ProofLink href={i.href} network={i.network} at={i.at} now={now} />
          </div>
          {i.amount ? <p className={clsx('tabular font-heading text-section font-bold', i.tone === 'bad' ? 'text-bad' : 'text-ink')}>{i.amount}</p> : null}
        </Card>
      ))}
    </div>
  );
}

export const castName = (role: string) => cast.agents[role]?.label ?? role;
