'use client';

// The stage on one screen: the customer’s phone, the middle and the shop's phone, side by side, with no
// page scroll. The director (./director.tsx) moves all three together; the middle shows the scene
// for the director's beat, with a transition between scenes; the top bar's "This run" gets a chip
// for each record the demo makes.

import { useEffect, useMemo, useRef, useState } from 'react';
import { txUrl, entityUrl } from '@/lib/explorer';
import { usdt, microUsdt } from '@/lib/stage/format';
import { stepIndex, type BeatKey } from '@/lib/stage/scenes';
import { useSite, type RunChip } from '../site-context';
import { Director, useDirector } from './director';
import { Fit } from './fit';
import { useReceipts } from './data';
import { SceneFilm } from './scene-film';
import { SceneCheckBack, SceneGraph, ScenePlain, SceneQueries, SceneTeams, SceneX402 } from './scenes-errand';
import { SceneArkiv, SceneClose, SceneEns, ScenePause, SceneRefund, SceneWhitechain } from './scenes-after';

export function Stage({ customerLabel, merchantLabel }: { customerLabel: string; merchantLabel: string }) {
  const customer = useRef<HTMLIFrameElement>(null);
  const merchant = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    document.body.classList.add('on-stage');
    return () => document.body.classList.remove('on-stage');
  }, []);
  return (
    <Director customer={customer} merchant={merchant}>
      <RunChips />
      <div className="stage">
        <iframe ref={customer} className="stage-phone" src="/phones/customer.html" title={customerLabel} />
        <Middle />
        <iframe ref={merchant} className="stage-phone" src="/phones/merchant.html" title={merchantLabel} />
      </div>
      <nav className="stage-small" aria-label="The two phones">
        <a href="/phones/customer.html">{customerLabel}</a>
        <a href="/phones/merchant.html">{merchantLabel}</a>
      </nav>
    </Director>
  );
}

function Middle() {
  const { model } = useSite();
  const d = useDirector();
  const receipts = useReceipts(
    model.shops.map((s) => s.ens),
    model.payer.ens,
    d.model.runId,
  );
  // The scene that is leaving stays for its exit, so the two cross.
  const [shown, setShown] = useState<{ beat: BeatKey; leaving: BeatKey | null }>({ beat: d.beat, leaving: null });
  useEffect(() => {
    if (d.beat === shown.beat) return;
    setShown({ beat: d.beat, leaving: shown.beat });
    const t = setTimeout(() => setShown((s) => ({ ...s, leaving: null })), 700);
    return () => clearTimeout(t);
  }, [d.beat, shown.beat]);
  const render = (beat: BeatKey) => {
    switch (beat) {
      case 'film':
        return <SceneFilm />;
      case 'teams':
        return <SceneTeams />;
      case 'plain':
        return <ScenePlain receipts={receipts} />;
      case 'queries':
        return <SceneQueries />;
      case 'graph':
        return <SceneGraph receipts={receipts} />;
      case 'check-back':
        return <SceneCheckBack receipts={receipts} />;
      case 'x402':
        return <SceneX402 />;
      case 'refund':
        return <SceneRefund />;
      case 'pause':
        return <ScenePause />;
      case 'arkiv':
        return <SceneArkiv />;
      case 'ens':
        return <SceneEns />;
      case 'whitechain':
        return <SceneWhitechain />;
      case 'close':
        return <SceneClose />;
    }
  };
  const failure = d.model.end && d.model.end.status !== 'paid' ? d.model.end : null;
  return (
    <main className="stage-middle" data-beat={shown.beat}>
      {shown.leaving ? (
        <div className="scene-layer is-leaving" key={`out-${shown.leaving}`} aria-hidden>
          <Fit>{render(shown.leaving)}</Fit>
        </div>
      ) : null}
      <div className="scene-layer is-entering" key={`in-${shown.beat}`}>
        <Fit>{render(shown.beat)}</Fit>
      </div>
      {failure && ['teams', 'plain', 'queries', 'graph', 'check-back', 'x402'].includes(shown.beat) ? <FailureNote /> : null}
    </main>
  );
}

function FailureNote() {
  const d = useDirector();
  const end = d.model.end;
  if (!end) return null;
  const why = end.reason ?? '';
  const text = /busy/i.test(why)
    ? 'Another errand is running. Try again in a minute.'
    : end.status === 'failed'
      ? 'The errand stopped before it paid. Nothing was paid. Try again in a minute.'
      : /ENS_PAUSED/.test(why)
        ? 'Refused: the payer is paused on ENS. Nothing was paid.'
        : 'No purchase this time. Nothing was paid.';
  return <p className="stage-failure">{text}</p>;
}

// "This run" in the top bar: a chip for each record this demo made, with its network and age.
function RunChips() {
  const { model, setChips } = useSite();
  const d = useDirector();
  const chips = useMemo(() => {
    const out: RunChip[] = [];
    const m = d.model;
    const x = model.explorers;
    const n = model.networks;
    if (m.paid) {
      const href = txUrl(x, 'whitechain', m.paid.tx);
      if (href && d.pace.shown >= stepIndex('settled')) out.push({ key: 'paid', label: `Paid ${usdt(m.paid.amountUsdt)}`, network: n.whitechain.name.split(' ')[0] ?? n.whitechain.name, href, at: m.arrived.settled ?? Date.now() });
    }
    const receipt = m.paid ? d.edges.find((e) => e.kind === 'pay' && e.settlementTx?.toLowerCase() === m.paid?.tx) : undefined;
    if (receipt) {
      const href = entityUrl(x, receipt.entityKey) ?? txUrl(x, 'rabdi', receipt.arkivTx);
      if (href) out.push({ key: 'receipt', label: 'Receipt', network: n.rabdi.name.split(' ')[0] ?? n.rabdi.name, href, at: receipt.at });
    }
    for (const e of d.events) {
      const data = e.data ?? {};
      const s = (v: unknown) => (typeof v === 'string' ? v : null);
      if (e.key === 'refund-photo' && e.chips[0]) out.push({ key: `photo-${e.at}`, label: 'Refund photo', network: 'Swarm', href: e.chips[0].href, at: e.at });
      if (e.key === 'refund-request') {
        const href = txUrl(x, 'rabdi', s(data.arkivTx));
        if (href) out.push({ key: `req-${e.at}`, label: 'Refund asked', network: n.rabdi.name.split(' ')[0] ?? n.rabdi.name, href, at: e.at });
      }
      if (e.key === 'refund') {
        const href = txUrl(x, 'whitechain', s(data.transaction));
        if (href) out.push({ key: `refund-${e.at}`, label: `Refunded ${microUsdt(s(data.amountMicro) ?? model.order.refundMicro)}`, network: n.whitechain.name.split(' ')[0] ?? n.whitechain.name, href, at: e.at });
      }
      if (e.key === 'refund-declined') {
        const href = txUrl(x, 'rabdi', s(data.arkivTx));
        if (href) out.push({ key: `dec-${e.at}`, label: 'Refund declined', network: n.rabdi.name.split(' ')[0] ?? n.rabdi.name, href, at: e.at });
      }
      if (e.key === 'paused') {
        const href = txUrl(x, 'sepolia', s(data.sepoliaTx));
        if (href) out.push({ key: `pause-${e.at}`, label: 'Paused', network: 'ENS', href, at: e.at });
      }
    }
    const attempt = d.edges.find((e) => e.kind === 'fail' && e.ref.startsWith('att:'));
    if (attempt) {
      const href = entityUrl(x, attempt.entityKey) ?? txUrl(x, 'rabdi', attempt.arkivTx);
      if (href) out.push({ key: 'refused', label: 'Refused', network: n.rabdi.name.split(' ')[0] ?? n.rabdi.name, href, at: attempt.at });
    }
    return out;
  }, [d.model, d.edges, d.events, d.pace.shown, model]);
  useEffect(() => setChips(chips), [chips, setChips]);
  return null;
}
