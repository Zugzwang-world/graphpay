'use client';

// Scenes 1 to 4 of the middle (final website brief §5): the errand, step by step, every figure from
// its frames (lib/stage/errand.ts) or from the stage's own reads, every name and record a link.

import { useEffect, useMemo, useState } from 'react';
import { arkivQueryUrl, entityUrl, txUrl } from '@/lib/explorer';
import { stepIndex } from '@/lib/stage/scenes';
import { microUsdt, orderNumber, percent, usdt } from '@/lib/stage/format';
import { useSite } from '../site-context';
import { useDirector } from './director';
import { NetLink, Pending, Figurine, SceneHead, ensPage, useClock } from './common';
import { useExplain, type Receipts } from './data';

const CHAIN_REF = /^\d+:(0x[0-9a-fA-F]{64}):\d+$/;
const short = (ens: string) => ens.replace(/\.graphpay\.eth$/, '');

// Scene 1: the two teams as a drawn ENS tree; each node opens its name page and lights as its agent wakes.
export function SceneTeams() {
  const { model } = useSite();
  const d = useDirector();
  const buyers = model.buyerAgents;
  const shop = model.merchant;
  const woke = new Set(d.model.woke);
  const shopAwake = d.pace.shown >= stepIndex('order');
  const W = 920;
  const leafY = 640;
  const left = buyers.map((a, i) => ({ a, x: 70 + i * 112 }));
  const right = shop.agents.map((a, i) => ({ a, x: 600 + i * 125 }));
  const persona = { x: 238, y: 360 };
  const merchant = { x: 725, y: 360 };
  const root = { x: W / 2, y: 110 };
  const curve = (x1: number, y1: number, x2: number, y2: number) => `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`;
  const node = (name: string, x: number, y: number, lit: boolean, big = false) => (
    <a key={name} className="ens-node" data-lit={lit ? 'true' : 'false'} data-big={big ? 'true' : 'false'} data-long={(name.split('.')[0] ?? '').length > 10 ? 'true' : 'false'} href={ensPage(model, name) ?? undefined} target="_blank" rel="noopener noreferrer" style={{ left: x, top: y }}>
      <strong>{name.split('.')[0]}</strong>
      <span>.{name.split('.').slice(1).join('.')}</span>
    </a>
  );
  return (
    <div className="scene scene-teams">
      <SceneHead number={1} title="Two teams, each agent a name on ENS" />
      <div className="tree">
        <svg viewBox={`0 0 ${W} 860`} className="tree-lines" aria-hidden>
          <path className="tree-line" d={curve(root.x, root.y + 26, persona.x, persona.y - 26)} data-lit="true" />
          <path className="tree-line" d={curve(root.x, root.y + 26, merchant.x, merchant.y - 26)} data-lit="true" />
          {left.map(({ a, x }) => (
            <path key={a.key} className="tree-line" d={curve(persona.x, persona.y + 26, x, leafY - 70)} data-lit={woke.has(a.ens) ? 'true' : 'false'} />
          ))}
          {right.map(({ a, x }) => (
            <path key={a.key} className="tree-line" d={curve(merchant.x, merchant.y + 26, x, leafY - 70)} data-lit={shopAwake ? 'true' : 'false'} />
          ))}
        </svg>
        {node(model.root, root.x, root.y, true, true)}
        {node(model.persona.ens, persona.x, persona.y, d.model.arrived.ask !== undefined, true)}
        {node(shop.ens, merchant.x, merchant.y, shopAwake, true)}
        {left.map(({ a, x }) => (
          <a key={a.key} className="ens-leaf" data-lit={woke.has(a.ens) ? 'true' : 'false'} href={ensPage(model, a.ens) ?? undefined} target="_blank" rel="noopener noreferrer" style={{ left: x, top: leafY }}>
            <Figurine avatar={a.avatar} state={woke.has(a.ens) ? (d.model.end ? 'success' : 'thinking') : 'idle'} size={78} />
            <strong>{a.displayName}</strong>
            <span>{a.ens.split('.')[0]}.{short(model.persona.ens)}</span>
          </a>
        ))}
        {right.map(({ a, x }) => (
          <a key={a.key} className="ens-leaf" data-lit={shopAwake ? 'true' : 'false'} href={ensPage(model, a.ens) ?? undefined} target="_blank" rel="noopener noreferrer" style={{ left: x, top: leafY }}>
            <Figurine avatar={a.avatar} state="idle" size={78} />
            <strong>{a.displayName}</strong>
            <span>{a.ens.split('.')[0]}.{short(shop.ens)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

interface Row {
  key: string;
  from: string;
  to: string;
  amountMicro: string;
  kind: string;
  tx: string | null;
  sample: boolean;
}

function rowsOf(receipts: Receipts | null): Row[] {
  if (!receipts) return [];
  const rows: Row[] = [];
  for (const s of receipts.shops) {
    for (const e of [...s.recent, ...s.refunds]) {
      const tx = CHAIN_REF.exec(e.ref)?.[1] ?? null;
      rows.push({ key: `${e.kind}|${e.ref}`, from: e.from.ens, to: e.to.ens, amountMicro: e.amountMicro, kind: e.kind, tx, sample: e.synthetic });
    }
  }
  // The payments of the real buyers first, then the labelled sample rows.
  return rows.sort((a, b) => Number(a.sample) - Number(b.sample)).slice(0, 14);
}

function useCountUp(target: number | null, ms: number, run: boolean): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run || target === null) return;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setV(Math.round(target * (1 - (1 - p) ** 2)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, run]);
  return v;
}

// Scene 2a: the plain way, the receipts as a table a reader pages through.
export function ScenePlain({ receipts }: { receipts: Receipts | null }) {
  const { model } = useSite();
  const rows = useMemo(() => rowsOf(receipts), [receipts]);
  const explain = useExplain(receipts?.explainId ?? null);
  const edgeQuery = explain?.queries.find((q) => /type = str\('edge'\)/.test(q)) ?? null;
  const [pointer, setPointer] = useState(-1);
  useEffect(() => {
    if (!rows.length) return;
    setPointer(0);
    const t = setInterval(() => setPointer((p) => (p >= rows.length - 1 ? p : p + 1)), 520);
    return () => clearInterval(t);
  }, [rows.length]);
  const reads = useCountUp(receipts?.calls ?? null, rows.length * 520, rows.length > 0);
  const count = Math.max(0, pointer + 1);
  const kb = useCountUp(receipts?.bytes ? Math.round(receipts.bytes / 1024) : null, rows.length * 520, rows.length > 0);
  const name = (ens: string) => (
    <a href={ensPage(model, ens) ?? undefined} target="_blank" rel="noopener noreferrer">
      {short(ens)}
    </a>
  );
  return (
    <div className="scene scene-plain">
      <SceneHead number={2} title="The plain way: read every receipt">
        {edgeQuery ? (
          <a className="net-link" href={arkivQueryUrl(model.explorers, edgeQuery) ?? undefined} target="_blank" rel="noopener noreferrer">
            <span className="net-link-label">These rows</span>
            <span>{model.networks.rabdi.name}</span>
          </a>
        ) : null}
      </SceneHead>
      <div className="counters">
        <div>
          <b>{reads}</b>
          <span>reads</span>
        </div>
        <div>
          <b>{count}</b>
          <span>receipts</span>
        </div>
        <div>
          <b>{kb}</b>
          <span>KB</span>
        </div>
      </div>
      <div className="receipts">
        <div className="receipt-row is-head">
          <span>Key</span>
          <span>Payer to shop</span>
          <span>USDT</span>
          <span>Type</span>
        </div>
        {rows.length === 0 ? <p className="receipts-wait">Reading the receipts on {model.networks.rabdi.name}.</p> : null}
        {rows.map((r, i) => (
          <div key={r.key} className="receipt-row" data-read={i <= pointer ? 'true' : 'false'} data-at={i === pointer ? 'true' : 'false'} style={{ animationDelay: `${i * 40}ms` }}>
            <span className="mono">{r.tx ? <a href={txUrl(model.explorers, 'whitechain', r.tx) ?? undefined} target="_blank" rel="noopener noreferrer">{`#${r.tx.slice(2, 6).toUpperCase()}`}</a> : <em className="sample">Sample data</em>}</span>
            <span className="party">
              {name(r.from)} <i aria-hidden>to</i> {name(r.to)}
            </span>
            <span className="num">{microUsdt(r.amountMicro)}</span>
            <span data-kind={r.kind}>{r.kind === 'pay' ? 'payment' : r.kind}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Scene 2b: plain Arkiv beside GraphPay, with this run's real query and reads.
export function SceneQueries() {
  const { model } = useSite();
  const d = useDirector();
  const g = d.model.graph;
  const explain = useExplain(g?.explainId ?? null);
  const query = (g?.query ?? '').trim();
  const keys = explain?.entityKeys ?? g?.entityKeys ?? [];
  const firstArkiv = explain?.queries[0] ?? null;
  return (
    <div className="scene scene-queries">
      <SceneHead number={2} title="Two ways to ask the same question" />
      <div className="versus">
        <section className="side side-plain">
          <h3>Plain {model.networks.rabdi.name.split(' ')[0]}</h3>
          <p>Pages through every receipt and adds them up in the app, every time.</p>
          <div className="big-read">
            <b>5</b>
            <span>reads</span>
          </div>
          <p className="fine">Measured race, size S, synthetic city</p>
          <div className="pages" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <i key={i} style={{ animationDelay: `${i * 260}ms` }} />
            ))}
          </div>
        </section>
        <section className="side side-graph">
          <h3>GraphPay</h3>
          <p>Reads each shop’s scoreboard, kept current in the same write as each payment.</p>
          <div className="big-read">
            <b>{g?.calls ?? ''}</b>
            <span>reads</span>
          </div>
          <p className="fine">This errand, live: {keys.length} entities</p>
          {query ? <pre className="query">{query}</pre> : null}
          <div className="keys">
            {keys.slice(0, 3).map((k) => (
              <a key={k} href={entityUrl(model.explorers, k) ?? undefined} target="_blank" rel="noopener noreferrer" className="mono">
                {k.slice(0, 10)}
              </a>
            ))}
            {firstArkiv ? (
              <a className="net-link" href={arkivQueryUrl(model.explorers, firstArkiv) ?? undefined} target="_blank" rel="noopener noreferrer">
                <span className="net-link-label">The read</span>
                <span>{model.networks.rabdi.name}</span>
              </a>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

// Scene 2c: the same receipts as a graph of ENS names, every node with its scoreboard.
export function SceneGraph({ receipts }: { receipts: Receipts | null }) {
  const { model } = useSite();
  const d = useDirector();
  const boards = d.model.graph?.boards ?? [];
  const ranking = d.model.ranking;
  const shops = model.shops.map((s) => s.ens);
  const xs = [170, 460, 750];
  const placed = new Map<string, { x: number; y: number; r: number }>();
  shops.forEach((ens, i) => placed.set(ens, { x: xs[i] ?? 460, y: 560, r: 92 }));
  const payers = new Map<string, { count: number; key: string | null }>();
  const lines: { from: string; to: string; kind: string; n: number }[] = [];
  for (const s of receipts?.shops ?? []) {
    for (const e of [...s.recent, ...s.refunds]) {
      const payer = e.kind === 'refund' ? e.to : e.from;
      payers.set(payer.ens, { count: (payers.get(payer.ens)?.count ?? 0) + 1, key: payer.key });
      const shop = e.kind === 'refund' ? e.from.ens : e.to.ens;
      const found = lines.find((l) => l.from === payer.ens && l.to === shop && l.kind === e.kind);
      if (found) found.n += 1;
      else lines.push({ from: payer.ens, to: shop, kind: e.kind, n: 1 });
    }
  }
  const ourPayer = model.payer.ens;
  if (!payers.has(ourPayer)) payers.set(ourPayer, { count: 0, key: receipts?.payer?.key ?? null });
  const others = [...payers.keys()].filter((p) => p !== ourPayer).slice(0, 8);
  placed.set(ourPayer, { x: 460, y: 190, r: 0 });
  const spots = [
    { x: 140, y: 330 },
    { x: 780, y: 330 },
    { x: 140, y: 830 },
    { x: 780, y: 830 },
    { x: 330, y: 880 },
    { x: 590, y: 880 },
    { x: 300, y: 250 },
    { x: 620, y: 250 },
  ];
  others.forEach((p, i) => placed.set(p, { ...spots[i]!, r: 0 }));
  const boardOf = (ens: string) => boards.find((b) => b.ens === ens);
  const rankOf = (ens: string) => ranking.find((r) => r.ens === ens);
  const keyOf = (ens: string) => receipts?.shops.find((s) => s.ens === ens)?.key ?? payers.get(ens)?.key ?? null;
  return (
    <div className="scene scene-graph">
      <SceneHead number={2} title="The same receipts, as a graph of names" />
      <div className="graph">
        <svg viewBox="0 0 920 940" aria-hidden>
          {lines.map((l) => {
            const a = placed.get(l.from);
            const b = placed.get(l.to);
            if (!a || !b) return null;
            return <line key={`${l.from}|${l.to}|${l.kind}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="graph-line" data-kind={l.kind} strokeWidth={Math.min(10, 2 + l.n * 1.5)} />;
          })}
        </svg>
        {[...placed.entries()].map(([ens, p]) => {
          const shop = shops.includes(ens);
          const b = boardOf(ens);
          const rank = rankOf(ens);
          const trap = shop && model.shops.find((s) => s.ens === ens)?.storyRole === 'trap';
          const best = ens === d.model.best;
          const tally = ens === ourPayer ? receipts?.payer?.tally : null;
          const href = entityUrl(model.explorers, keyOf(ens));
          return (
            <a key={ens} className="graph-node" data-shop={shop ? 'true' : 'false'} data-trap={trap ? 'true' : 'false'} data-best={best ? 'true' : 'false'} data-ours={ens === ourPayer ? 'true' : 'false'} href={href ?? undefined} target="_blank" rel="noopener noreferrer" style={shop ? { left: p.x, top: p.y, width: p.r * 2, height: p.r * 2 } : { left: p.x, top: p.y }}>
              <strong>{shop ? model.shops.find((s) => s.ens === ens)?.displayName : short(ens)}</strong>
              {shop && b ? (
                <span>
                  {b.orders} orders
                  <br />
                  {percent(b.refundRate)} refunds
                </span>
              ) : null}
              {tally ? (
                <span>
                  {tally.orders} orders
                  <br />
                  {tally.refunds} refunds
                </span>
              ) : null}
              {shop && rank && !rank.eligible ? <em>rejected</em> : null}
            </a>
          );
        })}
      </div>
    </div>
  );
}

// Scene 3: the shop checks the buyer back, from the graph and from ENS, then its verdict.
export function SceneCheckBack({ receipts }: { receipts: Receipts | null }) {
  const { model } = useSite();
  const d = useDirector();
  const now = useClock();
  const r = d.model.risk;
  const buyer = r.buyer ?? model.payer.ens;
  const checked = d.pace.shown >= stepIndex('checks');
  const verdict = d.pace.shown >= stepIndex('verdict');
  const payerKey = receipts?.payer?.key ?? null;
  return (
    <div className="scene scene-check">
      <SceneHead number={3} title="Who is this buyer?" />
      <div className="check">
        <div className="check-buyer">
          <Figurine avatar={model.payer.avatar} state="thinking" size={110} />
          <a href={ensPage(model, buyer) ?? undefined} target="_blank" rel="noopener noreferrer">
            {buyer}
          </a>
        </div>
        <svg viewBox="0 0 920 300" className="check-lines" aria-hidden>
          <path d="M460,0 C460,140 230,120 230,300" className="tree-line" data-lit={checked ? 'true' : 'false'} />
          <path d="M460,0 C460,140 690,120 690,300" className="tree-line" data-lit={checked ? 'true' : 'false'} />
        </svg>
        <div className="answers">
          <div className="answer" data-on={checked ? 'true' : 'false'}>
            <p className="answer-from">From {model.networks.rabdi.name}: its scoreboard</p>
            <p className="answer-big">{r.paidOrders ?? ''} paid orders</p>
            <p>
              {r.disputes ?? 0} disputes, {r.cancellations ?? 0} cancellations
            </p>
            <NetLink href={entityUrl(model.explorers, payerKey)} network={model.networks.rabdi.name} label="Scoreboard" now={now} />
          </div>
          <div className="answer" data-on={checked ? 'true' : 'false'}>
            <p className="answer-from">From ENS: its owner and status</p>
            <p className="answer-big">{r.ensStatus ?? ''}</p>
            <p>Owned by {r.owner ?? model.persona.ens}</p>
            <NetLink href={ensPage(model, buyer)} network="ENS" label="Name page" now={now} />
          </div>
        </div>
        <div className="verdict" data-on={verdict ? 'true' : 'false'} data-ok={r.approved === false ? 'false' : 'true'}>
          {verdict ? (r.approved === false ? 'Declined' : 'Approved') : ''}
        </div>
      </div>
    </div>
  );
}

// Scene 4: the x402 sequence, lane by lane; each arrow appears with its frame.
export function SceneX402() {
  const { model } = useSite();
  const d = useDirector();
  const now = useClock();
  const m = d.model;
  const at = (k: Parameters<typeof stepIndex>[0]) => d.pace.shown >= stepIndex(k);
  const lanes = ['Payer', 'Shop', 'Facilitator', 'ENS', model.networks.whitechain.name.split(' ')[0] ?? 'Whitechain', model.networks.rabdi.name.split(' ')[0] ?? 'Arkiv'];
  const laneX = (i: number) => 80 + i * 152;
  const paidEdge = m.paid ? d.edges.find((e) => e.kind === 'pay' && e.settlementTx?.toLowerCase() === m.paid?.tx) : undefined;
  // The shop marks the order dispatched on chain right after the payment (its phone's event).
  const dispatched = m.paid ? d.events.find((e) => e.key === 'dispatched' && typeof e.data?.orderId === 'string' && e.data.orderId.toLowerCase() === m.paid?.orderId.toLowerCase()) : undefined;
  const dispatchTx = typeof dispatched?.data?.transaction === 'string' ? dispatched.data.transaction : null;
  const price = usdt(m.quote?.priceUsdt ?? m.paid?.amountUsdt ?? '');
  type Arrow = { from: number; to: number; label: string; on: boolean; link?: { href: string | null; network: string; at?: number | null }; pending?: boolean; pendingText?: string; protocol?: boolean };
  const arrows: Arrow[] = [
    { from: 0, to: 1, label: `Quote ${m.quote?.quantity ?? 1} × ${model.order.item}`, on: at('quote') },
    { from: 1, to: 0, label: `Bill ${orderNumber(m.quote?.orderId)}: ${price} USDT`, on: at('quote') },
    { from: 0, to: 1, label: 'Pay this order', on: at('bill402') },
    { from: 1, to: 0, label: '402 Payment required', on: at('bill402') },
    { from: 0, to: 1, label: 'One signature, no gas', on: at('sign') },
    { from: 1, to: 2, label: 'Verify', on: at('verify'), protocol: true },
    { from: 2, to: 3, label: 'Is the payer active? Its cap?', on: at('verify'), protocol: true },
    { from: 3, to: 2, label: 'Active, inside the cap', on: at('verify'), protocol: true },
    { from: 2, to: 4, label: 'Settle', on: at('settled'), link: { href: txUrl(model.explorers, 'whitechain', m.settledTx ?? m.paid?.tx), network: model.networks.whitechain.name, at: m.arrived.settled } },
    { from: 1, to: 0, label: dispatched ? 'Dispatched, on chain' : 'Paid. Dispatching.', on: at('dispatch'), link: dispatchTx ? { href: txUrl(model.explorers, 'whitechain', dispatchTx), network: model.networks.whitechain.name, at: dispatched?.at } : undefined, pending: !dispatchTx, pendingText: `Marking on ${model.networks.whitechain.name.split(' ')[0]}` },
    { from: 4, to: 5, label: 'The receipt', on: at('paid'), link: paidEdge ? { href: paidEdge.entityKey ? entityUrl(model.explorers, paidEdge.entityKey) : txUrl(model.explorers, 'rabdi', paidEdge.arkivTx), network: model.networks.rabdi.name, at: paidEdge.at } : undefined, pending: !paidEdge },
  ];
  return (
    <div className="scene scene-x402">
      <SceneHead number={4} title="The bill and the payment" />
      <div className="seq">
        {lanes.map((l, i) => (
          <div key={l} className="seq-lane" style={{ left: laneX(i) }}>
            <span>{l}</span>
          </div>
        ))}
        {arrows.map((a, i) => {
          const x1 = laneX(a.from);
          const x2 = laneX(a.to);
          const left = Math.min(x1, x2);
          const width = Math.abs(x2 - x1);
          return (
            <div key={i} className="seq-arrow" data-on={a.on ? 'true' : 'false'} data-dir={x2 > x1 ? 'right' : 'left'} data-protocol={a.protocol ? 'true' : 'false'} data-link={Math.max(x1, x2) > 600 ? 'left' : 'right'} style={{ left, width, top: 130 + i * 74 }}>
              <span className="seq-label">{a.label}</span>
              <i aria-hidden />
              {a.on && (a.link || a.pending) ? (
                <span className="seq-link">{a.link ? <NetLink href={a.link.href} network={a.link.network} at={a.link.at} now={now} /> : <Pending>{a.pendingText ?? `Writing to ${model.networks.rabdi.name.split(' ')[0]}`}</Pending>}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
