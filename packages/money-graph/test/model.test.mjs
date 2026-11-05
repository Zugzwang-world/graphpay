import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkDefinition, checkIndexes } from '@graphpay/arkiv-graph';
import { ENTITIES, QUERIES, tallyRules, trustedOwners, writerAddresses } from '../index.mjs';

test('every entity passes the definition check', () => {
  for (const def of Object.values(ENTITIES)) assert.deepEqual(checkDefinition(def, { noBytes: def.type === 'tally' }), [], def.type);
});

test('index rule: an attribute is indexed if and only if a shipped query filters on it (ADR-0041)', () => {
  assert.deepEqual(Object.keys(QUERIES).sort(), Object.keys(ENTITIES).sort());
  for (const [type, filtered] of Object.entries(QUERIES)) assert.deepEqual(checkIndexes(ENTITIES[type], filtered), [], type);
});

test('GraphPay rules: *_micro is u64, an epoch wherever a node is stored, no bytes on tallies, readonly edges and quotes', () => {
  for (const def of Object.values(ENTITIES)) {
    const cols = def.schema.columns;
    for (const [name, c] of Object.entries(cols)) {
      if (name.endsWith('_micro')) assert.equal(c.type, 'u64', `${def.type}.${name}`);
      const m = /^(from|to)?_?node$/.exec(name);
      if (m && c.type === 'key') assert.ok(Object.hasOwn(cols, m[1] ? `${m[1]}_epoch` : 'epoch'), `${def.type}.${name} has an epoch`);
      if (def.type === 'tally') assert.notEqual(c.type, 'bytes');
    }
  }
  assert.equal(ENTITIES.edge.readonly, true);
  assert.equal(ENTITIES.quote.readonly, true);
  assert.equal(ENTITIES.tally.readonly, false);
  assert.equal(ENTITIES.shop.readonly, false);
});

test('tally rules: a renewal counts its own value (0 on the renew edge), DUPLICATE and owns move nothing', () => {
  assert.deepEqual(tallyRules({ kind: 'pay' }), { paid_micro: 'value' });
  assert.deepEqual(tallyRules({ kind: 'refund' }), { refunds: 'count', refunded_micro: 'value' });
  assert.equal(tallyRules({ kind: 'fail', reason: 'DUPLICATE' }), null);
  assert.equal(tallyRules({ kind: 'owns' }), null);
  assert.equal(tallyRules({ kind: 'request' }), null);
});

test('writer addresses come from the config; trusted owners per type', () => {
  const w = writerAddresses();
  assert.equal(Object.keys(w).length, 5);
  for (const a of Object.values(w)) assert.match(a, /^0x[0-9a-f]{40}$/);
  assert.deepEqual(trustedOwners('edge', { writers: w }), [w.W_LEDGER, w.W_SYNC]);
  assert.deepEqual(trustedOwners('shop', { writers: w }), [w.W_DIRECTORY]);
  assert.throws(() => writerAddresses({ arkiv: { writers: { ...w, W_LEDGER: '' } } }), /blank/);
  assert.throws(() => writerAddresses({ arkiv: { writers: { ...w, W_SYNC: '0x12' } } }), /malformed/);
});
