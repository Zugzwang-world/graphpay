import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config, story } from '@graphpay/config';
import { RENEWAL_BIT } from '@graphpay/contracts';
import { createOrder, orderFromWire, orderToWire, formatUsdt, usdt, toCsv, nodeOf, ZERO32 } from '../index.mjs';

const shop = story.shops[0];
const product = shop.products[0];
const merchant = { name: `${shop.label}.${config.root.ens}`, address: `0x${'11'.repeat(20)}` };
const payer = { name: `${story.buyerAgents.find((a) => a.pays).label}.${story.persona.label}.${config.root.ens}`, address: `0x${'22'.repeat(20)}` };
const base = { merchant, payer, items: [{ sku: product.sku, name: product.name, quantity: 2, unitPriceMicro: product.priceMicro }], fulfilment: { type: 'delivery', details: { area: 'synthetic' } }, deadline: 2_000_000_000 };

test('usdt amounts are exact micro-units', () => {
  assert.equal(usdt('4.80'), 4_800_000n);
  assert.equal(usdt('0.000001'), 1n);
  assert.equal(formatUsdt(4_800_000n), '4.80');
  assert.equal(formatUsdt(1_234_567n), '1.234567');
  assert.throws(() => usdt('1.0000001'));
  assert.throws(() => usdt('-1'));
});

test('an order totals its lines and binds every term into its id', () => {
  const o = createOrder(base);
  assert.equal(o.totalMicro, BigInt(product.priceMicro) * 2n);
  assert.equal(o.chain.amountMicro, o.totalMicro);
  assert.equal(o.chain.shopNode, nodeOf(merchant.name));
  assert.equal(o.chain.payerNode, nodeOf(payer.name));
  assert.equal(o.kind, 0);
  assert.equal(BigInt(o.orderId) & RENEWAL_BIT, 0n);
  for (const change of [
    { items: [{ ...base.items[0], quantity: 3 }] },
    { fulfilment: { type: 'pickup' } },
    { deadline: 2_000_000_001 },
    { salt: `0x${'01'.repeat(32)}` },
    { payer: { ...payer, address: `0x${'33'.repeat(20)}` } },
    { merchant: { ...merchant, address: `0x${'44'.repeat(20)}` } },
  ]) {
    assert.notEqual(createOrder({ ...base, ...change }).orderId, o.orderId, JSON.stringify(Object.keys(change)));
  }
});

test('fixed-price only: a stated total must equal the lines', () => {
  assert.throws(() => createOrder({ ...base, totalMicro: 1n }), /fixed-price/);
  assert.equal(createOrder({ ...base, totalMicro: BigInt(product.priceMicro) * 2n }).totalMicro, BigInt(product.priceMicro) * 2n);
});

test('bad orders are refused', () => {
  assert.throws(() => createOrder({ ...base, items: [] }));
  assert.throws(() => createOrder({ ...base, items: [{ ...base.items[0], quantity: 0 }] }));
  assert.throws(() => createOrder({ ...base, items: [{ ...base.items[0], unitPriceMicro: 0 }] }));
  assert.throws(() => createOrder({ ...base, fulfilment: { type: 'teleport' } }));
  assert.throws(() => createOrder({ ...base, fulfilment: { type: 'ride', details: { a: { b: { c: { d: 1 } } } } } }));
  assert.throws(() => createOrder({ ...base, merchant: { name: '', address: merchant.address } }));
});

test('a re-order is kind 1 and a human payer has node 0', () => {
  const parent = createOrder(base);
  const re = createOrder({ ...base, parentOrderId: parent.orderId });
  assert.equal(re.kind, 1);
  const human = createOrder({ ...base, payer: { address: payer.address } });
  assert.equal(human.chain.payerNode, ZERO32);
});

test('the wire form round-trips to the same id', () => {
  const o = createOrder(base);
  const back = orderFromWire(JSON.parse(JSON.stringify(orderToWire(o))));
  assert.equal(back.orderId, o.orderId);
  const tampered = orderToWire(o);
  tampered.items[0].unitPriceMicro = '1';
  assert.throws(() => orderFromWire(tampered), /fixed-price/);
  tampered.totalMicro = String(tampered.items[0].quantity);
  assert.notEqual(orderFromWire(tampered).orderId, o.orderId);
});

test('CSV never exports a spreadsheet formula', () => {
  const csv = toCsv(['a', 'b'], [{ a: '=HYPERLINK("x")', b: 'one, "two"' }, { a: '-1.5', b: '@cmd' }]);
  assert.equal(csv, `a,b\r\n"'=HYPERLINK(""x"")","one, ""two"""\r\n-1.5,'@cmd\r\n`);
});
