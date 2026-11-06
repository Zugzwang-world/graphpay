import { Stage } from '@/components/stage/stage';
import { siteModel } from '@/lib/site.server';

// The stage (final website brief): the customer’s phone, the middle and the shop's phone on one screen,
// moving together. Each phone is its own page under /phones/, built from the team's frontend/ on
// live data; the director in the middle follows what the phones do.
export default function LiveStagePage() {
  const model = siteModel();
  return <Stage customerLabel={`${model.persona.displayName}’s phone`} merchantLabel={`${model.merchant.displayName}’s phone`} />;
}
