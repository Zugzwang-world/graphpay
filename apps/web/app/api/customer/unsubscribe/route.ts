// The customer's Cancel (WEBSITE_SPEC.md §3, §7): the payer agent's wallet signs the checkout's Cancel
// for the payer's own subscription to the story's plan (no gas), and RENEWER sends cancelWithSig; no
// renewal runs after it. Every decision is in lib/subscription.server.ts; the body may only name that
// subscription.
import { errorNames } from '@graphpay/facilitator';
import { sharedCustomerState } from '../../../../lib/customer-state.server.ts';
import { json, notLive, readJsonObject } from '../../../../lib/http.ts';
import { requirePasscode } from '../../../../lib/passcode.ts';
import { forgetSubscriptionRead, liveSubscriptionDeps, subscriptionKeysConfigured } from '../../../../lib/subscription-live.server.ts';
import { SUBSCRIBE_WAITING_FOR, SubscriptionRefusal, cancelSubscription } from '../../../../lib/subscription.server.ts';

export const dynamic = 'force-dynamic';
// The reads, one signature and one receipt (up to 45 s).
export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  const refused = requirePasscode(request);
  if (refused) return refused;
  if (!subscriptionKeysConfigured()) return notLive(SUBSCRIBE_WAITING_FOR);
  const body = await readJsonObject(request);
  if (!body) return json({ error: 'a JSON object is expected' }, 400);
  try {
    const result = await cancelSubscription({ subId: body.subId }, liveSubscriptionDeps(async () => (await sharedCustomerState()).agent.status));
    forgetSubscriptionRead();
    return json(result, result.status === 'pending' ? 202 : 200);
  } catch (error) {
    if (error instanceof SubscriptionRefusal) return json({ error: error.code, ...error.extra }, error.status);
    console.error('customer unsubscribe failed:', errorNames(error));
    return json({ error: 'the cancel could not be sent; check the subscription before trying again' }, 502);
  }
}
