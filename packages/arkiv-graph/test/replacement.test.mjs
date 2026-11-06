// Two instances of one writer key (several Vercel instances sharing a wallet): when another
// instance's transaction takes our nonce, viem's receipt wait returns THEIR receipt. The
// writer must not report their entities as ours.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ExpirationTime } from '@arkiv-network/sdk';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { ArkivSim, arkivChain, arkivClients, arkivTransport, createWriter, readAll, WriteNonceTakenError } from '../index.mjs';
import { CHAIN_ID, ENTITY_CONTRACT, socialGraph } from './helpers.mjs';

const day = ExpirationTime.fromDays(1);

// Two connections to one sim with one key: each has its own transport (its own sent hashes).
function twoInstances(writerOptions = {}) {
  const sim = new ArkivSim({ chainId: CHAIN_ID, entityContract: ENTITY_CONTRACT });
  const account = privateKeyToAccount(generatePrivateKey());
  const make = (extra = {}) => {
    const transport = arkivTransport({ url: 'http://arkivsim.invalid/', fetchFn: sim.fetch });
    const { publicClient, walletClient, sentHashes } = arkivClients({ transport, chain: arkivChain({ id: CHAIN_ID }), account, pollingInterval: 10 });
    const writer = createWriter({ walletClient, publicClient, entityContract: ENTITY_CONTRACT, recoveryMs: 300, pollMs: 20, ...writerOptions, ...extra(sentHashes) });
    return { publicClient, walletClient, writer };
  };
  return { sim, account, a: make(() => ({})), b: make((sentHashes) => ({ sentHashes })), make };
}

const batchOf = (g, ref) => {
  const planned = g.plan([{ ref, kind: 'like', from: { node: `0x${'1'.padStart(64, '0')}`, epoch: 0, kind: 'user' }, to: { node: `0x${'2'.padStart(64, '0')}`, epoch: 0, kind: 'user' }, ts: 1_760_000_000 }], g.newState(), {});
  return { planned, batch: { creates: planned.creates.map((c) => ({ ...c, expiration: day })), patches: planned.patches } };
};

// B reads its nonce, then another instance (A, its own transport) lands a transaction at it, so
// B's first send "returns" A's receipt, as viem's receipt wait does for a replacement. A's
// transaction here carries the same operations: what matters is whose entities come back.
function replaceFirstSend(instance, other) {
  const real = instance.walletClient.executeBatch.bind(instance.walletClient);
  const seen = { calls: 0, landed: null };
  instance.walletClient.executeBatch = async (sdkBatch, opts) => {
    seen.calls += 1;
    if (seen.calls === 1) {
      seen.landed = await other.walletClient.executeBatch(sdkBatch, opts);
      return seen.landed;
    }
    return real(sdkBatch, opts);
  };
  return seen;
}

test('a transaction of another instance at our nonce is not adopted as ours; we send again at the next nonce', async () => {
  const t = twoInstances();
  const g = socialGraph();
  const seen = replaceFirstSend(t.b, t.a);
  const res = await t.b.writer.send(batchOf(g, 'ours').batch);
  assert.equal(seen.calls, 2, 'sent again after the replacement');
  assert.equal(await t.b.writer.confirmedNonce(), 2, 'two transactions of this key landed: theirs at 0, ours at 1');
  assert.notEqual(res.txs[0].hash, seen.landed.txHash, "not the other instance's transaction");
  assert.ok(res.createdKeys.every((k) => !seen.landed.createdEntities.includes(k)), "not the other instance's entities");
  const edges = await readAll(t.b.publicClient, g.defs.edge, { owner: t.account.address.toLowerCase() });
  assert.equal(edges.length, 2, "the other instance's edge and ours");
});

test('with a fixed nonce, a replacement refuses with NONCE_TAKEN and sends nothing more', async () => {
  const t = twoInstances();
  const g = socialGraph();
  const seen = replaceFirstSend(t.b, t.a);
  const nonce = await t.b.writer.confirmedNonce();
  await assert.rejects(t.b.writer.send(batchOf(g, 'ours').batch, { nonce, verifyRecovered: async () => true }), (e) => e instanceof WriteNonceTakenError);
  assert.equal(seen.calls, 1);
});

test('a node that returns no transaction hash is uncertain, not a reason to send again', async () => {
  const t = twoInstances();
  const g = socialGraph();
  let calls = 0;
  t.b.walletClient.executeBatch = async () => {
    calls += 1;
    return { createdEntities: [] };
  };
  await assert.rejects(t.b.writer.send(batchOf(g, 'ours').batch), /no transaction hash/);
  assert.equal(calls, 1);
});

test('our own transaction is adopted as before (the hash is one this transport sent)', async () => {
  const t = twoInstances();
  const g = socialGraph();
  const res = await t.b.writer.send(batchOf(g, 'plain').batch);
  assert.equal(res.txs.length, 1);
  assert.equal(res.txs[0].recovered, false);
  assert.ok(res.createdKeys.length > 0);
});
