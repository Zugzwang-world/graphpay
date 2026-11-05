// The chain source: the checkout's logs from a block to head − confirmations, in
// ranges of at most 1,000 blocks (eth_getLogs over HTTPS polling; ADR-0055). The head
// is read uncached: viem caches getBlockNumber for its polling interval, and a lab
// /sync returned before the payment was mirrored (§8 item 1).

import { decodeLogs } from './decode.mjs';

export const MAX_RANGE = 1000;

export function ranges(from, to, max = MAX_RANGE) {
  const out = [];
  for (let start = from; start <= to; start += max) out.push({ from: start, to: Math.min(to, start + max - 1) });
  return out;
}

// client: a viem public client on the checked RPC (resolveRpc refuses any other chain).
export function chainSource({ client, address, abi, chainId, confirmations = 2 }) {
  const times = new Map();
  return {
    chainId,
    confirmations,
    async head() {
      return Number(await client.getBlockNumber({ cacheTime: 0 }));
    },
    async safeHead() {
      return (await this.head()) - confirmations;
    },
    async events(from, to) {
      const logs = await client.getLogs({ address, fromBlock: BigInt(from), toBlock: BigInt(to) });
      return decodeLogs(abi, logs, { chainId });
    },
    async blockTime(block) {
      if (!times.has(block)) {
        const b = await client.getBlock({ blockNumber: BigInt(block) });
        times.set(block, Number(b.timestamp));
        if (times.size > 5000) times.delete(times.keys().next().value);
      }
      return times.get(block);
    },
  };
}
