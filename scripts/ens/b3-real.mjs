// node scripts/ens/b3-real.mjs [--send]
// Acceptance B3 (amended) on real Sepolia, as the acceptance agent's own key (ACCEPTANCE_PAYER):
// simulated setText of graphpay.cap_micro, graphpay.status, x-graphpay-accepts and agent-endpoint[mcp],
// and setAddress(60), each revert EACUnauthorizedAccountRoles and none is sent; setAddress of its own
// Whitechain address succeeds in simulation; with --send, setText of its own agent-context lands
// (one transaction, the planned text, so the record does not change).

import { getAddress, isAddressEqual } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from '../../packages/config/index.mjs';
import { createTxRunner, dnsEncode, KEYS, namespacePlan, permissionedResolverAbi, readText, retryingReads, WHITECHAIN_COIN_TYPE, walkName } from '../../packages/ens/index.mjs';
import { clientsFor } from '../lib/chains.mjs';
import { loadEnv } from '../lib/env-loader.mjs';
import { installErrorBoundary } from '../lib/redact.mjs';

const { values } = loadEnv();
installErrorBoundary(() => values);
const c = await clientsFor(config.ens.network, Object.fromEntries(values));
const client = retryingReads(c.publicClient);
const agent = namespacePlan().agents.find((a) => a.key === 'acceptance');
const account = privateKeyToAccount(values.get(`${agent.walletRole}_PRIVATE_KEY`));
const w = await walkName(client, agent.name);
if (!w.ok) throw new Error(`${agent.name}: ${w.reason}`);
const dns = dnsEncode(agent.name);
const sim = (functionName, args) => c.publicClient.simulateContract({ account, address: w.resolver, abi: permissionedResolverAbi, functionName, args });
let failed = 0;
const expectRevert = async (what, fn) => {
  try {
    await fn();
    console.log(`FAIL ${what}: did not revert`);
    failed += 1;
  } catch (e) {
    const ok = /EACUnauthorizedAccountRoles/.test([e.message, e.shortMessage, e.cause?.message].join(' '));
    console.log(`${ok ? 'pass' : 'FAIL'} ${what}: reverts EACUnauthorizedAccountRoles in simulation, nothing sent`);
    if (!ok) failed += 1;
  }
};
for (const [key, value] of [[KEYS.capMicro, '999000000'], [KEYS.status, 'paused'], [KEYS.acceptsText, '0x'], [KEYS.agentEndpointMcp, 'https://example.invalid']]) {
  await expectRevert(`setText ${key}`, () => sim('setText', [dns, key, value]));
}
await expectRevert('setAddress(60)', () => sim('setAddress', [dns, 60n, account.address]));
await sim('setAddress', [dns, WHITECHAIN_COIN_TYPE, account.address]);
console.log('pass setAddress(2147485522, own wallet): succeeds in simulation');
if (process.argv.includes('--send')) {
  if (!isAddressEqual(account.address, getAddress(w.owner))) throw new Error('the key is not the agent holder');
  const runner = createTxRunner({ client: c.publicClient, chainId: config.networks.sepolia.chainId, explorerTx: c.explorerTx });
  const text = await readText(client, agent.name, KEYS.agentContext);
  const wc = c.walletClient(account);
  const { hash } = await runner.send('B3 setText agent-context', { role: agent.walletRole, address: account.address, sendTransaction: (r) => wc.sendTransaction(r) }, {
    to: w.resolver,
    data: (await import('viem')).encodeFunctionData({ abi: permissionedResolverAbi, functionName: 'setText', args: [dns, KEYS.agentContext, text] }),
  });
  console.log(`pass setText agent-context landed: ${c.explorerTx(hash)}`);
}
if (failed > 0) process.exitCode = 1;
