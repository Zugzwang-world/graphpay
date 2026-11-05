'use client';

// The top bar's live chips (WEBSITE_SPEC.md §2): the three chains' heads, mirror
// lag, relayer balance, the token, the passcode lock, sound, and race mode. Each
// number links to where it came from.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { StatusResponse } from '@/lib/contracts';
import { blockUrl, tokenUrl } from '@/lib/explorer';
import { usePoll } from '@/lib/use-poll';
import { useSite } from './site-context';

const fmt = (n: string) => Number(n).toLocaleString('en-US');

export function TopBar() {
  const { model, passcode, setPasscode, requestUnlock, soundOn, setSoundOn, caption } = useSite();
  const status = usePoll<StatusResponse>('/api/status', 3000);
  const data = status.status === 'ok' ? status.data : null;
  const [showCaption, setShowCaption] = useState(false);

  useEffect(() => {
    if (!caption) return;
    setShowCaption(true);
    const t = setTimeout(() => setShowCaption(false), 2600);
    return () => clearTimeout(t);
  }, [caption]);

  const head = (key: 'whitechain' | 'sepolia' | 'rabdi', label: string) => {
    const value = data?.heads[key] ?? null;
    const href = value ? blockUrl(model.explorers, key, value) : null;
    const tone = data ? (value ? 'live' : 'down') : undefined;
    const body = (
      <>
        <span className="dot" aria-hidden="true" />
        <span className="label">{label}</span> {value ? fmt(value) : '—'}
      </>
    );
    return href ? (
      <a className="chip" data-tone={tone} href={href} target="_blank" rel="noopener noreferrer" title={`${label}: latest block`}>
        {body}
      </a>
    ) : (
      <span className="chip" data-tone={tone} title={`${label}: no answer yet`}>
        {body}
      </span>
    );
  };

  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="GraphPay, the stage">
        <span className="brand-name">GraphPay</span>
        <span className="brand-line">Ask before you pay</span>
      </Link>
      <nav className="topbar-chips" aria-label="Live status">
        {head('whitechain', model.networks.whitechain.name)}
        {head('sepolia', model.networks.sepolia.name)}
        {head('rabdi', model.networks.rabdi.name)}
        <span className="chip" title={data?.mirrorLagBlocks == null ? 'Mirror lag: waiting for the mirror' : 'Blocks between the chain head and the mirror'}>
          <span className="label">Mirror lag</span> {data?.mirrorLagBlocks == null ? '—' : `${data.mirrorLagBlocks} blocks`}
        </span>
        <span className="chip" title={data?.relayerWbt == null ? 'Relayer balance: waiting for the facilitator' : 'The relayer pays every gas fee'}>
          <span className="label">Relayer</span> {data?.relayerWbt == null ? '—' : `${data.relayerWbt} ${model.networks.whitechain.nativeSymbol}`}
        </span>
        {data ? (
          <a
            className="chip"
            data-tone={data.token === 'usdt' ? 'pista' : 'chilli'}
            href={tokenUrl(model.explorers, data.tokenAddress) ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            title="The token every payment settles in"
          >
            {data.token === 'usdt' ? model.token.symbol : 'stand-in (not USDT)'}
          </a>
        ) : null}
      </nav>
      <div className="topbar-actions">
        <button
          type="button"
          className="chip lock"
          data-tone={passcode ? 'pista' : undefined}
          onClick={() => (passcode ? setPasscode(null) : void requestUnlock())}
          aria-label={passcode ? 'Unlocked: click to lock the spending buttons again' : 'Locked: click to enter the demo passcode'}
        >
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <rect x="3" y="7" width="10" height="7.5" rx="1.6" fill="currentColor" />
            <path d={passcode ? 'M5.2 7V5.2a2.8 2.8 0 0 1 5.5-.8' : 'M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7'} fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          {passcode ? 'Unlocked' : 'Locked'}
        </button>
        <button type="button" className="chip" aria-pressed={soundOn} onClick={() => setSoundOn(!soundOn)} title="Sounds are synthesised in the browser; captions show either way">
          {soundOn ? 'Sound on' : 'Sound off'}
        </button>
        <Link className="chip" href="/race">
          Race mode
        </Link>
        <Link className="chip" href="/how">
          How it works
        </Link>
      </div>
      <p className="caption" role="status" aria-live="polite" data-show={showCaption ? 'true' : 'false'}>
        {caption ? `♪ ${caption.text}` : ''}
      </p>
    </header>
  );
}
