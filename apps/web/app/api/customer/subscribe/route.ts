// The customer's Subscribe (WEBSITE_SPEC.md §3, §7): the story's renewal plan as a subscription on the
// checkout, the payer agent's wallet signing (no gas) and RENEWER sending; the first charge runs in the
// same transaction and the renewal cron charges it on the labelled demo clock. Every decision is in
// lib/subscription.server.ts; nothing in the body chooses the plan, the price, the period or the shop.
import { errorNames } from '@graphpay/facilitator';
import { sharedCustomerState } from '../../../../lib/customer-state.server.ts';
import { json, notLive, readJsonObject } from '../../../../lib/http.ts';
import { requirePasscode } from '../../../../lib/passcode.ts';
import { forgetSubscriptionRead, liveSubscriptionDeps, subscriptionKeysConfigured } from '../../../../lib/subscription-live.server.ts';
import { SUBSCRIBE_WAITING_FOR, SubscriptionRefusal, subscribe } from '../../../../lib/subscription.server.ts';

export const dynamic = 'force-dynamic';
// The reads, the signatures and one receipt (up to 45 s).
export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  const refused = requirePasscode(request);
  if (refused) return refused;
  if (!subscriptionKeysConfigured()) return notLive(SUBSCRIBE_WAITING_FOR);
  const body = await readJsonObject(request);
  if (!body) return json({ error: 'a JSON object is expected' }, 400);
  try {
    const result = await subscribe({ plan: body.plan }, liveSubscriptionDeps(async () => (await sharedCustomerState()).agent.status));
    forgetSubscriptionRead();
    return json(result, result.status === 'pending' ? 202 : 200);
  } catch (error) {
    if (error instanceof SubscriptionRefusal) return json({ error: error.code, ...error.extra }, error.status);
    console.error('customer subscribe failed:', errorNames(error));
    return json({ error: 'the subscription could not be created; check the subscription before trying again' }, 502);
  }
}
