import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Metadata } from 'next';
import { RaceView, type RaceQuestion } from '@/components/race-view';
import { siteModel } from '@/lib/site.server';
import { kbOf, parseBenchCsv, type BenchRow } from '@/lib/race';

export const metadata: Metadata = { title: 'Race mode' };

// The event's own live benchmark, committed by M9 (bench/results/questions-S.csv, read at
// build time). Reads and bytes only: no time is the result (ADR-0042).
const LABELS: Record<string, string> = {
  Q1: 'the featured shop’s refund rate and 90-day orders',
  Q2: 'the top 10 shops by sales, city-wide',
  Q3: 'the persona’s agents’ spend by shop this week',
  Q4: 'agents that paid a shop this week and later refunded someone else',
  Q5: 'a payment path from the persona’s paying agent to the trap shop, within 3 hops',
  Q6: 'the featured shop’s depth-2 neighbourhood over this week’s payments',
};

function benchRows(): BenchRow[] {
  try {
    return parseBenchCsv(readFileSync(join(process.cwd(), '../../bench/results/questions-S.csv'), 'utf8'));
  } catch {
    return [];
  }
}

const yesNo = (v: boolean) => (v ? 'yes' : 'no');

export default function RacePage() {
  const bench = benchRows();
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
        {bench.length === 0 ? (
          <p className="muted">The benchmark table is not available in this build.</p>
        ) : (
          <>
            <p className="muted">
              Measured live on Arkiv’s testnet over the synthetic size S city. Each count is Arkiv reads (JSON-RPC calls); bytes are request plus response bodies.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Question</th>
                    <th scope="col">Plain reads</th>
                    <th scope="col">Plain KB</th>
                    <th scope="col">Graph Arkiv reads</th>
                    <th scope="col">Graph Arkiv KB</th>
                    <th scope="col">Plain right by name</th>
                    <th scope="col">Plain right by identity</th>
                    <th scope="col">Graph Arkiv right</th>
                  </tr>
                </thead>
                <tbody>
                  {bench.map((r) => (
                    <tr key={r.question}>
                      <th scope="row">
                        {r.question}: {LABELS[r.question] ?? ''}
                      </th>
                      <td className="num">{r.plainReads}</td>
                      <td className="num">{kbOf(r.plainBytes)}</td>
                      <td className="num">{r.graphReads}</td>
                      <td className="num">{kbOf(r.graphBytes)}</td>
                      <td>{yesNo(r.plainRightByName)}</td>
                      <td>{yesNo(r.plainRightByIdentity)}</td>
                      <td>{yesNo(r.graphRight)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small">
              Graph Arkiv wins where an answer is an aggregate (the city-wide top 10: 2 reads against 5 or 6), not on every question. Plain code credits a re-registered shop’s earlier holder to the new one, so it is wrong by identity on the top 10.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
