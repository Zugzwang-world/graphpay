// A local sandbox for trying AgentPay in five minutes with no wallet, no faucet and no keys of
// yours: an anvil fork of Whitechain Sepolia (chain 1874) on your own machine, with your own
// checkout deployed on it, a relayer, a policy writer, a merchant and a buyer, all fresh keys
// made for this run. Nothing here touches the real chain; the fork is thrown away on stop().
//
// Needs Foundry's `anvil` on the PATH (https://getfoundry.sh). Only a loopback fork is ever used.

import { spawn } from 'node:child_process';
import { createPublicClient, createWalletClient, defineChain, encodeFunctionData, erc20Abi, http, parseEther, toHex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { deployCheckout } from './deploy.mjs';
import { AgentPayError } from './network.mjs';
import { defaults } from './vendor/defaults.mjs';

// A proxy's implementation, admin and beacon slots: never probed for a balance.
const EIP1967_SLOTS = new Set([
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
  '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103',
  '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50',
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch(forkUrl, base) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const port = base + Math.floor(Math.random() * 2000);
    const child = spawn('anvil', ['--fork-url', forkUrl, '--port', String(port), '--host', '127.0.0.1', '--silent'], { stdio: 'ignore' });
    let failed = null;
    child.on('error', (e) => {
      failed = e;
    });
    let exited = false;
    child.on('exit', () => {
      exited = true;
    });
    const url = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 150 && !failed && !exited; i++) {
      try {
        const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }) });
        if (res.ok) return { child, url, chainId: Number.parseInt((await res.json()).result, 16) };
      } catch {
        // still starting
      }
      await sleep(200);
    }
    child.kill('SIGTERM');
    if (failed?.code === 'ENOENT') throw new AgentPayError('NO_ANVIL', 'anvil was not found: install Foundry (https://getfoundry.sh) and run `foundryup`');
    // otherwise the port was taken or the fork did not start: try another port
  }
  throw new AgentPayError('FORK_FAILED', 'could not start an anvil fork of Whitechain Sepolia (is the public RPC reachable?)');
}

// options: { forkUrl? } defaults to the first public Whitechain Sepolia RPC. The fork must answer
// chain 1874 or the sandbox refuses to run.
export async function startSandbox({ forkUrl = defaults.publicRpcs[0], buyerUsdt = 20_000_000n, port = 18_000 } = {}) {
  const { child, url, chainId } = await launch(forkUrl, port);
  const stop = () => child.kill('SIGTERM');
  try {
    if (chainId !== 1874) throw new AgentPayError('WRONG_CHAIN', `the fork answered chain ${chainId}, not 1874`);
    const chain = defineChain({
      id: 1874,
      name: `${defaults.name} (local anvil fork)`,
      nativeCurrency: { name: defaults.nativeSymbol, symbol: defaults.nativeSymbol, decimals: 18 },
      rpcUrls: { default: { http: [url] } },
      contracts: { multicall3: { address: defaults.multicall3 } },
    });
    const publicClient = createPublicClient({ chain, transport: http(url) });
    const rpc = (method, params) => publicClient.request({ method, params });
    const wallet = (account) => createWalletClient({ account, chain, transport: http(url) });
    const account = () => privateKeyToAccount(generatePrivateKey());

    const accounts = { admin: account(), relayer: account(), policyWriter: account(), merchant: account(), buyer: account() };
    for (const key of ['admin', 'relayer', 'policyWriter', 'merchant']) await rpc('anvil_setBalance', [accounts[key].address, toHex(parseEther('10'))]);
    // The buyer gets no WBT at all: it pays by signature and cannot pay gas.

    const deployed = await deployCheckout({ walletClient: wallet(accounts.admin), publicClient, relayer: accounts.relayer.address, policyWriter: accounts.policyWriter.address });
    const network = deployed.network;

    // Test USDT on the fork only: find the storage key balanceOf(holder) reads and write it there.
    async function giveUsdt(to, micro) {
      const balanceOf = (a) => publicClient.readContract({ address: network.token.address, abi: erc20Abi, functionName: 'balanceOf', args: [a] });
      const before = await balanceOf(to);
      const data = encodeFunctionData({ abi: erc20Abi, functionName: 'balanceOf', args: [to] });
      const { accessList } = await rpc('eth_createAccessList', [{ to: network.token.address, data }, 'latest']);
      const keys = accessList.filter((e) => e.address.toLowerCase() === network.token.address.toLowerCase()).flatMap((e) => e.storageKeys);
      const marker = before + 123_456_789n;
      for (const key of keys.filter((k) => !EIP1967_SLOTS.has(k.toLowerCase()))) {
        const old = await rpc('eth_getStorageAt', [network.token.address, key, 'latest']);
        let hit = false;
        try {
          await rpc('anvil_setStorageAt', [network.token.address, key, toHex(marker, { size: 32 })]);
          hit = (await balanceOf(to)) === marker;
        } catch {
          // not the balance slot
        } finally {
          await rpc('anvil_setStorageAt', [network.token.address, key, old]);
        }
        if (hit) {
          await rpc('anvil_setStorageAt', [network.token.address, key, toHex(before + BigInt(micro), { size: 32 })]);
          if ((await balanceOf(to)) !== before + BigInt(micro)) break;
          return;
        }
      }
      throw new AgentPayError('NO_TEST_USDT', 'could not give test USDT on the fork');
    }
    await giveUsdt(accounts.buyer.address, buyerUsdt);

    return Object.freeze({ url, chain, network, publicClient, accounts, wallet, giveUsdt, checkout: deployed, stop });
  } catch (e) {
    stop();
    throw e;
  }
}
