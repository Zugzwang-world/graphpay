import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExplainTrace } from '@/components/explain-trace';

export const metadata: Metadata = { title: 'The exact reads' };

// An explain id is 12 hex characters: sha256 of the backend and its sorted queries.
export default async function ExplainIdPage({ params }: { params: Promise<{ explainId: string }> }) {
  const { explainId } = await params;
  if (!/^[0-9a-f]{12}$/.test(explainId)) notFound();
  return (
    <div className="page">
      <p className="small">
        <Link href="/explain">What just happened</Link>
      </p>
      <h1>
        The exact reads behind answer <span className="mono">{explainId}</span>
      </h1>
      <p className="muted">Every Arkiv call one GraphQL answer made, with its query, as recorded by Graph Arkiv’s explain trace.</p>
      <ExplainTrace explainId={explainId} />
    </div>
  );
}
