// A partial or full refund (WEBSITE_SPEC.md §4, §7): the shop's own key signs refund on Whitechain
// Sepolia, behind the passcode. The order must be this shop's, PAID or DELIVERED, and the amount
// cannot exceed what the contract says is left; a full refund is that amount, never a figure from the page.
import { json, notLive, readJsonObject } from '../../../../lib/http.ts';
import { requirePasscode } from '../../../../lib/passcode.ts';
import { Busy, Refusal, SHOP_KEY_WAITING_FOR, isOrderId, refundOrder, shopKeyConfigured } from '../../../../lib/merchant-actions.server.ts';
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
  let amount: bigint | null = null;
  if (body?.full !== true) {
    if (typeof body?.amountMicro !== 'string' || !/^[1-9][0-9]{0,15}$/.test(body.amountMicro)) return json({ error: 'amountMicro is a positive integer string, or full is true' }, 400);
    amount = BigInt(body.amountMicro);
  }
  try {
    const sent = await refundOrder(body.orderId as string, amount);
    return json(sent, sent.status === 'pending' ? 202 : 200);
  } catch (error) {
    if (error instanceof Refusal) return json({ error: error.code }, error.status);
    if (error instanceof Busy) return json({ error: 'another signing is still running; wait for it' }, 429);
    console.error('merchant refund failed:', errorNames(error));
    return json({ error: 'the refund could not be sent; check the order, then try again once' }, 502);
  }
}
