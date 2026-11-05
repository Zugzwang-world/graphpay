'use client';

// The Mumbai map (MASTER_PLAN.md item 10): our own drawing of the neighbourhoods (no
// third-party tiles), a dot for every shop in the directory, open shops and agents at work
// glowing while their heartbeat is live and fading when it lapses. Every dot opens its
// Arkiv explorer query; the neighbourhoods link to their OpenStreetMap source. Synthetic
// shops are labelled synthetic.
import { useMemo, useRef } from 'react';
import { arkivQueryUrl } from '@/lib/explorer';
import { kmToUnits, presenceQuery, projector, shopLabel, shopQuery, type MapData } from '@/lib/map';
import { usePoll, waitingForOf } from '@/lib/use-poll';
import { useSite } from './site-context';

const W = 900;
const H = 620;

export function MapView({ radiusKm }: { radiusKm: number }) {
  const { model } = useSite();
  const root = useRef<HTMLDivElement>(null);
  const state = usePoll<MapData>('/api/map', 5000, root);
  const data = state.status === 'ok' ? state.data : null;

  const drawn = useMemo(() => {
    if (!data) return null;
    const pts = [...data.neighbourhoods, ...data.shops, data.persona];
    const at = projector(pts, W, H);
    const km = kmToUnits(pts, W, H);
    return { at, km };
  }, [data]);

  const open = data?.shops.filter((s) => s.open).length ?? 0;
  const synthetic = data?.shops.filter((s) => s.synthetic).length ?? 0;

  return (
    <div ref={root} className="map">
      <p className="muted small" role="status" aria-live="polite">
        {state.status === 'loading' ? 'Reading the shop directory…' : null}
        {state.status === 'error' ? (waitingForOf(state) ? `Not live yet: waiting for ${waitingForOf(state)}.` : 'The graph did not answer just now; trying again.') : null}
        {data ? `${data.shops.length} shops (${synthetic} synthetic), ${open} open now, ${data.agents.length} agents at work.` : null}
      </p>
      {data && drawn ? (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Map of the shops in the neighbourhoods around the arrival point" className="map-svg">
          <rect x="0" y="0" width={W} height={H} rx="18" className="map-bg" />
          {data.neighbourhoods.map((n) => {
            const p = drawn.at(n);
            return (
              <a key={n.area} href={n.source} target="_blank" rel="noopener noreferrer">
                <g className="map-area">
                  <circle cx={p.x} cy={p.y} r={drawn.km(0.5)} />
                  <text x={p.x} y={p.y + drawn.km(0.5) + 14} textAnchor="middle">
                    {n.area}
                  </text>
                </g>
              </a>
            );
          })}
          <g className="map-persona">
            <circle cx={drawn.at(data.persona).x} cy={drawn.at(data.persona).y} r={drawn.km(radiusKm)} className="map-radius" />
            <circle cx={drawn.at(data.persona).x} cy={drawn.at(data.persona).y} r="5" />
            <text x={drawn.at(data.persona).x + 9} y={drawn.at(data.persona).y - 8}>
              {data.persona.label}
            </text>
          </g>
          {data.shops.map((s) => {
            const p = drawn.at(s);
            const href = arkivQueryUrl(model.explorers, shopQuery(s.shopKey));
            const dot = (
              <g className="map-shop" data-open={s.open ? 'true' : 'false'} data-synthetic={s.synthetic ? 'true' : 'false'}>
                {/* The glow stays in the drawing and fades out when the heartbeat lapses (reduced motion: no pulse). */}
                <circle className="map-glow" cx={p.x} cy={p.y} r={s.synthetic ? 11 : 17} />
                <circle className="map-dot" cx={p.x} cy={p.y} r={s.synthetic ? 4 : 8} />
                {s.synthetic ? null : (
                  <text x={p.x + 12} y={p.y + 4}>
                    {shopLabel(s)}
                  </text>
                )}
                <title>{`${shopLabel(s)}${s.synthetic ? ' (synthetic)' : ''}: ${s.open ? 'open now' : 'closed'}. Opens its record on Arkiv.`}</title>
              </g>
            );
            return href ? (
              <a key={s.ens} href={href} target="_blank" rel="noopener noreferrer" aria-label={`${shopLabel(s)}${s.synthetic ? ' (synthetic)' : ''}, ${s.open ? 'open now' : 'closed'}: the shop's record on Arkiv`}>
                {dot}
              </a>
            ) : (
              <g key={s.ens}>{dot}</g>
            );
          })}
          {data.agents.map((a, i) => {
            const c = drawn.at(data.persona);
            // Agents work for the person at the arrival point: they sit in rings around it, eight to a ring.
            const ring = Math.floor(i / 8);
            const inRing = Math.min(8, data.agents.length - ring * 8);
            const angle = ((i % 8) / inRing) * Math.PI * 2 - Math.PI / 2 + ring * 0.4;
            const r = drawn.km(0.3 + 0.22 * ring);
            const x = c.x + Math.cos(angle) * r;
            const y = c.y + Math.sin(angle) * r;
            const href = arkivQueryUrl(model.explorers, presenceQuery(a.session));
            const bot = (
              <g className="map-agent">
                <circle className="map-glow" cx={x} cy={y} r="11" />
                <circle className="map-bot" cx={x} cy={y} r="5" />
                <title>{`${a.ens} (${a.role}) is at work. Opens its presence record on Arkiv.`}</title>
              </g>
            );
            return href ? (
              <a key={a.key} href={href} target="_blank" rel="noopener noreferrer" aria-label={`${a.ens}, ${a.role}, at work: its presence record on Arkiv`}>
                {bot}
              </a>
            ) : (
              <g key={a.key}>{bot}</g>
            );
          })}
        </svg>
      ) : null}
      <ul className="map-legend small" aria-label="Legend">
        <li>
          <span className="map-key" data-kind="shop" /> a shop in the directory
        </li>
        <li>
          <span className="map-key" data-kind="open" /> open now (its Open toggle is on)
        </li>
        <li>
          <span className="map-key" data-kind="synthetic" /> synthetic shop (the small city, labelled synthetic)
        </li>
        <li>
          <span className="map-key" data-kind="agent" /> an agent at work (a live presence record)
        </li>
      </ul>
    </div>
  );
}
