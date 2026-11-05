import assert from 'node:assert/strict';
import { test } from 'node:test';
import { config } from '@graphpay/config';
import { resetChainCache } from './chain.server.ts';
import { GET } from '../app/api/status/route.ts';

const chainOf = (url: string) =>
  Object.values(config.networks as Record<string, { chainId: number; publicRpcs: { url: string }[] }>).find((n) => n.publicRpcs.some((p) => p.url === url));

// A fake RPC: answers the chain id and a block number per network, or hangs up.
function fakeFetch(down: number[] = []) {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const net = chainOf(url);
    if (!net || down.includes(net.chainId)) throw new Error('unreachable');
    const { method } = JSON.parse(String(init?.body)) as { method: string };
    const result = method === 'eth_chainId' ? `0x${net.chainId.toString(16)}` : '0x1f4';
    return Response.json({ jsonrpc: '2.0', id: 1, result });
  };
}

test('the status chips carry each chain head, and a dead chain shows null with a note', async (t) => {
  resetChainCache();
  t.mock.method(globalThis, 'fetch', fakeFetch([config.networks.rabdi.chainId]));
  const body = await (await GET()).json();
  assert.equal(body.heads.whitechain, '500');
  assert.equal(body.heads.sepolia, '500');
  assert.equal(body.heads.rabdi, null);
  assert.ok(body.notes.some((n: string) => n.startsWith('rabdi block')));
  assert.equal(body.token, 'usdt');
  assert.equal(body.relayerWbt, null);
  resetChainCache();
});

test('an RPC that answers the wrong chain id is never used', async (t) => {
  resetChainCache();
  t.mock.method(globalThis, 'fetch', async () => Response.json({ jsonrpc: '2.0', id: 1, result: '0x1' }));
  const body = await (await GET()).json();
  assert.deepEqual(body.heads, { whitechain: null, sepolia: null, rabdi: null });
  resetChainCache();
});
