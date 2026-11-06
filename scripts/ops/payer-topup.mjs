// node scripts/ops/payer-topup.mjs --from <shop|funder> [--target <USDT>] [--execute --real]
// Keeps the payer agent's wallet funded tonight (the W5 Ops brief: "from FUNDER and from the
// shop's takings"). One source per run, so no run reads a balance its own earlier send moved:
// - --from shop: the good shop's takings, above its refund float (MERCHANT_FLOAT_MICRO, 20 test
//   USDT), keeping 0.03 WBT for the gas of its dispatches and refunds;
// - --from funder: FUNDER's test USDT above 20 (kept for disposable agents and other top-ups),
//   keeping the funding plan's WBT reserve.
// Run --from shop first, then --from funder if the payer is still short of --target (default:
// the funding plan's PAYER target).
// Before anything is sent:
// - every flag is parsed, and --target is at most 200;
// - scripts/funding's identity checks pass: FUNDER is the configured FUNDER, and the payer and
//   the shop are fresh roles with their own addresses;
// - the payer's wallet is the one the checkout's policy binds to the payer agent's node;
// - neither sender has a transaction in flight (a pending nonce): a re-run while an earlier send
//   is unconfirmed would pay twice.
// The transfer is scripts/funding's fundUsdt:
// - the chain id is checked;
// - the source's nonce is pinned;
// - gas is estimated;
// - the receipt and its exact Transfer log are checked.
// A payment the payer makes between this script's read and fundUsdt's own pinned read raises the
// send by that payment, at most one order; the floors leave room for it.
// A dry run unless both --execute and --real. Prints roles, addresses, amounts and hashes only.

import { readFileSync } from 'node:fs';
import { erc20Abi, formatUnits, namehash, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { activeCast, castEntries, config } from '../../packages/config/index.mjs';
import { checkoutAbi } from '../../packages/contracts/index.mjs';
import { fundUsdt } from '../funding/fund.mjs';
import { identityProblems } from '../funding/logic.mjs';
import { clientsFor } from '../lib/chains.mjs';
import { loadEnv } from '../lib/env-loader.mjs';
import { installErrorBoundary } from '../lib/redact.mjs';
import { FRESH, roleAddresses } from '../lib/wallets.mjs';
import { MERCHANT_FLOAT_MICRO } from '../whitechain/plan.mjs';

const PLAN = JSON.parse(readFileSync(new URL('../funding/plan.json', import.meta.url), 'utf8'));
const MAX_TARGET = 200;
const FUNDER_KEEP = '20';
const SHOP_RESERVE_WBT = '0.03';

// Every flag first, before .env or any network is touched. A value is never echoed.
export function parseFlags(argv) {
  const out = { from: null, target: PLAN.usdt.whitechain.PAYER, execute: false, real: false };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (seen.has(flag)) throw new Error('a flag is given twice');
    seen.add(flag);
    if (flag === '--execute') out.execute = true;
    else if (flag === '--real') out.real = true;
    else if (flag === '--from' || flag === '--target') {
      const value = argv[++i];
      if (value === undefined) throw new Error(`${flag} needs a value`);
      if (flag === '--from') {
        if (value !== 'shop' && value !== 'funder') throw new Error('--from takes shop or funder');
        out.from = value;
      } else {
        if (!/^\d{1,3}(\.\d{1,6})?$/.test(value) || Number(value) <= 0 || Number(value) > MAX_TARGET) throw new Error(`--target takes an amount of test USDT above 0 and at most ${MAX_TARGET}`);
        out.target = value;
      }
    } else throw new Error('unknown argument; use --from <shop|funder> [--target <USDT>] [--execute --real]');
  }
  if (!out.from) throw new Error('say where the test USDT comes from: --from shop or --from funder');
  if (out.execute !== out.real) throw new Error('a real run takes both --execute and --real');
  return out;
}

let values = new Map();
installErrorBoundary(() => values);

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const real = flags.execute && flags.real;
  ({ values } = loadEnv());
  const env = Object.fromEntries(values);
  const addresses = roleAddresses(values);
  const entries = castEntries(activeCast());
  const payer = entries.find((e) => e.kind === 'buyer-agent' && e.key === 'payer');
  const shop = entries.find((e) => e.kind === 'shop' && e.storyRole === 'good');
  if (!payer?.walletRole || !shop?.walletRole) throw new Error('the story has no payer agent or no good shop with a wallet role');
  const role = { payer: payer.walletRole, shop: shop.walletRole };
  if (!addresses.FUNDER || !addresses[role.payer] || !addresses[role.shop]) throw new Error('FUNDER, the payer or the shop has no valid key in .env');
  const problems = identityProblems({ funder: addresses.FUNDER, carried: config.wallets.carried, labNotUsed: config.wallets.labNotUsed, fresh: FRESH, roles: [role.payer, role.shop], addresses });
  if (problems.length > 0) {
    for (const p of problems) console.log(`STOP: ${p}`);
    process.exitCode = 1;
    return;
  }

  const c = await clientsFor('whitechain', env);
  const pc = c.publicClient;
  const token = config.whitechain.tokens.usdt;
  const checkout = config.whitechain.contracts.checkout.address;
  const decimals = await pc.readContract({ address: token.address, abi: erc20Abi, functionName: 'decimals' });
  if (decimals !== token.decimals) throw new Error(`USDT decimals ${decimals}, the config says ${token.decimals}`);
  const fmt = (u) => formatUnits(u, decimals);
  const balance = (r) => pc.readContract({ address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [addresses[r]] });

  // The payer's wallet is the one the checkout pays from for the payer agent.
  const policy = await pc.readContract({ address: checkout, abi: checkoutAbi, functionName: 'policies', args: [namehash(payer.ensName)] });
  if (String(policy.wallet).toLowerCase() !== addresses[role.payer].toLowerCase()) throw new Error(`${role.payer} is not the wallet the checkout's policy binds to ${payer.ensName}`);

  // Neither sender may have a transaction in flight.
  for (const r of [role.shop, 'FUNDER']) {
    const [latest, pending] = await Promise.all([pc.getTransactionCount({ address: addresses[r], blockTag: 'latest' }), pc.getTransactionCount({ address: addresses[r], blockTag: 'pending' })]);
    if (pending !== latest) {
      console.log(`STOP: ${r} has a transaction in flight (nonce ${latest} confirmed, ${pending} pending); nothing sent`);
      process.exitCode = 1;
      return;
    }
  }

  const source = flags.from === 'shop' ? { role: role.shop, keep: MERCHANT_FLOAT_MICRO, reserve: SHOP_RESERVE_WBT } : { role: 'FUNDER', keep: parseUnits(FUNDER_KEEP, decimals), reserve: PLAN.funderReserve.whitechain };
  const target = parseUnits(flags.target, decimals);
  const [have, sourceHas] = await Promise.all([balance(role.payer), balance(source.role)]);
  console.log(`${real ? 'REAL RUN' : 'dry run'}: ${role.payer} (${payer.ensName}) has ${fmt(have)} test USDT, target ${fmt(target)}; from ${source.role}${source.role === role.shop ? ` (${shop.ensName}'s takings)` : ''}, which has ${fmt(sourceHas)} and keeps ${fmt(source.keep)}`);
  if (have >= target) return console.log('nothing to send: the payer is at its target');
  const spare = sourceHas > source.keep ? sourceHas - source.keep : 0n;
  const amount = target - have < spare ? target - have : spare;
  if (amount <= 0n) return console.log(`nothing to send: ${source.role} has nothing above what it keeps`);

  // fundUsdt's log and stops speak of "FUNDER" as the sender; here the sender is source.role.
  const relabel = (s) => s.replace(/FUNDER/g, source.role);
  const { stops } = await fundUsdt({ c, funder: privateKeyToAccount(values.get(`${source.role}_PRIVATE_KEY`)), targets: { [role.payer]: fmt(have + amount) }, addresses, token, reserve: source.reserve, real, log: (line) => console.log(relabel(line)) });
  if (stops.length > 0) {
    for (const why of stops) console.log(`STOP: ${relabel(why)}`);
    process.exitCode = 1;
    return;
  }
  if (real) console.log(`${role.payer} now has ${fmt(await balance(role.payer))} test USDT`);
}

const invoked = process.argv[1] && new URL(import.meta.url).pathname === (await import('node:fs')).realpathSync(process.argv[1]);
if (invoked) await main();
