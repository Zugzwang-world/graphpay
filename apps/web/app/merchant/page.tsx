import type { Metadata } from 'next';
import { MerchantScreen } from '@/components/merchant-screen';
import { PhoneFrame } from '@/components/phone-frame';
import { siteModel } from '@/lib/site.server';

export function generateMetadata(): Metadata {
  return { title: `${siteModel().merchant.displayName}’s phone` };
}

export default function MerchantPage() {
  const model = siteModel();
  return (
    <div className="solo">
      <PhoneFrame label={`${model.merchant.displayName}’s phone`} tone="shop">
        <MerchantScreen />
      </PhoneFrame>
    </div>
  );
}
