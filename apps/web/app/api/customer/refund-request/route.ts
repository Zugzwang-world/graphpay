// The customer's refund request (WEBSITE_SPEC.md §3, §7): behind the passcode, a `request` edge
// on Arkiv written with the recorder's key. It moves no money; the merchant decides. The order is
// the payer agent's newest payment, never one named by the page (lib/refund-request.server.ts).
import { json, notLive, readJsonObject } from '../../../../lib/http.ts';
import { requirePasscode } from '../../../../lib/passcode.ts';
import { REFUND_WAITING_FOR, RefundRefusal, recorderKeyConfigured, requestRefund } from '../../../../lib/refund-request.server.ts';
import { failureKind } from '../../../../lib/owner-actions.server.ts';

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
    return json(await requestRefund({ orderId: body.orderId, amountMicro: body.amountMicro, reason: body.reason }));
  } catch (error) {
    if (error instanceof RefundRefusal) return json({ error: error.code }, error.status);
    console.error('customer refund request failed:', failureKind(error));
    return json({ error: 'the request could not be recorded; try again once' }, 502);
  }
}
