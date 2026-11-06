'use client';

// Scene 0: the opening film (final website brief §5), built in code from Grok's figurines, with
// almost no words. Five parts of five seconds, looping until the request bubble on the customer’s phone
// is tapped: coins in a fast zigzag; the concierge, close, with a question; every payment a row in a
// pile that keeps growing; a question and a pointer crawling through the pile; three words, then
// the name. With reduced motion, the last frame stands still.

import { useEffect, useState } from 'react';
import { useSite } from '../site-context';
import { Figurine } from './common';

const PART_MS = 5_000;
const PARTS = 5;

export function SceneFilm() {
  const { model } = useSite();
  const [tick, setTick] = useState(0);
  const [still, setStill] = useState(false);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    setStill(reduce.matches);
    if (reduce.matches) return;
    const t = setInterval(() => setTick((n) => n + 1), PART_MS);
    return () => clearInterval(t);
  }, []);
  const part = still ? PARTS - 1 : tick % PARTS;
  const loop = Math.floor(tick / PARTS);
  const buyers = model.buyerAgents;
  const shopAgents = model.merchant.agents;
  const concierge = buyers.find((a) => a.key === 'concierge') ?? buyers[0];
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
            <div className="film-db" aria-hidden>
              {Array.from({ length: 22 }, (_, i) => (
                <i key={i} style={{ animationDelay: `${i * 0.19}s` }} />
              ))}
            </div>
          </div>
        ) : null}
        {part === 3 ? (
          <div className="film-search">
            <div className="film-ask" aria-hidden>
              ?
            </div>
            <div className="film-db is-full" aria-hidden>
              {Array.from({ length: 22 }, (_, i) => (
                <i key={i} />
              ))}
              <b className="film-pointer" />
            </div>
          </div>
        ) : null}
        {part === 4 ? (
          <div className="film-words">
            <p className="film-word" style={{ animationDelay: '0.1s' }}>
              Identify <span>ENS</span>
            </p>
            <p className="film-word" style={{ animationDelay: '0.9s' }}>
              Remember fast <span>{model.networks.rabdi.name.split(' ')[0]}</span>
            </p>
            <p className="film-word" style={{ animationDelay: '1.7s' }}>
              Pay <span>{model.networks.whitechain.name.split(' ')[0]}</span>
            </p>
            <p className="film-name" style={{ animationDelay: '2.8s' }}>
              GraphPay
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
