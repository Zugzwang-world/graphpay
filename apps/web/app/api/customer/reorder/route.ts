// The customer's Re-order (WEBSITE_SPEC.md §3, §7): behind the passcode, the payer agent signs one
// payment for the story's re-order of its newest order, through the hosted shop and facilitator.
// Every decision is in lib/reorder.server.ts; nothing in the body chooses the order, price or shop.
import { json, notLive, readJsonObject } from '../../../../lib/http.ts';
import { requirePasscode } from '../../../../lib/passcode.ts';
import { REORDER_WAITING_FOR, ReorderRefusal, codeOf, reorder } from '../../../../lib/reorder.server.ts';
import { liveReorderDeps, payerKeyConfigured } from '../../../../lib/reorder-live.server.ts';
import { errorNames } from '@graphpay/facilitator';

export const dynamic = 'force-dynamic';
// The quote, the signature and the facilitator's settlement (up to 60 s).
export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  const refused = requirePasscode(request);
  if (refused) return refused;
  if (!payerKeyConfigured()) return notLive(REORDER_WAITING_FOR);
  const body = await readJsonObject(request);
  if (!body) return json({ error: 'a JSON object is expected' }, 400);
  try {
    const result = await reorder({ parentOrderId: body.parentOrderId }, liveReorderDeps());
    return json(result, result.status === 'pending' ? 202 : 200);
  } catch (error) {
    if (error instanceof ReorderRefusal) return json({ error: error.code }, error.status);
    // The buyer's own refusals (a cap, a revoked pass) are codes; anything else is one fixed line.
    const code = codeOf(error);
    if (code) return json({ error: code }, 409);
    console.error('customer reorder failed:', errorNames(error));
    return json({ error: 'the re-order could not be completed; check the last order before trying again' }, 502);
  }
}
