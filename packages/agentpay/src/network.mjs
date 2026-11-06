// The network AgentPay pays on: Whitechain Sepolia (chain 1874), the only chain V1 accepts.
// Defaults (the demo GraphPayCheckout, its test USDT and Permit2) are vendored in
// src/vendor/defaults.mjs. A developer overrides `checkout` with their own deployment; the
// guards below refuse any other chain, a never-use token and a token that is not 6-decimal USDT.

import { getAddress, isAddressEqual } from 'viem';
import { defaults } from './vendor/defaults.mjs';

// Testnet only: Whitechain Sepolia. A local anvil fork of it keeps the chain id.
export const ALLOWED_CHAIN_IDS = Object.freeze([1874]);

export function whitechainNetwork(overrides = {}, source = defaults) {
  const net = source;
  const checkout = source.checkout;
  const token = source.tokens[checkout.token];
  const base = {
    name: net.name,
    chainId: net.chainId,
    caip2: `eip155:${net.chainId}`,
    nativeSymbol: net.nativeSymbol,
    explorer: net.explorer,
    checkout: getAddress(checkout.address),
    deployBlock: BigInt(checkout.deployBlock),
    permit2: getAddress(source.permit2),
    token: Object.freeze({
      address: getAddress(token.address),
      symbol: token.symbol,
      decimals: token.decimals,
      eip712: Object.freeze({ ...token.eip712 }),
    }),
    neverUse: Object.freeze(source.neverUse.map((a) => getAddress(a))),
  };
  const merged = { ...base, ...overrides };
  // An override can add to the never-use list but never remove the baseline entries.
  merged.neverUse = Object.freeze([...new Set([...base.neverUse, ...(overrides.neverUse ?? []).map((a) => getAddress(a))])]);
  if (!ALLOWED_CHAIN_IDS.includes(merged.chainId)) throw new Error(`agentpay: chain ${merged.chainId} is not an allowed testnet`);
  if (merged.neverUse.some((a) => isAddressEqual(a, merged.token.address))) throw new Error('agentpay: the configured token is on the never-use list');
  if (merged.token.decimals !== 6) throw new Error('agentpay: the token must have 6 decimals (USDT)');
  merged.caip2 = `eip155:${merged.chainId}`;
  return Object.freeze(merged);
}

// At client creation: a viem client that names a chain must name Whitechain Sepolia's.
// (A client without a chain is checked by eth_chainId before every signing step instead.)
export function assertClientChain(publicClient, network) {
  const id = publicClient?.chain?.id;
  if (id !== undefined && id !== network.chainId) throw new AgentPayError('WRONG_CHAIN', `the client is on chain ${id}, not ${network.chainId}`);
}

// Before every write: the public client AND the wallet client must be on Whitechain Sepolia.
// A wallet client has its own transport, so it is asked directly (eth_chainId) as well.
export async function assertWriteChain(publicClient, walletClient, network) {
  assertClientChain(walletClient, network);
  await assertChain(publicClient, network);
  if (typeof walletClient?.getChainId !== 'function') throw new AgentPayError('WRONG_CHAIN', 'the wallet client cannot report its chain id');
  const id = await walletClient.getChainId();
  if (id !== network.chainId) throw new AgentPayError('WRONG_CHAIN', `the wallet client is on chain ${id}, not ${network.chainId}`);
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
