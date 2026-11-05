// node scripts/whitechain/setup.mjs [--fork <anvil url>] [--checkout <address, fork only>] [--yes]
// Sets the deployed checkout up (planning/PROMPTS/02-deploy-verify.md, setup), each step only if
// the chain does not already show it:
// 1. the admin (DEPLOYER) grants RENEWER as a second relayer (E-1);
// 2. each cast shop's merchant wallet approves a bounded refund float for the checkout;
// 3. the policy writer creates one policy per paying agent, from the story config (plan.mjs),
//    each on its own wallet; a wallet bound to another node stops that agent's step.
// Dry run by default: prints what it would send.

import { erc20Abi, formatUnits, isAddressEqual } from 'viem';
import { checkoutAbi } from '../../packages/contracts/index.mjs';
import { roleAddresses } from '../lib/wallets.mjs';
import { configuredCheckout, context, hasKey, option, sendTx, usdt } from './lib.mjs';
import { merchantPlan, policyAction, policyPlan } from './plan.mjs';

const argv = process.argv.slice(2);
const ctx = await context(argv);
const { publicClient } = ctx;
const forkCheckout = option(argv, '--checkout');
if (forkCheckout && !ctx.fork) throw new Error('--checkout is for a fork only; the real address comes from the config');
const address = forkCheckout ?? configuredCheckout()?.address;
if (!address) throw new Error('no whitechain.contracts.checkout in the config: deploy first');
const checkout = { address, abi: checkoutAbi };
const read = (functionName, args = []) => publicClient.readContract({ ...checkout, functionName, args });
let problems = 0;

// 1. RENEWER as a second relayer.
const renewer = ctx.account('RENEWER').address;
if (await read('isRelayer', [renewer])) {
  console.log('1. RENEWER is a relayer already');
} else {
  console.log(`1. grant RENEWER ${renewer} as a relayer (admin DEPLOYER)`);
  if (ctx.send) await sendTx(ctx, { role: 'DEPLOYER', label: 'setRelayer RENEWER', request: { ...checkout, functionName: 'setRelayer', args: [renewer, true] } });
}

// 2. Merchant refund floats.
const token = usdt();
for (const m of merchantPlan()) {
  if (!hasKey(ctx.env, m.walletRole)) {
    console.log(`2. ${m.shop}: no key for ${m.walletRole}, skipped`);
    continue;
  }
  const merchant = ctx.account(m.walletRole).address;
  const allowance = await publicClient.readContract({ address: token.address, abi: erc20Abi, functionName: 'allowance', args: [merchant, address] });
  if (allowance >= m.floatMicro) {
    console.log(`2. ${m.shop}: float ${formatUnits(allowance, token.decimals)} approved already`);
    continue;
  }
  console.log(`2. ${m.shop}: ${m.walletRole} approves a ${formatUnits(m.floatMicro, token.decimals)} ${token.symbol} refund float`);
  if (ctx.send) {
    await sendTx(ctx, { role: m.walletRole, label: `approve refund float ${m.shop}`, request: { address: token.address, abi: erc20Abi, functionName: 'approve', args: [address, m.floatMicro] } });
  }
}

// 3. Agent policies.
const block = await publicClient.getBlock();
const plan = policyPlan({ roles: roleAddresses(Object.entries(ctx.env)), now: Number(block.timestamp) });
for (const p of plan) {
  const [onChain, bound] = await Promise.all([read('policies', [p.node]), read('nodeOfWallet', [p.wallet])]);
  const step = policyAction(p, onChain, bound);
  const cap = `${formatUnits(p.capMicro, token.decimals)}/day`;
  if (step.action === 'skip') {
    console.log(`3. ${p.ensName} → ${p.walletRole} (${cap}) set already`);
    continue;
  }
  if (step.action === 'stop') {
    console.log(`3. STOP ${p.ensName} → ${p.walletRole}: ${step.why}`);
    problems++;
    continue;
  }
  if (!isAddressEqual(onChain.wallet, p.wallet) && onChain.wallet !== '0x0000000000000000000000000000000000000000') {
    console.log(`   note: ${p.ensName} moves from wallet ${onChain.wallet} to ${p.walletRole}`);
  }
  console.log(`3. ${step.action} policy ${p.ensName} → ${p.walletRole} ${p.wallet}, epoch ${p.epoch}, cap ${cap}, expiry ${step.expiry}`);
  if (ctx.send) {
    await sendTx(ctx, {
      role: 'POLICY_WRITER',
      label: `setPolicy ${p.ensName}`,
      request: { ...checkout, functionName: 'setPolicy', args: [p.node, p.epoch, p.wallet, false, p.capMicro, step.expiry] },
    });
  }
}
if (problems) {
  console.log(`setup: ${problems} step(s) stopped`);
  process.exitCode = 1;
}
