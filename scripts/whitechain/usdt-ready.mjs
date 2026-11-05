// node scripts/whitechain/usdt-ready.mjs [--fork <anvil url>]
// Read-only readiness of the qualifying test-USDT payment (acceptance C7): the token as clients
// sign for it, the checkout pinned to it, the acceptance agent's wallet, balance and policy, and
// FUNDER's reserve. The stand-in token is retired (ADR-0054), so M2 deploys the USDT checkout
// itself; the payment runs once in M3 part B through the facilitator, as the acceptance agent.

import { domainSeparator, erc20Abi, formatEther, formatUnits, isAddressEqual, namehash, parseAbi } from 'viem';
import { castEntries, config } from '../../packages/config/index.mjs';
import { checkoutAbi, tokenDomain } from '../../packages/contracts/index.mjs';
import { configuredCheckout, context, usdt } from './lib.mjs';

const ctx = await context(process.argv.slice(2));
const { publicClient } = ctx;
const token = usdt();
const tokenAbi = [...erc20Abi, ...parseAbi(['function DOMAIN_SEPARATOR() view returns (bytes32)'])];
const read = (address, abi, functionName, args = []) => publicClient.readContract({ address, abi, functionName, args });
const checks = [];
const check = (name, ok, note = '') => checks.push({ name, ok, note });

check('token has code', Boolean(await publicClient.getCode({ address: token.address })));
check(`decimals = ${token.decimals}`, (await read(token.address, tokenAbi, 'decimals')) === token.decimals);
check('EIP-712 domain = DOMAIN_SEPARATOR()', (await read(token.address, tokenAbi, 'DOMAIN_SEPARATOR')) === domainSeparator({ domain: tokenDomain(ctx.chain.id, token) }));
const funder = config.wallets.carried.FUNDER;
const funderUsdt = await read(token.address, erc20Abi, 'balanceOf', [funder]);
check('FUNDER holds test USDT for top-ups', funderUsdt > 0n, `${formatUnits(funderUsdt, 6)} USDT`);

const acceptance = castEntries().find((e) => e.key === 'acceptance');
const wallet = ctx.account(acceptance.walletRole).address;
const balance = await read(token.address, erc20Abi, 'balanceOf', [wallet]);
const storyCap = BigInt(acceptance.capMicro);
check(`${acceptance.ensName} wallet holds test USDT`, balance > 0n, `${formatUnits(balance, 6)} USDT, ${formatEther(await publicClient.getBalance({ address: wallet }))} WBT (pays no gas)`);

const deployed = configuredCheckout();
if (!deployed) {
  check('USDT checkout deployed', false, 'run deploy-checkout');
} else {
  const pinned = await read(deployed.address, checkoutAbi, 'USDT');
  check('checkout.USDT() = test USDT', isAddressEqual(pinned, token.address), deployed.address);
  const policy = await read(deployed.address, checkoutAbi, 'policies', [namehash(acceptance.ensName)]);
  check(`policy for ${acceptance.ensName} on its own wallet`, isAddressEqual(policy.wallet, wallet) && !policy.revoked, `cap ${formatUnits(policy.dailyCapMicro, 6)}/day, the story's ${formatUnits(storyCap, 6)}`);
}
for (const c of checks) console.log(`  ${c.ok ? 'ok  ' : 'FAIL'} ${c.name}${c.note ? ` (${c.note})` : ''}`);
if (checks.some((c) => !c.ok)) process.exitCode = 1;
