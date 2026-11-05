// A partial or full refund: the shop's own key signs on the server, behind the passcode. A
// full refund is whatever the contract says is left on the order, never an amount from the page.
import { checkoutAbi } from '@graphpay/contracts';
import { failure, requirePasscode, serially } from '@/lib/gate';
import { publicClient, shop } from '@/lib/store';

export const dynamic = 'force-dynamic';
// A send waits for its receipt (up to 60 s).
export const maxDuration = 60;

const NO_STORE = { 'cache-control': 'no-store' };

// What is left to refund on an order of this shop, read from the checkout contract.
async function leftOn(orderId: string): Promise<bigint | null> {
  const o = (await publicClient.readContract({ address: shop.network.checkout as `0x${string}`, abi: checkoutAbi, functionName: 'orders', args: [orderId as `0x${string}`] })) as { amountMicro: bigint; refundedMicro: bigint; merchant: string };
  return o.amountMicro === 0n ? null : o.amountMicro - o.refundedMicro;
}

export async function POST(request: Request): Promise<Response> {
  const refused = requirePasscode(request);
  if (refused) return refused;
  const body = (await request.json().catch(() => null)) as { orderId?: unknown; amountMicro?: unknown; full?: unknown } | null;
  const orderId = body?.orderId;
  if (typeof orderId !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(orderId)) return Response.json({ error: 'orderId is 32-byte hex' }, { status: 400, headers: NO_STORE });
  try {
    let amount: bigint;
    if (body?.full === true) {
      const left = await leftOn(orderId);
      if (left === null) return Response.json({ error: 'no such order' }, { status: 404, headers: NO_STORE });
      amount = left;
    } else {
      if (typeof body?.amountMicro !== 'string' || !/^[1-9][0-9]{0,15}$/.test(body.amountMicro)) return Response.json({ error: 'amountMicro is a positive integer string' }, { status: 400, headers: NO_STORE });
      amount = BigInt(body.amountMicro);
    }
    // The merchant checks the order is this shop's and that the amount fits what is left.
    const sent = await serially(() => shop.merchant.refund(orderId, amount));
    return Response.json({ transaction: sent.transaction, amountMicro: String(sent.amountMicro), full: sent.full }, { headers: NO_STORE });
  } catch (error) {
    return failure(error, 'could not refund');
  }
}
