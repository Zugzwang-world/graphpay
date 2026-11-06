// The spare finder on a fake registry (the kill's live spare, scripts/ens/spare.mjs and the site's
// kill route): the lowest live disposable-<n> among the numbers with a key; a killed, lapsed or
// never-registered label is never a spare. The real registry is read on the fork and on Sepolia.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { zeroAddress } from 'viem';
import { disposableAgent, labelId, liveDisposable, namehash, nextFreeDisposable, STATUS } from '../index.mjs';

const REG = '0x3333333333333333333333333333333333333333';
const RES = '0x4444444444444444444444444444444444444444';
const HOLDER = '0x5555555555555555555555555555555555555555';

// states: n → { status, expiry } for disposable-<n>; anything else is AVAILABLE and never registered.
function fakeClient(states) {
  const reads = [];
  const byId = new Map(Object.entries(states).map(([n, s]) => [labelId(disposableAgent(Number(n)).label), s]));
  return {
    reads,
    readContract: async ({ functionName, args }) => {
      reads.push(functionName);
      if (functionName === 'getSubregistry') return REG;
      // getState takes the label's id, getResolver the label itself
      const id = typeof args[0] === 'string' ? labelId(args[0]) : BigInt(args[0]);
      const s = byId.get(id) ?? { status: STATUS.AVAILABLE, expiry: 0n };
      if (functionName === 'getState') return { status: s.status, expiry: s.expiry, latestOwner: s.status === STATUS.REGISTERED ? HOLDER : zeroAddress, tokenId: id, resource: 0n };
      if (functionName === 'getResolver') return s.status === STATUS.REGISTERED ? RES : zeroAddress;
      throw new Error(`fake registry: ${functionName}`);
    },
  };
}

test('liveDisposable: the lowest registered label among the numbers with a key, with its node, epoch and holder', async () => {
  const client = fakeClient({ 1: { status: STATUS.AVAILABLE, expiry: 1_700_000_000n }, 2: { status: STATUS.REGISTERED, expiry: 2_000_000_000n }, 3: { status: STATUS.REGISTERED, expiry: 2_000_000_000n } });
  const spare = await liveDisposable(client, [3, 1, 2, 2]);
  assert.equal(spare.n, 2);
  assert.equal(spare.name, disposableAgent(2).name);
  assert.equal(spare.node, namehash(disposableAgent(2).name));
  assert.equal(spare.epoch, 0);
  assert.equal(spare.holder, HOLDER);
  assert.equal(spare.resolver, RES);
  // killed (1) is skipped; without 2 and 3 in the key pool there is no spare
  assert.equal(await liveDisposable(client, [1, 4]), null);
  assert.equal(await liveDisposable(client, []), null);
  // the next free label skips the killed one and the live ones
  assert.equal(await nextFreeDisposable(client, { parentRegistry: REG }), 4);
});

test('liveDisposable: a RESERVED label (renewed after a kill) is never a spare', async () => {
  const client = fakeClient({ 2: { status: STATUS.RESERVED, expiry: 2_000_000_000n } });
  assert.equal(await liveDisposable(client, [2], { parentRegistry: REG }), null);
});
