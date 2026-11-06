// The customer’s phone on the stage (final website brief §4 and §5): one screen, no menus, no chat box.
// The header (name, live status, pass), the team, the conversation with its cards, the activity row.
// The request bubble sends the errand; Refund and the payer's switch are the only other taps that
// act. Every line is shown only once the stage's director has reached its step (on its own, the
// phone paces itself with the same rules).

import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { story } from '@/data/story';
import { foldAll } from '../../web/lib/stage/errand.ts';
import { customerErrandLines, dispatchLines, endSentence, pauseLines, refundLines, type Line as LineData } from '../../web/lib/stage/lines.ts';
import { advance, caughtUp, restPace, type Pace } from '../../web/lib/stage/pace.ts';
import { ERRAND_STEPS, stepIndex, type BeatKey } from '../../web/lib/stage/scenes.ts';
import { clock, microUsdt, orderNumber, percent, usdt } from '../../web/lib/stage/format.ts';
import { getJson, postJson, Refusal, type CustomerState, type HealState } from './api';
import { cast, links, menuOf, networks, order, payer, productOf, renewal, shopOf, timeZone } from './cast';
import { readFrames } from './errand';
import { embedded, postEvent, postFrame, useNow, useStage, type Frame } from './stage-link';
import { ActivityRow, ArkivPending, Card, Figure, Line, Pending, ProofLink, SwarmPhoto, TeamStrip, useAutoScroll, type ActivityState, type TeamMember } from './ui';
import { AgentsView, ProofList, ScoreboardView, type ProofItem } from './views';

const REQUEST = story.quickPrompts[0]?.text ?? '';
const PAUSABLE = new Set(['payer', 'scout']);
const POLL_MS = 15_000;
const FAST_POLL_MS = 3_000;

interface RefundFlow {
  phase: 'card' | 'sending' | 'sent' | 'refunded' | 'declined' | 'error';
  orderId: string;
  swarm: { ref: string; file: string; uploaded: boolean; at: number } | null;
  arkiv: { tx: string | null; entityKey: string | null; at: number } | null;
  refund: { tx: string | null; amountMicro: string; at: number } | null;
  error: string | null;
}

interface PauseFlow {
  phase: 'pausing' | 'waiting' | 'paused' | 'trying' | 'refused' | 'paid' | 'error';
  sepoliaTx: string | null;
  at: number;
  resumesAt: string | null;
  refusal: string | null;
  error: string | null;
}

export function CustomerPhone() {
  const stage = useStage('customer');
  const now = useNow(1000);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [state, setState] = useState<CustomerState | null>(null);
  const [heal, setHeal] = useState<HealState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [refund, setRefund] = useState<RefundFlow | null>(null);
  const [pause, setPause] = useState<PauseFlow | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const [switchNote, setSwitchNote] = useState<string | null>(null);
  const model = useMemo(() => foldAll(frames), [frames]);

  // The live state of the payer and the self-healing plan, polled together.
  const refresh = useCallback(async () => {
    const [s, h] = await Promise.all([getJson<CustomerState>('/api/state/customer'), getJson<HealState>('/api/state/heal')]);
    if (s) setState(s);
    if (h) setHeal(h);
    return s;
  }, []);
  const fast = pause !== null && (pause.phase === 'pausing' || pause.phase === 'waiting');
  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), fast ? FAST_POLL_MS : POLL_MS);
    return () => clearInterval(t);
  }, [refresh, fast]);

  // The phone's own pace, used when no stage is around it.
  const [pace, setPace] = useState<Pace>(() => restPace(Date.now()));
  useEffect(() => {
    if (embedded) return;
    const t = setInterval(() => setPace((p) => advance(p, model.arrived, model.end !== null, Date.now())), 200);
    return () => clearInterval(t);
  }, [model]);
  const stageScene = stage.scene;
  const shownIndex = embedded ? (stageScene && stageScene.runId === model.runId ? stageScene.step : -1) : pace.shown;
  const localBeat: BeatKey = pause ? 'pause' : refund ? 'refund' : model.runId ? pace.beat : 'film';
  const beat: BeatKey = embedded ? (stageScene?.beat ?? 'film') : localBeat;
  const atRest = beat === 'film' && !running;

  // The errand: one POST, its frames to the stage and to this phone's model.
  const start = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setNotice(null);
    setFrames([]);
    setRefund(null);
    setPause(null);
    setPace(restPace(Date.now()));
    let res: Response;
    try {
      res = await fetch('/api/agents/run', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'text/event-stream' }, body: JSON.stringify({ request: REQUEST }), cache: 'no-store' });
    } catch {
      setRunning(false);
      setNotice('The site did not answer. Try again in a minute.');
      return;
    }
    if (!res.ok || !res.body) {
      setRunning(false);
      setNotice(res.status === 409 ? 'Another errand is running. Try again in a minute.' : 'The errand did not start. Try again in a minute.');
      return;
    }
    let runId: string | null = null;
    let done = false;
    let applied = 0;
    const apply = (event: string, data: string) => {
      applied += 1;
      postFrame(event, data);
      if (event === 'started') {
        try {
          runId = (JSON.parse(data) as { runId?: string }).runId ?? null;
        } catch {
          // kept as it was
        }
      }
      if (event === 'result' || event === 'failed') done = true;
      setFrames((f) => [...f, { event, data, at: Date.now() }]);
    };
    await readFrames(res.body, apply);
    // The stream dropped before the end: the run goes on server side, so re-attach to it by its id
    // (the server replays its frames; the ones already shown are skipped). Never a second errand.
    for (let tries = 0; !done && runId && tries < 8; tries++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const again = await fetch(`/api/agents/run/${runId}/events`, { cache: 'no-store', headers: { accept: 'text/event-stream' } });
        if (again.status === 404) break;
        if (again.ok && again.body) {
          let seen = 0;
          await readFrames(again.body, (event, data) => {
            seen += 1;
            if (seen > applied) apply(event, data);
          });
        }
      } catch {
        // the connection dropped again: try once more
      }
    }
    if (!done) apply('failed', JSON.stringify({ error: 'the errand stream ended before its result' }));
    setRunning(false);
    void refresh();
  }, [running, refresh]);

  // Local design work only (localhost): a recorded errand's frames, replayed through the same path
  // with their own timing, so the stage can be checked without a payment.
  useEffect(() => {
    if (window.location.hostname !== 'localhost') return;
    const onReplay = (msg: MessageEvent) => {
      const data = msg.data as { type?: unknown; frames?: unknown } | null;
      if (msg.source !== window || data?.type !== 'graphpay.dev-replay' || !Array.isArray(data.frames)) return;
      const list = data.frames as { event: string; data: string; t: number }[];
      setFrames([]);
      setRefund(null);
      setPause(null);
      setPace(restPace(Date.now()));
      for (const f of list) {
        setTimeout(() => {
          postFrame(f.event, f.data);
          setFrames((x) => [...x, { event: f.event, data: f.data, at: Date.now() }]);
        }, f.t * 1000);
      }
    };
    window.addEventListener('message', onReplay);
    return () => window.removeEventListener('message', onReplay);
  }, []);

  // Relayed from the shop's phone through the stage: the refund's answer.
  useEffect(() => {
    const last = stage.events[stage.events.length - 1];
    if (!last || !refund) return;
    if (last.key === 'refund' && refund.phase !== 'refunded') {
      const tx = typeof last.data?.transaction === 'string' ? last.data.transaction : null;
      const amountMicro = typeof last.data?.amountMicro === 'string' ? last.data.amountMicro : order.refundMicro;
      setRefund({ ...refund, phase: 'refunded', refund: { tx, amountMicro, at: last.at } });
    } else if (last.key === 'refund-declined' && refund.phase !== 'declined') {
      setRefund({ ...refund, phase: 'declined' });
    }
  }, [stage.events, refund]);

  // The shop marks the paid order dispatched on chain right after the payment (relayed from its
  // phone through the stage). On the stage, the refund unlocks only once that is confirmed.
  const dispatchEvent = model.paid ? stage.events.find((e) => e.key === 'dispatched' && typeof e.data?.orderId === 'string' && e.data.orderId.toLowerCase() === model.paid?.orderId.toLowerCase()) : undefined;
  const dispatched = dispatchEvent ? { tx: typeof dispatchEvent.data?.transaction === 'string' ? dispatchEvent.data.transaction : null, at: dispatchEvent.at } : null;

  // Scene 5: Refund, then one tap to attach the photo: it goes to Swarm from this browser, then the
  // request is recorded on Arkiv, and the shop accepts it by itself.
  const paidOrder = model.paid?.orderId ?? (state?.lastOrder && /PAID|DELIVERED/.test(state.lastOrder.status) ? state.lastOrder.orderId : null);
  // A phone on its own has no shop beside it to dispatch, so its refund stays as it was. One refund
  // request per order: after a reload, the stage's replay shows one was already made.
  const asked = model.paid ? stage.events.some((e) => (e.key === 'refund-request' || e.key === 'refund') && typeof e.data?.orderId === 'string' && e.data.orderId.toLowerCase() === model.paid?.orderId.toLowerCase()) : false;
  const refundable = embedded ? dispatched !== null && !asked : paidOrder !== null;
  const openRefund = () => {
    if (!paidOrder || refund || !refundable) return;
    setRefund({ phase: 'card', orderId: paidOrder, swarm: null, arkiv: null, refund: null, error: null });
    postEvent('refund-start', [], { orderId: paidOrder });
  };
  const attachPhoto = async () => {
    if (!refund || refund.phase !== 'card') return;
    // The coffee's photo, already on Swarm with its menu: its reference, read from the menu at build time.
    const coffee = productOf(cast.merchant.ens, order.reorder.sku);
    const known = coffee?.swarm ? /\/bzz\/([0-9a-f]{64})\/([^/]+)$/.exec(coffee.swarm) : null;
    const swarm: RefundFlow['swarm'] = known ? { ref: known[1]!, file: known[2]!, uploaded: false, at: Date.now() } : null;
    postEvent('refund-photo', swarm ? [{ label: 'Photo on Swarm', href: links.swarm(swarm.ref, swarm.file) }] : [], swarm ? { ...swarm } : {});
    setRefund((r) => (r ? { ...r, phase: 'sending', swarm } : r));
    // The route refunds the payer's newest order as the graph knows it; a fresh order can take a
    // moment to reach Arkiv, so the request waits for it rather than being refused.
    for (let i = 0; i < 20; i++) {
      const s = await refresh();
      if (s?.lastOrder?.orderId?.toLowerCase() === refund.orderId.toLowerCase()) break;
      await new Promise((r) => setTimeout(r, 3_000));
    }
    try {
      const answer = await postJson<{ arkivTx?: string | null; entityKey?: string | null }>('/api/customer/refund-request', { orderId: refund.orderId, amountMicro: order.refundMicro, reason: order.refundReason });
      const arkiv = { tx: answer.arkivTx ?? null, entityKey: answer.entityKey ?? null, at: Date.now() };
      setRefund((r) => (r ? { ...r, phase: 'sent', arkiv } : r));
      const chips = [arkiv.tx ? { label: 'Request on Arkiv', href: links.arkivTx(arkiv.tx) } : null].filter((c): c is { label: string; href: string } => c !== null);
      postEvent('refund-request', chips, { orderId: refund.orderId, amountMicro: order.refundMicro, reason: order.refundReason, swarmRef: swarm?.ref ?? null, file: swarm?.file ?? null, uploaded: swarm?.uploaded ?? false, arkivTx: arkiv.tx, entityKey: arkiv.entityKey });
    } catch (error) {
      setRefund((r) => (r ? { ...r, phase: 'error', error: error instanceof Refusal ? error.message : 'The request did not go through. Try again in a minute.' } : r));
    }
  };

  // Scene 6: the payer's switch. Paused shows only once the state reads PAUSED; only then does the
  // phone try the payer's next payment, which ENS must refuse. Never while the payer is active.
  const flipPayer = async () => {
    if (pause && pause.phase !== 'error') return;
    const at = Date.now();
    setPause({ phase: 'pausing', sepoliaTx: null, at, resumesAt: null, refusal: null, error: null });
    postEvent('pause-start', [], { agent: payer.ens });
    let sepoliaTx: string | null = null;
    try {
      const answer = await postJson<{ sepoliaTx?: string | null }>('/api/customer/pause', { agent: payer.ens });
      sepoliaTx = answer.sepoliaTx ?? null;
    } catch (error) {
      setPause({ phase: 'error', sepoliaTx: null, at, resumesAt: null, refusal: null, error: error instanceof Refusal ? error.message : 'The pause did not go through. Try again in a minute.' });
      return;
    }
    setPause((p) => (p ? { ...p, phase: 'waiting', sepoliaTx } : p));
    let paused: CustomerState | null = null;
    for (let i = 0; i < 25 && !paused; i++) {
      await new Promise((r) => setTimeout(r, FAST_POLL_MS));
      const s = await refresh();
      if (s?.agent.status === 'PAUSED') paused = s;
    }
    if (!paused) {
      setPause((p) => (p ? { ...p, phase: 'error', error: 'ENS has not shown the pause yet. Look again in a minute.' } : p));
      return;
    }
    const h = await getJson<HealState>('/api/state/heal');
    if (h) setHeal(h);
    const resumesAt = h?.agents.find((a) => a.ens === payer.ens)?.resumesAt ?? null;
    setPause((p) => (p ? { ...p, phase: 'paused', resumesAt } : p));
    postEvent('paused', sepoliaTx ? [{ label: 'Paused on ENS', href: links.sepoliaTx(sepoliaTx) }] : [], { sepoliaTx, resumesAt, agent: payer.ens });
    // A few seconds more, then the state is read once again: the attempt is made only while PAUSED.
    await new Promise((r) => setTimeout(r, 6_000));
    const check = await refresh();
    const parent = check?.lastOrder?.orderId ?? null;
    if (check?.agent.status !== 'PAUSED' || !parent) {
      setPause((p) => (p ? { ...p, phase: 'paused' } : p));
      return;
    }
    setPause((p) => (p ? { ...p, phase: 'trying' } : p));
    try {
      const paid = await postJson<{ status?: string; transaction?: string }>('/api/customer/reorder', { parentOrderId: parent });
      // Never expected while paused; shown as it is if it ever happens.
      setPause((p) => (p ? { ...p, phase: 'paid', refusal: paid.transaction ?? null } : p));
    } catch (error) {
      const code = error instanceof Refusal ? error.code : 'UNKNOWN';
      // Refused before anything was sent: the shop's refusal while ENS reads paused. Any other answer
      // (a wait, a newer order) is said as it is, and is not shown as the pause's refusal.
      if (['SHOP_REFUSED', 'NOT_PAID', 'ENS_PAUSED'].includes(code)) {
        setPause((p) => (p ? { ...p, phase: 'refused', refusal: code } : p));
        postEvent('reorder-refused', [], { code, agent: payer.ens, parentOrderId: parent });
      } else {
        setPause((p) => (p ? { ...p, phase: 'error', error: error instanceof Refusal ? error.message : 'The payment was not tried. Try again in a minute.' } : p));
      }
    }
  };

  const toggleAgent = async (role: string, pausing: boolean) => {
    if (role === 'payer' && pausing) {
      void flipPayer();
      return;
    }
    const a = cast.agents[role];
    if (!a) return;
    setSwitching(role);
    setSwitchNote(null);
    try {
      await postJson(pausing ? '/api/customer/pause' : '/api/customer/resume', { agent: a.ens });
      setSwitchNote(pausing ? 'Paused on ENS. It shows here within 20 seconds.' : 'Resumed on ENS. It shows here within 20 seconds.');
      if (role === 'payer' && !pausing) postEvent('resumed', [], { agent: a.ens });
    } catch (error) {
      setSwitchNote(error instanceof Refusal ? error.message : 'That did not go through. Try again in a minute.');
    } finally {
      setSwitching(null);
      void refresh();
    }
  };

  // What this phone shows: the errand's lines up to the director's step, then the run's end, then
  // the refund and the pause in the same style.
  const errandLines = useMemo(() => customerErrandLines(model, cast).filter((l) => stepIndex(l.step) <= shownIndex), [model, shownIndex]);
  const atEnd = model.end !== null && (embedded ? shownIndex >= lastArrived(model.arrived) : caughtUp(pace, model.arrived));
  const failure = atEnd ? endSentence(model) : null;
  const scrollKey = `${errandLines.length}|${dispatched?.at}|${failure}|${refund?.phase}|${pause?.phase}|${beat}`;
  const scroller = useAutoScroll(scrollKey);

  const payerStatus = statusOf(state?.agent.status);
  const scoutStatus = statusOf(heal?.agents.find((a) => a.ens === cast.agents.scout?.ens)?.status?.toUpperCase());
  const speaking = beat === 'pause' ? 'payer' : beat === 'refund' ? 'payer' : (errandLines[errandLines.length - 1]?.role ?? (model.runId ? 'concierge' : null));
  const members: TeamMember[] = Object.keys(cast.agents)
    .filter((r) => ['concierge', 'scout', 'analyst', 'payer'].includes(r))
    .map((role) => {
      const ens = cast.agents[role]!.ens;
      const status = role === 'payer' ? payerStatus : role === 'scout' ? scoutStatus : 'active';
      const woke = model.woke.includes(ens) && !model.end;
      const activity = role === speaking ? 'talking' : role === 'payer' && pause?.phase === 'refused' ? 'refused' : model.paid && shownIndex >= stepIndex('paid') && (role === 'payer' || role === 'concierge') ? 'success' : woke ? 'thinking' : 'idle';
      return { role, status, activity } as TeamMember;
    });

  const find: ActivityState = shownIndex >= stepIndex('order') ? 'done' : model.runId && shownIndex >= 0 ? 'on' : 'idle';
  const pay: ActivityState = shownIndex >= stepIndex('paid') ? 'done' : failure ? 'blocked' : shownIndex >= stepIndex('order') ? 'on' : 'idle';
  const refundState: ActivityState = refund?.phase === 'refunded' ? 'done' : refund?.phase === 'declined' || refund?.phase === 'error' ? 'blocked' : refund ? 'on' : 'idle';
  const pauseState: ActivityState = pause?.phase === 'refused' || pause?.phase === 'paid' ? 'blocked' : pause && pause.phase !== 'error' ? 'on' : 'idle';

  const header = payerStatus === 'paused' ? `${cast.agents.payer?.label ?? 'Payer'} paused` : payerStatus === 'revoked' ? `${cast.agents.payer?.label ?? 'Payer'} revoked` : scoutStatus === 'paused' ? `${cast.agents.scout?.label ?? 'Scout'} paused` : state ? 'Agents active' : '';
  const pass = state?.capMicro ? `Pass ${microUsdt(state.capMicro)} a day, ${microUsdt(state.spentTodayMicro ?? '0')} used` : '';
  const view = beat === 'arkiv' ? 'scoreboard' : beat === 'ens' ? 'agents' : beat === 'whitechain' ? 'history' : beat === 'close' ? 'replay' : 'thread';

  return (
    <div className="flex h-full flex-col bg-bg pt-[54px]">
      <header className="flex items-center gap-3 border-b border-line bg-surface px-4 pt-1 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate font-heading text-title leading-tight font-bold text-ink">{story.customer.name}</h1>
            <span className="stage-role">User</span>
          </div>
          <p className="truncate text-caption text-muted">{pass}</p>
        </div>
        {header ? <span className={clsx('stage-status rounded-full px-3 py-1 text-caption font-bold', payerStatus === 'paused' || scoutStatus === 'paused' ? 'bg-warn/10 text-warn' : payerStatus === 'revoked' ? 'bg-bad/10 text-bad' : 'bg-ok/10 text-ok')}>{header}</span> : null}
      </header>

      <div className="border-b border-line bg-surface pt-2">
        <TeamStrip members={members} speaking={speaking} selected={selected} onTap={(r) => setSelected((s) => (s === r ? null : r))} />
        {selected ? (
          <AgentCard role={selected} status={selected === 'payer' ? payerStatus : selected === 'scout' ? scoutStatus : 'active'} heal={heal} busy={switching === selected} note={switchNote} onSwitch={(pausing) => void toggleAgent(selected, pausing)} />
        ) : null}
      </div>

      <div ref={scroller} className="stage-scroll flex-1 overflow-y-auto px-4 py-4">
        {view !== 'thread' ? (
          view === 'scoreboard' ? (
            <ScoreboardView ens={payer.ens} title={`${cast.agents.payer?.label ?? 'Payer'}’s scoreboard`} />
          ) : view === 'agents' ? (
            <AgentsView side="customer" state={state} heal={heal} />
          ) : view === 'history' ? (
            <ProofList title="Payments" items={historyItems(model, dispatched, refund, pause, state, false)} now={now} empty="No payment on this phone yet." />
          ) : (
            <ProofList title="This run" items={historyItems(model, dispatched, refund, pause, state, true)} now={now} replay empty="No run on this phone yet." />
          )
        ) : atRest ? (
          <RestingDesk notice={notice} onSend={() => void start()} />
        ) : (
          <div className="flex flex-col gap-4">
            {errandLines.map((l) => (
              <Line key={l.key} role={l.role} text={l.text} tone={l.tone} mine={l.role === 'persona'}>
                {l.card ? <ErrandCard line={l} model={model} shownIndex={shownIndex} now={now} state={state} dispatched={dispatched} embedded={embedded} refundable={refundable} onRefund={openRefund} refundOpen={refund !== null} /> : null}
              </Line>
            ))}
            {dispatched && shownIndex >= stepIndex('paid') ? <Line role="payer" text={dispatchLines.customerDone(cast)} tone="ok" /> : null}
            {running && errandLines.length === 0 ? <Line role="persona" text={REQUEST} mine /> : null}
            {failure ? <Line role="concierge" text={failure} tone="bad" /> : null}
            {refund ? <RefundThread flow={refund} now={now} onAttach={() => void attachPhoto()} /> : null}
            {pause ? <PauseThread flow={pause} state={state} now={now} /> : null}
          </div>
        )}
      </div>

      <ActivityRow
        items={[
          { label: 'Find', state: find },
          { label: 'Pay', state: pay },
          { label: 'Refund', state: refundState },
          { label: 'Pause', state: pauseState },
        ]}
      />
    </div>
  );
}

// This run's steps as a plain list: the history (scene 9) or the fast replay (scene 10).
function historyItems(model: ReturnType<typeof foldAll>, dispatched: { tx: string | null; at: number } | null, refund: RefundFlow | null, pause: PauseFlow | null, state: CustomerState | null, replay: boolean): ProofItem[] {
  const items: ProofItem[] = [];
  if (replay && model.request) items.push({ key: 'order', label: `Asked for ${cast.order.item} near ${cast.order.area}`, href: null, network: '', at: null });
  if (replay && model.quote) items.push({ key: 'bill', label: `Bill ${orderNumber(model.quote.orderId)} from ${shopOf(model.quote.shop)?.name ?? ''}`, amount: usdt(model.quote.priceUsdt), href: null, network: '', at: null });
  if (model.paid) items.push({ key: 'paid', label: `Paid ${shopOf(model.quote?.shop ?? model.best)?.name ?? ''}`, amount: usdt(model.paid.amountUsdt), href: links.whitechainTx(model.paid.tx), network: networks.whitechain, at: model.arrived.settled ?? null, tone: 'ok' });
  if (dispatched?.tx) items.push({ key: 'dispatched', label: 'Dispatched', href: links.whitechainTx(dispatched.tx), network: networks.whitechain, at: dispatched.at });
  if (refund?.refund) items.push({ key: 'refund', label: 'Refunded', amount: microUsdt(refund.refund.amountMicro), href: refund.refund.tx ? links.whitechainTx(refund.refund.tx) : null, network: networks.whitechain, at: refund.refund.at, tone: 'ok' });
  else if (refund?.arkiv) items.push({ key: 'refund', label: 'Refund asked', amount: microUsdt(order.refundMicro), href: refund.arkiv.tx ? links.arkivTx(refund.arkiv.tx) : null, network: networks.arkiv, at: refund.arkiv.at });
  const renewed = state?.subscription?.renewals?.[state.subscription.renewals.length - 1];
  if (!replay && renewed) items.push({ key: 'renewal', label: `${renewal.item} renewed`, amount: microUsdt(state?.subscription?.priceMicro ?? renewal.priceMicro ?? ''), href: links.whitechainTx(renewed.transaction), network: networks.whitechain, at: Date.parse(renewed.at) });
  if (pause?.phase === 'refused') items.push({ key: 'refused', label: 'Refused while paused, nothing sent', href: pause.sepoliaTx ? links.sepoliaTx(pause.sepoliaTx) : null, network: networks.sepolia, at: pause.at, tone: 'bad' });
  return items;
}

const lastArrived = (arrived: Partial<Record<string, number>>): number => ERRAND_STEPS.reduce((max, s, i) => (arrived[s.key] !== undefined ? i : max), -1);

function statusOf(s: string | undefined | null): 'active' | 'paused' | 'revoked' {
  if (s === 'ACTIVE' || s === 'EXPIRED') return 'active';
  if (s === 'REVOKED') return 'revoked';
  if (s === 'PAUSED') return 'paused';
  return 'active';
}

function RestingDesk({ notice, onSend }: { notice: string | null; onSend: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-2">
      <button type="button" onClick={onSend} className="stage-bubble w-full rounded-[28px] rounded-br-[8px] bg-brand px-6 py-6 text-left font-heading text-title leading-snug font-bold text-white shadow-card">
        {REQUEST}
      </button>
      <p className="stage-live-label text-section font-bold text-brand">{notice ?? 'Live demo'}</p>
    </div>
  );
}

function AgentCard({ role, status, heal, busy, note, onSwitch }: { role: string; status: 'active' | 'paused' | 'revoked'; heal: HealState | null; busy: boolean; note: string | null; onSwitch: (pausing: boolean) => void }) {
  const a = cast.agents[role];
  if (!a) return null;
  const pausable = PAUSABLE.has(role);
  const resumesAt = heal?.agents.find((x) => x.ens === a.ens)?.resumesAt ?? null;
  return (
    <div className="stage-card mx-4 mb-3 rounded-card border border-line bg-bg p-3">
      <p className="text-body font-bold text-ink">{a.label}</p>
      <p className="truncate text-caption text-muted">{a.ens}</p>
      {pausable ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-caption text-muted">{status === 'paused' ? (resumesAt ? `Paused. Resumes by itself at ${clock(resumesAt, timeZone)}.` : 'Paused.') : 'Active on ENS.'}</span>
          <button type="button" disabled={busy || status === 'revoked'} onClick={() => onSwitch(status !== 'paused')} className={clsx('rounded-full px-4 py-2 text-caption font-bold text-white', status === 'paused' ? 'bg-ok' : 'bg-warn')}>
            {status === 'paused' ? 'Resume' : 'Pause'}
          </button>
        </div>
      ) : null}
      {note && pausable ? <p className="mt-2 text-caption text-muted">{note}</p> : null}
    </div>
  );
}

function ErrandCard({ line, model, shownIndex, now, state, dispatched, embedded: onStage, refundable, onRefund, refundOpen }: { line: LineData; model: ReturnType<typeof foldAll>; shownIndex: number; now: number; state: CustomerState | null; dispatched: { tx: string | null; at: number } | null; embedded: boolean; refundable: boolean; onRefund: () => void; refundOpen: boolean }) {
  if (line.card === 'shops' || line.card === 'ranking') {
    const ranked = line.card === 'ranking' || shownIndex >= stepIndex('best');
    const scored = shownIndex >= stepIndex('graphql');
    const list = ranked && model.ranking.length ? model.ranking.map((r) => r.ens) : model.offers.map((o) => o.shop);
    if (line.card === 'shops' && ranked) return null;
    return (
      <div className="flex flex-col gap-2">
        {list.map((ens, i) => {
          const shop = shopOf(ens);
          const offer = model.offers.find((o) => o.shop === ens);
          const board = model.graph?.boards.find((b) => b.ens === ens);
          const rank = model.ranking.find((r) => r.ens === ens);
          const rejected = ranked && rank && !rank.eligible;
          const best = ranked && ens === model.best;
          return (
            <Card key={ens} tone={best ? 'ok' : rejected ? 'bad' : undefined} className="stage-slide flex gap-3 p-2" >
              <SwarmPhoto swarm={shop?.swarm ?? null} local={shop?.image ?? null} className="h-[72px] w-[128px] shrink-0 rounded-input object-cover" />
              <div className="min-w-0 flex-1" style={{ animationDelay: `${i * 90}ms` }}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-heading text-section font-bold text-ink">{shop?.name ?? ens}</p>
                  <p className="tabular text-body font-bold text-ink">{offer ? usdt(offer.priceUsdt) : ''}</p>
                </div>
                {scored && board ? (
                  <p className={clsx('stage-fade text-caption', rejected ? 'font-bold text-bad' : 'text-muted')}>
                    {board.orders ?? ''} orders, {percent(board.refundRate)} refunds, {percent(board.onTimeRate, 0)} on time{rejected ? ', rejected' : best ? ', best' : ''}
                  </p>
                ) : (
                  <p className="truncate text-caption text-muted">{ens}</p>
                )}
                {shop?.swarm ? (
                  <a href={shop.swarm} target="_blank" rel="noopener noreferrer" className="text-caption font-bold text-info">
                    Photo on {networks.swarm}
                  </a>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>
    );
  }
  if (line.card === 'menu' && model.order) {
    const menu = menuOf(model.order.shop);
    return (
      <Card className="stage-slide p-2">
        <div className="grid grid-cols-2 gap-2">
          {menu.map((p) => {
            const chosen = p.id === model.offers.find((o) => o.shop === model.order?.shop)?.sku;
            return (
              <div key={p.id} className={clsx('rounded-input border p-1', chosen ? 'stage-chosen border-brand bg-brand/10' : 'border-line')}>
                <SwarmPhoto swarm={p.swarm} local={p.image} className="aspect-square w-full rounded-[10px] object-cover" />
                <p className="mt-1 line-clamp-2 text-caption leading-tight font-bold text-ink">{p.name}</p>
                <div className="flex items-center justify-between">
                  <span className="tabular text-caption text-muted">{usdt(p.priceUsdt)}</span>
                  {p.swarm ? (
                    <a href={p.swarm} target="_blank" rel="noopener noreferrer" className="text-caption font-bold text-info">
                      {networks.swarm}
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }
  if (line.card === 'bill' && model.quote) {
    const product = productOf(model.quote.shop, model.offers.find((o) => o.shop === model.quote?.shop)?.sku ?? order.sku);
    const signed = shownIndex >= stepIndex('sign');
    const settling = shownIndex >= stepIndex('verify') && shownIndex < stepIndex('settled');
    return (
      <Card tone="brand" className="stage-slide">
        <div className="flex gap-3">
          <SwarmPhoto swarm={product?.swarm ?? null} local={product?.image ?? null} className="h-16 w-16 shrink-0 rounded-input object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-caption text-muted">Bill {orderNumber(model.quote.orderId)}</p>
            <p className="line-clamp-2 text-body font-bold text-ink">{product?.name ?? cast.order.item}</p>
            <p className="truncate text-caption text-muted">Pay to {model.quote.shop}</p>
          </div>
          <p className="tabular font-heading text-amount font-bold text-ink">{usdt(model.quote.priceUsdt)}</p>
        </div>
        <p className="mt-2 text-caption font-bold text-muted">{signed ? (settling ? 'Signed once. Settling on Whitechain.' : 'Signed once, no gas.') : shownIndex >= stepIndex('bill402') ? 'The shop asks for payment. Checking the pass.' : 'The bill is in.'}</p>
      </Card>
    );
  }
  if (line.card === 'receipt' && model.paid) {
    return (
      <Card tone="ok" className="stage-slide">
        <div className="flex items-baseline justify-between">
          <p className="font-heading text-section font-bold text-ok">Paid</p>
          <p className="tabular font-heading text-amount font-bold text-ink">{usdt(model.paid.amountUsdt)}</p>
        </div>
        <p className="text-caption text-muted">Order {orderNumber(model.paid.orderId)} to {shopOf(model.quote?.shop ?? model.best)?.name ?? ''}</p>
        <p className="mt-1 text-caption font-bold text-ink">Gas paid by GraphPay, you paid 0.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ProofLink href={links.whitechainTx(model.paid.tx)} network={networks.whitechain} label="Paid" at={model.end?.at ?? model.arrived.settled} now={now} />
          {dispatched?.tx ? <ProofLink href={links.whitechainTx(dispatched.tx)} network={networks.whitechain} label="Dispatched" at={dispatched.at} now={now} /> : onStage ? <Pending>Dispatching</Pending> : null}
          {!refundOpen && state && refundable ? (
            <button type="button" onClick={onRefund} className="stage-refund-button min-h-8 rounded-full border border-bad/40 px-3 text-caption font-bold text-bad">
              Refund
            </button>
          ) : null}
        </div>
      </Card>
    );
  }
  return null;
}

function RefundThread({ flow, now, onAttach }: { flow: RefundFlow; now: number; onAttach: () => void }) {
  const coffee = productOf(cast.merchant.ens, order.reorder.sku);
  return (
    <>
      <Line role="payer" text={refundLines.ask(cast)}>
        <Card tone="bad" className="stage-slide">
          <div className="flex items-center gap-3">
            <SwarmPhoto swarm={null} local={coffee?.image ?? null} className={clsx('h-16 w-16 shrink-0 rounded-input object-cover', !flow.swarm && 'opacity-50')} />
            <div className="min-w-0 flex-1">
              <p className="text-body font-bold text-ink">{order.refundReason}</p>
              <p className="tabular text-caption text-muted">{microUsdt(order.refundMicro)} USDT back, order {orderNumber(flow.orderId)}</p>
            </div>
          </div>
          {flow.phase === 'card' ? (
            <button type="button" onClick={onAttach} className="stage-attach mt-3 w-full rounded-full bg-bad px-4 py-3 text-body font-bold text-white">
              Attach the photo
            </button>
          ) : null}
          {flow.swarm ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <ProofLink href={links.swarm(flow.swarm.ref, flow.swarm.file)} network={`On ${networks.swarm}`} now={now} />
            </div>
          ) : null}
        </Card>
      </Line>
      {flow.arkiv ? (
        <Line role="payer" text={refundLines.sent(cast)}>
          <div className="flex flex-wrap gap-2">
            {flow.arkiv.tx ? <ProofLink href={links.arkivTx(flow.arkiv.tx)} network={networks.arkiv} label="Request" at={flow.arkiv.at} now={now} /> : <ArkivPending />}
          </div>
        </Line>
      ) : null}
      {flow.phase === 'refunded' && flow.refund ? (
        <Line role="payer" text={refundLines.refunded(flow.refund.amountMicro)} tone="ok">
          <div className="flex flex-wrap gap-2">{flow.refund.tx ? <ProofLink href={links.whitechainTx(flow.refund.tx)} network={networks.whitechain} at={flow.refund.at} now={now} /> : null}</div>
        </Line>
      ) : null}
      {flow.phase === 'declined' ? <Line role="payer" text={refundLines.declined()} tone="bad" /> : null}
      {flow.phase === 'error' && flow.error ? <Line role="payer" text={flow.error} tone="bad" /> : null}
    </>
  );
}

function PauseThread({ flow, state, now }: { flow: PauseFlow; state: CustomerState | null; now: number }) {
  const sub = state?.subscription;
  const last = sub?.renewals?.[sub.renewals.length - 1] ?? null;
  return (
    <>
      {last ? (
        <Line role="payer" text={pauseLines.renewed(renewal.item, sub?.priceMicro ?? renewal.priceMicro ?? '0')} tone="ok">
          <div className="flex flex-wrap gap-2">
            <ProofLink href={links.whitechainTx(last.transaction)} network={networks.whitechain} at={Date.parse(last.at)} now={now} />
          </div>
        </Line>
      ) : null}
      <Line role="payer" text={pauseLines.pausing(cast)}>
        <div className="flex flex-wrap gap-2">{flow.sepoliaTx ? <ProofLink href={links.sepoliaTx(flow.sepoliaTx)} network={networks.sepolia} at={flow.at} now={now} /> : null}</div>
      </Line>
      {flow.phase === 'paused' || flow.phase === 'trying' || flow.phase === 'refused' || flow.phase === 'paid' ? <Line role="payer" text={pauseLines.paused(cast, flow.resumesAt ? clock(flow.resumesAt, timeZone) : '')} /> : null}
      {flow.phase === 'trying' || flow.phase === 'refused' || flow.phase === 'paid' ? <Line role="payer" text={pauseLines.trying(cast)} /> : null}
      {flow.phase === 'refused' ? (
        <Line role="payer" text={pauseLines.refused()} tone="bad">
          <Card tone="bad" className="stage-slide flex items-center gap-3">
            <Figure role="payer" activity="refused" size={48} />
            <p className="text-caption font-bold text-ink">ENS answered paused. Nothing left the wallet.</p>
          </Card>
        </Line>
      ) : null}
      {flow.phase === 'paid' && flow.refusal ? (
        <Line role="payer" text="This payment went through while paused." tone="bad">
          <ProofLink href={links.whitechainTx(flow.refusal)} network={networks.whitechain} at={flow.at} now={now} />
        </Line>
      ) : null}
      {flow.phase === 'error' && flow.error ? <Line role="payer" text={flow.error} tone="bad" /> : null}
    </>
  );
}

export type { RefundFlow, PauseFlow };
