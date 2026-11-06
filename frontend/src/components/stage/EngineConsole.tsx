import { useState } from 'react';
import { useDemo, useDemoEvents } from '@/demo/DemoProvider';
import type { DemoEvent } from '@/demo/contract';
import { encodeSchedule } from '@/demo/contract';
import { story, payingAgent } from '@/data/story';
import { formatMoney, usdt } from '@/lib/money';
import { formatTime, isoDate } from '@/lib/time';
import { orderChip } from '@/demo/rules';
import { copy } from '@/copy';

/**
 * Temporary F1 page: drives the mock engine with buttons and shows the shared
 * store and the live event log. Replaced by the two-phone stage in F2.
 */
export function EngineConsole() {
  const { adapter, snapshot, generation } = useDemo();
  const [log, setLog] = useState<{ at: number; e: DemoEvent }[]>([]);
  useDemoEvents((e) => setLog((l) => [{ at: Date.now(), e }, ...l].slice(0, 200)));

  if (!snapshot) return <p className="p-8">{copy.common.loading}</p>;
  const payer = payingAgent();
  const mine = snapshot.orders.filter((o) => o.owner.ens === story.customer.ens);
  const lastPaid = [...mine].reverse().find((o) => o.status !== 'ordered');
  const requested = mine.find((o) => o.refunds.some((r) => r.status === 'requested'));
  const myRenewal = snapshot.renewals.find((r) => r.owner.ens === story.customer.ens && r.status !== 'cancelled');
  const payerState = snapshot.agents.find((a) => a.ref.ens === payer.ens);
  const prompt = story.quickPrompts[0]!.text;

  const actions: { label: string; run: () => unknown; disabled?: boolean }[] = [
    { label: snapshot.shop.open ? 'Close shop' : 'Open shop', run: () => adapter.setShopOpen(!snapshot.shop.open) },
    { label: `Ask: “${prompt}”`, run: () => adapter.sendPrompt(prompt) },
    { label: 'Dispatch last order', run: () => lastPaid && adapter.dispatch(lastPaid.id), disabled: lastPaid?.status !== 'paid' },
    { label: 'Request 1.00 refund', run: () => lastPaid && adapter.requestRefund(lastPaid.id, { amount: usdt('1.00'), reason: 'Two pieces were squashed' }), disabled: !lastPaid },
    { label: 'Approve refund', run: () => requested && adapter.approveRefund(requested.id, requested.refunds.find((r) => r.status === 'requested')!.amount), disabled: !requested },
    { label: 'Decline refund', run: () => requested && adapter.declineRefund(requested.id, 'Sweets cannot be returned.'), disabled: !requested },
    { label: 'Make weekly renewal', run: () => lastPaid && adapter.startRenewal(lastPaid.id, encodeSchedule({ frequency: 'weekly', weekday: 0, startDate: isoDate(Date.now()) })), disabled: !lastPaid },
    { label: copy.stage.runNextRenewal, run: () => adapter.runNextRenewal() },
    { label: 'Cancel renewal', run: () => myRenewal && adapter.cancelRenewal(myRenewal.id), disabled: !myRenewal },
    { label: payerState?.status === 'paused' ? 'Resume payer' : 'Pause payer', run: () => (payerState?.status === 'paused' ? adapter.resumeAgent(payer.ens) : adapter.pauseAgent(payer.ens)), disabled: payerState?.status === 'revoked' },
    { label: 'Payer tries to raise cap', run: () => adapter.tryRaiseCap(payer.ens, usdt(story.demo.capRaiseAttemptUsdt)) },
    { label: 'Set cap 20.00', run: () => adapter.setCap?.(payer.ens, usdt('20.00')), disabled: payerState?.status === 'revoked' },
    { label: 'Reorder last', run: () => lastPaid && adapter.reorder(lastPaid.id), disabled: !lastPaid },
    {
      label: 'Export CSV',
      run: async () => {
        const blob = await adapter.exportCsv({ from: '2026-01-01', to: isoDate(Date.now()) });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `payouts-${isoDate(Date.now())}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      },
    },
    { label: copy.stage.resetDemo, run: () => adapter.resetDemo() },
  ];

  return (
    <main className="grid min-h-full grid-cols-[360px_1fr_1fr] gap-6 p-6 text-stage-ink" key={generation}>
      <section className="flex flex-col gap-2">
        <h1 className="font-heading text-title font-bold">F1 mock engine</h1>
        <p className="text-caption text-stage-muted">Temporary console. Every button calls the adapter; both phones will share this store.</p>
        {actions.map((a) => (
          <button
            key={a.label}
            className="min-h-11 rounded-full bg-brand px-4 text-left text-body font-bold text-white disabled:opacity-40"
            disabled={a.disabled}
            onClick={() => void Promise.resolve(a.run()).catch((err: Error) => alert(err.message))}
          >
            {a.label}
          </button>
        ))}
      </section>

      <section className="flex flex-col gap-3 overflow-auto rounded-card bg-phone p-4 text-ink">
        <h2 className="font-heading text-section font-bold">
          Store · {snapshot.shop.ref.name} {snapshot.shop.open ? copy.status.open : copy.status.closed}
          {snapshot.errandRunning ? ' · errand running' : ''}
        </h2>
        <div>
          <h3 className="text-caption font-bold text-muted">Agents</h3>
          {snapshot.agents.map((a) => (
            <p key={a.ref.ens} className="tabular text-body">
              {a.label}: {a.status}
              {a.pass ? ` · pass ${a.pass.used.amount}/${a.pass.cap.amount} (${a.pass.state})` : ''}
              {a.refusedAttempts.length ? ` · ${a.refusedAttempts.length} refused` : ''}
            </p>
          ))}
        </div>
        <div>
          <h3 className="text-caption font-bold text-muted">Orders ({snapshot.orders.length})</h3>
          {[...snapshot.orders].reverse().map((o) => (
            <p key={o.id} className="tabular text-body">
              #{o.number} {o.kind} · {o.owner.ens} · {formatMoney(o.total)} · {orderChip(o)}
              {o.isNew ? ' · NEW' : ''}
              {o.refunds.map((r) => ` · refund ${r.amount.amount} ${r.status}${r.note ? ` (“${r.note}”)` : ''}`).join('')}
              {o.synthetic ? ' · sample' : ''}
            </p>
          ))}
        </div>
        <div>
          <h3 className="text-caption font-bold text-muted">Renewals ({snapshot.renewals.length})</h3>
          {snapshot.renewals.map((r) => (
            <p key={r.id} className="tabular text-body">
              {r.owner.ens} · {r.item}, {r.scheduleText} · {r.status} · {r.charges.length} charges · next {r.nextChargeAt ? new Date(r.nextChargeAt).toLocaleString() : '—'}
            </p>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-1 overflow-auto rounded-card bg-stage-2 p-4 font-mono text-caption">
        <h2 className="mb-2 font-heading text-section font-bold">Event log (newest first)</h2>
        {log.map(({ at, e }, i) => (
          <p key={i} className="text-stage-muted">
            <span className="text-stage-ink">{formatTime(at)}</span> <span className="text-agent-payer">{e.type}</span> {summary(e)}
          </p>
        ))}
      </section>
    </main>
  );
}

function summary(e: DemoEvent): string {
  switch (e.type) {
    case 'agent.message':
      return `${e.agent.role}: ${e.text}`;
    case 'agent.status':
      return `${e.agent.role} → ${e.status}${e.reason ? ` (${e.reason})` : ''}`;
    case 'payment.refused':
      return `${e.reason}${e.attempted ? ` ${e.attempted.amount}` : ''}`;
    case 'quote.created':
      return `${e.orderId} ${e.total.amount}`;
    case 'order.updated':
      return `#${e.order.number} ${e.order.status}`;
    case 'merchant.notification':
      return `${e.kind} ${e.orderId}`;
    case 'renewal.created':
    case 'renewal.charged':
    case 'renewal.cancelled':
      return `${e.renewal.item} ${e.renewal.status}`;
    case 'shop.status':
      return e.open ? 'open' : 'closed';
    case 'agent.permission':
      return `${e.agent.role} ${e.change}`;
    default:
      return '';
  }
}
