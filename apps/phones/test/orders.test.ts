import assert from 'node:assert/strict';
import { test } from 'node:test';
import { amountToMicro, csvCells, foldOrders, itemsFor, microToAmount, parentName, rowFromEdge, rowsFromCsv, type FoldContext } from '../src/orders.ts';

const SHOP = 'shop-a.example.eth';
const PERSONA = 'owner.example.eth';
const PAYER = `payer.${PERSONA}`;
const TX = (n: number) => `0x${String(n).padStart(64, '0')}`;
const ORDER = `0x${'ab'.repeat(32)}`;

const ctx: FoldContext = {
  persona: { name: 'Owner', ens: PERSONA },
  shops: [{ ens: SHOP, name: 'Shop A' }],
  products: [{ shop: SHOP, name: 'sweet, box of 12', short: 'sweet × 12', unitName: 'sweet', priceMicro: 4_800_000n, quantity: 12 }],
  txLink: (tx) => ({ label: 'tx', url: `https://explorer.example/tx/${tx}` }),
};

const HEADER = 'date_utc,date_local,order_id,kind,buyer_ens,payer_ens,shop_ens,amount_usdt,net_effect_usdt,token,tx_hash,explorer_link,ref';
const line = (ts: string, kind: string, amount: string, tx: string, ref: string, order = ORDER, owner = PERSONA, payer = PAYER) =>
  [ts, ts, order, kind, owner, payer, SHOP, amount, amount, 'USDT', tx, tx ? `https://x/tx/${tx}` : '', ref].join(',');

test('amounts round-trip between text and micro units', () => {
  assert.equal(amountToMicro('4.80'), 4_800_000n);
  assert.equal(amountToMicro('-0.4'), -400_000n);
  assert.equal(microToAmount(4_800_000n), '4.80');
  assert.equal(microToAmount(5_000n), '0.01');
  assert.equal(microToAmount(1_200_000n), '1.20');
});

test('csv cells keep quoted commas and quotes', () => {
  assert.deepEqual(csvCells('a,"b,c","d""e",'), ['a', 'b,c', 'd"e', '']);
});

test('a paid, delivered and partly refunded order folds from the export', () => {
  const csv = [
    HEADER,
    line('2026-11-06T05:44:13.000Z', 'order', '4.80', TX(1), `1874:${TX(1)}:0`),
    line('2026-11-06T05:44:13.000Z', 'pay', '4.80', TX(1), `1874:${TX(1)}:3`),
    line('2026-11-06T05:44:19.000Z', 'deliver', '0.00', TX(2), `1874:${TX(2)}:0`),
    line('2026-11-06T06:00:00.000Z', 'request', '0.80', TX(3), `1874:${TX(3)}:0`),
    line('2026-11-06T06:05:00.000Z', 'refund', '0.80', TX(4), `1874:${TX(4)}:0`),
  ].join('\r\n');
  const [order, ...rest] = foldOrders(rowsFromCsv(csv), ctx);
  assert.equal(rest.length, 0);
  assert.ok(order);
  assert.equal(order.status, 'delivered');
  assert.deepEqual(order.total, { amount: '4.80', currency: 'USDT' });
  assert.equal(order.owner.name, 'Owner');
  assert.equal(order.buyer.ens, PAYER);
  assert.equal(order.items[0]?.name, 'sweet, box of 12');
  assert.equal(order.links[0]?.url, `https://explorer.example/tx/${TX(1)}`);
  assert.equal(order.refunds.length, 1);
  assert.equal(order.refunds[0]?.status, 'refunded');
  assert.equal(order.refunds[0]?.full, false);
  assert.deepEqual(order.reputation, { orders: 1, refunds: 1, since: '2026' });
  assert.equal(order.risk.level, 'warn');
  assert.equal(order.synthetic, false);
});

test('a subscription row alone is no order', () => {
  const csv = [HEADER, line('2026-11-06T05:00:00.000Z', 'subscribe', '0.40', TX(5), `1874:${TX(5)}:0`)].join('\n');
  assert.deepEqual(foldOrders(rowsFromCsv(csv), ctx), []);
});

test('seeded history rows without a transaction never become orders', () => {
  const csv = [HEADER, line('2026-10-06T11:51:28.000Z', 'pay', '4.80', '', 'hist:b7d36bb9:841', ORDER, 'buyer.sim.example.eth', 'buyer.sim.example.eth')].join('\n');
  assert.deepEqual(foldOrders(rowsFromCsv(csv), ctx), []);
});

test('a re-order of a few pieces names its quantity from the unit price', () => {
  assert.deepEqual(itemsFor(SHOP, 1_200_000n, ctx.products), [{ name: 'sweet', qty: 3, price: { amount: '0.40', currency: 'USDT' } }]);
  assert.deepEqual(itemsFor(SHOP, 1_234_567n, ctx.products), []);
});

test('a stream edge becomes a row from the buyer agent, whichever way it points', () => {
  const pay = rowFromEdge({ kind: 'pay', from: PAYER, to: SHOP, amountMicro: '4800000', orderId: ORDER, ref: `1874:${TX(1)}:3`, ts: '1793944000', settlementTx: TX(1) }, SHOP);
  const refund = rowFromEdge({ kind: 'refund', from: SHOP, to: PAYER, amountMicro: '800000', orderId: ORDER, ref: `1874:${TX(4)}:0`, ts: '1793945000', settlementTx: null }, SHOP);
  assert.equal(pay.payer, PAYER);
  assert.equal(pay.owner, PERSONA);
  assert.equal(refund.payer, PAYER);
  assert.equal(refund.tx, TX(4));
  assert.equal(parentName(PAYER), PERSONA);
  const [order] = foldOrders([pay, refund], ctx, () => true);
  assert.equal(order?.status, 'paid');
  assert.equal(order?.isNew, true);
  assert.equal(order?.refunds[0]?.status, 'refunded');
});
