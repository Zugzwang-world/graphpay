// Fork tests (docs/plan/amendments/M5-ens.md §1 row 8): run against an anvil fork of Sepolia
// that scripts/ens/real-run.mjs --fork has already provisioned. FORK_URL defaults to the
// loopback anvil on port 8611. Fork keys are public: nothing here touches a real chain.
//   pnpm --filter @graphpay/ens test:fork

import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { config } from '@graphpay/config';
import { createPublicClient, createWalletClient, getAddress, http } from 'viem';
import { loadEnv } from '../../../scripts/lib/env-loader.mjs';
import { roleAddresses } from '../../../scripts/lib/wallets.mjs';
import {
  createEnsReader,
  disposableAgent,
  dnsEncode,
  eventually,
  ensChain,
  KEYS,
  labelId,
  namespacePlan,
  permissionedRegistryAbi,
  permissionedResolverAbi,
  readText,
  registryState,
  STATUS,
  WHITECHAIN_COIN_TYPE,
  walkName,
  readAddressBytes,
} from '../index.mjs';

const FORK_URL = process.env.FORK_URL ?? 'http://127.0.0.1:8611';
const plan = namespacePlan();
const client = createPublicClient({ chain: ensChain(), transport: http(FORK_URL, { timeout: 120_000 }) });
const wallets = roleAddresses(loadEnv().values);
let reachable = false;

before(async () => {
  try {
    reachable = (await client.getChainId()) === 11155111;
  } catch {
    reachable = false;
  }
});

const guard = (name, fn) => test(name, async (t) => (reachable ? fn(t) : t.skip(`no fork at ${FORK_URL}`)));
const errorText = (e) => [e?.message, e?.shortMessage, e?.cause?.message, e?.cause?.shortMessage, e?.details].filter(Boolean).join(' | ');
async function reverts(promise, name) {
  try {
    await promise;
  } catch (e) {
    assert.match(errorText(e), new RegExp(name), errorText(e));
    return;
  }
  assert.fail(`expected a revert with ${name}`);
}
const asAccount = (address) => createWalletClient({ account: address, chain: ensChain(), transport: http(FORK_URL, { timeout: 120_000 }) });

async function resolverOf(agentName) {
  const w = await walkName(client, agentName);
  assert.ok(w.ok, `${agentName}: ${w.reason}`);
  return w;
}

guard('B1/B2 on the fork: every name of the cast walks ok, is REGISTERED at epoch 0 with its own factory-proxy resolver', async () => {
  const all = [...plan.owners, ...plan.agents, disposableAgent(2)];
  const resolvers = new Set();
  for (const e of all) {
    const w = await resolverOf(e.name);
    assert.equal(w.epoch, 0, e.name);
    assert.ok(w.expiry > w.now, e.name);
    assert.ok(!resolvers.has(w.resolver), `${e.name} shares a resolver`);
    resolvers.add(w.resolver);
    assert.equal(await readText(client, e.name, KEYS.status), 'active', e.name);
  }
  for (const a of [...plan.agents, disposableAgent(2)].filter((x) => x.pays)) {
    const bytes = await readAddressBytes(client, a.name, WHITECHAIN_COIN_TYPE);
    assert.equal(getAddress(bytes), getAddress(wallets[a.walletRole]), `${a.name} address is its own wallet`);
    assert.equal(await readText(client, a.name, KEYS.capMicro), a.capMicro.toString());
  }
  assert.equal(await readText(client, config.root.ens, KEYS.agentEndpointMcp), `${config.site.url}${config.site.mcpPath}`);
  assert.equal(await readText(client, config.root.ens, KEYS.agentEndpointWeb), config.site.url);
});

guard('B3: an agent writes its own agent-context and Whitechain address; every other key reverts EACUnauthorizedAccountRoles', async () => {
  const agent = plan.agents.find((a) => a.key === 'acceptance');
  const w = await resolverOf(agent.name);
  const me = getAddress(wallets[agent.walletRole]);
  const sim = (functionName, args) => client.simulateContract({ account: me, address: w.resolver, abi: permissionedResolverAbi, functionName, args });
  const dns = dnsEncode(agent.name);
  await sim('setText', [dns, KEYS.agentContext, 'updated by the agent']);
  await sim('setAddress', [dns, WHITECHAIN_COIN_TYPE, me]);
  for (const [key, value] of [[KEYS.capMicro, '999000000'], [KEYS.status, 'paused'], [KEYS.acceptsText, '0x'], [KEYS.agentEndpointMcp, 'https://example.invalid'], [KEYS.principal, 'x'], [KEYS.kind, 'human']]) {
    await reverts(sim('setText', [dns, key, value]), 'EACUnauthorizedAccountRoles');
  }
  await reverts(sim('setAddress', [dns, 60n, me]), 'EACUnauthorizedAccountRoles');
  await reverts(sim('setContenthash', [dns, '0x01']), 'EACUnauthorizedAccountRoles');
  // the write that lands (fork only)
  const hash = await asAccount(me).writeContract({ address: w.resolver, abi: permissionedResolverAbi, functionName: 'setText', args: [dns, KEYS.agentContext, 'updated by the agent'] });
  const receipt = await eventually(() => client.getTransactionReceipt({ hash }).catch(() => null), { tries: 30, delayMs: 500, what: 'agent write receipt' });
  assert.equal(receipt.status, 'success');
  assert.equal(await readText(client, agent.name, KEYS.agentContext), 'updated by the agent');
  assert.equal(await readText(client, agent.name, KEYS.status), 'active', 'status untouched');
  // an owner-held agent has no grant for anyone but its owner: a stranger cannot write
  const held = plan.agents.find((a) => !a.selfHeld);
  const hw = await resolverOf(held.name);
  const stranger = getAddress(wallets[agent.walletRole]);
  await reverts(client.simulateContract({ account: stranger, address: hw.resolver, abi: permissionedResolverAbi, functionName: 'setText', args: [dnsEncode(held.name), KEYS.agentContext, 'x'] }), 'EACUnauthorizedAccountRoles');
});

guard('both transfer routes revert: safeTransferFrom (unemancipated) and unsafeTransfer (no CAN_TRANSFER_ADMIN)', async () => {
  const agent = plan.agents.find((a) => a.key === 'acceptance');
  const human = await resolverOf(plan.owners[0].name);
  const rootRegistry = human.registry;
  const ownerRegistry = await client.readContract({ address: rootRegistry, abi: permissionedRegistryAbi, functionName: 'getSubregistry', args: [plan.owners[0].label] });
  const st = await registryState(client, ownerRegistry, agent.label);
  assert.equal(st.status, STATUS.REGISTERED);
  const holder = getAddress(wallets[agent.walletRole]);
  const other = getAddress(wallets[plan.owners[0].walletRole]);
  await reverts(
    client.simulateContract({ account: holder, address: ownerRegistry, abi: permissionedRegistryAbi, functionName: 'safeTransferFrom', args: [holder, other, st.tokenId, 1n, '0x'] }),
    'TransferUnsafeUntilRegistryIsEmancipated',
  );
  await reverts(
    client.simulateContract({ account: holder, address: ownerRegistry, abi: permissionedRegistryAbi, functionName: 'unsafeTransfer', args: [other, st.tokenId, '0x'] }),
    'TransferDisallowed',
  );
});

guard('B5: anything.sim.<root> answers as a synthetic wildcard with no transaction; the walk says ENS_SYNTHETIC', async () => {
  const name = `acceptance-0001.${plan.wildcard.name}`;
  assert.equal(await readText(client, name, KEYS.synthetic), 'true');
  assert.equal(await readText(client, name, KEYS.kind), 'agent');
  assert.equal(await readText(client, name, KEYS.status), '', 'a default record never holds a status');
  assert.equal(await readText(client, name, KEYS.capMicro), '');
  assert.deepEqual(await walkName(client, name), { ok: false, reason: 'ENS_SYNTHETIC' });
  assert.deepEqual(await walkName(client, `a.b.${plan.wildcard.name}`), { ok: false, reason: 'ENS_SYNTHETIC' });
});

guard('resolvePayee and readAccepts: shops resolve to their wallet and accept test USDT; an unregistered name, a foreign root and a look-alike are refused', async () => {
  const reader = createEnsReader({ client });
  for (const shop of plan.owners.filter((o) => o.kind === 'shop')) {
    const p = await reader.resolvePayee(shop.name);
    assert.equal(p.ok, true, shop.name);
    assert.equal(p.payee, getAddress(wallets[shop.walletRole]));
    const a = await reader.readAccepts(shop.name);
    assert.deepEqual(a.accepts, [{ chainId: config.networks.whitechain.chainId, token: getAddress(config.whitechain.tokens.usdt.address) }]);
  }
  const missing = await reader.resolvePayee(`no-such-shop.${config.root.ens}`);
  assert.deepEqual([missing.ok, missing.reason], [false, 'PAYEE_UNRESOLVED']);
  assert.equal((await reader.resolvePayee('kesar.evil.eth')).ok, false);
  assert.equal((await reader.resolvePayee(` ${plan.owners[1].name}`)).ok, false);
  assert.equal((await reader.resolvePayee(plan.owners[1].name.toUpperCase())).ok, false);
  assert.equal((await reader.resolvePayee(plan.wildcard.name)).ok, false, 'the reserved wildcard has no payee');
  assert.equal((await reader.resolvePayee(`x.${plan.wildcard.name}`)).ok, false);
  assert.equal((await reader.resolvePayee(plan.agents.find((a) => a.pays).name)).ok, true, 'a paying agent has its own address record');
});

guard('the label of a never-registered name has expiry 0 and a registry lookup keys on keccak256(label)', async () => {
  const s = await registryState(client, (await resolverOf(plan.owners[0].name)).registry, 'never-registered-label');
  assert.deepEqual([s.status, s.expiry], [STATUS.AVAILABLE, 0n]);
  assert.ok(labelId('x') > 0n);
});
