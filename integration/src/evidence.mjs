// What `pnpm e2e:food` reads before and after the errand, for the assertions
// (assertions.mjs): USDT balances by wallet role, the good shop's and the payer's tallies
// through GraphQL (MCP), the order's trail, and the mirror's cursor.

import { config } from '@graphpay/config';
import { erc20Abi } from 'viem';

// "4.8" (USDT, as GraphQL answers) → 4800000n.
export function microOf(usdt) {
  const [whole, frac = ''] = String(usdt ?? '0').split('.');
  return BigInt(whole) * 1_000_000n + BigInt((frac + '000000').slice(0, 6));
}

export const TALLY_QUERY = `query ($good: String!, $payer: String!) {
  good: node(ens: $good) {
    today: reputation(window: TODAY) { orders refunds delivered onTime paidUsdt refundedUsdt }
    all: tally(window: "all") { orders refunds delivered onTime paidMicro refundedMicro }
  }
  payer: node(ens: $payer) { today: reputation(window: TODAY) { orders paidUsdt } }
}`;

export const TRAIL_QUERY = 'query ($id: String!) { order(id: $id) { kind ref ts } }';

const fromReputation = (r) =>
  r ? { orders: BigInt(r.orders ?? 0), refunds: BigInt(r.refunds ?? 0), delivered: BigInt(r.delivered ?? 0), onTime: BigInt(r.onTime ?? 0), paidMicro: microOf(r.paidUsdt), refundedMicro: microOf(r.refundedUsdt) } : null;
const fromTally = (t) => (t ? Object.fromEntries(Object.entries(t).map(([k, v]) => [k, BigInt(v ?? 0)])) : null);

// mcp: an McpLike (mcp.mjs). Returns { good: { today, all }, payer: { today }, explainId }.
export async function tallies(mcp, { good, payer }) {
  const r = await mcp.call('graphql', { query: TALLY_QUERY, variables: { good, payer } });
  if (r.errors?.length) throw new Error(`graphql: ${r.errors.map((e) => e.message).join('; ')}`);
  return {
    good: { today: fromReputation(r.data?.good?.today), all: fromTally(r.data?.good?.all) },
    payer: { today: fromReputation(r.data?.payer?.today) },
    explainId: r.extensions?.arkiv?.explainId ?? null,
  };
}

// The order's edges in time order (ties by ref).
export async function trail(mcp, orderId) {
  const r = await mcp.call('graphql', { query: TRAIL_QUERY, variables: { id: orderId } });
  if (r.errors?.length) throw new Error(`graphql: ${r.errors.map((e) => e.message).join('; ')}`);
  const edges = (r.data?.order ?? []).map((e) => ({ kind: e.kind, ref: e.ref, ts: BigInt(e.ts) }));
  edges.sort((a, b) => (a.ts === b.ts ? a.ref.localeCompare(b.ref) : a.ts < b.ts ? -1 : 1));
  return { edges, explainId: r.extensions?.arkiv?.explainId ?? null };
}

// whitechain: a public client on chain 1874. who: { payer: address, good: address, trap: address }.
export async function balances(whitechain, who, token = config.whitechain.tokens.usdt.address) {
  const out = {};
  for (const [k, address] of Object.entries(who)) {
    out[k] = await whitechain.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [address] });
  }
  return out;
}

// The workers process's local status: the block it has read up to.
export async function mirrorCursor(port = 8788) {
  const r = await fetch(`http://127.0.0.1:${port}/status`, { signal: AbortSignal.timeout(5_000) });
  if (!r.ok) throw new Error(`workers /status answered ${r.status}`);
  const s = await r.json();
  return { scannedTo: s.mirror.scannedTo, head: s.mirror.head, lagBlocks: s.mirror.lagBlocks, instance: s.instance };
}

// POST /sync: one poll under the mirror's lock; returns after the writes landed.
export async function mirrorSync(port = 8788) {
  const r = await fetch(`http://127.0.0.1:${port}/sync`, { method: 'POST', signal: AbortSignal.timeout(120_000) });
  if (!r.ok) throw new Error(`workers /sync answered ${r.status}`);
  return r.json();
}
