// node scripts/whitechain/verify.mjs [--yes]
// Verifies the configured checkout on the Whitechain explorer (Blockscout) with the command of
// planning/SPEC/PAYMENTS_WHITECHAIN.md §7, then reads the explorer API: "verified" (a partial
// match, as the build carries no metadata hash) is the expected result. Dry run: prints the
// command and the current state. The public RPC is used, so no secret reaches a command line.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { encodeAbiParameters } from 'viem';
import { network } from '../../packages/config/index.mjs';
import { configuredCheckout, context, permit2, usdt } from './lib.mjs';

const CONTRACTS_DIR = fileURLToPath(new URL('../../packages/contracts/', import.meta.url));

const ctx = await context(process.argv.slice(2));
if (ctx.fork) throw new Error('verification is for the real chain only');
const checkout = configuredCheckout();
if (!checkout) throw new Error('no whitechain.contracts.checkout in the config: deploy first');

const wc = network('whitechain');
const publicRpc = wc.publicRpcs.find((r) => r.label === 'Whitechain public') ?? wc.publicRpcs.at(-1);
// The constructor arguments exactly as deploy-checkout passed them.
const admin = ctx.account('DEPLOYER').address;
const relayer = ctx.account('FACILITATOR').address;
const policyWriter = ctx.account('POLICY_WRITER').address;
const constructorArgs = encodeAbiParameters(
  [{ type: 'address' }, { type: 'address' }, { type: 'address' }, { type: 'address' }, { type: 'address' }],
  [usdt().address, permit2(), admin, relayer, policyWriter],
);
const argv = [
  'verify-contract', checkout.address, 'src/GraphPayCheckout.sol:GraphPayCheckout',
  '--rpc-url', publicRpc.url,
  '--verifier', 'blockscout', '--verifier-url', wc.explorerApi,
  '--compiler-version', '0.8.30', '--evm-version', 'prague', '--num-of-optimizations', '200', '--via-ir',
  '--constructor-args', constructorArgs, '--watch',
];

async function explorerState() {
  const res = await fetch(`${wc.explorer}/api/v2/smart-contracts/${checkout.address}`, { redirect: 'error' });
  if (!res.ok) return { status: res.status };
  const body = await res.json();
  return { status: res.status, is_verified: body.is_verified, is_fully_verified: body.is_fully_verified, name: body.name };
}

console.log(`checkout ${checkout.address}; explorer before: ${JSON.stringify(await explorerState())}`);
console.log(`  forge ${argv.join(' ')}`);
if (!ctx.send) process.exit(0);

execFileSync('forge', argv, { cwd: CONTRACTS_DIR, stdio: 'inherit' });
const after = await explorerState();
console.log(`explorer after: ${JSON.stringify(after)}`);
if (after.is_verified !== true) throw new Error('the explorer does not show the checkout as verified yet; rerun to check');
console.log(`verified: ${wc.explorer}/address/${checkout.address}?tab=contract`);
