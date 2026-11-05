import type { Metadata } from 'next';
import { CustomerScreen } from '@/components/customer-screen';
import { PhoneFrame } from '@/components/phone-frame';
import { siteModel } from '@/lib/site.server';

export function generateMetadata(): Metadata {
  return { title: `${siteModel().persona.displayName}’s phone` };
}

export default function CustomerPage() {
  const model = siteModel();
  return (
    <div className="solo">
      <PhoneFrame label={`${model.persona.displayName}’s phone`} tone="buyer">
        <CustomerScreen />
      </PhoneFrame>
    </div>
  );
}
