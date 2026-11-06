'use client';

// The middle of the live stage at the booth: the draft deck, which follows a live errand. Each
// step of the run (the ask, the team, the check, the check back, the quote, the payment, the
// record on Arkiv) moves the deck to its slide and shows that step's explorer chips, taken from
// the same handoff rows and result the explainer reads. After the run the deck stays on the last
// slide with the real links; "Replay the last run" in the deck steps through them again.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { entityUrl, txUrl } from '@/lib/explorer';
import { agentLabel, handoffsUrl, type HandoffRow } from '@/lib/lanes';
import { usePoll } from '@/lib/use-poll';
import { useSite } from './site-context';

interface Chip {
  label: string;
  href: string;
  tone?: 'ok';
}

interface Stage {
  title: string;
  // The deck's slide (1-based) and, for a slide with steps, how far to reveal it (null: all).
  slide: number;
  step: number | null;
  chips: Chip[];
}

interface Answer {
  data?: { handoffs?: HandoffRow[] };
}

const STAGE_TITLES = ['The ask', 'The team', 'The check', 'The check back', 'The 402 quote', 'The payment', 'The record on Arkiv'];
// Slides of the deck: 5 one message, 4 two desks, 7 the graph, 9 the shop checks back, 10 the payment, 15 how one payment is written.
const STAGE_SLIDES: [number, number | null][] = [[5, null], [4, null], [7, null], [9, null], [10, 2], [10, null], [15, null]];
const LANE_OF_STAGE = [null, 'ask', 'check', 'check-back', 'quote', 'pay', null];
const REPLAY_MS = 2500;

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

  const stages = useMemo<Stage[]>(() => {
    const receipt = run.result?.receipt ?? null;
    const chipsOf = (lane: string | null): Chip[] =>
      seenRows
        .filter((r) => r.step === lane)
        .flatMap((r) => {
          const href = entityUrl(model.explorers, r.key);
          return href ? [{ label: `${agentLabel(r.from.ens)} to ${agentLabel(r.to.ens)}`, href }] : [];
        });
    return STAGE_TITLES.map((title, i) => {
      const [slide, step] = STAGE_SLIDES[i] as [number, number | null];
      let chips = chipsOf(LANE_OF_STAGE[i] ?? null);
      if (i === 5 && receipt) {
        const href = txUrl(model.explorers, 'whitechain', receipt.transaction);
        if (href) chips = [...chips, { label: 'settlement', href, tone: 'ok' as const }];
      }
      if (i === 6) {
        chips = [];
        if (run.result?.orderId) chips.push({ label: 'the order’s trail on Arkiv', href: `/order/${run.result.orderId}`, tone: 'ok' });
        if (run.result?.explainId) chips.push({ label: 'exact reads', href: `/explain/${run.result.explainId}` });
        const href = receipt ? txUrl(model.explorers, 'whitechain', receipt.transaction) : null;
        if (href) chips.push({ label: 'settlement', href, tone: 'ok' });
      }
      return { title, slide, step, chips };
    });
  }, [seenRows, run.result, model.explorers]);

  // The furthest stage the run has reached: the lanes with rows, then the record once it paid.
  const reachedStage = useMemo(() => {
    if (!run.runId) return -1;
    let at = run.events.length > 0 ? 0 : -1;
    LANE_OF_STAGE.forEach((lane, i) => {
      if (lane && seenRows.some((r) => r.step === lane)) at = Math.max(at, i);
    });
    if (run.result?.status === 'paid') at = 6;
    return at;
  }, [run.runId, run.events.length, run.result, seenRows]);

  const post = useCallback((index: number, live: boolean) => {
    const stage = stagesRef.current[index];
    if (!stage || !frame.current?.contentWindow) return;
    frame.current.contentWindow.postMessage({ type: 'graphpay.deck', slide: stage.slide, step: stage.step, stage: { index: index + 1, of: STAGE_TITLES.length, title: stage.title }, chips: stage.chips, live }, window.location.origin);
  }, []);
  const stagesRef = useRef(stages);
  stagesRef.current = stages;

  // Follow the run: when the furthest stage moves, or the chips of the current one change.
  const chipKey = reachedStage >= 0 ? JSON.stringify(stages[reachedStage]?.chips) : '';
  useEffect(() => {
    if (reachedStage >= 0) post(reachedStage, !finished);
  }, [reachedStage, chipKey, finished, post]);

  // "Replay the last run": the deck asks, and steps through the stages the run reached.
  const replay = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const onMessage = (msg: MessageEvent) => {
      if (msg.origin !== window.location.origin || (msg.data as { type?: unknown } | null)?.type !== 'graphpay.deck-replay') return;
      if (replay.current) clearInterval(replay.current);
      const last = reachedStageRef.current;
      if (last < 0) return;
      let i = 0;
      post(i, false);
      replay.current = setInterval(() => {
        i += 1;
        post(Math.min(i, last), false);
        if (i >= last && replay.current) clearInterval(replay.current);
      }, REPLAY_MS);
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      if (replay.current) clearInterval(replay.current);
    };
  }, [post]);
  const reachedStageRef = useRef(reachedStage);
  reachedStageRef.current = reachedStage;

  return (
    <div className="middle-switch" ref={root}>
      <iframe ref={frame} className="middle-deck" src="/deck/index.html?embed=1" title="The GraphPay story" />
    </div>
  );
}
