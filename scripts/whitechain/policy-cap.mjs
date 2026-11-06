// node scripts/whitechain/policy-cap.mjs <agent key> [--fork <url>] [--yes]
// One setPolicy as POLICY_WRITER: the agent's daily cap from the story config; the epoch, wallet,
// expiry and revocation stay exactly as on-chain (a revoked policy is never lifted here). For a cap
// change between full setup runs (setup.mjs would also touch floats and other agents' policies).

import { namehash } from 'viem';
import { castEntries } from '../../packages/config/index.mjs';
import { checkoutAbi } from '../../packages/contracts/index.mjs';
import { configuredCheckout, context, sendTx } from './lib.mjs';

const key = process.argv[2];
const ctx = await context(process.argv.slice(3));
const payer = castEntries().find((e) => e.key === key && e.capMicro !== undefined);
if (!payer) throw new Error(`usage: policy-cap.mjs <agent key>; no paying agent ${key} in the story`);
const node = namehash(payer.ensName);
const checkout = configuredCheckout().address;
const p = await ctx.publicClient.readContract({ address: checkout, abi: checkoutAbi, functionName: 'policies', args: [node] });
const wallet = ctx.account(payer.walletRole).address;
console.log(`now: ${payer.ensName} epoch ${p.epoch}, wallet ${p.wallet}, revoked ${p.revoked}, cap ${p.dailyCapMicro}, expiry ${p.expiry}`);
if (p.wallet.toLowerCase() !== wallet.toLowerCase()) throw new Error('the policy is not bound to the payer wallet');
if (p.revoked) throw new Error('the payer policy is revoked; not lifting it here');
const cap = BigInt(payer.capMicro);
console.log(`next: cap ${cap} (story), all else unchanged`);
if (BigInt(p.dailyCapMicro) === cap) { console.log('already set'); process.exit(0); }
if (!ctx.send) { console.log('dry run: add --yes'); process.exit(0); }
const r = await sendTx(ctx, { role: 'POLICY_WRITER', label: `policy cap ${payer.key} ${cap}`, request: { address: checkout, abi: checkoutAbi, functionName: 'setPolicy', args: [node, p.epoch, p.wallet, false, cap, p.expiry] } });
const after = await ctx.publicClient.readContract({ address: checkout, abi: checkoutAbi, functionName: 'policies', args: [node] });
console.log(`after: epoch ${after.epoch}, wallet ${after.wallet}, revoked ${after.revoked}, cap ${after.dailyCapMicro}, expiry ${after.expiry}; tx ${ctx.explorerTx(r.transactionHash)}`);
