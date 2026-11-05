// The funding script's money rules (scripts/funding/fund.mjs does the reading and
// sending). Nothing here does I/O or sees a key: amounts are bigints in the
// smallest unit, addresses are public 0x strings, and every check either returns
// what it found or throws with role names and public values only.

import { erc20Abi, parseEventLogs, parseGwei } from 'viem';
import { NETWORKS } from '../lib/chains.mjs';

export const PLANS = ['m0', 'later', 'usdt'];
const FLAGS = ['--balances', '--plan', '--network', '--execute', '--real'];

// Hex values (addresses, hashes) compared ignoring case.
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();

// A command-line value is echoed only when it is a plain word, so a key pasted in
// the wrong place never reaches the terminal.
// Only short words are echoed (a typo such as --netwrok or a plan key); anything
// longer or with digits might be a secret pasted by mistake (generated secrets are 24+ characters).
const shown = (value) => (/^-{0,2}[a-z][A-Za-z-]{0,15}$/.test(String(value)) ? value : 'that value');

// The networks a plan funds, in NETWORKS order.
export function planNetworks(plan, planName) {
  const section = plan[planName] ?? {};
  return NETWORKS.filter((key) => section[key] !== null && typeof section[key] === 'object');
}

// Every role any plan funds: the identity checks cover them all, whichever plan runs.
export function planRoles(plan) {
  const roles = new Set();
  for (const name of PLANS) {
    for (const key of planNetworks(plan, name)) for (const role of Object.keys(plan[name][key])) roles.add(role);
  }
  return [...roles];
}

// The command line, or an error: an unknown argument, plan or network is refused
// (a typo must never widen a real run), and real sending needs both flags.
export function parseArgs(argv, plan) {
  const opts = { balances: false, planName: 'm0', network: undefined, execute: false, real: false };
  const seen = new Set();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!FLAGS.includes(arg)) throw new Error(`unknown argument ${shown(arg)} (${FLAGS.join(', ')})`);
    if (seen.has(arg)) throw new Error(`${arg} given twice`);
    seen.add(arg);
    if (arg === '--plan' || arg === '--network') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('-')) throw new Error(`${arg} needs a value`);
      opts[arg === '--plan' ? 'planName' : 'network'] = value;
      i += 1;
    } else {
      opts[arg.slice(2)] = true;
    }
  }
  if (opts.execute !== opts.real) throw new Error('real sending needs both --execute and --real');
  if (opts.balances) {
    if (seen.size > 1) throw new Error('--balances is read-only and takes no other argument');
    return { ...opts, networks: [...NETWORKS] };
  }
  if (!PLANS.includes(opts.planName)) throw new Error(`unknown plan ${shown(opts.planName)} (${PLANS.join(', ')})`);
  const networks = planNetworks(plan, opts.planName);
  if (opts.network === undefined) return { ...opts, networks };
  if (!NETWORKS.includes(opts.network)) throw new Error(`unknown network ${shown(opts.network)} (${NETWORKS.join(', ')})`);
  if (!networks.includes(opts.network)) {
    throw new Error(`plan ${opts.planName} funds nothing on ${opts.network} (only ${networks.join(', ')})`);
  }
  return { ...opts, networks: [opts.network] };
}

// Checked before any network is read: FUNDER's key is the carried-over FUNDER, and
// every role a plan funds is a fresh role with its own address, never FUNDER's,
// OPERATOR's (the configured one or the key's) or a lab wallet's, and never
// another plan role's. Roles without a key are skipped later, so they pass here.
export function identityProblems({ funder, carried, labNotUsed, fresh, roles, addresses }) {
  const problems = [];
  if (!same(funder, carried.FUNDER)) problems.push(`FUNDER_PRIVATE_KEY gives ${funder}, not the configured FUNDER ${carried.FUNDER}`);
  const taken = new Map();
  for (const address of labNotUsed) taken.set(address.toLowerCase(), 'a lab wallet (wallets.labNotUsed)');
  for (const [role, address] of Object.entries(carried)) {
    taken.set(address.toLowerCase(), role);
    if (addresses[role]) taken.set(addresses[role].toLowerCase(), role);
  }
  const freshRoles = new Set(fresh);
  const seen = new Map();
  for (const role of roles) {
    if (!freshRoles.has(role)) {
      problems.push(`${role} is in the plan but is not a fresh role in the config`);
      continue;
    }
    const address = addresses[role];
    if (!address) continue;
    const key = address.toLowerCase();
    if (taken.has(key)) problems.push(`${role} has the address of ${taken.get(key)} (${address})`);
    if (seen.has(key)) problems.push(`${seen.get(key)} and ${role} have the same address (${address})`);
    else seen.set(key, role);
  }
  return problems;
}

// One role's top-up: what it lacks below its target, and whether that is sent.
// A shortfall under 1% of the target is dust, not worth a transaction.
export function topUp(target, have) {
  const need = target - have;
  if (need <= 0n) return { need: 0n, action: 'at-target' };
  if (need * 100n < target) return { need, action: 'dust' };
  return { need, action: 'send' };
}

// The plan's targets for one network as rows: { role, to, target, have, need, action }.
// balances: Map role → balance at the pinned block; parse: decimal string → bigint.
export function planTopUps({ targets, addresses, balances, parse }) {
  return Object.entries(targets).map(([role, amount]) => {
    const to = addresses[role];
    if (!to) return { role, action: 'no-key', why: to === null ? 'not a valid key' : 'no key' };
    const have = balances.get(role);
    if (typeof have !== 'bigint') throw new Error(`${role}: no balance was read`);
    const target = parse(amount);
    return { role, to, target, have, ...topUp(target, have) };
  });
}

// The gas limit every transaction is sent with: the RPC's estimate plus 20%, rounded up.
export function gasLimitFor(estimate) {
  return (estimate * 12n + 9n) / 10n;
}

// The most a transaction can pay for gas: the gas limit it is sent with at the max
// fee per gas it is signed with. (Whitechain's OP-stack L1 data fee, under 3e-13 WBT
// a transaction, is left to the reserve.)
export function feeBound(gasLimit, maxFeePerGas) {
  return gasLimit * maxFeePerGas;
}

export function withGas(transfer, estimate, maxFeePerGas) {
  const gasLimit = gasLimitFor(estimate);
  return { ...transfer, estimate, gasLimit, fee: feeBound(gasLimit, maxFeePerGas) };
}

const total = (transfers, field) => transfers.reduce((sum, t) => sum + t[field], 0n);

// Native coin: FUNDER pays every top-up and every fee bound and keeps its reserve.
export function nativeBudget({ balance, transfers, reserve }) {
  const value = total(transfers, 'need');
  const fees = total(transfers, 'fee');
  const left = balance - value - fees;
  return { value, fees, left, ok: left >= reserve };
}

// Test USDT: FUNDER's USDT covers the top-ups, and its WBT covers every fee bound
// plus the WBT reserve.
export function usdtBudget({ units, wbt, transfers, reserve }) {
  const value = total(transfers, 'need');
  const fees = total(transfers, 'fee');
  const wbtLeft = wbt - fees;
  return { value, fees, wbtLeft, unitsOk: value <= units, wbtOk: wbtLeft >= reserve };
}

// planning/WALLETS.md §3: above this, Sepolia is not funded.
export function gasAbove({ baseFee, tip, maxGwei }) {
  return baseFee + tip > parseGwei(maxGwei);
}

// FUNDER's nonce at the pinned block against its pending nonce. Equal: nothing in
// flight. Pending ahead: a transaction this run cannot see in its balances (an
// earlier send whose receipt never came, or one mined after the pin), so sending
// now could top a role up twice. Pending behind: the RPC answered from behind the
// pin, so its view is not trusted either.
export function nonceProblem({ confirmed, pending }) {
  if (pending === confirmed) return null;
  if (pending > confirmed) {
    return `FUNDER has a transaction in flight (nonce ${confirmed} at the pinned block, ${pending} pending)`;
  }
  return `the RPC answered from behind the pinned block (pending nonce ${pending}, ${confirmed} at the block)`;
}

// waitForTransactionReceipt can return the receipt of another transaction with the
// same nonce (a replacement), so only a receipt for this hash counts.
export function assertOwnReceipt(receipt, hash, label) {
  if (!same(receipt?.transactionHash, hash)) {
    throw new Error(`${label}: the receipt is for ${receipt?.transactionHash ?? 'no transaction'}, not ${hash} (replaced?)`);
  }
  if (receipt.status !== 'success') throw new Error(`${label}: ${hash} reverted`);
}

// An ERC-20 transfer counts only if the token logged exactly one Transfer, from
// FUNDER to the recipient for exactly the amount.
export function assertTransferLog(receipt, { token, from, to, value }, label) {
  const logs = parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: receipt?.logs ?? [] }).filter((log) =>
    same(log.address, token),
  );
  const [log] = logs;
  if (logs.length !== 1 || !same(log.args.from, from) || !same(log.args.to, to) || log.args.value !== value) {
    throw new Error(
      `${label}: no single Transfer log from FUNDER to ${to} for exactly ${value} units (the token logged ${logs.length} Transfer(s))`,
    );
  }
}
