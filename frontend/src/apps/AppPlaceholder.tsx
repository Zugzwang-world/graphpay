import { useDemo } from '@/demo/DemoProvider';
import { story } from '@/data/story';
import { copy, fill } from '@/copy';
import { formatMoney } from '@/lib/money';
import { orderChip } from '@/demo/rules';
import { MockBadge } from '@/components/shared/MockBadge';

/**
 * Temporary phone content for F2, so the stage can be reviewed with live data
 * from the shared store. Replaced page by page from F3.
 */
export function AppPlaceholder({ app }: { app: 'customer' | 'merchant' }) {
  const { snapshot, adapter } = useDemo();
  const title = app === 'customer' ? story.customer.name : story.shop.name;
  const orders = snapshot?.orders.filter((o) => (app === 'customer' ? o.owner.ens === story.customer.ens : o.status !== 'ordered')) ?? [];
  return (
    <div className="flex h-full flex-col pt-[54px]">
      <div className="flex items-center gap-3 px-4 py-3">
        <h1 className="flex-1 font-heading text-title font-bold">{title}</h1>
        <MockBadge />
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-auto px-4 pb-8">
        <p className="rounded-card border border-line bg-surface p-4 text-body text-muted shadow-card">{copy.placeholder[app]}</p>
        {app === 'merchant' && snapshot && (
          <button
            className="min-h-11 rounded-full bg-brand px-4 text-body font-bold text-white"
            onClick={() => void adapter.setShopOpen(!snapshot.shop.open)}
          >
            {snapshot.shop.open ? copy.merchant.home.toggleOpen : copy.merchant.home.toggleClosed}
          </button>
        )}
        {app === 'customer' && snapshot && (
          <button
            className="min-h-11 rounded-full bg-brand px-4 text-body font-bold text-white disabled:opacity-50"
            disabled={snapshot.errandRunning}
            onClick={() => void adapter.sendPrompt(story.quickPrompts[0]!.text)}
          >
            {story.quickPrompts[0]!.text}
          </button>
        )}
        {app === 'customer' && snapshot && (
          <p className="text-caption text-muted">
            {fill(copy.customer.desk.subtitle, { cap: snapshot.agents.find((a) => a.pass && a.ref.role === story.spendingPass.payingRole)?.pass?.cap.amount })}
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {[...orders].reverse().map((o) => (
            <li key={o.id} className="flex items-center justify-between rounded-card border border-line bg-surface px-4 py-3 shadow-card">
              <span className="text-body">
                #{o.number} {o.items[0]?.name}
              </span>
              <span className="tabular text-caption text-muted">
                {formatMoney(o.total)} · {orderChip(o)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
