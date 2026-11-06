// An anvil fork of Whitechain Sepolia for AgentPay's end-to-end tests. Keys are generated per
// run (never stored); roles are arranged on the fork by impersonation and test USDT by writing the
// token's balance slot on the fork, which changes nothing on the real chain.

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createPublicClient, createWalletClient, defineChain, encodeFunctionData, erc20Abi, http, parseEther, toHex } from 'viem';
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
  // Refuse any other chain (CLAUDE.md): the fork must answer Whitechain Sepolia's id.
  if ((await publicClient.getChainId().catch(() => null)) !== network.chainId) {
    child.kill('SIGTERM');
    throw new Error(`the fork did not answer chain ${network.chainId}`);
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
    // Test USDT on the fork only, without depending on a real wallet's balance: find the storage
    // key balanceOf(to) reads (eth_createAccessList) and add to it there, as Foundry's `deal` does.
    // Falls back to a FUNDER transfer by impersonation.
    async giveUsdt(to, micro) {
      const before = await fork.usdtBalance(to);
      const key = await balanceKey(fork, to, before);
      if (!key) {
        await fork.impersonate(config.wallets.carried.FUNDER, (w) => fork.send(w, { address: network.token.address, abi: erc20Abi, functionName: 'transfer', args: [to, micro] }));
        return;
      }
      await rpcCall('anvil_setStorageAt', [network.token.address, key, toHex(before + BigInt(micro), { size: 32 })]);
      if ((await fork.usdtBalance(to)) !== before + BigInt(micro)) throw new Error('giveUsdt: the balance write did not take on the fork');
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

// The token storage key that holds balanceOf(holder): of the keys the call reads (behind a proxy
// too), the one whose write moves the balance. null if none does.
// A proxy's implementation, admin and beacon slots: never probed.
const EIP1967_SLOTS = new Set([
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
  '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103',
  '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50',
]);

async function balanceKey(fork, holder, current) {
  const data = encodeFunctionData({ abi: erc20Abi, functionName: 'balanceOf', args: [holder] });
  const { accessList } = await fork.rpc('eth_createAccessList', [{ to: network.token.address, data }, 'latest']);
  const keys = accessList.filter((e) => e.address.toLowerCase() === network.token.address.toLowerCase()).flatMap((e) => e.storageKeys);
  const marker = current + 123_456_789n;
  for (const key of keys.filter((k) => !EIP1967_SLOTS.has(k.toLowerCase()))) {
    const old = await fork.rpc('eth_getStorageAt', [network.token.address, key, 'latest']);
    let hit = false;
    try {
      await fork.rpc('anvil_setStorageAt', [network.token.address, key, toHex(marker, { size: 32 })]);
      hit = (await fork.usdtBalance(holder)) === marker;
    } catch {
      // not the balance (the write broke the call)
    } finally {
      await fork.rpc('anvil_setStorageAt', [network.token.address, key, old]);
    }
    if (hit) return key;
  }
  return null;
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
