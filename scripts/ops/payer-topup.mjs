// node scripts/ops/payer-topup.mjs [--target <USDT>] [--shop-floor <USDT>] [--funder-floor <USDT>] [--execute --real]
// Keeps the payer agent's wallet funded tonight (the W5 Ops brief: "from FUNDER and from the
// shop's takings"). It tops the payer's wallet up to --target test USDT (default 125, the plan's
// target): first from the good shop's takings (its merchant wallet keeps --shop-floor, default
// 20), then from FUNDER (which keeps --funder-floor, default 20, for disposable agents and other
// top-ups). The roles come from the story (the payer agent's and the good shop's wallet roles),
// never typed here, and the only recipient is the payer's wallet. Every transfer is
// scripts/funding's fundUsdt:
// - the chain id is checked;
// - the source's nonce is pinned, and a pending transaction stops it;
// - gas is estimated;
// - the receipt and its exact Transfer log are checked.
// A dry run by default; for real with --execute --real. Prints roles, addresses, amounts and
// transaction hashes only.

import { erc20Abi, formatUnits, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { activeCast, castEntries, config } from '../../packages/config/index.mjs';
import { fundUsdt } from '../funding/fund.mjs';
import { clientsFor } from '../lib/chains.mjs';
import { loadEnv } from '../lib/env-loader.mjs';
import { installErrorBoundary } from '../lib/redact.mjs';
import { roleAddresses } from '../lib/wallets.mjs';

const argv = process.argv.slice(2);
const KNOWN = ['--target', '--shop-floor', '--funder-floor', '--execute', '--real'];
for (const a of argv) if (a.startsWith('--') && !KNOWN.includes(a)) throw new Error(`unknown flag; use ${KNOWN.join(' ')}`);
const arg = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const amount = (name, fallback) => {
  const v = arg(name, fallback);
  if (!/^\d{1,6}(\.\d{1,6})?$/.test(String(v))) throw new Error(`${name} takes an amount of test USDT, like 125 or 20.5`);
  return v;
};
if (argv.includes('--execute') !== argv.includes('--real')) throw new Error('a real run takes both --execute and --real');
const real = argv.includes('--execute') && argv.includes('--real');

// The WBT each source keeps: the shop pays the gas of its dispatches and refunds; FUNDER keeps
// the funding plan's reserve.
const RESERVE_WBT = { shop: '0.03', funder: '0.2' };

let values = new Map();
installErrorBoundary(() => values);

async function main() {
  ({ values } = loadEnv());
  const env = Object.fromEntries(values);
  const addresses = roleAddresses(values);
  const entries = castEntries(activeCast());
  const payer = entries.find((e) => e.kind === 'buyer-agent' && e.key === 'payer');
  const shop = entries.find((e) => e.kind === 'shop' && e.storyRole === 'good');
  if (!payer?.walletRole || !shop?.walletRole) throw new Error('the story has no payer agent or no good shop with a wallet role');
  const roles = { payer: payer.walletRole, shop: shop.walletRole, funder: 'FUNDER' };
  for (const role of Object.values(roles)) if (!addresses[role]) throw new Error(`${role}: no valid key in .env`);
  if (new Set(Object.values(roles).map((r) => addresses[r].toLowerCase())).size !== 3) throw new Error('the payer, the shop and FUNDER must be three different wallets');
  if (addresses.FUNDER.toLowerCase() !== config.wallets.carried.FUNDER.toLowerCase()) throw new Error("FUNDER's key is not the configured FUNDER");

  const c = await clientsFor('whitechain', env);
  const token = config.whitechain.tokens.usdt;
  const decimals = await c.publicClient.readContract({ address: token.address, abi: erc20Abi, functionName: 'decimals' });
  if (decimals !== token.decimals) throw new Error(`USDT decimals ${decimals}, the config says ${token.decimals}`);
  const units = (v) => parseUnits(String(v), decimals);
  const fmt = (u) => formatUnits(u, decimals);
  const balance = (role) => c.publicClient.readContract({ address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [addresses[role]] });

  const target = units(amount('--target', '125'));
  const shopFloor = units(amount('--shop-floor', '20'));
  const funderFloor = units(amount('--funder-floor', '20'));
  const [have, shopHas, funderHas] = await Promise.all([balance(roles.payer), balance(roles.shop), balance(roles.funder)]);
  console.log(`${real ? 'REAL RUN' : 'dry run'}: ${roles.payer} (${payer.ensName}) has ${fmt(have)} test USDT, target ${fmt(target)}; ${roles.shop} (${shop.ensName}'s takings) has ${fmt(shopHas)}, keeps ${fmt(shopFloor)}; FUNDER has ${fmt(funderHas)}, keeps ${fmt(funderFloor)}`);
  if (have >= target) return console.log('nothing to send');

  const stops = [];
  const min = (a, b) => (a < b ? a : b);
  const fromShop = shopHas > shopFloor ? min(target - have, shopHas - shopFloor) : 0n;
  if (fromShop > 0n) {
    // fundUsdt tops a role up to a target from one source: the shop's part is the target it can reach.
    const relabel = (line) => console.log(line.replace(/FUNDER/g, roles.shop));
    const r = await fundUsdt({ c, funder: privateKeyToAccount(values.get(`${roles.shop}_PRIVATE_KEY`)), targets: { [roles.payer]: fmt(have + fromShop) }, addresses, token, reserve: RESERVE_WBT.shop, real, log: relabel });
    stops.push(...r.stops);
  }
  const after = real ? await balance(roles.payer) : have + fromShop;
  const rest = target > after ? target - after : 0n;
  const fromFunder = rest > 0n && funderHas > funderFloor ? min(rest, funderHas - funderFloor) : 0n;
  if (fromFunder > 0n && stops.length === 0) {
    const r = await fundUsdt({ c, funder: privateKeyToAccount(values.get('FUNDER_PRIVATE_KEY')), targets: { [roles.payer]: fmt(after + fromFunder) }, addresses, token, reserve: RESERVE_WBT.funder, real });
    stops.push(...r.stops);
  }
  console.log(`plan: ${fmt(fromShop)} from ${roles.shop}, ${fmt(fromFunder)} from FUNDER${rest > fromFunder ? `; ${fmt(rest - fromFunder)} short of the target` : ''}`);
  if (stops.length > 0) {
    for (const why of stops) console.log(`STOP: ${why}`);
    process.exitCode = 1;
  }
}

await main();
