import { story } from '@/data/story';
import { copy, fill } from '@/copy';
import { formatMoney, usdt } from '@/lib/money';
import { seedState } from '@/demo/mock-data';

const statusTokens = [
  { name: 'brand', cls: 'bg-brand', meaning: 'primary action, selection' },
  { name: 'info', cls: 'bg-info', meaning: 'information, links, money back' },
  { name: 'ok', cls: 'bg-ok', meaning: 'done, paid, active' },
  { name: 'warn', cls: 'bg-warn', meaning: 'waiting, paused' },
  { name: 'bad', cls: 'bg-bad', meaning: 'refused, failed, revoked' },
] as const;

const surfaceTokens = [
  { name: 'bg', cls: 'bg-bg' },
  { name: 'surface', cls: 'bg-surface' },
  { name: 'phone', cls: 'bg-phone' },
  { name: 'soft', cls: 'bg-soft' },
  { name: 'line', cls: 'bg-line' },
  { name: 'muted', cls: 'bg-muted' },
  { name: 'ink', cls: 'bg-ink' },
] as const;

const agentRing: Record<string, string> = {
  concierge: 'bg-agent-concierge',
  scout: 'bg-agent-scout',
  analyst: 'bg-agent-analyst',
  payer: 'bg-agent-payer',
  storefront: 'bg-agent-storefront',
  risk: 'bg-agent-risk',
  dispatch: 'bg-agent-dispatch',
};

/** Temporary F0 page for reviewing foundations. Removed in F2. */
export function FoundationsPreview() {
  const seed = seedState(Date.now());
  const agents = [...story.agents, ...story.shop.agents];
  return (
    <main className="min-h-full p-8 text-stage-ink">
      <header className="mb-8 flex items-center gap-3">
        <h1 className="font-heading text-title font-bold">GraphPay front end: F0 foundations</h1>
        <span className="rounded-full bg-stage-line px-3 py-1 text-caption text-stage-muted">{copy.stage.mockBadgeLong}</span>
      </header>

      <div className="grid max-w-5xl grid-cols-2 gap-8">
        <section className="rounded-card bg-phone p-6 text-ink shadow-card">
          <h2 className="mb-4 font-heading text-section font-bold">Status and accent tokens</h2>
          <ul className="flex flex-col gap-2">
            {statusTokens.map((t) => (
              <li key={t.name} className="flex items-center gap-3 text-body">
                <span className={`h-8 w-8 rounded-full ${t.cls}`} aria-hidden />
                <code className="w-16 font-bold">{t.name}</code>
                <span className="text-muted">{t.meaning}</span>
              </li>
            ))}
          </ul>
          <h2 className="mt-6 mb-4 font-heading text-section font-bold">Surfaces and text</h2>
          <div className="flex flex-wrap gap-2">
            {surfaceTokens.map((t) => (
              <div key={t.name} className="flex flex-col items-center gap-1">
                <span className={`h-12 w-12 rounded-input border border-line ${t.cls}`} aria-hidden />
                <code className="text-caption text-muted">{t.name}</code>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-card bg-phone p-6 text-ink shadow-card">
          <h2 className="mb-4 font-heading text-section font-bold">Type scale (the only five sizes)</h2>
          <p className="font-heading text-title font-bold">App title 20 · {story.customer.name}</p>
          <p className="font-heading text-section font-bold">Section title 16 · {copy.customer.pages.orders}</p>
          <p className="text-body">Body 14 · {fill(copy.customer.desk.subtitle, { cap: story.spendingPass.capUsdt })}</p>
          <p className="text-caption text-muted">Caption and chips 12 · {story.agents[0]?.ens}</p>
          <p className="tabular font-heading text-amount font-bold">{formatMoney(usdt(story.products[0]!.priceUsdt))}</p>
          <p className="tabular mt-2 text-body text-muted">Tabular: 1,204.00 · 36.00 · 111.11 · 4.00</p>
          <p className="mt-4 font-ios text-body">iOS system font: Done · Cancel · Choose from Photos</p>
        </section>

        <section className="rounded-card bg-phone p-6 text-ink shadow-card">
          <h2 className="mb-4 font-heading text-section font-bold">Agents from story data</h2>
          <ul className="flex flex-col gap-2">
            {agents.map((a) => (
              <li key={a.ens} className="flex items-center gap-3 text-body">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full font-heading font-bold text-white ${agentRing[a.role] ?? 'bg-agent-fallback'}`}
                  aria-hidden
                >
                  {a.label.charAt(0)}
                </span>
                <span className="font-bold">{a.label}</span>
                <span className="text-caption text-muted">{a.ens}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-card bg-phone p-6 text-ink shadow-card">
          <h2 className="mb-4 font-heading text-section font-bold">Mock store seed</h2>
          <ul className="flex flex-col gap-1 text-body">
            <li>Shop: {seed.shop.ref.name}, starts {seed.shop.open ? copy.status.open : copy.status.closed}</li>
            <li>Customer orders: {seed.orders.filter((o) => o.owner.ens === story.customer.ens).length} (empty state first)</li>
            <li>Seeded renewals: {seed.renewals.length} ({seed.renewals[0]?.owner.ens}, {seed.renewals[0]?.scheduleShort})</li>
            <li>Seeded history orders: {seed.orders.length} (synthetic)</li>
            <li>Agents: {seed.agents.map((a) => `${a.label}${a.pass ? ` (cap ${a.pass.cap.amount})` : ''}`).join(', ')}</li>
          </ul>
          <div className="mt-4 flex gap-2">
            <button className="min-h-11 rounded-full bg-brand px-4 text-body font-bold text-white">Primary action</button>
            <button className="min-h-11 rounded-full bg-soft px-4 text-body font-bold text-ink">Secondary</button>
          </div>
        </section>
      </div>
    </main>
  );
}
