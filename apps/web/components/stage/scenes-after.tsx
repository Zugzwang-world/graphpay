'use client';

// Scenes 5 to 10 of the middle (final website brief §5): the refund with its photo on Swarm, the off
// switch, then what we proved on Arkiv, ENS and Whitechain, and the close. Live numbers come from
// the phones' answers and the registry; the lab's numbers are labelled lab.

import { useEffect, useState } from 'react';
import { entityUrl, txUrl } from '@/lib/explorer';
import { clock, microUsdt, orderNumber, usdt } from '@/lib/stage/format';
import { proofs } from '@/lib/stage/proofs';
import { useSite } from '../site-context';
import { useDirector } from './director';
import { NetLink, Pending, Figurine, SceneHead, ensPage, useClock } from './common';
import { useNpmVersion } from './data';

const last = <T,>(list: T[], pick: (x: T) => boolean): T | undefined => [...list].reverse().find(pick);
const str = (v: unknown) => (typeof v === 'string' ? v : null);

// Scene 5: one continuous flow, every hop with its network and link.
export function SceneRefund() {
  const { model } = useSite();
  const d = useDirector();
  const now = useClock();
  const photo = last(d.events, (e) => e.key === 'refund-photo');
  const request = last(d.events, (e) => e.key === 'refund-request');
  const refund = last(d.events, (e) => e.key === 'refund');
  const accepted = last(d.events, (e) => e.key === 'refund-accepted');
  const declined = last(d.events, (e) => e.key === 'refund-declined');
  const orderId = str(request?.data?.orderId) ?? str(last(d.events, (e) => e.key === 'refund-start')?.data?.orderId);
  const edge = d.edges.find((e) => e.kind === 'refund' && orderId !== null && e.orderId?.toLowerCase() === orderId.toLowerCase());
  const reqEdge = d.edges.find((e) => e.kind === 'request' && orderId !== null && e.ref.startsWith(`req:${orderId}`));
  const swarmHref = photo?.chips[0]?.href ?? null;
  const uploaded = photo?.data?.uploaded === true;
  const amount = microUsdt(str(request?.data?.amountMicro) ?? model.order.refundMicro);
  const hops = [
    { key: 'photo', title: uploaded ? 'The photo, uploaded to Swarm' : 'The photo, on Swarm', on: Boolean(photo), link: <NetLink href={swarmHref} network="Swarm" at={photo?.at} now={now} /> },
    {
      key: 'request',
      title: `The request on ${model.networks.rabdi.name.split(' ')[0]}: ${amount} back`,
      on: Boolean(request),
      link: (
        <>
          <NetLink href={txUrl(model.explorers, 'rabdi', request?.data?.arkivTx)} network={model.networks.rabdi.name} label="Write" at={request?.at} now={now} />
          <NetLink href={entityUrl(model.explorers, request?.data?.entityKey)} network={model.networks.rabdi.name} label="Entity" at={reqEdge?.at ?? request?.at} now={now} />
        </>
      ),
    },
    { key: 'accept', title: declined ? 'The shop declined' : 'The shop’s risk agent accepts, by itself', on: Boolean(accepted || refund || declined), bad: Boolean(declined), link: null },
    { key: 'money', title: `${amount} back on ${model.networks.whitechain.name.split(' ')[0]}`, on: Boolean(refund), link: <NetLink href={txUrl(model.explorers, 'whitechain', refund?.data?.transaction)} network={model.networks.whitechain.name} at={refund?.at} now={now} /> },
    { key: 'board', title: 'The shop’s scoreboard: refunds +1', on: Boolean(edge), wait: Boolean(refund) && !edge, link: edge ? <NetLink href={entityUrl(model.explorers, edge.entityKey) ?? txUrl(model.explorers, 'rabdi', edge.arkivTx)} network={model.networks.rabdi.name} at={edge.at} now={now} /> : null },
  ];
  return (
    <div className="scene scene-refund">
      <SceneHead number={5} title="A refund, with its photo" />
      <p className="scene-sub">
        {orderNumber(orderId)} {model.order.refundReason}
      </p>
      <ol className="flow">
        {hops.map((h, i) => (
          <li key={h.key} className="flow-hop" data-on={h.on ? 'true' : 'false'} data-bad={h.bad ? 'true' : 'false'} style={{ transitionDelay: `${i * 60}ms` }}>
            <span className="flow-dot" aria-hidden />
            <div>
              <p>{h.title}</p>
              <div className="flow-links">{h.on ? h.link : h.wait ? <Pending>Writing to {model.networks.rabdi.name.split(' ')[0]}</Pending> : null}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// Scene 6: the payer's ENS card, the status flipping live, then the refused attempt.
export function ScenePause() {
  const { model } = useSite();
  const d = useDirector();
  const now = useClock();
  const [cap, setCap] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/state/customer', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { capMicro?: string } | null) => setCap(j?.capMicro ?? null))
      .catch(() => undefined);
  }, []);
  const paused = last(d.events, (e) => e.key === 'paused');
  const refused = last(d.events, (e) => e.key === 'reorder-refused');
  const sepoliaTx = str(paused?.data?.sepoliaTx);
  const resumesAt = str(paused?.data?.resumesAt);
  const payer = model.payer;
  return (
    <div className="scene scene-pause">
      <SceneHead number={6} title="The off switch" />
      <div className="ens-card">
        <Figurine avatar={payer.avatar} state={refused ? 'refused' : 'idle'} size={96} className={paused ? 'is-paused' : ''} />
        <div>
          <a className="ens-card-name" href={ensPage(model, payer.ens) ?? undefined} target="_blank" rel="noopener noreferrer">
            {payer.ens}
          </a>
          <dl>
            <div>
              <dt>Owner</dt>
              <dd>{model.persona.ens}</dd>
            </div>
            <div>
              <dt>Resolver</dt>
              <dd>its own</dd>
            </div>
            <div className="ens-status" data-paused={paused ? 'true' : 'false'}>
              <dt>Status</dt>
              <dd>
                <span className="flip">
                  <b data-on={paused ? 'false' : 'true'}>active</b>
                  <b data-on={paused ? 'true' : 'false'}>paused</b>
                </span>
              </dd>
            </div>
            <div>
              <dt>Cap</dt>
              <dd>{cap ? `${microUsdt(cap)} USDT a day, only the owner can change it` : 'only the owner can change it'}</dd>
            </div>
          </dl>
          <div className="ens-card-links">
            {sepoliaTx ? <NetLink href={txUrl(model.explorers, 'sepolia', sepoliaTx)} network={model.networks.sepolia.name} label="Paused" at={paused?.at} now={now} /> : null}
            {resumesAt ? <span className="fine">Resumes by itself at {clock(resumesAt, model.city.timeZone)}</span> : null}
          </div>
        </div>
      </div>
      <ol className="path" data-on={refused ? 'true' : 'false'}>
        <li>The next payment asks ENS</li>
        <li>ENS answers paused</li>
        <li className="path-bad">Refused</li>
        <li>Nothing sent</li>
      </ol>
    </div>
  );
}

function NpmCard({ name, line, readme }: { name: string; line: string; readme: string | null }) {
  const version = useNpmVersion(name);
  const npm = `https://www.npmjs.com/package/${name}`;
  return (
    <div className="npm-card">
      <div className="npm-top">
        <span className="npm-name">{name}</span>
        {version ? <span className="npm-version">{version}</span> : null}
      </div>
      <code className="npm-install">npm i {name}</code>
      <p>{line}</p>
      <div className="npm-links">
        <a href={npm} target="_blank" rel="noopener noreferrer">
          npm
        </a>
        {readme ? (
          <a href={readme} target="_blank" rel="noopener noreferrer">
            README
          </a>
        ) : null}
      </div>
    </div>
  );
}

// Scene 7: one payment written, the two lab meters (speed and data), the arkiv-graph card.
// Scene 7's two meters: the lab benchmark on 9,612 payments (planning/SPEC/BENCHMARK.md §4, the M
// row, 4 Nov). The top-10 question: GraphPay answered in 0.65 s and 31 KB, plain Arkiv in 1.17 s and
// about 1 MB (976 KB) with every page fetched at once. Speed and data only.
const LAB = 'lab, 9,612 payments';
const METERS = [
  { key: 'speed', from: 1, to: 1.8, text: (v: number) => `${v.toFixed(1)}x faster`, fine: '0.65 s against 1.17 s' },
  { key: 'data', from: 1, to: 30, text: (v: number) => `about ${Math.round(v)}x less data`, fine: '31 KB against about 1 MB, every page at once' },
];
const METER_MS = 1_800;

export function SceneArkiv() {
  const { model } = useSite();
  const d = useDirector();
  // Both meters fill from zero to their values, eased, once the scene is in.
  const [fill, setFill] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setFill(1);
    let frame = 0;
    const start = performance.now() + 500;
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / METER_MS));
      setFill(1 - (1 - t) ** 3);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);
  const pkg = model.links.packages.find((p) => p.key === 'arkiv-graph');
  const best = d.model.graph?.boards.find((b) => b.ens === (d.model.best ?? model.merchant.ens));
  const orders = best?.orders ?? null;
  return (
    <div className="scene scene-arkiv">
      <SceneHead number={7} title={`What we proved on ${model.networks.rabdi.name.split(' ')[0]}`} />
      <div className="write">
        <p className="write-title">One payment, one transaction</p>
        <div className="write-parts">
          {['the line', 'the buyer’s scoreboard', 'the shop’s scoreboard', 'the pair link', 'an anchor'].map((p, i) => (
            <span key={p} style={{ animationDelay: `${i * 140}ms` }}>
              {p}
            </span>
          ))}
        </div>
        <p className="fine">About 0.00031 tGLM a payment, lab measure{orders !== null && d.model.paid ? `. The shop’s scoreboard: ${orders} orders, then ${orders + 1}.` : '.'}</p>
      </div>
      <div className="meters">
        {METERS.map((m) => (
          <div key={m.key} className="meter" role="img" aria-label={`${m.text(m.to)}, ${LAB}`}>
            <b>{m.text(m.from + (m.to - m.from) * fill)}</b>
            <div className="meter-track" aria-hidden>
              <i style={{ width: `${Math.round(fill * 100)}%` }} />
            </div>
            <span>{LAB}</span>
            <p className="fine">{m.fine}</p>
          </div>
        ))}
      </div>
      {pkg ? <NpmCard name={pkg.name} readme={pkg.readme} line="A graph layer over Arkiv: nodes, edges and totals, written atomically, every read explained." /> : null}
    </div>
  );
}

// Scene 8: names, owners and off switches, each with its proof.
export function SceneEns() {
  const { model } = useSite();
  const d = useDirector();
  const list = proofs(model);
  const link = (key: string) => list.find((p) => p.key === key)?.links ?? [];
  const paused = last(d.events, (e) => e.key === 'paused');
  const pauseTx = txUrl(model.explorers, 'sepolia', paused?.data?.sepoliaTx);
  const features: { title: string; links: { label: string; href: string | null }[] }[] = [
    { title: 'The hierarchy: graphpay.eth, the owners, their agents', links: [model.root, model.persona.ens, model.merchant.ens].map((n) => ({ label: n, href: ensPage(model, n) })) },
    { title: 'Our own subname registry', links: [{ label: model.root, href: ensPage(model, model.root) }] },
    { title: 'Access control: an agent cannot raise its own cap', links: link('raise-cap') },
    { title: 'A resolver per agent', links: [{ label: model.payer.ens, href: ensPage(model, model.payer.ens) }] },
    { title: 'Off switches: pause, and the kill', links: [...(pauseTx ? [{ label: 'This run’s pause', href: pauseTx }] : []), ...link('kill')] },
    { title: 'The owner changes the cap', links: link('owner-cap').filter((l) => /ENS/.test(l.label)) },
    { title: 'Names as keys: payments name the shop by its namehash', links: link('errands').slice(0, 1) },
  ];
  return (
    <div className="scene scene-ens">
      <SceneHead number={8} title="What we proved on ENS" />
      <p className="scene-point">Every agent has its own name, an owner and an off switch.</p>
      <ul className="features">
        {features.map((f, i) => (
          <li key={f.title} style={{ animationDelay: `${i * 90}ms` }}>
            <p>{f.title}</p>
            <div>
              {f.links.filter((l) => l.href).map((l) => (
                <a key={l.href!} href={l.href!} target="_blank" rel="noopener noreferrer">
                  {l.label}
                </a>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Scene 9: what people see, what runs underneath, the proofs, the agentpay card.
export function SceneWhitechain() {
  const { model } = useSite();
  const d = useDirector();
  const list = proofs(model);
  const refund = last(d.events, (e) => e.key === 'refund');
  const accepted = last(d.events, (e) => e.key === 'refund-accepted');
  const runLinks = [
    ...(d.model.paid ? [{ label: `This run’s payment, ${usdt(d.model.paid.amountUsdt)}`, href: txUrl(model.explorers, 'whitechain', d.model.paid.tx) }] : []),
    ...(refund ? [{ label: 'This run’s refund', href: txUrl(model.explorers, 'whitechain', refund.data?.transaction) }] : []),
  ];
  const groups = [
    { title: 'This run', links: runLinks },
    { title: model.renewal.item, links: list.find((p) => p.key === 'subscription')?.links ?? [] },
    { title: model.order.reorder.item, links: list.find((p) => p.key === 'reorder')?.links ?? [] },
    { title: 'A declined refund', links: list.find((p) => p.key === 'decline')?.links ?? [] },
    { title: 'The checkout contract', links: [{ label: 'On the explorer', href: model.links.checkout ? `${model.explorers.whitechain.replace(/\/+$/, '')}/address/${model.links.checkout}` : null }] },
  ].filter((g) => g.links.some((l) => l.href));
  const pkg = model.links.packages.find((p) => p.key === 'agentpay');
  return (
    <div className="scene scene-wc">
      <SceneHead number={9} title={`What we proved on ${model.networks.whitechain.name.split(' ')[0]}`} />
      <div className="columns">
        <section>
          <h3>What people see</h3>
          <ul>
            {['Pay', 'Refund', 'Re-order', 'Renew', 'Cancel', 'Export'].map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p className="fine">Each one tap, with no wallet and no gas.</p>
        </section>
        <section>
          <h3>What runs underneath</h3>
          <ul>
            <li>{model.token.symbol} on {model.networks.whitechain.name}</li>
            <li>One checkout contract</li>
            <li>Gas paid by our relayer</li>
            <li>Identity from ENS</li>
            <li>Memory on {model.networks.rabdi.name.split(' ')[0]}</li>
          </ul>
        </section>
      </div>
      <div className="proof-groups">
        {groups.map((g) => (
          <div key={g.title}>
            <p>{g.title}</p>
            {g.links.filter((l) => l.href).map((l) => (
              <a key={l.href!} href={l.href!} target="_blank" rel="noopener noreferrer">
                {l.label}
              </a>
            ))}
          </div>
        ))}
      </div>
      {pkg ? <NpmCard name={pkg.name} readme={pkg.readme} line="Agentic USDT payments on Whitechain: one signature, no gas, under an on-chain spending pass." /> : null}
    </div>
  );
}

// Scene 10: the close, told with the figurines and three small graphs.
export function SceneClose() {
  const { model } = useSite();
  return (
    <div className="scene scene-close">
      <p className="close-line">Agents that decide fast, pay safely, and can be stopped.</p>
      <div className="close-cast">
        {[...model.buyerAgents, ...model.merchant.agents].map((a, i) => (
          <Figurine key={a.ens} avatar={a.avatar} state="success" size={76} className={`film-bob film-d${i % 4}`} />
        ))}
      </div>
      <div className="close-graphs">
        <div className="mini">
          <div className="mini-bars">
            <i style={{ height: '100%' }} data-tone="plain" />
            <i style={{ height: '40%' }} data-tone="graph" />
          </div>
          <b>5 to 2</b>
          <span>reads, live; 48 to 2 in the lab</span>
        </div>
        <div className="mini">
          <div className="mini-bars">
            <i style={{ height: '4%' }} data-tone="graph" />
          </div>
          <b>0 gas</b>
          <span>for the payer</span>
        </div>
        <div className="mini">
          <div className="mini-switch" aria-hidden>
            <span />
          </div>
          <b>One tap</b>
          <span>to stop an agent</span>
        </div>
      </div>
      <div className="close-links">
        {model.links.repo ? (
          <a href={model.links.repo} target="_blank" rel="noopener noreferrer">
            {model.links.repo.replace(/^https:\/\//, '')}
          </a>
        ) : null}
        {model.links.packages.map((p) => (
          <a key={p.name} href={`https://www.npmjs.com/package/${p.name}`} target="_blank" rel="noopener noreferrer">
            {p.name}
          </a>
        ))}
      </div>
    </div>
  );
}
