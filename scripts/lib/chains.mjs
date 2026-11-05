// viem clients for the three testnets, built from the config file. Every RPC is
// chosen by resolveRpc, so a candidate on the wrong chain is refused before
// anything is read or signed. Log the label, never the URL.

import { createPublicClient, createWalletClient, defineChain, http } from 'viem';
import { network, resolveRpc } from '../../packages/config/index.mjs';

export const NETWORKS = ['whitechain', 'sepolia', 'rabdi'];

export function chainOf(key) {
  const n = network(key);
  return defineChain({
    id: n.chainId,
    name: n.name,
    nativeCurrency: { name: n.nativeSymbol, symbol: n.nativeSymbol, decimals: 18 },
    rpcUrls: { default: { http: [] } },
  });
}

// The clients for one network over a given transport, without any RPC call (the
// tests pass a transport to a local fake chain). clientsFor is the checked way in.
export function clientsOver(key, transport, { rpcLabel, refused = [] } = {}) {
  const chain = chainOf(key);
  const { explorer } = network(key);
  return {
    key,
    chain,
    rpcLabel,
    refused,
    publicClient: createPublicClient({ chain, transport }),
    walletClient: (account) => createWalletClient({ account, chain, transport }),
    explorerTx: (hash) => `${explorer}/tx/${hash}`,
    explorerAddress: (address) => `${explorer}/address/${address}`,
  };
}

// env: the loaded .env values as a plain object (secret RPC URLs and the Arkiv key).
export async function clientsFor(key, env) {
  const rpc = await resolveRpc(key, { env });
  const c = clientsOver(key, http(rpc.url, { retryCount: 2, timeout: 20_000 }), { rpcLabel: rpc.label, refused: rpc.refused });
  const chainId = await c.publicClient.getChainId();
  if (chainId !== c.chain.id) throw new Error(`${c.chain.name}: refused, the RPC reports chain ${chainId}`);
  return c;
}
