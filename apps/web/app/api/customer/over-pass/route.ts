// Over the pass (ADR-0073, "for everyone"): the payer agent asks for the story's "everyone" order and
// signs it under its daily pass; our facilitator refuses it before anything is sent, and the refusal
// is recorded on Arkiv. The route only starts an attempt that is over what is left of the pass, so it
// never pays (lib/limits.server.ts); nothing in the body chooses the order, the amount or the shop.
import { errorNames } from '@graphpay/facilitator';
import { json, notLive } from '../../../../lib/http.ts';
import { limitsKeysConfigured, liveOverPassDeps } from '../../../../lib/limits-live.server.ts';
import { AttemptUnanswered, LIMITS_WAITING_FOR, LimitRefusal, overPass } from '../../../../lib/limits.server.ts';
import { requirePasscode } from '../../../../lib/passcode.ts';

export const dynamic = 'force-dynamic';
// The quote, the signature, the facilitator's answer and up to 20 s for its record on Arkiv.
export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  const refused = requirePasscode(request);
  if (refused) return refused;
  if (!limitsKeysConfigured()) return notLive(LIMITS_WAITING_FOR);
  try {
    return json(await overPass(liveOverPassDeps()));
  } catch (error) {
    if (error instanceof LimitRefusal) return json({ error: error.code }, error.status);
    // No answer from verify: nothing can have been sent (the attempt is only ever verified), but the outcome
    // is not known, so it is never reported as a refusal.
    if (error instanceof AttemptUnanswered) return json({ error: 'FACILITATOR_UNANSWERED', orderId: error.orderId, sent: false, verifiedOnly: true }, 502);
    console.error('customer over-pass failed:', errorNames(error));
    return json({ error: 'the attempt could not be made; nothing was paid' }, 502);
  }
}
