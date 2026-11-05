// Server-side chain reads over HTTPS (ADR-0055) through resolveRpc: the secret or
// keyed URL first, then the public ones, each refused unless it answers the
// network's chain id (ADR-0031). Errors carry the candidate's label, never a URL.

import { resolveRpc, type NetworkKey, type ResolvedRpc } from '@graphpay/config';

const RESOLVE_TTL_MS = 5 * 60_000;
const FAILURE_TTL_MS = 10_000;
const resolved = new Map<NetworkKey, { rpc: ResolvedRpc; at: number }>();
const failed = new Map<NetworkKey, { message: string; at: number }>();

// Every candidate is probed for the chain id; a network with no answering RPC is
// not probed again for 10 s, so a poll never waits out the same dead candidates.
async function rpcFor(key: NetworkKey): Promise<ResolvedRpc> {
  const hit = resolved.get(key);
  if (hit && Date.now() - hit.at < RESOLVE_TTL_MS) return hit.rpc;
  const miss = failed.get(key);
  if (miss && Date.now() - miss.at < FAILURE_TTL_MS) throw new Error(miss.message);
  try {
    const rpc = await resolveRpc(key, { timeoutMs: 5000 });
    resolved.set(key, { rpc, at: Date.now() });
    failed.delete(key);
    return rpc;
  } catch (error) {
    const message = error instanceof Error ? error.message : `${key}: no RPC answered`;
    failed.set(key, { message, at: Date.now() });
    throw new Error(message);
  }
}

export function resetChainCache(): void {
  resolved.clear();
  failed.clear();
}

type RpcBody = { result?: unknown; error?: { code?: number } };

export async function rpcCall(key: NetworkKey, method: string, params: unknown[] = [], timeoutMs = 5000): Promise<unknown> {
  const rpc = await rpcFor(key);
  let body: RpcBody | null = null;
  try {
    const res = await fetch(rpc.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    if (res.ok) body = (await res.json()) as RpcBody;
  } catch {
    body = null;
  }
  if (!body || body.error || body.result === undefined) {
    resolved.delete(key); // try the next candidate on the next call
    throw new Error(`${key}: ${method} failed on ${rpc.label}${body?.error?.code ? ` (code ${body.error.code})` : ''}`);
  }
  return body.result;
}

const hexToBigint = (value: unknown, what: string): bigint => {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) throw new Error(`${what}: not a hex quantity`);
  return BigInt(value);
};

export async function blockNumber(key: NetworkKey): Promise<bigint> {
  return hexToBigint(await rpcCall(key, 'eth_blockNumber'), `${key} block number`);
}

export async function nativeBalance(key: NetworkKey, address: string): Promise<bigint> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error('not an address');
  return hexToBigint(await rpcCall(key, 'eth_getBalance', [address, 'latest']), `${key} balance`);
}
