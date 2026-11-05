import type { Metadata } from 'next';
import { Explainer } from '@/components/explainer';

export const metadata: Metadata = { title: 'What just happened' };

export default function ExplainPage() {
  return (
    <div className="page">
      <Explainer />
    </div>
  );
}
