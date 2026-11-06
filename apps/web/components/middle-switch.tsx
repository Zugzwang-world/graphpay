'use client';

// The middle of the live stage at the booth: the draft deck, which follows what happens on the
// phones. Each step of a live errand (the ask, the team, the check, the check back, the quote, the
// payment, the record on Arkiv) and each other phone event (a refund, pause and resume, the shop's
// Open switch, a renewal) moves the deck to its slide, with that step's explorer chips. Where each
// one goes is the single table in lib/deck-map.ts; the deck draws its strip from the same rows, so
// the strip and the slide agree. Back and Next only browse the deck: it never acts on a phone.
// "Replay the last run" in the deck steps through the errand's slides again (the deck only).

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { DECK_MAP, ERRAND_KEYS, isDeckKey, type DeckKey } from '@/lib/deck-map';
import { entityUrl, txUrl } from '@/lib/explorer';
import { agentLabel, handoffsUrl, type HandoffRow } from '@/lib/lanes';
import { usePoll } from '@/lib/use-poll';
import { useSite } from './site-context';

interface Chip {
  label: string;
  href: string;
  tone?: 'ok';
}

interface Answer {
  data?: { handoffs?: HandoffRow[] };
}

// The message the phones post for their own events (apps/phones/src/live-adapter.ts).
const PHONE_EVENT = 'graphpay.phone-event';
// The handoff lane (lib/lanes.ts) whose rows mark each errand step; the ask is the request itself, the record comes with the result.
const LANE_OF_KEY: Partial<Record<DeckKey, string>> = { team: 'ask', check: 'check', 'check-back': 'check-back', quote: 'quote', payment: 'pay' };
const REPLAY_MS = 2500;

const safeChips = (value: unknown): Chip[] =>
  (Array.isArray(value) ? value : []).flatMap((c: { label?: unknown; href?: unknown }) =>
    typeof c?.label === 'string' && typeof c.href === 'string' && /^https:\/\//.test(c.href) ? [{ label: c.label.slice(0, 60), href: c.href, tone: 'ok' as const }] : [],
  );

export function MiddleSwitch() {
  const { run, model } = useSite();
  const frame = useRef<HTMLIFrameElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const url = run.runId ? handoffsUrl(run.runId) : null;
  const finished = run.result !== null;
  const state = usePoll<Answer>(url && !finished ? url : null, 3000, root);
  const rows = useRef<HandoffRow[]>([]);
  const rowsRun = useRef<string | null>(null);
  if (rowsRun.current !== run.runId) {
    rowsRun.current = run.runId;
    rows.current = [];
  }
  if (state.status === 'ok' && state.data.data?.handoffs) rows.current = state.data.data.handoffs;
  // One more read after the result: the last rows land a moment late.
  const lastRead = usePoll<Answer>(url && finished ? url : null, 4000, root);
  if (lastRead.status === 'ok' && lastRead.data.data?.handoffs) rows.current = lastRead.data.data.handoffs;
  const seenRows = rows.current;

  // The chips of each row: the errand's from the same handoff rows and result the explainer reads;
  // the phones' own events bring theirs (a settlement link) in `phoneChips`.
  const phoneChips = useRef<Partial<Record<DeckKey, Chip[]>>>({});
  const chipsByKey = useMemo(() => {
    const receipt = run.result?.receipt ?? null;
    const settlement = receipt ? txUrl(model.explorers, 'whitechain', receipt.transaction) : null;
    const out: Partial<Record<DeckKey, Chip[]>> = {};
    for (const key of ERRAND_KEYS) {
      const lane = LANE_OF_KEY[key];
      let chips: Chip[] = lane
        ? seenRows
            .filter((r) => r.step === lane)
            .flatMap((r) => {
              const href = entityUrl(model.explorers, r.key);
              return href ? [{ label: `${agentLabel(r.from.ens)} to ${agentLabel(r.to.ens)}`, href }] : [];
            })
        : [];
      if (key === 'payment' && settlement) chips = [...chips, { label: 'settlement', href: settlement, tone: 'ok' as const }];
      if (key === 'record') {
        chips = [];
        if (run.result?.orderId) chips.push({ label: 'the order’s trail on Arkiv', href: `/order/${run.result.orderId}`, tone: 'ok' });
        if (run.result?.explainId) chips.push({ label: 'exact reads', href: `/explain/${run.result.explainId}` });
        if (settlement) chips.push({ label: 'settlement', href: settlement, tone: 'ok' });
      }
      out[key] = chips;
    }
    return out;
  }, [seenRows, run.result, model.explorers]);

  // The furthest errand step the run has reached: the lanes with rows, then the record once it paid.
  const reached = useMemo(() => {
    if (!run.runId) return -1;
    let at = run.events.length > 0 ? 0 : -1;
    ERRAND_KEYS.forEach((key, i) => {
      const lane = LANE_OF_KEY[key];
      if (lane && seenRows.some((r) => r.step === lane)) at = Math.max(at, i);
    });
    if (run.result?.status === 'paid') at = ERRAND_KEYS.length - 1;
    return at;
  }, [run.runId, run.events.length, run.result, seenRows]);

  const chipsRef = useRef(chipsByKey);
  chipsRef.current = chipsByKey;
  const reachedRef = useRef(reached);
  reachedRef.current = reached;
  // What the deck is showing because of a phone: the last key, and where a pause returns to.
  const focus = useRef<DeckKey | null>(null);
  const before = useRef<DeckKey | null>(null);

  // One message carries the whole table with the current chips, so the deck can draw its strip for
  // any slide the viewer browses to. `go` moves the deck to `key`; without it only the chips refresh.
  const post = useCallback((key: DeckKey | null, go: boolean, live: boolean, home = false) => {
    const win = frame.current?.contentWindow;
    if (!win) return;
    const entries = (Object.keys(DECK_MAP) as DeckKey[]).map((k) => ({ key: k, ...DECK_MAP[k], chips: phoneChips.current[k] ?? chipsRef.current[k] ?? [] }));
    win.postMessage({ type: 'graphpay.deck', entries, key, go, home, live, of: ERRAND_KEYS.length, reached: reachedRef.current + 1 }, window.location.origin);
  }, []);

  // Follow the errand: when its furthest step moves, the deck goes to that step's slide.
  const chipKey = JSON.stringify(chipsByKey);
  const lastStep = useRef(-1);
  useEffect(() => {
    if (reached !== lastStep.current) {
      lastStep.current = reached;
      if (reached >= 0) {
        focus.current = ERRAND_KEYS[reached] ?? null;
        post(focus.current, true, !finished);
        return;
      }
    }
    post(null, false, !finished);
  }, [reached, chipKey, finished, post]);

  // The phones' other events move the deck the same way. A pause shows "Stopped, live"; the resume
  // returns the deck to what it was showing before.
  useEffect(() => {
    const onMessage = (msg: MessageEvent) => {
      if (msg.origin !== window.location.origin) return;
      const data = msg.data as { type?: unknown; key?: unknown; chips?: unknown } | null;
      if (data?.type !== PHONE_EVENT || !isDeckKey(data.key)) return;
      const key = data.key;
      if (key === 'resumed') {
        if (focus.current !== 'paused') return;
        const back = before.current;
        before.current = null;
        focus.current = back;
        if (back) post(back, true, false);
        else post(null, true, false, true);
        return;
      }
      if (key === 'paused' && focus.current !== 'paused') before.current = focus.current;
      phoneChips.current = { ...phoneChips.current, [key]: safeChips(data.chips) };
      focus.current = key;
      post(key, true, false);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [post]);

  // "Replay the last run": the deck asks, and steps through the errand's steps the run reached.
  const replay = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const onMessage = (msg: MessageEvent) => {
      if (msg.origin !== window.location.origin || (msg.data as { type?: unknown } | null)?.type !== 'graphpay.deck-replay') return;
      if (replay.current) clearInterval(replay.current);
      const last = reachedRef.current;
      if (last < 0) return;
      let i = 0;
      post(ERRAND_KEYS[0] ?? null, true, false);
      replay.current = setInterval(() => {
        i += 1;
        post(ERRAND_KEYS[Math.min(i, last)] ?? null, true, false);
        if (i >= last && replay.current) clearInterval(replay.current);
      }, REPLAY_MS);
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      if (replay.current) clearInterval(replay.current);
    };
  }, [post]);

  return (
    <div className="middle-switch" ref={root}>
      <iframe ref={frame} className="middle-deck" src="/deck/index.html?embed=1" title="The GraphPay story" />
    </div>
  );
}
