// Sending transactions on the ENS network: the chain id is checked before every signing step,
// gas is estimated (never assumed) and sent with a 20% margin, each signer's nonce is counted
// locally after every confirmed receipt (the load-balanced Sepolia RPC can answer a block
// behind; docs/problems/PROBLEM_LOG.md P-foundation-2), and a receipt must be its own and
// successful. Only hashes and addresses are logged.

import { getAddress } from 'viem';

const RECEIPT_TIMEOUT_MS = 180_000;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Polls `check` until it returns a truthy value (the public RPC can lag a block after a write).
export async function eventually(check, { tries = 30, delayMs = 2000, what = 'state' } = {}) {
  for (let i = 0; i < tries; i += 1) {
    const value = await check();
    if (value) return value;
    await sleep(delayMs);
  }
  throw new Error(`${what}: not visible on chain after ${(tries * delayMs) / 1000} s`);
}

// sender: { role, address, sendTransaction(request) → hash } (a key-backed wallet client, or
// an impersonated account on a local fork). Returns send(step, request) → { hash, receipt }.
export function createTxRunner({ client, chainId, explorerTx = (h) => h, log = console.log }) {
  const nonces = new Map();

  async function assertChain() {
    const id = await client.getChainId();
    if (id !== chainId) throw new Error(`refused: the RPC reports chain ${id}, not ${chainId}; nothing signed`);
  }

  async function nextNonce(sender) {
    if (nonces.has(sender.address)) return nonces.get(sender.address);
    const latest = await client.getTransactionCount({ address: sender.address, blockTag: 'latest' });
    const pending = await client.getTransactionCount({ address: sender.address, blockTag: 'pending' });
    if (pending !== latest) throw new Error(`${sender.role} ${sender.address} has a transaction in flight (nonce ${latest} mined, ${pending} pending); wait for it, then run again`);
    nonces.set(sender.address, latest);
    return latest;
  }

  async function send(step, sender, { to, data, value = 0n }) {
    await assertChain();
    const from = getAddress(sender.address);
    const nonce = await nextNonce(sender);
    const estimate = await client.estimateGas({ account: from, to, data, value });
    const gas = (estimate * 120n) / 100n;
    const fees = await client.estimateFeesPerGas();
    const hash = await sender.sendTransaction({ to, data, value, gas, nonce, chainId, maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas });
    log(`  ${step}: ${sender.role} nonce ${nonce}, tx ${hash} (${explorerTx(hash)})`);
    const receipt = await eventually(
      async () => {
        try {
          return await client.getTransactionReceipt({ hash });
        } catch {
          return null; // not mined yet, or the load-balanced RPC is a block behind
        }
      },
      { tries: RECEIPT_TIMEOUT_MS / 2000, delayMs: 2000, what: `${step} receipt` },
    );
    if (receipt.transactionHash !== hash) throw new Error(`${step}: the receipt is not this transaction's`);
    nonces.set(from, nonce + 1);
    if (receipt.status !== 'success') throw new Error(`${step}: reverted on chain (${explorerTx(hash)})`);
    log(`  ${step}: mined in block ${receipt.blockNumber}, gas used ${receipt.gasUsed}`);
    return { hash, receipt };
  }

  return { send, assertChain };
}

// A client whose reads retry on an error: the public Sepolia RPC is load balanced, and a read
// seconds after a write can hit a node a block behind and fail or return no data (§10 pitfall 3).
// Writes and estimates are not retried here. A real revert costs a few extra seconds, then throws.
export function retryingReads(client, { tries = 8, delayMs = 3000 } = {}) {
  const retried = new Set(['readContract', 'getCode', 'getBlock']);
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (!retried.has(prop) || typeof value !== 'function') return value;
      return async (...args) => {
        let last;
        for (let i = 0; i < tries; i += 1) {
          try {
            return await value.apply(target, args);
          } catch (e) {
            last = e;
            await sleep(delayMs);
          }
        }
        throw last;
      };
    },
  });
}
