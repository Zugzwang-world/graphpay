// The accountant's export: one row per order of this shop, read from the chain (its
// OrderCreated, PaymentSettled and Refunded logs), so the rows match the chain. Read only; the
// log scan is kept for 15 s per instance so a burst of requests is one scan.
import { shop } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

let cached: { at: number; csv: Promise<string> } | null = null;

export async function GET(): Promise<Response> {
  if (!cached || Date.now() - cached.at > 15_000) {
    const csv = shop.merchant.exportCsv();
    cached = { at: Date.now(), csv };
    csv.catch(() => {
      if (cached?.csv === csv) cached = null;
    });
  }
  try {
    return new Response(await cached.csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="orders.csv"', 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ error: 'the chain did not answer; try again' }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}
