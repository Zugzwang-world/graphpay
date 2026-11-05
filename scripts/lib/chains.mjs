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

// env: the loaded .env values as a plain object (secret RPC URLs and the Arkiv key).
export async function clientsFor(key, env) {
  const rpc = await resolveRpc(key, { env });
  const chain = chainOf(key);
  const transport = http(rpc.url, { retryCount: 2, timeout: 20_000 });
  const publicClient = createPublicClient({ chain, transport });
  const chainId = await publicClient.getChainId();
  if (chainId !== chain.id) throw new Error(`${chain.name}: refused, the RPC reports chain ${chainId}`);
  return {
    chain,
    rpcLabel: rpc.label,
    refused: rpc.refused,
    publicClient,
    walletClient: (account) => createWalletClient({ account, chain, transport }),
    explorerTx: (hash) => `${network(key).explorer}/tx/${hash}`,
  };
}
