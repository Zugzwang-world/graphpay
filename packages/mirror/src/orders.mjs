// What later events need to know about an order or a subscription: who paid whom and
// when. Filled from the events as they pass; after a restart a miss is read back
// through `load` (Arkiv's order and pay edges, or the checkout's views), never guessed.

import { isZeroNode } from './ids.mjs';

export class OrderBook {
  #orders = new Map();
  #subs = new Map();
  #load;
  #loadSub;

  constructor({ load = async () => null, loadSub = async () => null } = {}) {
    this.#load = load;
    this.#loadSub = loadSub;
  }

  noteOrder(orderId, { buyerNode, shopNode, payerNode, amountMicro, kind, parentOrderId }) {
    const known = this.#orders.get(orderId) ?? {};
    // A human payer (payerNode = 0) pays as the buyer.
    const payer = isZeroNode(payerNode) ? buyerNode : payerNode;
    this.#orders.set(orderId, { ...known, buyerNode, shopNode, payerNode: payer, human: isZeroNode(payerNode), amountMicro, kind, parentOrderId });
  }

  notePaid(orderId, { at }) {
    const known = this.#orders.get(orderId);
    if (known) known.paidAt = at;
    else this.#orders.set(orderId, { paidAt: at });
  }

  noteSub(subId, { subscriberNode, shopNode, amountMicro }) {
    this.#subs.set(subId, { subscriberNode, shopNode, amountMicro });
  }

  async order(orderId) {
    const known = this.#orders.get(orderId);
    if (known?.payerNode && known.paidAt !== undefined) return known;
    const loaded = await this.#load(orderId);
    if (!loaded) return known?.payerNode ? known : null;
    const merged = { ...loaded, ...definedOnly(known ?? {}) };
    this.#orders.set(orderId, merged);
    return merged;
  }

  async sub(subId) {
    if (this.#subs.has(subId)) return this.#subs.get(subId);
    const loaded = await this.#loadSub(subId);
    if (loaded) this.#subs.set(subId, loaded);
    return loaded;
  }

  clear() {
    this.#orders.clear();
    this.#subs.clear();
  }
}

function definedOnly(o) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}
