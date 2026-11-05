// Shared by the Whitechain scripts (M2, M3 part B): one checked context per run.
// - keys only through the git-based env loader, read in-process, never printed;
// - every RPC chosen by resolveRpc and checked to answer chain 1874 (or a loopback fork of it
//   with --fork <url>); real sends need the script's confirm flag, a dry run is the default;
// - every transaction is logged (hash and nonce before its receipt, then gas, fee and the
//   explorer link) to docs/sessions/payments/txlog.jsonl;
// - errors pass through the redacting error boundary (viem messages quote RPC URLs).

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPublicClient, createWalletClient, formatEther, http, isAddressEqual } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from '../../packages/config/index.mjs';
import { chainOf, clientsFor } from '../lib/chains.mjs';
import { loadEnv } from '../lib/env-loader.mjs';
import { installErrorBoundary } from '../lib/redact.mjs';

// Real transactions only; a fork rehearsal logs to a temporary file instead.
export const TXLOG = new URL('../../docs/sessions/payments/txlog.jsonl', import.meta.url);
const FORK_TXLOG = pathToFileURL(join(tmpdir(), 'graphpay-fork-txlog.jsonl'));
let txlog = TXLOG;
export const CONFIG_FILE = new URL('../../packages/config/graphpay.config.json', import.meta.url);
const RECEIPT_TIMEOUT_MS = 120_000;

export function flag(argv, name) {
  return argv.includes(name);
}

export function option(argv, name) {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
}

// A fork must be a loopback URL (anvil); the real chain only through resolveRpc.
export function forkUrl(argv) {
  const url = option(argv, '--fork');
  if (url === undefined) return undefined;
  const { hostname, protocol } = new URL(url);
  if (protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(hostname)) {
    throw new Error('--fork takes a loopback anvil URL only');
  }
  return url;
}

export async function context(argv, { confirmFlag = '--yes' } = {}) {
  const { values } = loadEnv();
  const env = Object.fromEntries(values);
  installErrorBoundary(() => values);
  const fork = forkUrl(argv);
  let c;
  if (fork) {
    const chain = chainOf('whitechain');
    const transport = http(fork, { timeout: 20_000 });
    c = {
      chain,
      rpcLabel: 'local fork',
      publicClient: createPublicClient({ chain, transport }),
      walletClient: (account) => createWalletClient({ account, chain, transport }),
      explorerTx: (hash) => `fork:${hash}`,
    };
    const id = await c.publicClient.getChainId();
    if (id !== chain.id) throw new Error(`the fork reports chain ${id}, not ${chain.id}`);
    if (!(await isAnvil(c.publicClient))) throw new Error('--fork must be a local anvil fork');
  } else {
    c = await clientsFor('whitechain', env); // refuses any candidate not on chain 1874
    if (await isAnvil(c.publicClient)) throw new Error('the configured RPC is a local anvil, not the real chain; use --fork');
  }
  if (fork) txlog = FORK_TXLOG;
  const send = flag(argv, confirmFlag);
  const mode = fork ? 'fork' : 'real Whitechain Sepolia';
  console.log(`network: ${mode} (chain ${c.chain.id}, rpc ${c.rpcLabel}); ${send ? 'SENDING' : `dry run (add ${confirmFlag} to send)`}`);
  return { ...c, env, fork: Boolean(fork), send, account: (role) => accountOf(env, role) };
}

async function isAnvil(publicClient) {
  const version = await publicClient.request({ method: 'web3_clientVersion' }).catch(() => '');
  return /anvil/i.test(String(version));
}

export function accountOf(env, role) {
  const key = env[`${role}_PRIVATE_KEY`];
  if (!key) throw new Error(`${role}_PRIVATE_KEY is not in .env`);
  return privateKeyToAccount(key);
}

export function hasKey(env, role) {
  return Boolean(env[`${role}_PRIVATE_KEY`]);
}

export function logTx(record) {
  appendFileSync(txlog, `${JSON.stringify({ at: new Date().toISOString(), ...record })}\n`);
}

export function readTxLog() {
  if (!existsSync(txlog)) return [];
  return readFileSync(txlog, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

// Sends one transaction as `role` with an explicit nonce, gas and fees, and waits for its own
// receipt. Refuses to send while the role has a pending transaction (a timed-out send must be
// settled first, never repeated blindly).
export async function sendTx(ctx, { role, label, request, gasFloor = 0n, expectedNonce }) {
  const account = ctx.account(role);
  const { publicClient } = ctx;
  const [latest, pending] = await Promise.all([
    publicClient.getTransactionCount({ address: account.address, blockTag: 'latest' }),
    publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' }),
  ]);
  if (pending !== latest) throw new Error(`${role} has a pending transaction (nonce ${latest}); settle it first`);
  if ((await publicClient.getChainId()) !== ctx.chain.id) throw new Error(`the RPC no longer answers chain ${ctx.chain.id}; nothing sent`);
  if (expectedNonce !== undefined && latest !== expectedNonce) throw new Error(`${role}'s nonce moved to ${latest} (expected ${expectedNonce}); nothing sent`);
  const estimate = request.bytecode
    ? await publicClient.estimateGas({ account, data: request.data })
    : await publicClient.estimateContractGas({ ...request, account });
  const gas = (estimate * 12n) / 10n > gasFloor ? (estimate * 12n) / 10n : gasFloor;
  const fees = await publicClient.estimateFeesPerGas();
  const wallet = ctx.walletClient(account);
  const common = { account, chain: ctx.chain, nonce: latest, gas, ...fees };
  const hash = request.bytecode
    ? await wallet.deployContract({ ...common, abi: request.abi, bytecode: request.bytecode, args: request.args })
    : await wallet.writeContract({ ...common, ...request });
  logTx({ label, role, from: account.address, nonce: latest, hash, status: 'sent', network: ctx.fork ? 'fork' : 'whitechain' });
  console.log(`  sent ${label}: ${ctx.explorerTx(hash)} (nonce ${latest})`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: RECEIPT_TIMEOUT_MS });
  if (!isAddressEqual(receipt.from, account.address)) throw new Error(`${label}: the receipt is not ours`);
  const fee = receipt.gasUsed * receipt.effectiveGasPrice;
  logTx({
    label,
    hash,
    status: receipt.status,
    block: Number(receipt.blockNumber),
    gasUsed: Number(receipt.gasUsed),
    feeWbt: formatEther(fee),
    contractAddress: receipt.contractAddress ?? undefined,
    explorer: ctx.explorerTx(hash),
    network: ctx.fork ? 'fork' : 'whitechain',
  });
  if (receipt.status !== 'success') throw new Error(`${label} reverted: ${ctx.explorerTx(hash)}`);
  console.log(`  ${label}: ${receipt.gasUsed} gas, ${formatEther(fee)} WBT`);
  return receipt;
}

// whitechain.contracts is this track's section of the one config file (ADR-0030). It is
// spliced in place so the rest of the file keeps its formatting, and the result is checked:
// only that section may change.
export function writeContracts(entries) {
  const text = readFileSync(CONFIG_FILE, 'utf8');
  const before = JSON.parse(text);
  const contracts = { ...before.whitechain.contracts, ...entries }; // a re-record keeps the other entries
  const start = text.indexOf('"contracts":', text.indexOf('"labDoNotReuse"'));
  if (start === -1) throw new Error('whitechain.contracts not found in the config');
  let i = text.indexOf('{', start);
  const open = i;
  let depth = 0;
  for (; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) break;
  }
  const indent = '    ';
  const body = JSON.stringify(contracts, null, 2).replace(/\n/g, `\n${indent}`);
  const next = text.slice(0, open) + body + text.slice(i + 1);
  const after = JSON.parse(next);
  const expected = { ...before, whitechain: { ...before.whitechain, contracts } };
  if (JSON.stringify(after) !== JSON.stringify(expected)) throw new Error('config splice changed more than whitechain.contracts');
  writeFileSync(CONFIG_FILE, next);
}

export function configuredCheckout() {
  const c = JSON.parse(readFileSync(CONFIG_FILE, 'utf8')).whitechain.contracts?.checkout;
  return c?.address ? c : undefined;
}

export const usdt = () => config.whitechain.tokens.usdt;
export const permit2 = () => config.whitechain.system.permit2;
