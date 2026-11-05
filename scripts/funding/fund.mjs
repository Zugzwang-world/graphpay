// pnpm funding [--balances] [--plan m0|later] [--network whitechain|sepolia|rabdi] [--execute --real]
// --balances: every role's balance on all three networks and the Sepolia base fee and tip (read-only).
// Otherwise: the funding plan as a dry run (default) or, with --execute --real, for real.
// Every transfer is sent by FUNDER, tops a role up to its target, has its gas
// estimated (never 21,000 assumed: a Sepolia transfer to a new account costs about
// 207,000) and waits for its receipt. Roles without a key are skipped.

import { readFileSync } from 'node:fs';
import { erc20Abi, formatEther, formatGwei, formatUnits, parseEther, parseGwei, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from '../../packages/config/index.mjs';
import { loadEnv } from '../lib/env-loader.mjs';
import { installErrorBoundary } from '../lib/redact.mjs';
import { clientsFor, NETWORKS } from '../lib/chains.mjs';
import { CARRIED, FRESH, roleAddresses } from '../lib/wallets.mjs';

const PLAN = JSON.parse(readFileSync(new URL('./plan.json', import.meta.url), 'utf8'));
const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

const { values } = loadEnv();
installErrorBoundary(() => values);
const env = Object.fromEntries(values);
const addresses = roleAddresses(values);

function fmt(wei, digits = 6) {
  const [i, f = ''] = formatEther(wei).split('.');
  return f ? `${i}.${f.slice(0, digits)}` : i;
}

async function sepoliaFees(publicClient) {
  const block = await publicClient.getBlock();
  const tip = await publicClient.estimateMaxPriorityFeePerGas();
  return { baseFee: block.baseFeePerGas ?? 0n, tip };
}

async function balances() {
  const roles = [...CARRIED, ...FRESH, ...Object.keys(addresses).filter((r) => !CARRIED.includes(r) && !FRESH.includes(r))];
  for (const key of NETWORKS) {
    const c = await clientsFor(key, env);
    console.log(`\n${c.chain.name} (chain ${c.chain.id}, via ${c.rpcLabel}${c.refused.length ? `; refused: ${c.refused.join('; ')}` : ''})`);
    if (key === 'sepolia') {
      const { baseFee, tip } = await sepoliaFees(c.publicClient);
      console.log(`base fee ${formatGwei(baseFee)} gwei, suggested tip ${formatGwei(tip)} gwei`);
    }
    for (const role of roles) {
      const address = addresses[role];
      if (!address) {
        console.log(`  ${role.padEnd(18)} (no key)`);
        continue;
      }
      const wei = await c.publicClient.getBalance({ address });
      console.log(`  ${role.padEnd(18)} ${address} ${fmt(wei)} ${c.chain.nativeCurrency.symbol}`);
    }
  }
}

// Test USDT top-ups on Whitechain: an ERC-20 transfer from FUNDER per role (FUNDER pays the WBT gas).
async function fundUsdt(funder, real) {
  const token = config.whitechain.tokens.usdt;
  const c = await clientsFor('whitechain', env);
  console.log(`\nTest USDT ${token.address} on ${c.chain.name} (via ${c.rpcLabel})`);
  const balanceOf = (address) => c.publicClient.readContract({ address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [address] });
  const decimals = await c.publicClient.readContract({ address: token.address, abi: erc20Abi, functionName: 'decimals' });
  if (decimals !== token.decimals) throw new Error(`USDT decimals ${decimals}, the config says ${token.decimals}`);
  const fmtUsdt = (units) => formatUnits(units, decimals);
  let funderUnits = await balanceOf(funder.address);
  const transfers = [];
  for (const [role, target] of Object.entries(PLAN.usdt.whitechain)) {
    const to = addresses[role];
    if (!to) {
      console.log(`  skip ${role}: no key`);
      continue;
    }
    const need = parseUnits(target, decimals) - (await balanceOf(to));
    if (need <= 0n) {
      console.log(`  ${role.padEnd(18)} already holds at least ${target} USDT`);
      continue;
    }
    const gas = await c.publicClient.estimateContractGas({ account: funder.address, address: token.address, abi: erc20Abi, functionName: 'transfer', args: [to, need] });
    transfers.push({ role, to, need, gas });
    console.log(`  ${role.padEnd(18)} ${to} send ${fmtUsdt(need)} USDT (gas estimate ${gas})`);
  }
  const total = transfers.reduce((s, t) => s + t.need, 0n);
  console.log(`  FUNDER holds ${fmtUsdt(funderUnits)} USDT; sends ${fmtUsdt(total)}`);
  if (total > funderUnits) {
    console.log('  STOP: FUNDER holds too little test USDT; nothing sent');
    return;
  }
  if (!real) return;
  const wallet = c.walletClient(funder);
  let nonce = await c.publicClient.getTransactionCount({ address: funder.address, blockTag: 'latest' });
  for (const t of transfers) {
    const hash = await wallet.writeContract({ address: token.address, abi: erc20Abi, functionName: 'transfer', args: [t.to, t.need], gas: (t.gas * 12n) / 10n, nonce });
    const receipt = await c.publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
    if (receipt.status !== 'success') throw new Error(`${t.role}: USDT transfer reverted (${c.explorerTx(hash)})`);
    nonce += 1;
    console.log(`  sent ${fmtUsdt(t.need)} USDT to ${t.role}: ${c.explorerTx(hash)} (gas used ${receipt.gasUsed})`);
  }
  funderUnits = await balanceOf(funder.address);
  console.log(`  FUNDER now ${fmtUsdt(funderUnits)} USDT`);
}

async function fund() {
  const planName = opt('--plan') ?? 'm0';
  const plan = PLAN[planName];
  if (!plan) throw new Error(`unknown plan ${planName}`);
  const real = args.includes('--execute') && args.includes('--real');
  if (args.includes('--execute') !== args.includes('--real')) throw new Error('real sending needs both --execute and --real');
  const only = opt('--network');
  const funderKey = values.get('FUNDER_PRIVATE_KEY');
  if (!funderKey) throw new Error('FUNDER_PRIVATE_KEY is not set');
  const funder = privateKeyToAccount(funderKey);
  console.log(`${real ? 'REAL RUN' : 'dry run'}: plan ${planName}, every transfer from FUNDER ${funder.address}`);
  if (planName === 'usdt') return fundUsdt(funder, real);

  for (const key of NETWORKS.filter((k) => plan[k] && (!only || k === only))) {
    const c = await clientsFor(key, env);
    const symbol = c.chain.nativeCurrency.symbol;
    console.log(`\n${c.chain.name} (chain ${c.chain.id}, via ${c.rpcLabel})`);
    const fees = await c.publicClient.estimateFeesPerGas();
    if (key === 'sepolia') {
      const { baseFee, tip } = await sepoliaFees(c.publicClient);
      console.log(`base fee ${formatGwei(baseFee)} gwei + tip ${formatGwei(tip)} gwei`);
      if (baseFee + tip > parseGwei(PLAN.sepoliaMaxGwei) && real) {
        console.log(`STOP: above ${PLAN.sepoliaMaxGwei} gwei; Sepolia not funded (founder to-do: about 0.1 Sepolia ETH to OPERATOR)`);
        continue;
      }
    }
    let funderBalance = await c.publicClient.getBalance({ address: funder.address });
    const reserve = parseEther(PLAN.funderReserve[key] ?? '0');
    const transfers = [];
    for (const [role, target] of Object.entries(plan[key])) {
      const to = addresses[role];
      if (!to) {
        console.log(`  skip ${role}: no key`);
        continue;
      }
      const have = await c.publicClient.getBalance({ address: to });
      const need = parseEther(target) - have;
      if (need <= 0n) {
        console.log(`  ${role.padEnd(18)} has ${fmt(have)} ${symbol} (target ${target}): nothing to send`);
        continue;
      }
      const gas = await c.publicClient.estimateGas({ account: funder.address, to, value: need });
      const maxFee = gas * fees.maxFeePerGas;
      transfers.push({ role, to, need, gas, maxFee });
      console.log(`  ${role.padEnd(18)} ${to} has ${fmt(have)}, send ${fmt(need)} ${symbol} (gas estimate ${gas}, fee at most ${fmt(maxFee, 9)})`);
    }
    const total = transfers.reduce((s, t) => s + t.need + t.maxFee, 0n);
    console.log(`  FUNDER holds ${fmt(funderBalance)} ${symbol}; sends plus fees ${fmt(total)}; keeps at least ${PLAN.funderReserve[key] ?? '0'}`);
    if (funderBalance - total < reserve) {
      console.log(`  STOP: FUNDER would fall below its reserve on ${c.chain.name}; nothing sent here`);
      continue;
    }
    if (!real) continue;
    const wallet = c.walletClient(funder);
    // The confirmed nonce once, then counted locally after each receipt: a
    // load-balanced RPC can answer a block behind right after a receipt.
    let nonce = await c.publicClient.getTransactionCount({ address: funder.address, blockTag: 'latest' });
    for (const t of transfers) {
      const hash = await wallet.sendTransaction({
        to: t.to,
        value: t.need,
        gas: (t.gas * 12n) / 10n,
        maxFeePerGas: fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        nonce,
      });
      const receipt = await c.publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
      if (receipt.status !== 'success') throw new Error(`${t.role}: transfer reverted (${c.explorerTx(hash)})`);
      nonce += 1;
      console.log(`  sent ${fmt(t.need)} ${symbol} to ${t.role}: ${c.explorerTx(hash)} (gas used ${receipt.gasUsed})`);
    }
    funderBalance = await c.publicClient.getBalance({ address: funder.address });
    console.log(`  FUNDER now ${fmt(funderBalance)} ${symbol}`);
  }
}

await (args.includes('--balances') ? balances() : fund());
