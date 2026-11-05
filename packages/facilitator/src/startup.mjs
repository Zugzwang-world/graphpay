// The facilitator's and the shop's start-up checks (planning/SPEC/PAYMENTS_WHITECHAIN.md §5): a
// failure refuses to start, or answers 503 and is retried on the next request. A check's error
// is never printed (viem's message carries the RPC URL and any key in it): only its name.

import { domainSeparator, isAddressEqual, parseAbi } from 'viem';
import { checkoutAbi, tokenDomain } from '@graphpay/contracts';

const domainAbi = parseAbi(['function DOMAIN_SEPARATOR() view returns (bytes32)']);
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

export class StartupError extends Error {}

// rpcUrl: only its host is read, to tell a loopback fork from a real network.
export function networkMode({ rpcUrl, allowRealNetwork, ensStub, hosted = false }) {
  const { protocol, hostname } = new URL(rpcUrl);
  const loopback = LOOPBACK.has(hostname);
  if (!loopback && allowRealNetwork !== '1') throw new StartupError('a non-loopback RPC needs ALLOW_REAL_NETWORK=1');
  if (!loopback && ensStub) throw new StartupError('the ENS stub is refused on a real network');
  if (hosted && (protocol !== 'https:' || loopback)) throw new StartupError('the hosted service needs an https RPC on the real network');
  return loopback ? 'fork' : 'real';
}

export async function startupChecks({ publicClient, chainId, checkout, token, ensClient, sepoliaChainId }) {
  const step = async (name, fn) => {
    let ok;
    try {
      ok = await fn();
    } catch {
      throw new StartupError(`start-up check failed: ${name} (read error)`);
    }
    if (!ok) throw new StartupError(`start-up check failed: ${name}`);
  };
  await step(`eth_chainId = ${chainId}`, async () => (await publicClient.getChainId()) === chainId);
  await step('checkout.USDT() = the configured token', async () =>
    isAddressEqual(await publicClient.readContract({ address: checkout, abi: checkoutAbi, functionName: 'USDT' }), token.address),
  );
  await step("the configured EIP-712 domain = the token's DOMAIN_SEPARATOR()", async () =>
    (await publicClient.readContract({ address: token.address, abi: domainAbi, functionName: 'DOMAIN_SEPARATOR' })) ===
    domainSeparator({ domain: tokenDomain(chainId, token) }),
  );
  if (ensClient) await step(`the ENS RPC is chain ${sepoliaChainId}`, async () => (await ensClient.getChainId()) === sepoliaChainId);
}

// Runs the checks once; a failure is retried on the next call (the 503 rule).
export function readiness(run) {
  let passed = null;
  return () => {
    passed ??= run().catch((e) => {
      passed = null;
      throw e;
    });
    return passed;
  };
}
