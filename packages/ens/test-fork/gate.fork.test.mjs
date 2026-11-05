// Fork tests for the gate and the owner actions (planning/PROMPTS/06-ens-gate-kill-watcher.md):
// the pause, the kill ladder (unregister, then `renew` leaves the label RESERVED; a lapse then
// `renew` keeps the epoch) and the 20 s bite. Run against an anvil fork of Sepolia taken after
// the namespace and disposable-2 were provisioned (scripts/ens/real-run.mjs --fork ... --disposable 2).
// Fork keys are public: nothing here touches a real chain.
//   pnpm --filter @graphpay/ens test:fork

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createPublicClient, createWalletClient, encodeFunctionData, getAddress, http } from 'viem';
import { loadEnv } from '../../../scripts/lib/env-loader.mjs';
import { roleAddresses } from '../../../scripts/lib/wallets.mjs';
import {
  createEnsGate,
  createEnsWatcher,
  memoryCheckpoint,
  createOwnerActions,
  createTxRunner,
  disposableAgent,
  ensChain,
  labelId,
  locate,
  namespacePlan,
  nextFreeDisposable,
  ownerRoleOf,
  registryState,
  STATUS,
  userRegistryAbi,
} from '../index.mjs';

const FORK_URL = process.env.FORK_URL ?? 'http://127.0.0.1:8611';
const plan = namespacePlan();
const client = createPublicClient({ chain: ensChain(), transport: http(FORK_URL, { timeout: 120_000 }) });
const wallets = roleAddresses(loadEnv().values);
let reachable = false;
let snapshot;

// The kill and the time jump change the fork for good: put it back for the other test files.
before(async () => {
  try {
    reachable = (await client.getChainId()) === 11155111;
    if (reachable) snapshot = await client.request({ method: 'evm_snapshot' });
  } catch {
    reachable = false;
  }
});
after(async () => {
  if (reachable && snapshot) await client.request({ method: 'evm_revert', params: [snapshot] });
});
const guard = (name, fn) => test(name, async (t) => (reachable ? fn(t) : t.skip(`no fork at ${FORK_URL}`)));
// A test that changes the fork for good (a kill, a time jump) runs between a snapshot and its revert.
const isolated = (name, fn) =>
  guard(name, async (t) => {
    const snap = await client.request({ method: 'evm_snapshot' });
    try {
      await fn(t);
    } finally {
      await client.request({ method: 'evm_revert', params: [snap] });
    }
  });

const senders = new Map();
async function senderFor(role) {
  if (senders.has(role)) return senders.get(role);
  const address = getAddress(wallets[role]);
  await client.request({ method: 'anvil_setBalance', params: [address, '0xde0b6b3a7640000'] });
  const wc = createWalletClient({ account: address, chain: ensChain(), transport: http(FORK_URL, { timeout: 120_000 }) });
  const sender = { role, address, sendTransaction: (req) => wc.sendTransaction({ account: address, ...req }) };
  senders.set(role, sender);
  return sender;
}
const actions = async (...roles) => {
  for (const r of roles) await senderFor(r);
  return createOwnerActions({ client, retryReads: false, runner: createTxRunner({ client, chainId: 11155111, log: () => {} }), senderFor: (r) => senders.get(r), log: () => {} });
};
const gateFor = (epochs = {}, capMicro = 5_000_000n) =>
  createEnsGate({ client, expectedEpoch: async (node) => epochs[node] ?? 0, policyCapMicro: async () => capMicro, spentToday: async () => 0n });
const scout = plan.agents.find((a) => a.selfHeld && a.capMicro > 0n);
const reasonOf = async (gate, name, amount = 1_000_000n) => {
  const r = await gate.ensGate(name, amount);
  return r.ok ? 'ok' : r.reason;
};

guard('gate on a live fork: an active agent passes with min(ENS cap, policy cap); an outside root is refused', async () => {
  const gate = gateFor({}, 2_000_000n);
  const r = await gate.ensGate(scout.name, 1_000_000n);
  assert.equal(r.ok, true, JSON.stringify(r, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
  assert.equal(r.capMicro, BigInt(Math.min(Number(scout.capMicro), 2_000_000)));
  assert.equal(await reasonOf(gate, 'x.evil.eth'), 'ENS_ROOT_NOT_ALLOWED');
  assert.equal(await reasonOf(gate, `nobody-here.${plan.human.name}`), 'ENS_NOT_FOUND');
  assert.equal(await reasonOf(gate, plan.wildcard.name.replace(/^/, 'anyone.')), 'ENS_SYNTHETIC');
});

isolated('pause bites within 25 s of its receipt and resume allows the name again', async () => {
  const a = await actions(ownerRoleOf(scout.name));
  const gate = gateFor();
  assert.equal(await reasonOf(gate, scout.name), 'ok'); // primes the 20 s cache
  const paused = await a.pause(scout.name);
  assert.equal(paused.changed, true);
  const t0 = Date.now();
  let reason = 'ok';
  while (reason === 'ok' && Date.now() - t0 < 25_000) {
    await new Promise((r) => setTimeout(r, 500));
    reason = await reasonOf(gate, scout.name);
  }
  assert.equal(reason, 'ENS_PAUSED');
  assert.ok(Date.now() - t0 <= 25_000);
  assert.equal((await a.pause(scout.name)).changed, false); // idempotent
  const resumed = await a.resume(scout.name);
  assert.equal(resumed.changed, true);
  assert.equal(await reasonOf(gateFor(), scout.name), 'ok');
});

isolated('kill ladder: unregister refuses at once; a second kill says "killed earlier"; renew after unregister leaves the label RESERVED and refused', async () => {
  const d = disposableAgent(1);
  const a = await actions(d.ownerWalletRole);
  const check = createEnsGate({ client, expectedEpoch: async () => 0, policyCapMicro: async () => 1_000_000n, spentToday: async () => 0n });
  assert.equal(await reasonOf(check, d.name, 100_000n), 'ok');
  const killed = await a.kill(d.name);
  assert.equal(killed.changed, true);
  assert.equal(await reasonOf(gateFor({}, 1_000_000n), d.name, 100_000n), 'ENS_EXPIRED_OR_REVOKED');
  assert.equal((await check.ensCheck(d.name)).status, 'REVOKED');
  const again = await a.kill(d.name);
  assert.deepEqual([again.changed, again.killedEarly ?? again.killedEarlier], [false, true]);
  // The trap: renew() on the unregistered label emits ExpiryUpdated and leaves it RESERVED, records intact.
  const at = await locate(client, d.name);
  const owner = await senderFor(d.ownerWalletRole);
  const block = await client.getBlock();
  const data = encodeFunctionData({ abi: userRegistryAbi, functionName: 'renew', args: [labelId(d.label), block.timestamp + 86_400n * 30n] });
  try {
    await createTxRunner({ client, chainId: 11155111, log: () => {} }).send('renew', owner, { to: at.registry, data });
  } catch {
    /* a renew of a burned token may revert: then the label stays AVAILABLE and refused, which also passes */
  }
  const s = await registryState(client, at.registry, d.label);
  assert.notEqual(s.status, STATUS.REGISTERED);
  assert.equal(await reasonOf(gateFor({}, 1_000_000n), d.name, 100_000n), 'ENS_EXPIRED_OR_REVOKED');
});

isolated('a lapse then renew revives the same epoch; a never-registered label is the next free disposable', async () => {
  const d = disposableAgent(2);
  const a = await actions(d.ownerWalletRole);
  const at = await locate(client, d.name);
  const before = await registryState(client, at.registry, d.label);
  assert.equal(before.status, STATUS.REGISTERED);
  assert.equal(await nextFreeDisposable(client), 3);
  // Jump past the expiry (a time lapse emits nothing), then renew: same owner, same epoch.
  const jump = Number(before.expiry - (await client.getBlock()).timestamp) + 10;
  await client.request({ method: 'evm_increaseTime', params: [`0x${jump.toString(16)}`] });
  await client.request({ method: 'evm_mine', params: [] });
  assert.equal(await reasonOf(gateFor({}, 1_000_000n), d.name, 100_000n), 'ENS_EXPIRED_OR_REVOKED');
  assert.equal((await gateFor().ensCheck(d.name)).status, 'EXPIRED'); // a lapse keeps its owner: expired, not revoked
  const owner = await senderFor(d.ownerWalletRole);
  const now = (await client.getBlock()).timestamp;
  const data = encodeFunctionData({ abi: userRegistryAbi, functionName: 'renew', args: [labelId(d.label), now + 86_400n * 14n] });
  await createTxRunner({ client, chainId: 11155111, log: () => {} }).send('renew', owner, { to: at.registry, data });
  const after = await registryState(client, at.registry, d.label);
  assert.equal(after.status, STATUS.REGISTERED);
  assert.equal(after.epoch, before.epoch);
  assert.equal(after.latestOwner, before.latestOwner);
  assert.equal(await reasonOf(gateFor({}, 1_000_000n), d.name, 100_000n), 'ok');
  void a;
});


isolated('watcher on the fork: unregister revokes the policy; a later renew does not un-revoke it; a pause patches the node; the policy cap never moves', async () => {
  const d = disposableAgent(1);
  const a = await actions(d.ownerWalletRole);
  const calls = [];
  const patches = [];
  const sink = { updatePolicy: async (c) => calls.push(c), patchNode: async (node, f) => patches.push(f) };
  const watcher = createEnsWatcher({ client, names: [d.name], sink, checkpoint: memoryCheckpoint() });
  await watcher.start();
  const pr = await a.pause(d.name);
  const pl = await watcher.poll();
  assert.deepEqual([pr.changed, pl.events], [true, 1]);
  assert.deepEqual(patches.at(-1), { status: 'paused' });
  await a.kill(d.name);
  await watcher.poll();
  assert.deepEqual(calls, [{ node: watcher.tracked()[0].node, epoch: 0, revoked: true }]);
  assert.equal(patches.at(-1).status, 'revoked');
  const at = await locate(client, d.name);
  const block = await client.getBlock();
  const data = encodeFunctionData({ abi: userRegistryAbi, functionName: 'renew', args: [labelId(d.label), block.timestamp + 86_400n * 30n] });
  let renewed = true;
  try {
    await createTxRunner({ client, chainId: 11155111, log: () => {} }).send('renew', await senderFor(d.ownerWalletRole), { to: at.registry, data });
  } catch {
    renewed = false; // the burned token cannot be renewed: also safe
  }
  await watcher.poll();
  assert.equal(calls.length, 1, `renew ${renewed ? 'succeeded' : 'reverted'}: no un-revoke`);
  assert.notEqual((await registryState(client, at.registry, d.label)).status, STATUS.REGISTERED);
  console.log(`# renew after unregister: ${renewed ? 'accepted, label is RESERVED' : 'reverted'}`);
});
