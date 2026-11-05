// The shop's orders from Graph Arkiv, through the event site's public GraphQL (reads only):
// every edge that touches the shop, newest first. The payment itself is on the chain.
import { config } from '@graphpay/config';

export interface OrderRow {
  kind: string;
  amountMicro: string;
  ts: string;
  ref: string;
  orderId: string | null;
  from: { ens: string };
  to: { ens: string };
}

const EDGE = 'kind amountMicro ts ref orderId from { ens } to { ens }';
const QUERY = `query($ens: String!, $since: Int!) { node(ens: $ens) { in(sinceDay: $since, limit: 100) { ${EDGE} } out(sinceDay: $since, limit: 100) { ${EDGE} } } }`;

export async function ordersOf(shopEns: string, nowMs = Date.now()): Promise<OrderRow[] | null> {
  const url = new URL(config.site.graphqlPath, config.site.url);
  url.searchParams.set('query', QUERY);
  url.searchParams.set('variables', JSON.stringify({ ens: shopEns, since: Math.floor(nowMs / 86_400_000) - 30 }));
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    const body = (await res.json()) as { data?: { node: { in: OrderRow[]; out: OrderRow[] } | null } };
    if (!res.ok || !body.data) return null;
    const edges = [...(body.data.node?.in ?? []), ...(body.data.node?.out ?? [])].filter((e) => ['order', 'pay', 'deliver', 'refund', 'renew', 'subscribe'].includes(e.kind));
    return edges.sort((a, b) => (BigInt(b.ts) > BigInt(a.ts) ? 1 : -1));
  } catch {
    return null;
  }
}

// `<chain id>:<tx hash>:<log index>` is a chain event's ref.
export const txOfRef = (ref: string): string | null => /^\d+:(0x[0-9a-fA-F]{64}):\d+$/.exec(ref)?.[1]?.toLowerCase() ?? null;
