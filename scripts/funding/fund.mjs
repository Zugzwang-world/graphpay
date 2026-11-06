// pnpm funding --balances
// pnpm funding [--plan m0|later|usdt] [--network whitechain|sepolia|rabdi] [--execute --real]
// --balances: every role's balance on all three networks and the Sepolia base fee and tip (read-only).
// Otherwise the plan in plan.json, as a dry run (default) or, with --execute --real, for real. The
// money rules are in logic.mjs. Before any network is read, FUNDER's key must be the configured
// FUNDER and every planned recipient a fresh role's own address (never FUNDER, OPERATOR or a lab
// wallet; no two roles share one), or the whole run stops. Then, per network:
// - FUNDER's nonce and every balance are read at one pinned block; if FUNDER has a transaction
//   pending (perhaps a send whose receipt never came), STOP rather than top anyone up twice;
// - each role is topped up to its target from FUNDER (less than 1% short: nothing sent); gas is
//   estimated (never 21,000 assumed: a Sepolia transfer to a new account costs about 207,000) and
//   sent as the estimate + 20%, and FUNDER's reserve is checked with the fee bound at that limit;
//   Sepolia stops above the plan's sepoliaMaxGwei, in a dry run too;
// - every transaction is signed for the configured chain with explicit nonce, gas and fees, its hash
//   and nonce are logged before its receipt is awaited, and the receipt must be its own (for test
//   USDT, with the exact Transfer log).
// A STOP skips that network; the other networks still run and the process exits 1. Roles without a
// key are skipped.

import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { erc20Abi, formatEther, formatGwei, formatUnits, parseEther, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from '../../packages/config/index.mjs';
import { loadEnv } from '../lib/env-loader.mjs';
import { installErrorBoundary } from '../lib/redact.mjs';
import { clientsFor, NETWORKS } from '../lib/chains.mjs';
import { CARRIED, FRESH, roleAddresses } from '../lib/wallets.mjs';
import {
  assertOwnReceipt,
  assertTransferLog,
  gasAbove,
  identityProblems,
  nativeBudget,
  nonceProblem,
  parseArgs,
  planRoles,
  planTopUps,
  usdtBudget,
  withGas,
} from './logic.mjs';

const PLAN = JSON.parse(readFileSync(new URL('./plan.json', import.meta.url), 'utf8'));
const RECEIPT_TIMEOUT = 180_000;

function fmt(wei, digits = 6) {
  const [i, f = ''] = formatEther(wei).split('.');
  return f ? `${i}.${f.slice(0, digits)}` : i;
}

async function sepoliaFees(publicClient) {
  const block = await publicClient.getBlock();
  const tip = await publicClient.estimateMaxPriorityFeePerGas();
  return { baseFee: block.baseFeePerGas ?? 0n, tip };
}

async function balances(env, addresses) {
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

// Opens one network: pins a block (its number and base fee), the fees every
// transaction is signed with, and FUNDER's nonce at the block and pending. The
// pending nonce is read last, so it also sees anything mined after the pin.
async function pin(c, funder, log) {
  const pc = c.publicClient;
  const blockNumber = await pc.getBlockNumber();
  const block = await pc.getBlock({ blockNumber });
  const fees = await pc.estimateFeesPerGas();
  const confirmed = await pc.getTransactionCount({ address: funder.address, blockNumber });
  const pending = await pc.getTransactionCount({ address: funder.address, blockTag: 'pending' });
  const baseFee = block.baseFeePerGas ?? 0n;
  log(
    `  block ${blockNumber}: base fee ${formatGwei(baseFee)} gwei, signing at max fee ${formatGwei(fees.maxFeePerGas)} gwei, tip ${formatGwei(fees.maxPriorityFeePerGas)} gwei`,
  );
  return { blockNumber, baseFee, fees, confirmed, pending };
}

// The fields every transaction is signed with. Nothing is left for viem to fill
// from the RPC (without chainId, viem 2.57 asks the RPC for eth_fillTransaction).
const signing = (c, p, nonce, gas) => ({
  chainId: c.chain.id,
  nonce,
  gas,
  maxFeePerGas: p.fees.maxFeePerGas,
  maxPriorityFeePerGas: p.fees.maxPriorityFeePerGas,
});

function stopper(log) {
  const stops = [];
  const stop = (why) => {
    log(`  STOP: ${why}`);
    stops.push(why);
    return { stops };
  };
  return { stops, stop };
}

const inFlightStop = (c, funder, why) =>
  `${why}; nothing sent on ${c.chain.name}. Wait until it is mined (check ${c.explorerAddress(funder.address)}), then run again`;

// The native-coin plan on one network. c: clientsFor's clients; targets: { ROLE: amount }.
// Returns { stops }, the reasons this network was not funded.
export async function fundNative({ c, funder, targets, addresses, reserve, maxGwei, real, log = console.log }) {
  const pc = c.publicClient;
  const symbol = c.chain.nativeCurrency.symbol;
  const { stops, stop } = stopper(log);
  log(`\n${c.chain.name} (chain ${c.chain.id}, via ${c.rpcLabel})`);
  const p = await pin(c, funder, log);
  if (c.key === 'sepolia' && gasAbove({ baseFee: p.baseFee, tip: p.fees.maxPriorityFeePerGas, maxGwei })) {
    const outcome = real ? 'Sepolia not funded' : 'a real run would stop here and fund nothing on Sepolia';
    return stop(`base fee + tip is above ${maxGwei} gwei: ${outcome} (founder to-do: about 0.1 Sepolia ETH to OPERATOR)`);
  }
  const inFlight = nonceProblem(p);
  if (inFlight) return stop(inFlightStop(c, funder, inFlight));

  const at = { blockNumber: p.blockNumber };
  const funderBalance = await pc.getBalance({ address: funder.address, ...at });
  const have = new Map();
  for (const role of Object.keys(targets)) {
    if (addresses[role]) have.set(role, await pc.getBalance({ address: addresses[role], ...at }));
  }
  const sends = [];
  for (const row of planTopUps({ targets, addresses, balances: have, parse: parseEther })) {
    if (row.action === 'no-key') {
      log(`  skip ${row.role}: ${row.why}`);
      continue;
    }
    const line = `  ${row.role.padEnd(18)} ${row.to} has ${fmt(row.have)} ${symbol} (target ${formatEther(row.target)})`;
    if (row.action !== 'send') {
      log(`${line}: ${row.action === 'dust' ? 'within 1% of target: ' : ''}nothing to send`);
      continue;
    }
    const estimate = await pc.estimateGas({ account: funder.address, to: row.to, value: row.need });
    const t = withGas(row, estimate, p.fees.maxFeePerGas);
    sends.push(t);
    log(`${line}: send ${fmt(t.need)} (gas estimate ${t.estimate}, limit ${t.gasLimit}, fee at most ${fmt(t.fee, 9)})`);
  }
  const budget = nativeBudget({ balance: funderBalance, transfers: sends, reserve: parseEther(reserve) });
  log(
    `  FUNDER holds ${fmt(funderBalance)} ${symbol}; sends ${fmt(budget.value)} plus fees of at most ${fmt(budget.fees, 9)}; keeps ${fmt(budget.left)} (reserve ${reserve})`,
  );
  if (!budget.ok) return stop(`FUNDER would fall below its ${reserve} ${symbol} reserve; nothing sent on ${c.chain.name}`);
  if (sends.length === 0 || !real) {
    log(sends.length === 0 ? '  nothing to send' : `  dry run: ${sends.length} transfer(s) not sent`);
    return { stops };
  }

  const wallet = c.walletClient(funder);
  let nonce = p.confirmed;
  for (const t of sends) {
    const hash = await wallet.sendTransaction({ ...signing(c, p, nonce, t.gasLimit), to: t.to, value: t.need });
    log(`  ${t.role}: nonce ${nonce}, tx ${hash}; waiting for its receipt (${c.explorerTx(hash)})`);
    const receipt = await pc.waitForTransactionReceipt({ hash, timeout: RECEIPT_TIMEOUT });
    assertOwnReceipt(receipt, hash, `${t.role} (${c.explorerTx(hash)})`);
    nonce += 1;
    log(`  sent ${fmt(t.need)} ${symbol} to ${t.role} (gas used ${receipt.gasUsed})`);
  }
  log(`  FUNDER now ${fmt(await pc.getBalance({ address: funder.address }))} ${symbol}`);
  return { stops };
}

// Test USDT top-ups on Whitechain: an ERC-20 transfer from FUNDER per role; FUNDER
// pays the WBT gas. Returns { stops } like fundNative. maxNeed (optional, role → units): a
// ceiling a caller planned from its own earlier read; a send above it stops the run, so a
// balance that moved in between (or a node that has not seen an earlier transfer) never
// raises the send (scripts/ops/payer-topup.mjs).
export async function fundUsdt({ c, funder, targets, addresses, token, reserve, real, log = console.log, maxNeed = {} }) {
  const pc = c.publicClient;
  const symbol = c.chain.nativeCurrency.symbol;
  const { stops, stop } = stopper(log);
  log(`\nTest USDT ${token.address} on ${c.chain.name} (chain ${c.chain.id}, via ${c.rpcLabel})`);
  const p = await pin(c, funder, log);
  const inFlight = nonceProblem(p);
  if (inFlight) return stop(inFlightStop(c, funder, inFlight));

  const at = { blockNumber: p.blockNumber };
  const decimals = await pc.readContract({ address: token.address, abi: erc20Abi, functionName: 'decimals', ...at });
  if (decimals !== token.decimals) throw new Error(`USDT decimals ${decimals}, the config says ${token.decimals}`);
  const fmtUsdt = (units) => formatUnits(units, decimals);
  const balanceOf = (address, where = at) =>
    pc.readContract({ address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [address], ...where });
  const units = await balanceOf(funder.address);
  const wbt = await pc.getBalance({ address: funder.address, ...at });
  const have = new Map();
  for (const role of Object.keys(targets)) {
    if (addresses[role]) have.set(role, await balanceOf(addresses[role]));
  }
  const sends = [];
  for (const row of planTopUps({ targets, addresses, balances: have, parse: (amount) => parseUnits(amount, decimals) })) {
    if (row.action === 'no-key') {
      log(`  skip ${row.role}: ${row.why}`);
      continue;
    }
    const line = `  ${row.role.padEnd(18)} ${row.to} has ${fmtUsdt(row.have)} USDT (target ${fmtUsdt(row.target)})`;
    if (row.action !== 'send') {
      log(`${line}: ${row.action === 'dust' ? 'within 1% of target: ' : ''}nothing to send`);
      continue;
    }
    if (maxNeed[row.role] !== undefined && row.need > maxNeed[row.role]) return stop(`${row.role} would get ${fmtUsdt(row.need)} USDT, more than the ${fmtUsdt(maxNeed[row.role])} planned (a balance moved since the plan was read); nothing sent`);
    const estimate = await pc.estimateContractGas({
      account: funder.address,
      address: token.address,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [row.to, row.need],
    });
    const t = withGas(row, estimate, p.fees.maxFeePerGas);
    sends.push(t);
    log(`${line}: send ${fmtUsdt(t.need)} (gas estimate ${t.estimate}, limit ${t.gasLimit}, fee at most ${fmt(t.fee, 9)} ${symbol})`);
  }
  const budget = usdtBudget({ units, wbt, transfers: sends, reserve: parseEther(reserve) });
  log(
    `  FUNDER holds ${fmtUsdt(units)} USDT and ${fmt(wbt)} ${symbol}; sends ${fmtUsdt(budget.value)} USDT with fees of at most ${fmt(budget.fees, 9)} ${symbol}; keeps ${fmt(budget.wbtLeft)} ${symbol} (reserve ${reserve})`,
  );
  if (!budget.unitsOk) return stop('FUNDER holds too little test USDT; nothing sent');
  if (!budget.wbtOk) return stop(`FUNDER's ${symbol} would not cover the fees plus its ${reserve} ${symbol} reserve; nothing sent`);
  if (sends.length === 0 || !real) {
    log(sends.length === 0 ? '  nothing to send' : `  dry run: ${sends.length} transfer(s) not sent`);
    return { stops };
  }

  const wallet = c.walletClient(funder);
  let nonce = p.confirmed;
  for (const t of sends) {
    const hash = await wallet.writeContract({
      ...signing(c, p, nonce, t.gasLimit),
      address: token.address,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [t.to, t.need],
    });
    log(`  ${t.role}: nonce ${nonce}, tx ${hash}; waiting for its receipt (${c.explorerTx(hash)})`);
    const receipt = await pc.waitForTransactionReceipt({ hash, timeout: RECEIPT_TIMEOUT });
    const label = `${t.role} (${c.explorerTx(hash)})`;
    assertOwnReceipt(receipt, hash, label);
    assertTransferLog(receipt, { token: token.address, from: funder.address, to: t.to, value: t.need }, label);
    nonce += 1;
    log(`  sent ${fmtUsdt(t.need)} USDT to ${t.role} (gas used ${receipt.gasUsed})`);
  }
  log(`  FUNDER now ${fmtUsdt(await balanceOf(funder.address, {}))} USDT`);
  return { stops };
}

// The plan on each network in turn; connect(key) gives that network's clients. A
// STOP on one network does not keep the others from running. Returns every STOP,
// each prefixed with its network's name.
export async function fundPlan({ planName, networks, funder, addresses, real, connect, log = console.log }) {
  const stops = [];
  for (const key of networks) {
    const reserve = PLAN.funderReserve?.[key];
    if (!reserve) throw new Error(`plan.json has no funderReserve for ${key}`);
    const c = await connect(key);
    const run = { c, funder, addresses, reserve, real, log };
    let result;
    if (planName === 'usdt') {
      if (key !== 'whitechain') throw new Error('test USDT is on Whitechain only');
      result = await fundUsdt({ ...run, targets: PLAN.usdt[key], token: config.whitechain.tokens.usdt });
    } else {
      result = await fundNative({ ...run, targets: PLAN[planName][key], maxGwei: PLAN.sepoliaMaxGwei });
    }
    for (const why of result.stops) stops.push(`${c.chain.name}: ${why}`);
  }
  return stops;
}

async function main(argv) {
  let values;
  installErrorBoundary(() => values);
  const opts = parseArgs(argv, PLAN);
  ({ values } = loadEnv());
  const env = Object.fromEntries(values);
  const addresses = roleAddresses(values);
  if (opts.balances) return balances(env, addresses);

  if (!addresses.FUNDER) throw new Error(`FUNDER_PRIVATE_KEY is ${addresses.FUNDER === null ? 'not a valid key' : 'not set'}`);
  const funder = privateKeyToAccount(values.get('FUNDER_PRIVATE_KEY'));
  const problems = identityProblems({
    funder: funder.address,
    carried: config.wallets.carried,
    labNotUsed: config.wallets.labNotUsed,
    fresh: FRESH,
    roles: planRoles(PLAN),
    addresses,
  });
  if (problems.length > 0) {
    for (const problem of problems) console.log(`STOP: ${problem}`);
    console.log('STOP: the identity checks failed, so no network was read and nothing was sent');
    process.exitCode = 1;
    return;
  }

  console.log(`${opts.real ? 'REAL RUN' : 'dry run'}: plan ${opts.planName} on ${opts.networks.join(', ')}, every transfer from FUNDER ${funder.address}`);
  const stops = await fundPlan({
    planName: opts.planName,
    networks: opts.networks,
    funder,
    addresses,
    real: opts.real,
    connect: (key) => clientsFor(key, env),
  });
  if (stops.length > 0) {
    console.log(`\n${stops.length} STOP(s), so the run exits 1:`);
    for (const why of stops) console.log(`  ${why}`);
    process.exitCode = 1;
  }
}

// Runs only as a script. The tests import fundPlan, fundNative and fundUsdt and
// drive them against a local fake chain, with no .env.
function invokedDirectly() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (invokedDirectly()) await main(process.argv.slice(2));
