import { blockNumber } from '../../../lib/chain.server.ts';
import type { StatusResponse } from '../../../lib/contracts.ts';
import { json } from '../../../lib/http.ts';
import { checkoutAddress, tokenMode } from '../../../lib/site.server.ts';

export const dynamic = 'force-dynamic';

// The top bar's live chips (WEBSITE_SPEC.md §2, §7). Every browser polls this, so
// the CDN keeps it for 2 seconds: the chains are read at most once per 2 s.
export async function GET(): Promise<Response> {
  const notes: string[] = [];
  const keys = ['whitechain', 'sepolia', 'rabdi'] as const;
  // Each read is bounded: a slow RPC shows "—" rather than holding the chips back.
  const within = async <T,>(work: Promise<T>): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([work, new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error('timeout')), 8000)))]);
    } finally {
      clearTimeout(timer);
    }
  };
  const heads = await Promise.allSettled(keys.map((key) => within(blockNumber(key))));
  const head = (i: number): string | null => {
    const result = heads[i];
    if (result?.status === 'fulfilled') return result.value.toString();
    notes.push(`${keys[i]} block: no RPC answered`);
    return null;
  };
  const token = tokenMode();
  const body: StatusResponse = {
    heads: { whitechain: head(0), sepolia: head(1), rabdi: head(2) },
    mirrorLagBlocks: null,
    relayerWbt: null,
    token: token.mode,
    tokenAddress: token.address,
    checkout: checkoutAddress(),
    notes,
    at: new Date().toISOString(),
  };
  notes.push('mirror lag: waiting for M11 mirror', 'relayer balance: waiting for M4 facilitator');
  if (!body.checkout) notes.push('checkout: waiting for M2 deploy');
  return json(body, 200, { 'cache-control': 'public, max-age=0, s-maxage=2, stale-while-revalidate=8' });
}
