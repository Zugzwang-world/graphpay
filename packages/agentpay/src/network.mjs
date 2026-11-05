// The network AgentPay pays on. Defaults come from @graphpay/config (ADR-0030): the
// Whitechain Sepolia chain id, the deployed GraphPayCheckout, its token and Permit2.
// Every value can be overridden, so the SDK is not tied to one deployment; the guards
// below refuse anything that is not the configured testnet, token and checkout.

import { getAddress, isAddressEqual } from 'viem';
import { config } from '@graphpay/config';

// Testnets only (CLAUDE.md): Whitechain Sepolia. A loopback anvil fork keeps the chain id.
export const ALLOWED_CHAIN_IDS = Object.freeze([config.networks.whitechain.chainId]);

export function whitechainNetwork(overrides = {}, source = config) {
  const net = source.networks.whitechain;
  const checkout = source.whitechain.contracts.checkout;
  const token = source.whitechain.tokens[checkout.token];
  const base = {
    name: net.name,
    chainId: net.chainId,
    caip2: `eip155:${net.chainId}`,
    nativeSymbol: net.nativeSymbol,
    explorer: net.explorer,
    checkout: getAddress(checkout.address),
    deployBlock: BigInt(checkout.deployBlock),
    permit2: getAddress(source.whitechain.system.permit2),
    token: Object.freeze({
      address: getAddress(token.address),
      symbol: token.symbol,
      decimals: token.decimals,
      eip712: Object.freeze({ ...token.eip712 }),
    }),
    neverUse: Object.freeze(source.whitechain.tokens.neverUse.map((a) => getAddress(a))),
  };
  const merged = { ...base, ...overrides };
  if (!ALLOWED_CHAIN_IDS.includes(merged.chainId)) throw new Error(`agentpay: chain ${merged.chainId} is not an allowed testnet`);
  if (merged.neverUse.some((a) => isAddressEqual(a, merged.token.address))) throw new Error('agentpay: the configured token is on the never-use list');
  if (merged.token.decimals !== 6) throw new Error('agentpay: the token must have 6 decimals (USDT)');
  merged.caip2 = `eip155:${merged.chainId}`;
  return Object.freeze(merged);
}

export function explorerTx(network, hash) {
  return `${network.explorer}/tx/${hash}`;
}

// eth_chainId before every signing step (CLAUDE.md): refuse any other chain.
export async function assertChain(publicClient, network) {
  const id = await publicClient.getChainId();
  if (id !== network.chainId) throw new AgentPayError('WRONG_CHAIN', `connected to chain ${id}, not ${network.chainId}`);
  return id;
}

// A stable, code-readable error: `code` is what a tool or a 402 answer reports.
export class AgentPayError extends Error {
  constructor(code, message, details) {
    super(`${code}: ${message}`);
    this.name = 'AgentPayError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
