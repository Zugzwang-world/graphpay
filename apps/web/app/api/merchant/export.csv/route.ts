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
    const { edges } = await sharedShopEdges(model.merchant.ens, 31);
    const csv = buildCsv(edges, { shopEns: model.merchant.ens, timeZone: model.city.timeZone, tokenSymbol: model.token.symbol, explorers: model.explorers });
    return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'no-store', 'content-disposition': `attachment; filename="${model.merchant.key}-orders.csv"` } });
  } catch {
    return json({ error: 'the graph did not answer; try again' }, 502);
  }
}
