// The merchant's Decline (WEBSITE_SPEC.md §4, §7): the shop's answer to the payer agent's refund
// request, recorded on Arkiv with the recorder's key. It moves no money. The order must be this
// shop's and the story persona's, still refundable, with a refund request on the record
// (lib/refund-decline.server.ts); the note is plain text, at most 140 characters.
import { errorNames } from '@graphpay/facilitator';
import { json, notLive, readJsonObject } from '../../../../lib/http.ts';
import { requirePasscode } from '../../../../lib/passcode.ts';
import { DeclineRefusal, declineRefund } from '../../../../lib/refund-decline.server.ts';
import { REFUND_WAITING_FOR, recorderKeyConfigured } from '../../../../lib/refund-request.server.ts';

export const dynamic = 'force-dynamic';
// An Arkiv write waits for its transaction.
export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  const refused = requirePasscode(request);
  if (refused) return refused;
  if (!recorderKeyConfigured()) return notLive(REFUND_WAITING_FOR);
  const body = await readJsonObject(request);
  if (!body) return json({ error: 'a JSON object is expected' }, 400);
  try {
    return json(await declineRefund({ orderId: body.orderId, note: body.note }));
  } catch (error) {
    if (error instanceof DeclineRefusal) return json({ error: error.code }, error.status);
    console.error('merchant refund decline failed:', errorNames(error));
    return json({ error: 'the decline could not be recorded; try again once' }, 502);
  }
}
