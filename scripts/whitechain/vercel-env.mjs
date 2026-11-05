// node scripts/whitechain/vercel-env.mjs [--dry-run]
// M4: the hosted payment routes' environment on the pinned Vercel project (config site.vercel),
// production only. Checks first, on the real chain (read-only): FACILITATOR and RENEWER are
// relayers on the checkout and neither is its admin; every shop key is that shop's ENS payee is
// left to the shop's own start-up (the payee check runs on every 402). Then every name goes to
// Vercel as a Sensitive value through `pnpm -s secrets:vercel` (stdin, never the command line,
// never printed). Public values are not set: the routes derive their URLs from the config's
// production domain and the merchant lists from the shop keys (apps/web/lib/payments.server.ts).
// Deploys come from origin/main through the Git integration; this script never deploys.

import { spawnSync } from 'node:child_process';
import { isAddressEqual } from 'viem';
import { story } from '../../packages/config/index.mjs';
import { checkoutAbi } from '../../packages/contracts/index.mjs';
import { configuredCheckout, context, flag } from './lib.mjs';

const argv = process.argv.slice(2);
for (const a of argv) if (a !== '--dry-run') throw new Error('usage: vercel-env.mjs [--dry-run]');
const ctx = await context([]); // read-only: no --yes, nothing is sent on-chain
const checkout = configuredCheckout().address;
const read = (functionName, args = []) => ctx.publicClient.readContract({ address: checkout, abi: checkoutAbi, functionName, args });
const owner = await read('owner');
if (isAddressEqual(ctx.account('FACILITATOR').address, ctx.account('RENEWER').address)) throw new Error('FACILITATOR and RENEWER must be different keys (E-1)');
for (const role of ['FACILITATOR', 'RENEWER']) {
  const { address } = ctx.account(role);
  if (!(await read('isRelayer', [address]))) throw new Error(`${role} is not a relayer on the checkout`);
  if (isAddressEqual(owner, address)) throw new Error(`${role} is the checkout admin: refused`);
  console.log(`  ok ${role} ${address} is a relayer, not the admin`);
}

const shopKeys = [...new Set(story.shops.map((s) => `${s.walletRole}_PRIVATE_KEY`))];
const NAMES = [
  'ALLOW_REAL_NETWORK', // the hosted rule (SPEC §8); `1` in .env
  'WHITECHAIN_RPC_URL',
  'FACILITATOR_PRIVATE_KEY',
  'FACILITATOR_AUTH_TOKEN',
  'DEMO_PASSCODE',
  'W_SYNC_PRIVATE_KEY',
  'ARKIV_ACCESS_KEY',
  'RECORDER_TOKEN',
  'RENEWER_PRIVATE_KEY',
  'CRON_SECRET',
  ...shopKeys, // E-3: markDelivered after a payment and the passcode-gated merchant routes
];
const missing = NAMES.filter((n) => !ctx.env[n]);
if (missing.length) throw new Error(`not set in .env: ${missing.join(', ')}`);
if (ctx.env.ALLOW_REAL_NETWORK !== '1') throw new Error('ALLOW_REAL_NETWORK must be 1 in .env for the hosted routes');

const push = new URL('../secrets/vercel-push.mjs', import.meta.url).pathname;
const res = spawnSync(process.execPath, [push, ...NAMES, ...(flag(argv, '--dry-run') ? ['--dry-run'] : [])], { stdio: 'inherit' });
process.exitCode = res.status ?? 1;
