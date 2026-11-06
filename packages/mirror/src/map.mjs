// One checkout event → one Arkiv write (SPEC/INTEGRATION_AND_MIRROR.md §3): an edge,
// a standing patch on a node, nothing (the cursor just moves), or "park" while an
// actor is unknown. Epochs: the payer's from the event where it carries one, everyone
// else's from the node rows; a fresh ENSv2 name is epoch 0.

import { FAIL_REASON } from '@graphpay/contracts';
import { isZeroNode, utcDay } from './ids.mjs';

// FailReason, in the contract's order (the contracts package, M1).
export const FAIL_REASONS = FAIL_REASON;
export const DEFAULT_DELIVERY_PROMISE_S = 2 * 60 * 60;

// Events that move no tally and write nothing; the cursor passes them.
const NO_WRITE = new Set([
  'DisputeResolved',
  'EIP712DomainChanged',
  'SubscriptionLapsed',
  'RelayerSet',
  'PolicyWriterSet',
  'OwnershipTransferStarted',
  'OwnershipTransferred',
]);

const failReason = (n) => FAIL_REASONS[Number(n)] ?? `UNKNOWN_${Number(n)}`;

// What a skipped event (already on Arkiv) still teaches the later ones in this run.
export function observeEvent(e, { orders }) {
  if (e.name === 'OrderCreated') orders.noteOrder(e.args.orderId, e.args);
  if (e.name === 'SubscriptionCreated') orders.noteSub(e.args.subId, e.args);
}

// The epoch an event states for an actor it names, if it states one.
export function epochHint(e, node) {
  const a = e.args;
  if (e.name === 'AgentPolicySet' && a.payerNode?.toLowerCase() === node) return Number(a.epoch);
  if ((e.name === 'PaymentSettled' || e.name === 'PaymentFailed') && a.payerNode?.toLowerCase() === node) return Number(a.payerEpoch);
  return undefined;
}

// ctx: { actors, orders, blockTime(block) → unix seconds, deliveryPromiseS }
export async function mapEvent(e, ctx) {
  const { actors, orders } = ctx;
  const a = e.args;
  const ts = () => ctx.blockTime(e.block);

  const edge = async (kind, fromNode, toNode, fields = {}) => {
    // The zero node is no one: a checkout-kit payment from a wallet with no ENS name. It can
    // never be registered, so it is passed with nothing written rather than parked: a parked
    // event holds the checkpoint, and every restart would re-scan from it.
    if ([fromNode, toNode].some((n) => /^0x0{64}$/i.test(String(n)))) return { action: 'none', why: 'anonymous party (the zero node): outside the graph' };
    const unknown = [fromNode, toNode].filter((n) => !actors.has(n));
    if (unknown.length) return { action: 'park', nodes: unknown, why: 'unknown actor' };
    const from = actors.get(fromNode);
    const to = actors.get(toNode);
    const at = fields.ts ?? (await ts());
    return {
      action: 'edge',
      edge: {
        ref: e.id,
        kind,
        fromNode: from.node,
        toNode: to.node,
        fromEpoch: fields.fromEpoch ?? from.epoch,
        toEpoch: to.epoch,
        fromEns: from.ens,
        toEns: to.ens,
        fromKind: from.kind,
        toKind: to.kind,
        amountMicro: BigInt(fields.amountMicro ?? 0n),
        ts: at,
        day: fields.day ?? utcDay(at),
        orderId: fields.orderId ?? null,
        payload: fields.payload ?? null,
        counted: fields.counted ?? true,
        synthetic: false,
      },
    };
  };

  const orderOrPark = async (orderId) => {
    const o = await orders.order(orderId);
    return o?.payerNode ? o : null;
  };

  switch (e.name) {
    case 'OrderCreated': {
      orders.noteOrder(a.orderId, a);
      const payer = isZeroNode(a.payerNode) ? a.buyerNode : a.payerNode;
      const payload = { orderKind: Number(a.kind) };
      if (!isZeroNode(a.parentOrderId)) payload.parentOrderId = a.parentOrderId;
      if (isZeroNode(a.payerNode)) payload.human = true;
      return edge('order', payer, a.shopNode, { amountMicro: a.amountMicro, orderId: a.orderId, payload });
    }
    case 'PaymentSettled': {
      const at = await ts();
      orders.notePaid(a.orderId, { at });
      const human = isZeroNode(a.payerNode);
      const payer = human ? (await orderOrPark(a.orderId))?.payerNode : a.payerNode;
      if (!payer) return { action: 'park', nodes: [], why: 'order unknown', orderId: a.orderId };
      return edge('pay', payer, a.shopNode, {
        amountMicro: a.amountMicro,
        orderId: a.orderId,
        ts: at,
        day: Number(a.day),
        fromEpoch: human ? undefined : Number(a.payerEpoch),
        payload: { mandateHash: a.mandateHash },
      });
    }
    case 'PaymentFailed': {
      const human = isZeroNode(a.payerNode);
      const payer = human ? (await orderOrPark(a.orderId))?.payerNode : a.payerNode;
      if (!payer) return { action: 'park', nodes: [], why: 'order unknown', orderId: a.orderId };
      const reason = failReason(a.reason);
      return edge('fail', payer, a.shopNode, {
        amountMicro: a.amountMicro,
        orderId: a.orderId,
        fromEpoch: human ? undefined : Number(a.payerEpoch),
        payload: { onchain: true, reason },
        // A replayed settle is recorded, never counted (SPEC/ARKIV_GRAPH.md §3).
        counted: reason !== 'DUPLICATE',
      });
    }
    case 'Refunded': {
      const o = await orderOrPark(a.orderId);
      if (!o) return { action: 'park', nodes: [], why: 'order unknown', orderId: a.orderId };
      return edge('refund', a.shopNode, o.payerNode, {
        amountMicro: a.amountMicro,
        orderId: a.orderId,
        payload: { full: Boolean(a.full), reason: Number(a.reason), totalRefundedMicro: String(a.totalRefundedMicro) },
      });
    }
    case 'OrderDelivered': {
      const o = await orderOrPark(a.orderId);
      if (!o || o.paidAt === undefined) return { action: 'park', nodes: [], why: 'payment time unknown', orderId: a.orderId };
      const deliveredAt = Number(a.deliveredAt);
      // On time = within the delivery promise after the payment; OrderCreated.deadline
      // is the payment deadline, not a promise (SPEC/INTEGRATION_AND_MIRROR.md §8 item 5).
      const onTime = deliveredAt - o.paidAt <= (ctx.deliveryPromiseS ?? DEFAULT_DELIVERY_PROMISE_S);
      return edge(onTime ? 'deliver' : 'late', a.shopNode, o.payerNode, {
        orderId: a.orderId,
        ts: deliveredAt,
        payload: { paidAt: o.paidAt, deliveredAt },
      });
    }
    case 'OrderCancelled': {
      const o = await orderOrPark(a.orderId);
      if (!o) return { action: 'park', nodes: [], why: 'order unknown', orderId: a.orderId };
      return edge('cancel', o.payerNode, o.shopNode, { orderId: a.orderId, payload: { by: a.byNode, reason: Number(a.reason) } });
    }
    case 'Disputed': {
      const o = await orderOrPark(a.orderId);
      const payer = o?.payerNode ?? a.buyerNode;
      return edge('dispute', payer, a.shopNode, { orderId: a.orderId, payload: { by: a.buyerNode, reason: Number(a.reason) } });
    }
    case 'SubscriptionCreated': {
      orders.noteSub(a.subId, a);
      return edge('subscribe', a.subscriberNode, a.shopNode, {
        amountMicro: a.amountMicro,
        orderId: a.subId,
        payload: { period: Number(a.period), firstChargeAt: Number(a.firstChargeAt) },
      });
    }
    case 'SubscriptionRenewed': {
      const s = await orders.sub(a.subId);
      if (!s) return { action: 'park', nodes: [], why: 'subscription unknown', subId: a.subId };
      // The money is on the renewal's PaymentSettled; the renew edge carries 0.
      return edge('renew', s.subscriberNode, s.shopNode, {
        amountMicro: 0n,
        orderId: a.orderId,
        payload: { subId: a.subId, cycle: Number(a.cycle), amountMicro: String(a.amountMicro) },
      });
    }
    case 'RenewalFailed': {
      const s = await orders.sub(a.subId);
      if (!s) return { action: 'park', nodes: [], why: 'subscription unknown', subId: a.subId };
      return edge('fail', s.subscriberNode, s.shopNode, {
        orderId: a.subId,
        payload: { onchain: true, reason: failReason(a.reason), subId: a.subId, cycle: Number(a.cycle) },
      });
    }
    case 'SubscriptionCancelled': {
      const s = await orders.sub(a.subId);
      if (!s) return { action: 'park', nodes: [], why: 'subscription unknown', subId: a.subId };
      return edge('cancel', s.subscriberNode, s.shopNode, {
        orderId: a.subId,
        payload: { by: a.byNode, subId: a.subId, effectiveAt: Number(a.effectiveAt) },
      });
    }
    case 'AgentPolicySet': {
      if (!actors.has(a.payerNode)) return { action: 'park', nodes: [a.payerNode], why: 'unknown actor' };
      const actor = actors.get(a.payerNode);
      const epoch = Number(a.epoch);
      // Standing only within the node's own epoch; a new epoch arrives with its node row.
      if (epoch !== actor.epoch) return { action: 'none', why: `policy epoch ${epoch} is not the node's epoch ${actor.epoch}` };
      const expiry = Number(a.expiry);
      const at = await ts();
      const status = a.revoked ? 'revoked' : expiry !== 0 && at >= expiry ? 'expired' : 'active';
      const capMicro = BigInt(a.dailyCapMicro);
      // Already the node row's standing (a replay, a lost cursor): bind the wallet, write nothing.
      const unchanged = actor.status === status && actor.capMicro != null && BigInt(actor.capMicro) === capMicro;
      return { action: 'standing', ref: e.id, ens: actor.ens, ts: at, node: actor.node, epoch, status, capMicro, wallet: a.wallet.toLowerCase(), unchanged };
    }
    default:
      if (NO_WRITE.has(e.name)) return { action: 'none', why: e.name };
      return { action: 'none', why: `not mirrored: ${e.name}` };
  }
}
