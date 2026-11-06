// The watcher with a fake chain and recording sinks (planning/PROMPTS/06-ens-gate-kill-watcher.md):
// a renew after an unregister does not un-revoke; an owner's ENS cap reaches a live policy only
// bounded by the configured cap; marks are set only after the sink succeeded; the policy sink
// never creates a policy.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeFunctionData, encodeFunctionResult, zeroAddress } from 'viem';
import { createEnsWatcher, createPolicySink, KEYS, labelId, memoryCheckpoint, namehash, namespacePlan, profileAbi, STATUS, WHITECHAIN_COIN_TYPE } from '../index.mjs';

const REG = '0x3333333333333333333333333333333333333333';
const RES = '0x4444444444444444444444444444444444444444';
const OWNER = '0x5555555555555555555555555555555555555555';
const agent = namespacePlan().agents.find((a) => a.selfHeld && a.capMicro > 0n);
const NODE = namehash(agent.name);
const TOKEN = labelId(agent.label) ^ (labelId(agent.label) & 0xffffffffn) | 7n; // a versioned token id: low 32 bits differ

function world(over = {}) {
  const w = {
    state: { status: STATUS.REGISTERED, expiry: 2_000_000_000n, latestOwner: OWNER, tokenId: TOKEN, resource: 0n },
    head: 100n,
    nowTs: 1_000n,
    policyCalls: [],
    patches: [],
    failPolicy: false,
    invalidated: [],
    payeeInvalid: [],
    acceptsInvalid: [],
    ...over,
  };
  w.client = {
    getBlockNumber: async () => w.head,
    getBlock: async () => ({ timestamp: w.nowTs }),
    getLogs: async () => w.logs ?? [],
    readContract: async ({ functionName, args }) => {
      if (functionName === 'getSubregistry') return REG;
      if (functionName === 'getResolver') return w.state.status === STATUS.REGISTERED ? RES : zeroAddress;
      if (functionName === 'getState') return w.state;
      // the universal resolver answers only the texts in `w.texts`; any other read fails (textStatus stays unknown)
      if (functionName === 'resolve' && w.texts) {
        const [, key] = decodeFunctionData({ abi: profileAbi, data: args[1] }).args;
        if (w.textFails) throw new Error('resolver read failed');
        if (key in w.texts) return [encodeFunctionResult({ abi: profileAbi, functionName: 'text', result: w.texts[key] }), RES];
      }
      throw new Error(`fake chain: ${functionName}`);
    },
  };
  w.sink = {
    updatePolicy: async (c) => {
      if (w.failPolicy) throw new Error('whitechain down');
      w.policyCalls.push(c);
    },
    patchNode: async (node, f) => w.patches.push({ node, ...f }),
  };
  w.gate = { invalidate: (n) => w.invalidated.push(n) };
  w.reader = { invalidatePayee: (n) => w.payeeInvalid.push(n), invalidateAccepts: (n) => w.acceptsInvalid.push(n) };
  w.checkpoint = memoryCheckpoint();
  return w;
}
const watcherOf = (w) => createEnsWatcher({ client: w.client, names: [agent.name], sink: w.sink, reader: w.reader, gate: w.gate, checkpoint: w.checkpoint, now: async () => w.nowTs });
let n = 0;
const log = (eventName, args, address = REG, blockNumber = 101n) => ({ eventName, args, address, blockNumber, logIndex: n++, transactionHash: `0x${(n).toString(16).padStart(64, '0')}` });

test('watcher: an unregister revokes the existing policy at the stored epoch and marks the node revoked; no cap or wallet is passed', async () => {
  const w = world();
  const watcher = watcherOf(w);
  await watcher.start();
  w.state = { status: STATUS.AVAILABLE, expiry: 1_500n, latestOwner: zeroAddress, tokenId: TOKEN, resource: 9n };
  await watcher.handle([log('LabelUnregistered', { tokenId: TOKEN })]);
  assert.deepEqual(w.policyCalls, [{ node: NODE, epoch: 0, revoked: true }]);
  assert.deepEqual(w.patches, [{ node: NODE, status: 'revoked' }]);
  assert.deepEqual(w.invalidated, [agent.name]);
});

test('watcher: onRevoked runs once after a revocation was applied, never when the sink failed, and its failure is only logged', async () => {
  const calls = [];
  const lines = [];
  const mk = (w, onRevoked) => createEnsWatcher({ client: w.client, names: [agent.name], sink: w.sink, reader: w.reader, gate: w.gate, checkpoint: w.checkpoint, now: async () => w.nowTs, log: (l) => lines.push(l), onRevoked });
  const killed = { status: STATUS.AVAILABLE, expiry: 1_500n, latestOwner: zeroAddress, tokenId: TOKEN, resource: 9n };
  // the sink fails first: no mark, no hook; the repeated event applies it and runs the hook once
  const w = world();
  const watcher = mk(w, (c) => calls.push(c));
  await watcher.start();
  w.state = killed;
  w.failPolicy = true;
  await assert.rejects(watcher.handle([log('LabelUnregistered', { tokenId: TOKEN })]));
  await new Promise((r) => setImmediate(r));
  assert.equal(calls.length, 0);
  w.failPolicy = false;
  await watcher.handle([log('LabelUnregistered', { tokenId: TOKEN })]);
  await watcher.handle([log('LabelUnregistered', { tokenId: TOKEN })]); // a replay: already revoked
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(calls, [{ name: agent.name, node: NODE, epoch: 0, why: 'unregistered' }]);
  // a hook that throws: the revocation stands and the line is logged
  const w2 = world();
  const watcher2 = mk(w2, () => {
    throw new Error('spare keeper down');
  });
  await watcher2.start();
  w2.state = killed;
  await watcher2.handle([log('LabelUnregistered', { tokenId: TOKEN })]);
  await new Promise((r) => setImmediate(r));
  assert.equal(watcher2.tracked()[0].revoked, true);
  assert.ok(lines.some((l) => /spare keeper down/.test(l)));
});

test('watcher: a renew after an unregister leaves the label RESERVED and does not un-revoke', async () => {
  const w = world();
  const watcher = watcherOf(w);
  await watcher.start();
  w.state = { status: STATUS.AVAILABLE, expiry: 1_500n, latestOwner: zeroAddress, tokenId: TOKEN, resource: 9n };
  await watcher.handle([log('LabelUnregistered', { tokenId: TOKEN })]);
  w.policyCalls.length = 0;
  w.patches.length = 0;
  w.state = { status: STATUS.RESERVED, expiry: 3_000_000_000n, latestOwner: zeroAddress, tokenId: TOKEN, resource: 9n };
  await watcher.handle([log('ExpiryUpdated', { tokenId: TOKEN, newExpiry: 3_000_000_000n }, REG, 102n)]);
  assert.deepEqual(w.policyCalls, []);
  assert.deepEqual(w.patches, []);
});

test('watcher: a plain renew moves only the expiry (read back from the registry) and lifts nothing', async () => {
  const w = world();
  const watcher = watcherOf(w);
  await watcher.start();
  await watcher.handle([log('ExpiryUpdated', { tokenId: TOKEN, newExpiry: 2_100_000_000n })]);
  assert.deepEqual(w.policyCalls, [{ node: NODE, epoch: 0, expiry: 2_000_000_000n }]); // no `revoked`
  assert.deepEqual(w.patches, [{ node: NODE, expiry: 2_000_000_000n }]);
});

test("watcher: the owner's graphpay.cap_micro goes to the sink as the owner's cap for a live name at its epoch, read as it is now", async () => {
  const w = world({ texts: { [KEYS.capMicro]: '300' } });
  const watcher = watcherOf(w);
  await watcher.start();
  // a replayed batch carries the older value first: both events send the record's current value
  await watcher.handle([log('TextUpdated', { recordId: 1n, key: KEYS.capMicro, value: '250' }, RES), log('TextUpdated', { recordId: 1n, key: KEYS.capMicro, value: '300' }, RES)]);
  assert.deepEqual(w.policyCalls, [{ node: NODE, epoch: 0, ownerCapMicro: 300n }, { node: NODE, epoch: 0, ownerCapMicro: 300n }]);
  assert.deepEqual(w.patches, [{ node: NODE, ensCapMicro: '250' }, { node: NODE, ensCapMicro: '300' }]);
  assert.deepEqual(w.invalidated, [agent.name, agent.name]);
});

test("watcher: no owner's cap reaches the sink for a malformed record, a lapsed name or one that is no longer REGISTERED", async () => {
  const w = world({ texts: { [KEYS.capMicro]: '' } });
  const watcher = watcherOf(w);
  await watcher.start();
  const capEvent = () => watcher.handle([log('TextUpdated', { recordId: 1n, key: KEYS.capMicro, value: '1' }, RES)]);
  for (const value of ['', '1.5', '-1', '01', 'abc']) {
    w.texts[KEYS.capMicro] = value;
    await capEvent();
  }
  assert.deepEqual(w.policyCalls, []);
  w.texts[KEYS.capMicro] = '1';
  w.nowTs = 3_000_000_000n; // past the expiry
  await capEvent();
  assert.deepEqual(w.policyCalls, []);
  w.nowTs = 1_000n;
  w.state = { ...w.state, status: STATUS.AVAILABLE }; // a stale event: the name was unregistered since
  await capEvent();
  assert.deepEqual(w.policyCalls, []);
});

test("watcher: a failed cap read or write never holds up the batch (a kill behind it still revokes); the ticker tries the cap again", async () => {
  const w = world({ texts: { [KEYS.capMicro]: '2' }, textFails: true });
  const watcher = watcherOf(w);
  await watcher.start();
  await watcher.handle([log('TextUpdated', { recordId: 1n, key: KEYS.capMicro, value: '2' }, RES)]);
  assert.deepEqual(w.policyCalls, []); // the read failed: nothing sent, nothing thrown
  w.textFails = false;
  await watcher.tick();
  assert.deepEqual(w.policyCalls, [{ node: NODE, epoch: 0, ownerCapMicro: 2n }]);
  await watcher.tick(); // applied: not sent again
  assert.equal(w.policyCalls.length, 1);
  // a cap event and a kill in one batch: the cap read fails, the kill still revokes
  w.textFails = true;
  const killed = { status: STATUS.AVAILABLE, expiry: 1_500n, latestOwner: zeroAddress, tokenId: TOKEN, resource: 9n };
  await watcher.handle([log('TextUpdated', { recordId: 1n, key: KEYS.capMicro, value: '3' }, RES)]);
  w.state = killed;
  await watcher.handle([log('LabelUnregistered', { tokenId: TOKEN })]);
  assert.deepEqual(w.policyCalls.at(-1), { node: NODE, epoch: 0, revoked: true });
  w.textFails = false;
  await watcher.tick(); // revoked since: the pending cap is dropped, not sent
  assert.deepEqual(w.policyCalls.at(-1), { node: NODE, epoch: 0, revoked: true });
});

test('watcher: a status text patches the node and clears the gate cache; a paused name that was killed stays revoked', async () => {
  const w = world();
  const watcher = watcherOf(w);
  await watcher.start();
  await watcher.handle([log('TextUpdated', { recordId: 1n, key: KEYS.status, value: 'paused' }, RES)]);
  assert.deepEqual(w.patches, [{ node: NODE, status: 'paused' }]);
  w.state = { status: STATUS.AVAILABLE, expiry: 1_500n, latestOwner: zeroAddress, tokenId: TOKEN, resource: 9n };
  await watcher.handle([log('LabelUnregistered', { tokenId: TOKEN })]);
  w.patches.length = 0;
  await watcher.handle([log('TextUpdated', { recordId: 1n, key: KEYS.status, value: 'active' }, RES)]);
  assert.deepEqual(w.patches, []);
  assert.deepEqual(w.policyCalls.map((c) => c.revoked), [true]);
});

test('watcher: an address record change on the Whitechain coin type clears the payee cache; accepts clears accepts; nothing touches a policy', async () => {
  const w = world();
  const watcher = watcherOf(w);
  await watcher.start();
  await watcher.handle([
    log('AddressUpdated', { recordId: 1n, coinType: WHITECHAIN_COIN_TYPE, addressBytes: '0x' }, RES),
    log('AddressUpdated', { recordId: 1n, coinType: 60n, addressBytes: '0x' }, RES),
    log('TextUpdated', { recordId: 1n, key: KEYS.acceptsText, value: '0x' }, RES),
  ]);
  assert.deepEqual(w.payeeInvalid, [agent.name]);
  assert.deepEqual(w.acceptsInvalid, [agent.name]);
  assert.deepEqual(w.policyCalls, []);
});

test('watcher: a registration takes its epoch from the TokenResource of the same transaction', async () => {
  const w = world();
  const watcher = watcherOf(w);
  await watcher.start();
  const tx = '0x' + 'ab'.repeat(32);
  w.state = { ...w.state, resource: (labelId(agent.label) ^ (labelId(agent.label) & 0xffffffffn)) | 3n }; // the label is REGISTERED at epoch 3 now
  const reg = { ...log('LabelRegistered', { tokenId: TOKEN, labelHash: '0x', label: agent.label, owner: OWNER, expiry: 2_500_000_000n }), transactionHash: tx };
  const res = { ...log('TokenResource', { tokenId: TOKEN, resource: (labelId(agent.label) ^ (labelId(agent.label) & 0xffffffffn)) | 3n }), transactionHash: tx };
  await watcher.handle([reg, res]);
  assert.deepEqual(w.policyCalls, [{ node: NODE, epoch: 3, revoked: false, expiry: 2_000_000_000n }]);
  assert.deepEqual(w.patches.at(-1), { node: NODE, epoch: 3, status: 'active', expiry: 2_000_000_000n });
});

test('watcher: a replayed event never undoes a kill or revokes a live label', async () => {
  // a replayed LabelRegistered of a label unregistered since: ignored
  const w = world({ state: { status: STATUS.AVAILABLE, expiry: 1_500n, latestOwner: zeroAddress, tokenId: TOKEN, resource: 9n } });
  const watcher = createEnsWatcher({ client: w.client, names: [agent.name], sink: w.sink, reader: w.reader, gate: w.gate, epochs: { [agent.name]: 0 }, checkpoint: w.checkpoint });
  await watcher.start();
  w.policyCalls.length = 0;
  await watcher.handle([log('LabelRegistered', { tokenId: TOKEN, labelHash: '0x', label: agent.label, owner: OWNER, expiry: 2_500_000_000n })]);
  assert.deepEqual(w.policyCalls, []);
  // a replayed LabelUnregistered of a label registered again since: ignored
  const live = world();
  const w2 = watcherOf(live);
  await w2.start();
  await w2.handle([log('LabelUnregistered', { tokenId: TOKEN })]);
  assert.deepEqual(live.policyCalls, []);
});

test('watcher: a renew after a lapse moves only the expiry; it never lifts a revocation the watcher did not set', async () => {
  const w = world();
  const watcher = watcherOf(w);
  await watcher.start();
  w.nowTs = 3_000_000_000n;
  await watcher.tick();
  w.policyCalls.length = 0;
  w.nowTs = 1_000n;
  await watcher.handle([log('ExpiryUpdated', { tokenId: TOKEN, newExpiry: 2_000_000_000n })]);
  assert.deepEqual(w.policyCalls, [{ node: NODE, epoch: 0, expiry: 2_000_000_000n }]);
});

test('watcher: a failed sink sets no mark and leaves the checkpoint; the next poll repeats the batch', async () => {
  const w = world();
  const watcher = watcherOf(w);
  await watcher.start();
  assert.equal(await w.checkpoint.get(), 100n);
  w.head = 105n;
  w.state = { status: STATUS.AVAILABLE, expiry: 1_500n, latestOwner: zeroAddress, tokenId: TOKEN, resource: 9n };
  w.logs = [log('LabelUnregistered', { tokenId: TOKEN }, REG, 103n)];
  w.failPolicy = true;
  await assert.rejects(watcher.poll(), /LabelUnregistered/);
  assert.equal(watcher.tracked()[0].revoked, false);
  assert.deepEqual(w.patches, []);
  assert.equal(await w.checkpoint.get(), 102n);
  w.failPolicy = false;
  await watcher.poll();
  assert.equal(watcher.tracked()[0].revoked, true);
  assert.equal(await w.checkpoint.get(), 105n);
});

test('watcher: the ticker marks a lapse once, after the sink; a lapse emits no event', async () => {
  const w = world();
  const watcher = watcherOf(w);
  await watcher.start();
  assert.deepEqual(await watcher.tick(), { marked: 0 });
  w.nowTs = 2_000_000_001n;
  assert.deepEqual(await watcher.tick(), { marked: 1 });
  assert.deepEqual(await watcher.tick(), { marked: 0 });
  assert.deepEqual(w.patches, [{ node: NODE, status: 'expired' }]);
});

test('watcher: at start, a name unregistered while the watcher was down is revoked from chain state', async () => {
  const w = world({ state: { status: STATUS.AVAILABLE, expiry: 1_500n, latestOwner: zeroAddress, tokenId: TOKEN, resource: 9n } });
  const watcher = createEnsWatcher({ client: w.client, names: [agent.name], sink: w.sink, reader: w.reader, gate: w.gate, epochs: { [agent.name]: 0 }, checkpoint: w.checkpoint });
  await watcher.start();
  assert.deepEqual(w.policyCalls, [{ node: NODE, epoch: 0, revoked: true }]);
});

const cfg = { wallet: '0x6666666666666666666666666666666666666666', capMicro: 5_000_000n };
const policy = (over = {}) => ({ epoch: 0, wallet: cfg.wallet, revoked: false, dailyCapMicro: 5_000_000n, expiry: 0n, ...over });

test('policy sink: never creates a policy; a revoke needs no list and writes cap 0 and expiry 0 with the bound wallet', async () => {
  const written = [];
  const mk = (cur, configured = () => cfg) => createPolicySink({ configured, readPolicy: async () => cur, writePolicy: async (c) => written.push(c) });
  assert.match((await mk(policy({ wallet: zeroAddress })).updatePolicy({ node: NODE, epoch: 0, revoked: true })).skipped, /never creates/);
  await mk(policy(), () => undefined).updatePolicy({ node: NODE, epoch: 0, revoked: true }); // not in the list: still revoked
  assert.deepEqual(written.pop(), { node: NODE, epoch: 0, wallet: cfg.wallet, revoked: true, capMicro: 0n, expiry: 0n });
  assert.equal((await mk(policy({ revoked: true, dailyCapMicro: 0n })).updatePolicy({ node: NODE, epoch: 0, revoked: true })).inStep, true);
  assert.match((await mk(policy({ epoch: 4 })).updatePolicy({ node: NODE, epoch: 3, revoked: true })).skipped, /newer epoch/);
});

test("policy sink: the owner's cap lowers a live policy to min(owner, configured), never raises it, and moves nothing else", async () => {
  const written = [];
  const mk = (cur, configured = () => cfg) => createPolicySink({ configured, readPolicy: async () => cur, writePolicy: async (c) => written.push(c) });
  await mk(policy({ expiry: 77n })).updatePolicy({ node: NODE, epoch: 0, ownerCapMicro: 2_000_000n });
  assert.deepEqual(written.pop(), { node: NODE, epoch: 0, wallet: cfg.wallet, revoked: false, capMicro: 2_000_000n, expiry: 77n });
  // above the configured cap: the configured cap, which the chain already holds
  assert.equal((await mk(policy()).updatePolicy({ node: NODE, epoch: 0, ownerCapMicro: 900_000_000_000n })).inStep, true);
  // back up from a lowered pass, but never past the configured cap
  await mk(policy({ dailyCapMicro: 2_000_000n })).updatePolicy({ node: NODE, epoch: 0, ownerCapMicro: 900_000_000_000n });
  assert.equal(written.pop().capMicro, cfg.capMicro);
  await mk(policy()).updatePolicy({ node: NODE, epoch: 0, ownerCapMicro: 0n });
  assert.equal(written.pop().capMicro, 0n);
  assert.match((await mk(policy({ revoked: true, dailyCapMicro: 0n })).updatePolicy({ node: NODE, epoch: 0, ownerCapMicro: 1n })).skipped, /revoked/);
  assert.match((await mk(policy({ epoch: 1 })).updatePolicy({ node: NODE, epoch: 0, ownerCapMicro: 1n })).skipped, /epoch/);
  assert.match((await mk(policy(), () => undefined).updatePolicy({ node: NODE, epoch: 0, ownerCapMicro: 1n })).skipped, /no configured/);
  assert.match((await mk(policy({ wallet: zeroAddress })).updatePolicy({ node: NODE, epoch: 0, ownerCapMicro: 1n })).skipped, /never creates/);
  assert.equal(written.length, 0);
});

test('policy sink: reopening takes the configured cap and never an ENS value; a plain renew keeps the cap and a never-expiring policy', async () => {
  const written = [];
  const mk = (cur, configured = () => cfg) => createPolicySink({ configured, readPolicy: async () => cur, writePolicy: async (c) => written.push(c) });
  assert.match((await mk(policy({ revoked: true, dailyCapMicro: 0n })).updatePolicy({ node: NODE, epoch: 0, revoked: false, expiry: 99n })).skipped, /not lifted/);
  await mk(policy({ revoked: true, dailyCapMicro: 0n })).updatePolicy({ node: NODE, epoch: 1, revoked: false, expiry: 99n });
  assert.deepEqual(written.pop(), { node: NODE, epoch: 1, wallet: cfg.wallet, revoked: false, capMicro: 5_000_000n, expiry: 99n });
  assert.match((await mk(policy({ revoked: true, dailyCapMicro: 0n }), () => undefined).updatePolicy({ node: NODE, epoch: 1, revoked: false })).skipped, /no configured/);
  await mk(policy({ expiry: 50n, dailyCapMicro: 1_000_000n })).updatePolicy({ node: NODE, epoch: 0, expiry: 99n });
  assert.deepEqual(written.pop(), { node: NODE, epoch: 0, wallet: cfg.wallet, revoked: false, capMicro: 1_000_000n, expiry: 99n }); // the owner-set cap is kept
  assert.equal((await mk(policy()).updatePolicy({ node: NODE, epoch: 0, expiry: 99n })).inStep, true);
  await mk(policy()).updatePolicy({ node: NODE, epoch: 1, revoked: false, expiry: 99n }); // a new epoch reopens at the configured cap
  assert.equal(written.pop().capMicro, 5_000_000n);
});
