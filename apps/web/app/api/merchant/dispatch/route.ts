// Mark a paid order dispatched (WEBSITE_SPEC.md §4, §7): the shop's own key signs markDelivered on
// Whitechain Sepolia, behind the passcode; the order must be this shop's and PAID. An order already
// delivered on chain answers 200 with its existing delivery transaction and alreadyDelivered, sending nothing.
import { json, notLive, readJsonObject } from '../../../../lib/http.ts';
import { requirePasscode } from '../../../../lib/passcode.ts';
import { Busy, Refusal, SHOP_KEY_WAITING_FOR, isOrderId, markDispatched, shopKeyConfigured } from '../../../../lib/merchant-actions.server.ts';
import { errorNames } from '@graphpay/facilitator';

export const dynamic = 'force-dynamic';
// A send waits for its receipt (up to 60 s).
// A queued request waits behind one that waits for its receipt (up to 60 s each).
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  const refused = requirePasscode(request);
  if (refused) return refused;
  // No shop in the story, or no key in the env: not live, before any read.
  let configured = false;
  try {
    configured = shopKeyConfigured();
  } catch {
    configured = false;
  }
  if (!configured) return notLive(SHOP_KEY_WAITING_FOR);
  const body = await readJsonObject(request);
  if (!isOrderId(body?.orderId)) return json({ error: 'orderId is 32-byte hex' }, 400);
  try {
    const sent = await markDispatched(body.orderId as string);
    return json(sent, sent.status === 'pending' ? 202 : 200);
  } catch (error) {
    if (error instanceof Refusal) return json({ error: error.code }, error.status);
    if (error instanceof Busy) return json({ error: 'another signing is still running; wait for it' }, 429);
    // The kind only: a chain error's message can name an RPC. None reaches the browser.
    console.error('merchant dispatch failed:', errorNames(error));
    return json({ error: 'the order could not be marked dispatched; check its state, then try again once' }, 502);
  }
}
