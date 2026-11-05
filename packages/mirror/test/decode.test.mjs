import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encodeAbiParameters, encodeEventTopics, parseAbi } from 'viem';
import { decodeLogs } from '../src/decode.mjs';
import { CHAIN, hash } from './fakes.mjs';

// Test only: two of the spec's events (SPEC/PAYMENTS_WHITECHAIN.md §3.3) with the types
// of §3.2. The mirror decodes with the contract's own ABI from M1, never with this one.
const abi = parseAbi([
  'event OrderCreated(bytes32 indexed orderId, bytes32 indexed shopNode, bytes32 indexed buyerNode, bytes32 payerNode, address merchant, uint64 amountMicro, uint64 deadline, bytes32 parentOrderId, uint8 kind)',
  'event OrderDelivered(bytes32 indexed orderId, bytes32 indexed shopNode, uint64 deliveredAt)',
]);

function log(eventName, args, data, { block, logIndex, tx }) {
  return {
    address: `0x${'11'.repeat(20)}`,
    topics: encodeEventTopics({ abi, eventName, args }),
    data,
    blockNumber: BigInt(block),
    logIndex,
    transactionHash: tx,
    blockHash: hash(`b:${block}`),
    removed: false,
  };
}

test('logs decode into events with id 1874:<tx>:<logIndex>, in chain order; unknown logs are counted', () => {
  const orderId = hash('o');
  const shopNode = hash('s');
  const tx1 = hash('tx1');
  const tx2 = hash('tx2');
  const delivered = log('OrderDelivered', { orderId, shopNode }, encodeAbiParameters([{ type: 'uint64' }], [1234n]), { block: 12, logIndex: 0, tx: tx2 });
  const created = log(
    'OrderCreated',
    { orderId, shopNode, buyerNode: hash('b') },
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'address' }, { type: 'uint64' }, { type: 'uint64' }, { type: 'bytes32' }, { type: 'uint8' }],
      [hash('p'), `0x${'22'.repeat(20)}`, 4_800_000n, 99n, `0x${'00'.repeat(32)}`, 0],
    ),
    { block: 11, logIndex: 3, tx: tx1 },
  );
  const stranger = { ...delivered, topics: [hash('Unknown(uint256)'), ...delivered.topics.slice(1)], logIndex: 1 };
  const removed = { ...created, removed: true, logIndex: 9 };
  const { events, unknown } = decodeLogs(abi, [delivered, created, stranger, removed], { chainId: CHAIN });
  assert.equal(unknown, 1);
  assert.deepEqual(events.map((e) => e.name), ['OrderCreated', 'OrderDelivered']);
  assert.equal(events[0].id, `1874:${tx1}:3`);
  assert.equal(events[0].args.amountMicro, 4_800_000n);
  assert.equal(events[1].args.deliveredAt, 1234n);
  assert.equal(events[1].block, 12);
});

test('the checkout ABI from M1 decodes every mapped event', async () => {
  const { checkoutAbi } = await import('@graphpay/contracts');
  const names = new Set(checkoutAbi.filter((x) => x.type === 'event').map((x) => x.name));
  for (const n of ['OrderCreated', 'PaymentSettled', 'PaymentFailed', 'Refunded', 'OrderDelivered', 'OrderCancelled', 'Disputed', 'SubscriptionCreated', 'SubscriptionRenewed', 'RenewalFailed', 'SubscriptionCancelled', 'AgentPolicySet']) {
    assert.ok(names.has(n), n);
  }
  const args = { orderId: hash('o'), payerNode: hash('p'), shopNode: hash('s') };
  const ev = checkoutAbi.find((x) => x.type === 'event' && x.name === 'PaymentSettled');
  const data = encodeAbiParameters(
    ev.inputs.filter((i) => !i.indexed),
    [`0x${'33'.repeat(20)}`, 4_800_000n, 20_398n, hash('m'), 0],
  );
  const l = { address: `0x${'11'.repeat(20)}`, topics: encodeEventTopics({ abi: checkoutAbi, eventName: 'PaymentSettled', args }), data, blockNumber: 5n, logIndex: 2, transactionHash: hash('t'), removed: false };
  const { events } = decodeLogs(checkoutAbi, [l], { chainId: CHAIN });
  assert.equal(events[0].name, 'PaymentSettled');
  assert.equal(events[0].args.amountMicro, 4_800_000n);
  assert.equal(events[0].args.payerEpoch, 0);
});
