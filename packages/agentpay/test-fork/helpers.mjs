// An anvil fork of Whitechain Sepolia for AgentPay's end-to-end tests. Keys are generated per
// run (never stored); roles and test USDT are arranged on the fork by impersonation, which
// changes nothing on the real chain.

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createPublicClient, createWalletClient, defineChain, erc20Abi, http, parseEther } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { config, resolveRpc } from '@graphpay/config';
import { checkoutAbi } from '@graphpay/contracts';
import { whitechainNetwork } from '../index.mjs';

export const network = whitechainNetwork();

export async function startFork() {
  // Public RPCs only: no keyed URL ever reaches the anvil command line.
  const rpc = await resolveRpc('whitechain', { env: {} });
  const port = 18_545 + Math.floor(Math.random() * 1000);
  const child = spawn('anvil', ['--fork-url', rpc.url, '--port', String(port), '--silent'], { stdio: 'ignore' });
  const url = `http://127.0.0.1:${port}`;
  const chain = defineChain({
    id: network.chainId,
    name: `${network.name} (anvil fork)`,
    nativeCurrency: { name: network.nativeSymbol, symbol: network.nativeSymbol, decimals: 18 },
    rpcUrls: { default: { http: [url] } },
    contracts: { multicall3: { address: config.whitechain.system.multicall3 } },
  });
  const publicClient = createPublicClient({ chain, transport: http(url) });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await publicClient.getChainId()) === network.chainId) break;
    } catch {
      // still starting
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  const rpcCall = (method, params) => publicClient.request({ method, params });
  const fork = {
    url,
    chain,
    publicClient,
    rpc: rpcCall,
    stop: () => child.kill('SIGTERM'),
    wallet(account) {
      return createWalletClient({ account, chain, transport: http(url) });
    },
    newAccount() {
      return privateKeyToAccount(generatePrivateKey());
    },
    async setBalance(address, wbt) {
      await rpcCall('anvil_setBalance', [address, `0x${parseEther(String(wbt)).toString(16)}`]);
    },
    async impersonate(address, fn) {
      await rpcCall('anvil_impersonateAccount', [address]);
      await fork.setBalance(address, 10);
      try {
        return await fn(createWalletClient({ account: address, chain, transport: http(url) }));
      } finally {
        await rpcCall('anvil_stopImpersonatingAccount', [address]);
      }
    },
    async send(walletClient, args) {
      const hash = await walletClient.writeContract({ chain, account: walletClient.account, ...args });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error(`${args.functionName} reverted on the fork`);
      return receipt;
    },
    // Test USDT from the FUNDER wallet, by impersonation on the fork.
    async giveUsdt(to, micro) {
      await fork.impersonate(config.wallets.carried.FUNDER, (w) => fork.send(w, { address: network.token.address, abi: erc20Abi, functionName: 'transfer', args: [to, micro] }));
    },
    async usdtBalance(address) {
      return publicClient.readContract({ address: network.token.address, abi: erc20Abi, functionName: 'balanceOf', args: [address] });
    },
    // Grant the checkout's relayer and policy-writer roles to fresh fork keys.
    async grantRoles({ relayer, policyWriter }) {
      const owner = await publicClient.readContract({ address: network.checkout, abi: checkoutAbi, functionName: 'owner' });
      await fork.impersonate(owner, async (w) => {
        if (relayer) await fork.send(w, { address: network.checkout, abi: checkoutAbi, functionName: 'setRelayer', args: [relayer, true] });
        if (policyWriter) await fork.send(w, { address: network.checkout, abi: checkoutAbi, functionName: 'setPolicyWriter', args: [policyWriter, true] });
      });
    },
    async chainNowSec() {
      return Number((await publicClient.getBlock()).timestamp);
    },
    async warp(seconds) {
      await rpcCall('evm_increaseTime', [`0x${seconds.toString(16)}`]);
      await rpcCall('evm_mine', []);
    },
  };
  return fork;
}

// A clock that follows the fork's block time (so warps move the SDK's "now" too).
export function chainClock() {
  let offsetMs = 0;
  return {
    now: () => Date.now() + offsetMs,
    async sync(fork) {
      offsetMs = (await fork.chainNowSec()) * 1000 - Date.now();
    },
  };
}

// A node:http server on a random loopback port.
export async function listen(listener) {
  const server = createServer(listener);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) };
}
