// ENSv2 contract addresses (from the config file's `ens.contracts`, ADR-0030) and the
// resolver profile calls read through `resolve(name, data)`.

import { config, network, resolveRpc } from '@graphpay/config';
import { createPublicClient, defineChain, getAddress, http, parseAbi } from 'viem';

const c = config.ens.contracts;
export const ENS = Object.freeze({
  rootRegistry: getAddress(c.rootRegistry),
  ethRegistry: getAddress(c.ethRegistry),
  ethRegistrar: getAddress(c.ethRegistrar),
  rentPriceOracle: getAddress(c.standardRentPriceOracle),
  factory: getAddress(c.verifiableFactory),
  userRegistryImpl: getAddress(c.userRegistryImpl),
  resolverImpl: getAddress(c.permissionedResolverImpl),
  universalResolverV2: getAddress(c.universalResolverV2),
  universalResolver: getAddress(c.universalResolverProxy), // the entry point (a proxy; use this one)
});

// ENSIP-5 text and ENSIP-9 multicoin address profiles, as the resolver's `resolve` dispatches
// them (ITextResolver.text, IAddressResolver.addr in the verified sources).
export const profileAbi = parseAbi([
  'function text(bytes32 node, string key) view returns (string)',
  'function addr(bytes32 node, uint256 coinType) view returns (bytes)',
]);

export const ensNetwork = () => network(config.ens.network);

export function ensChain() {
  const n = ensNetwork();
  return defineChain({
    id: n.chainId,
    name: n.name,
    nativeCurrency: { name: n.nativeSymbol, symbol: n.nativeSymbol, decimals: 18 },
    rpcUrls: { default: { http: [] } },
  });
}

// A public client on the ENS network through the first RPC that answers its chain id
// (the secret URL first, if set; then the public ones). Errors carry labels, never URLs.
export async function ensPublicClient({ env = process.env } = {}) {
  const rpc = await resolveRpc(config.ens.network, { env });
  const client = createPublicClient({ chain: ensChain(), transport: http(rpc.url, { retryCount: 2, timeout: 20_000 }) });
  return { client, rpcLabel: rpc.label };
}
