// The accountant's CSV (WEBSITE_SPEC.md §4): the shop's orders, payments, refunds,
// deliveries and renewals read from the graph. Read only; every row is chain data.
import { siteModel } from '../../../../lib/site.server.ts';
import { allowed } from '../../graphql/arkiv.server.ts';
import { sharedShopEdges } from '../../../../lib/merchant-feed.server.ts';
import { buildCsv } from '../../../../lib/merchant-feed.ts';
import { json } from '../../../../lib/http.ts';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  if (!allowed(request, 10)) return json({ error: 'too many requests' }, 429);
  const model = siteModel();
  try {
    // The graph keeps rows for 30 days (docs/technical/FACTS.md), so 31 days back is all there is.
    const { edges, truncated, daysBack } = await sharedShopEdges(model.merchant.ens, 31);
    const csv = buildCsv(edges, { shopEns: model.merchant.ens, timeZone: model.city.timeZone, tokenSymbol: model.token.symbol, explorers: model.explorers });
    // The window shrinks when the graph holds more rows than one answer can carry: the file name says how far
    // back it reaches, and the headers say so too, never a silently short file.
    const from = new Date((Math.floor(Date.now() / 86_400_000) - daysBack) * 86_400_000).toISOString().slice(0, 10);
    const headers = { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'no-store', 'content-disposition': `attachment; filename="${model.merchant.key}-orders-from-${from}.csv"`, 'x-export-days': String(daysBack + 1), 'x-export-truncated': String(truncated) };
    return new Response(csv, { headers });
  } catch {
    return json({ error: 'the graph did not answer; try again' }, 502);
  }
}
