// The generic order model: items, a fixed total in USDT, the merchant, and a fulfilment
// type with its details. One model for food, shopping and rides. V1 is fixed-price only:
// the total is the sum of the lines, known before the buyer signs. Variable fares
// (pre-authorise a ceiling, capture the final amount) are V2.
//
// The order id binds every term: the merchant's and the parties' nodes, the payer's wallet,
// the hash of the items and fulfilment, the deadline, the parent order and a salt. Both
// sides derive it from the same public data, so the buyer can check what it signs and the
// merchant can check what it is paid for, with no database.

import { encodeAbiParameters, getAddress, keccak256, stringToHex } from 'viem';
import { namehash, normalize } from 'viem/ens';
import { RENEWAL_BIT, ORDER_KIND } from '@graphpay/contracts';
import { MAX_U64, toMicro } from './money.mjs';

export const ORDER_SCHEMA = 'agentpay.order/v1';
export const FULFILMENT_TYPES = Object.freeze(['delivery', 'pickup', 'ride', 'digital', 'service']);
export const ZERO32 = `0x${'0'.repeat(64)}`;
export const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;

const LIMITS = Object.freeze({ items: 50, sku: 64, itemName: 120, quantity: 10_000, name: 255, details: 2048, depth: 3 });
const HEX32 = /^0x[0-9a-fA-F]{64}$/;

// The ENS-style node of a name ('' or undefined → 0: a human payer, or no name).
export function nodeOf(name) {
  if (name === undefined || name === null || name === '') return ZERO32;
  if (typeof name !== 'string' || name.length > LIMITS.name) throw new Error('a name must be a string of at most 255 characters');
  return namehash(normalize(name));
}

// JSON with sorted keys and no white space: the same object always hashes the same.
export function canonicalJson(value) {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('details may not hold NaN or Infinity');
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'bigint') return JSON.stringify(value.toString());
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  throw new Error(`details may not hold a ${typeof value}`);
}

function depthOf(value, d = 0) {
  if (value === null || typeof value !== 'object') return d;
  return Math.max(d + 1, ...Object.values(value).map((v) => depthOf(v, d + 1)));
}

function boundedString(value, max, what) {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) throw new Error(`${what} must be a string of 1 to ${max} characters`);
  return value;
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > LIMITS.items) throw new Error(`an order has 1 to ${LIMITS.items} items`);
  return items.map((item, i) => {
    const quantity = item.quantity ?? 1;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > LIMITS.quantity) throw new Error(`item ${i}: quantity must be an integer from 1 to ${LIMITS.quantity}`);
    const unitPriceMicro = toMicro(item.unitPriceMicro, `item ${i} unitPriceMicro`);
    if (unitPriceMicro === 0n) throw new Error(`item ${i}: a price must be above zero`);
    return Object.freeze({
      sku: boundedString(item.sku, LIMITS.sku, `item ${i} sku`),
      name: boundedString(item.name, LIMITS.itemName, `item ${i} name`),
      quantity,
      unitPriceMicro,
      lineTotalMicro: unitPriceMicro * BigInt(quantity),
    });
  });
}

function normalizeFulfilment(fulfilment) {
  const type = fulfilment?.type;
  if (!FULFILMENT_TYPES.includes(type)) throw new Error(`fulfilment type must be one of ${FULFILMENT_TYPES.join(', ')}`);
  const details = fulfilment.details ?? {};
  if (typeof details !== 'object' || Array.isArray(details) || details === null) throw new Error('fulfilment details must be an object');
  if (depthOf(details) > LIMITS.depth) throw new Error('fulfilment details are nested too deeply');
  const text = canonicalJson(details);
  if (text.length > LIMITS.details) throw new Error(`fulfilment details are over ${LIMITS.details} characters`);
  return Object.freeze({ type, details: JSON.parse(text) });
}

function party(p, what) {
  const name = p?.name ?? '';
  if (typeof name !== 'string' || name.length > LIMITS.name) throw new Error(`${what} name must be at most 255 characters`);
  const address = p?.address ? getAddress(p.address) : ZERO_ADDRESS;
  return Object.freeze({ name, node: nodeOf(name), address });
}

// keccak256 of the canonical items, total and fulfilment: what the buyer gets.
export function detailsHash({ items, totalMicro, fulfilment }) {
  return keccak256(
    stringToHex(
      canonicalJson({
        schema: ORDER_SCHEMA,
        currency: 'USDT',
        items: items.map((i) => ({ sku: i.sku, name: i.name, quantity: i.quantity, unitPriceMicro: i.unitPriceMicro })),
        totalMicro,
        fulfilment,
      }),
    ),
  );
}

const ID_PARAMS = [
  { type: 'bytes32' }, // shopNode
  { type: 'address' }, // merchant
  { type: 'bytes32' }, // buyerNode
  { type: 'bytes32' }, // payerNode
  { type: 'address' }, // payer wallet (0 when not bound at quote time)
  { type: 'bytes32' }, // detailsHash
  { type: 'uint64' }, // deadline
  { type: 'bytes32' }, // parentOrderId
  { type: 'bytes32' }, // salt
];

// The order id, with the renewal bit cleared (renewal ids live in their own id space, E-5).
export function deriveOrderId(o) {
  const raw = BigInt(
    keccak256(encodeAbiParameters(ID_PARAMS, [o.shopNode, o.merchant, o.buyerNode, o.payerNode, o.payer, o.detailsHash, o.deadline, o.parentOrderId, o.salt])),
  );
  return `0x${(raw & ~RENEWAL_BIT).toString(16).padStart(64, '0')}`;
}

// → a frozen order. `totalMicro`, when given, must equal the sum of the lines (fixed price).
export function createOrder({ merchant, buyer, payer, items, fulfilment, deadline, parentOrderId = ZERO32, salt = ZERO32, totalMicro }) {
  const m = party(merchant, 'merchant');
  if (m.node === ZERO32) throw new Error('the merchant needs a name');
  if (m.address === ZERO_ADDRESS) throw new Error('the merchant needs an address');
  const p = party(payer, 'payer');
  const b = buyer?.name ? party(buyer, 'buyer') : Object.freeze({ name: p.name, node: p.node, address: ZERO_ADDRESS });
  const lines = normalizeItems(items);
  const total = lines.reduce((sum, l) => sum + l.lineTotalMicro, 0n);
  if (total > MAX_U64) throw new Error('the total is out of range');
  if (totalMicro !== undefined && toMicro(totalMicro, 'totalMicro') !== total) throw new Error('fixed-price orders only: the total must equal the sum of the lines');
  const f = normalizeFulfilment(fulfilment);
  const dl = BigInt(deadline);
  if (dl <= 0n || dl > MAX_U64) throw new Error('the deadline must be a unix time in seconds');
  if (!HEX32.test(parentOrderId) || !HEX32.test(salt)) throw new Error('parentOrderId and salt are 32-byte hex');
  const kind = parentOrderId === ZERO32 ? ORDER_KIND.ONE_OFF : ORDER_KIND.REORDER;
  const dHash = detailsHash({ items: lines, totalMicro: total, fulfilment: f });
  const orderId = deriveOrderId({
    shopNode: m.node,
    merchant: m.address,
    buyerNode: b.node,
    payerNode: p.node,
    payer: p.address,
    detailsHash: dHash,
    deadline: dl,
    parentOrderId,
    salt,
  });
  return Object.freeze({
    schema: ORDER_SCHEMA,
    orderId,
    merchant: m,
    buyer: b,
    payer: p,
    items: Object.freeze(lines),
    totalMicro: total,
    fulfilment: f,
    deadline: dl,
    parentOrderId,
    salt,
    kind,
    detailsHash: dHash,
    // The GraphPayCheckout Order struct (planning/SPEC/PAYMENTS_WHITECHAIN.md §3.2).
    chain: Object.freeze({
      orderId,
      parentOrderId,
      buyerNode: b.node,
      shopNode: m.node,
      payerNode: p.node,
      merchant: m.address,
      amountMicro: total,
      deadline: dl,
      kind,
    }),
  });
}

// The details that travel next to the 402 (PaymentRequired.extensions.agentpay), numbers as strings.
export function orderToWire(order) {
  return {
    schema: order.schema,
    merchant: { name: order.merchant.name, address: order.merchant.address },
    buyer: { name: order.buyer.name },
    payer: { name: order.payer.name, address: order.payer.address },
    items: order.items.map((i) => ({ sku: i.sku, name: i.name, quantity: i.quantity, unitPriceMicro: i.unitPriceMicro.toString() })),
    totalMicro: order.totalMicro.toString(),
    fulfilment: order.fulfilment,
    deadline: order.deadline.toString(),
    parentOrderId: order.parentOrderId,
    salt: order.salt,
  };
}

// Rebuilds an order from its wire details; the id is re-derived, never read from the wire.
export function orderFromWire(w) {
  if (!w || typeof w !== 'object' || w.schema !== ORDER_SCHEMA) throw new Error(`not an ${ORDER_SCHEMA} order`);
  return createOrder({
    merchant: w.merchant,
    buyer: w.buyer?.name ? w.buyer : undefined,
    payer: { name: w.payer?.name ?? '', address: w.payer?.address && w.payer.address !== ZERO_ADDRESS ? w.payer.address : undefined },
    items: (w.items ?? []).map((i) => ({ ...i, unitPriceMicro: i.unitPriceMicro })),
    totalMicro: w.totalMicro,
    fulfilment: w.fulfilment,
    deadline: w.deadline,
    parentOrderId: w.parentOrderId,
    salt: w.salt,
  });
}
