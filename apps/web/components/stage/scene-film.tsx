'use client';

// Scene 0: the opening film (final website brief §5), built in code from Grok's figurines, with
// almost no words. Six parts, looping until the request bubble on the customer’s phone is tapped:
// coins in a fast zigzag; the concierge, close, with a question; every payment a row in a table
// (USER, MERCHANT, the amount) that keeps growing as payments drop in; a question and a pointer
// crawling through it; the table turning into a graph of the same payments, each shop with its
// running total; three words, then the name, built in slowly and held for the founder to speak over.
// The rows are payments of the seeded synthetic city, labelled so. With reduced motion, the last
// frame stands still.

import { useEffect, useState } from 'react';
import type { FilmRow } from '@/lib/site.server';
import { microUsdt } from '@/lib/stage/format';
import { useSite } from '../site-context';
import { Figurine } from './common';

// How long each part stays; the last one builds slowly, then holds about four seconds.
const PART_MS = [5_000, 5_000, 5_000, 5_000, 7_000, 11_000];
const PARTS = PART_MS.length;
const ROW_DROP_MS = 320;
// A row and the gap above it (the table's CSS), for the pointer's crawl.
const ROW_PITCH = 50;
const LINE_MS = 380;
const LINES_AFTER_MS = 1_100;

export function SceneFilm() {
  const { model } = useSite();
  const [tick, setTick] = useState(0);
  const [still, setStill] = useState(false);
  useEffect(() => {
    setStill(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);
  useEffect(() => {
    if (still) return;
    const t = setTimeout(() => setTick((n) => n + 1), PART_MS[tick % PARTS]);
    return () => clearTimeout(t);
  }, [tick, still]);
  const part = still ? PARTS - 1 : tick % PARTS;
  const loop = Math.floor(tick / PARTS);
  const buyers = model.buyerAgents;
  const shopAgents = model.merchant.agents;
  const concierge = buyers.find((a) => a.key === 'concierge') ?? buyers[0];
  const rows = model.film.rows;
  return (
    <div className="scene scene-film" aria-label="Opening film">
      <div className="film" key={`${loop}-${part}`} data-part={part}>
        {part === 0 ? (
          <div className="film-zigzag">
            <div className="film-side">
              {buyers.map((a, i) => (
                <Figurine key={a.key} avatar={a.avatar} state="talking" size={104} className={`film-bob film-d${i}`} />
              ))}
            </div>
            <div className="film-coins" aria-hidden>
              {Array.from({ length: 14 }, (_, i) => (
                <i key={i} style={{ animationDelay: `${i * 0.32}s`, top: `${8 + ((i * 37) % 84)}%` }} data-dir={i % 2 ? 'left' : 'right'} />
              ))}
            </div>
            <div className="film-side">
              {[...shopAgents, ...shopAgents.slice(0, 1)].map((a, i) => (
                <Figurine key={`${a.key}-${i}`} avatar={a.avatar} state="talking" size={104} className={`film-bob film-d${i + 2}`} />
              ))}
            </div>
          </div>
        ) : null}
        {part === 1 && concierge ? (
          <div className="film-close">
            <Figurine avatar={concierge.avatar} state="thinking" size={420} className="film-zoom" />
            <span className="film-q" aria-hidden>
              ?
            </span>
            <p className="film-caption">Who is it? Who controls it?</p>
          </div>
        ) : null}
        {part === 2 ? (
          <div className="film-pile">
            <div className="film-payers">
              {buyers.slice(0, 3).map((a, i) => (
                <Figurine key={a.key} avatar={a.avatar} state="success" size={84} className={`film-bob film-d${i}`} />
              ))}
            </div>
            <FilmTable rows={rows} growing />
          </div>
        ) : null}
        {part === 3 ? (
          <div className="film-search">
            <div className="film-ask" aria-hidden>
              ?
            </div>
            <FilmTable rows={rows} pointer />
          </div>
        ) : null}
        {part === 4 ? (
          <div className="film-morph">
            <FilmTable rows={rows} />
            <FilmGraph rows={rows} />
          </div>
        ) : null}
        {part === 5 ? (
          <div className="film-words">
            <p className="film-word" style={{ animationDelay: '0.4s' }}>
              Identify <span>ENS</span>
            </p>
            <p className="film-word" style={{ animationDelay: '2s' }}>
              Remember fast <span>{model.networks.rabdi.name.split(' ')[0]}</span>
            </p>
            <p className="film-word" style={{ animationDelay: '3.6s' }}>
              Pay <span>{model.networks.whitechain.name.split(' ')[0]}</span>
            </p>
            <p className="film-name" style={{ animationDelay: '5.2s' }}>
              GraphPay
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// The payments as a table: one row per payment, dropping in one at a time while `growing`.
function FilmTable({ rows, growing = false, pointer = false }: { rows: FilmRow[]; growing?: boolean; pointer?: boolean }) {
  const [shown, setShown] = useState(growing ? 0 : rows.length);
  useEffect(() => {
    if (!growing) return;
    const t = setInterval(() => setShown((n) => (n >= rows.length ? n : n + 1)), ROW_DROP_MS);
    return () => clearInterval(t);
  }, [growing, rows.length]);
  return (
    <div className={`film-table${growing ? ' is-growing' : ''}`} aria-hidden>
      <div className="film-th">
        <span>User</span>
        <span>Merchant</span>
      </div>
      {rows.slice(0, shown).map((r, i) => (
        <div key={i} className="film-tr">
          <span className="film-td">{r.user}</span>
          <span className="film-td is-shop">
            <b>{r.merchant}</b>
            <em>{microUsdt(r.amountMicro)}</em>
          </span>
        </div>
      ))}
      <p className="film-synthetic">Synthetic payments</p>
      {pointer && rows.length > 1 ? <b className="film-pointer" style={{ ['--crawl' as string]: `${(rows.length - 1) * ROW_PITCH}px`, animationTimingFunction: `steps(${rows.length - 1})` }} /> : null}
    </div>
  );
}

// The same payments as a graph: each agent and each shop a node, each payment a line between them,
// drawn one at a time; each shop shows its running total and grows with it.
function FilmGraph({ rows }: { rows: FilmRow[] }) {
  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    let t: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      setDrawn(1);
      t = setInterval(() => setDrawn((n) => (n >= rows.length ? n : n + 1)), LINE_MS);
    }, LINES_AFTER_MS);
    return () => {
      clearTimeout(start);
      if (t) clearInterval(t);
    };
  }, [rows.length]);
  const users = [...new Set(rows.map((r) => r.user))];
  const shops = [...new Set(rows.map((r) => r.merchant))];
  const spread = (i: number, n: number) => (n <= 1 ? 350 : 70 + (i * 560) / (n - 1));
  const userY = (ens: string) => spread(users.indexOf(ens), users.length);
  const shopY = (ens: string) => spread(shops.indexOf(ens), shops.length);
  const total = (ens: string, upTo: number) => rows.slice(0, upTo).reduce((s, r) => (r.merchant === ens ? s + BigInt(r.amountMicro) : s), 0n);
  const most = shops.reduce((m, s) => (total(s, rows.length) > m ? total(s, rows.length) : m), 1n);
  return (
    <svg className="film-graph" viewBox="0 0 880 700" aria-hidden>
      {rows.map((r, i) => (
        <line key={i} x1={310} y1={userY(r.user)} x2={590} y2={shopY(r.merchant)} data-on={i < drawn ? 'true' : 'false'} />
      ))}
      {users.map((u, i) => (
        <g key={u} className="film-node is-user" style={{ animationDelay: `${300 + i * 70}ms` }}>
          <circle cx={310} cy={userY(u)} r={13} />
          <text x={288} y={userY(u) + 6} textAnchor="end">
            {u}
          </text>
        </g>
      ))}
      {shops.map((s, i) => {
        const sum = total(s, drawn);
        const r = 16 + Math.round((14 * Number((sum * 100n) / most)) / 100);
        return (
          <g key={s} className="film-node is-shop" style={{ animationDelay: `${450 + i * 90}ms` }}>
            <circle cx={590} cy={shopY(s)} r={r} />
            <text x={630} y={shopY(s) - 6}>
              {s}
            </text>
            <text className="film-total" x={630} y={shopY(s) + 26}>
              {`${microUsdt(String(sum))} USDT`}
            </text>
          </g>
        );
      })}
      <text className="film-synthetic-svg" x={870} y={694} textAnchor="end">
        Synthetic payments
      </text>
    </svg>
  );
}
