// A checkout lifecycle as the mirror sees it (decoded events), built from the spec's
// lifecycle (SPEC/PAYMENTS_WHITECHAIN.md §2, ACCEPTANCE_TESTS.md C2–C4): an errand and
// its delivery, a partial refund, a re-order, a subscription with one renewal paid by
// the human and one failed, a revoked agent's failed payment and its replay. The good
// shop's expected tallies are the lab's fork-transcript result (SPEC/INTEGRATION_AND_MIRROR.md
// §3): orders 5, paid 6.40, one refund of 0.80, 2 fails, 3 delivered. Amounts come from
// the story; the scout's 0.40 is its share of the disposable cap in the C4 beat.

import { story } from '@graphpay/config';
import { cast, ev, hash, ZERO } from './fakes.mjs';

export const DEPLOY_BLOCK = 100;
const T0 = 1_762_400_000;
export const blockTime = (b) => T0 + b * 60;

export function lifecycle() {
  const c = cast();
  const n = (ens) => c.node(ens);
  const { order, renewal } = story;
  const price = BigInt(order.priceMicro);
  const reorder = BigInt(order.reorder.priceMicro);
  const refund = BigInt(order.refundMicro);
  const box = BigInt(renewal.priceMicro);
  const o1 = hash('order-1');
  const o2 = hash('order-2');
  const o3 = hash('order-3');
  const s1 = hash('sub-1');
  const r1 = hash('renewal-1');
  const payerAgent = n(c.names.payer);
  const scout = n(c.names.scout);
  const persona = n(c.names.persona);
  const shop = n(c.names.good);
  const wallet = (s) => `0x${hash(s).slice(26)}`;
  const day = (b) => BigInt(Math.floor(blockTime(b) / 86_400));
  const created = (orderId, payerNode, amountMicro, kind, parentOrderId, block, li = 0) =>
    ev('OrderCreated', { orderId, shopNode: shop, buyerNode: persona, payerNode, merchant: wallet('merchant'), amountMicro, deadline: BigInt(blockTime(block) + 600), parentOrderId, kind }, block, li);
  const settled = (orderId, payerNode, amountMicro, block, li = 1) =>
    ev('PaymentSettled', { orderId, payerNode, shopNode: shop, payer: wallet(payerNode), amountMicro, day: day(block), mandateHash: hash(`m:${orderId}`), payerEpoch: 0 }, block, li);
  const delivered = (orderId, block, afterS) => ev('OrderDelivered', { orderId, shopNode: shop, deliveredAt: BigInt(blockTime(block) + afterS) }, block);

  const events = [
    ev('RelayerSet', { relayer: wallet('relayer'), allowed: true }, DEPLOY_BLOCK),
    ev('AgentPolicySet', { payerNode: payerAgent, epoch: 0, wallet: wallet('payer'), revoked: false, dailyCapMicro: 6_000_000n, expiry: 0n }, DEPLOY_BLOCK + 1, 0),
    ev('AgentPolicySet', { payerNode: scout, epoch: 0, wallet: wallet('scout'), revoked: false, dailyCapMicro: 1_000_000n, expiry: 0n }, DEPLOY_BLOCK + 1, 1),
    created(o1, payerAgent, price, 0, ZERO, 110),
    settled(o1, payerAgent, price, 110),
    delivered(o1, 120, 0),
    ev('Refunded', { orderId: o1, shopNode: shop, buyerNode: persona, amountMicro: refund, totalRefundedMicro: refund, full: false, reason: 1 }, 130),
    created(o2, payerAgent, reorder, 1, o1, 140),
    settled(o2, payerAgent, reorder, 140),
    delivered(o2, 150, 0),
    ev('SubscriptionCreated', { subId: s1, subscriberNode: persona, shopNode: shop, amountMicro: box, period: 120, firstChargeAt: BigInt(blockTime(165)) }, 160),
    created(r1, ZERO, box, 2, ZERO, 170, 0),
    settled(r1, ZERO, box, 170, 1),
    ev('SubscriptionRenewed', { subId: s1, orderId: r1, cycle: 1, amountMicro: box }, 170, 2),
    delivered(r1, 175, 0),
    ev('AgentPolicySet', { payerNode: scout, epoch: 0, wallet: wallet('scout'), revoked: true, dailyCapMicro: 1_000_000n, expiry: 0n }, 178),
    created(o3, scout, 400_000n, 0, ZERO, 180, 0),
    ev('PaymentFailed', { orderId: o3, payerNode: scout, shopNode: shop, amountMicro: 400_000n, reason: 1, payerEpoch: 0 }, 180, 1),
    ev('PaymentFailed', { orderId: o3, payerNode: scout, shopNode: shop, amountMicro: 400_000n, reason: 5, payerEpoch: 0 }, 185),
    ev('RenewalFailed', { subId: s1, cycle: 2, reason: 3 }, 190),
  ];
  return {
    c,
    events,
    nodes: { payerAgent, scout, persona, shop },
    expected: { orders: 5, paidMicro: price + reorder + box, refunds: 1, refundedMicro: refund, fails: 2, delivered: 3, onTime: 3 },
  };
}
