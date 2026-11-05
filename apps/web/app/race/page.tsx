import type { Metadata } from 'next';
import { RaceView, type RaceQuestion } from '@/components/race-view';
import { siteModel } from '@/lib/site.server';

export const metadata: Metadata = { title: 'Race mode' };

export default function RacePage() {
  const model = siteModel();
  const trap = model.shops.find((s) => s.storyRole === 'trap');
  const questions: RaceQuestion[] = [
    { id: 'Q2', label: 'top 10 shops by sales, city-wide' },
    { id: 'Q1', label: `refund rate and 90-day orders of ${model.merchant.ens}` },
    ...(trap ? [{ id: 'Q5', label: `a payment path from ${model.payer.ens} to ${trap.ens} within 3 hops` }] : []),
  ];
  return (
    <div className="page page-wide">
      <h1>Race mode: the reads each answer needs</h1>
      <p className="muted">
        Both sides ask Arkiv’s live testnet the same question at the same moment, uncached. Graph Arkiv keeps tallies as payments land, so a city-wide
        ranking is a couple of reads; plain Arkiv code has to read every payment. The count is the result, not the clock.
      </p>
      <p>
        <span className="chip" data-tone="synthetic">
          synthetic city, size S
        </span>
      </p>
      <RaceView questions={questions} cityNote="The small city is seeded tonight; the larger one waits for the final story (ADR-0049)." />
      <section className="bench" aria-label="The event's benchmark">
        <h2>The event’s benchmark</h2>
        <div className="waiting">
          <span aria-hidden="true">◌</span>
          <p>
            The table of every question’s reads and bytes, measured live at the event, appears here once <strong>M9 live benchmark</strong> commits it.
            Only the event’s own numbers are shown.
          </p>
        </div>
      </section>
    </div>
  );
}
