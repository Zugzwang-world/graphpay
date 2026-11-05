// Marks a paid order delivered: the shop's own key signs on the server, behind the passcode.
import { failure, requirePasscode, serially } from '@/lib/gate';
import { shop } from '@/lib/store';

export const dynamic = 'force-dynamic';
// A send waits for its receipt (up to 60 s).
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const refused = requirePasscode(request);
  if (refused) return refused;
  const body = (await request.json().catch(() => null)) as { orderId?: unknown } | null;
  if (typeof body?.orderId !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(body.orderId)) return Response.json({ error: 'orderId is 32-byte hex' }, { status: 400, headers: { 'cache-control': 'no-store' } });
  try {
    const orderId = body.orderId;
    const sent = await serially(() => shop.merchant.deliver(orderId));
    return Response.json({ transaction: sent.transaction }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return failure(error, 'could not mark it dispatched');
  }
}
