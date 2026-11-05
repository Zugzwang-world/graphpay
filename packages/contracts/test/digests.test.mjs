// The committed digest fixture is exactly what viem computes from the shared type
// definitions (the Foundry suite checks the other side: by hand, the contract, the fork).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildFixture, serialise } from '../scripts/digests.mjs';
import { RENEWAL_BIT, checkoutAbi, renewalOrderId } from '../index.mjs';

test('the digest fixture matches viem', () => {
  const committed = readFileSync(new URL('./fixtures/digests.json', import.meta.url), 'utf8');
  assert.equal(committed, serialise(buildFixture()));
});

test('renewal order ids carry the top bit', () => {
  const id = renewalOrderId(`0x${'ab'.repeat(32)}`, 2);
  assert.equal(BigInt(id) & RENEWAL_BIT, RENEWAL_BIT);
});

test('the ABI exports every function and event the other tracks read', () => {
  const names = new Set(checkoutAbi.map((e) => `${e.type}:${e.name}`));
  for (const name of [
    'function:settleOrder', 'function:orders', 'function:policies', 'function:nodeOfWallet', 'function:spentToday',
    'function:renew', 'function:subscriptionCount', 'function:subscriptionIdAt', 'function:USDT',
    'event:OrderCreated', 'event:PaymentSettled', 'event:PaymentFailed', 'event:Refunded', 'event:OrderDelivered',
    'event:OrderCancelled', 'event:Disputed', 'event:DisputeResolved', 'event:SubscriptionCreated',
    'event:SubscriptionRenewed', 'event:RenewalFailed', 'event:SubscriptionLapsed', 'event:SubscriptionCancelled',
    'event:AgentPolicySet', 'event:RelayerSet', 'event:PolicyWriterSet',
  ]) {
    assert.ok(names.has(name), name);
  }
});
