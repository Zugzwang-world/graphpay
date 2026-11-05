// The cast as one constant (planning/SPEC/AGENTS.md §1). Every name, shop, product
// and the order come from the story config (ADR-0047); ENS names hang under ROOT,
// the config's root name (ADR-0030). Nothing story-specific is typed in here.

import { activeCast, config } from '@graphpay/config';

export const ROOT = config.root.ens;

// Shops are told apart by their story role, never by name (acceptance E2 as amended).
export const SHOP_ROLES = Object.freeze(['good', 'trap', 'runner-up']);

export function teamCast(cast = activeCast(), root = ROOT) {
  const owner = `${cast.persona.label}.${root}`;
  const agentEns = (label) => `${label}.${owner}`;
  const buyer = Object.fromEntries(cast.buyerAgents.map((a) => [a.key, agentEns(a.label)]));
  // Every agent that may pay, by key: the stage payer, the working agents (E2E_BUYER).
  const payers = Object.fromEntries(
    [...cast.buyerAgents, ...cast.workingAgents]
      .filter((a) => a.pays)
      .map((a) => [a.key, Object.freeze({ key: a.key, ens: agentEns(a.label), walletRole: a.walletRole, capMicro: BigInt(a.capMicro ?? 0) })]),
  );
  const shops = cast.shops.map((s) => {
    const ens = `${s.label}.${root}`;
    return Object.freeze({
      key: s.key,
      label: s.label,
      displayName: s.displayName,
      storyRole: s.storyRole,
      ens,
      category: s.category,
      products: s.products,
      scenario: s.scenario,
      agents: Object.freeze(Object.fromEntries(cast.shopAgents.map((a) => [a.key, `${a.label}.${ens}`]))),
    });
  });
  const byEns = new Map(shops.map((s) => [s.ens, s]));
  // The shop team's names under any shop, cast or directory-found: storefront.<shop> …
  const shopAgentNames = (shopEns) => Object.freeze(Object.fromEntries(cast.shopAgents.map((a) => [a.key, `${a.label}.${shopEns}`])));
  const orderShop = shops.find((s) => s.key === cast.order.shop);
  if (!orderShop) throw new Error('the story order names a shop that is not in the cast');
  return Object.freeze({
    key: cast.key,
    root,
    city: cast.city,
    persona: Object.freeze({ key: cast.persona.key, displayName: cast.persona.displayName, ens: owner }),
    buyer: Object.freeze(buyer),
    payers: Object.freeze(payers),
    shops: Object.freeze(shops),
    order: cast.order,
    // The need this story's request is about: its item, quantity and category.
    food: Object.freeze({ item: cast.order.item, quantity: cast.order.quantity, category: orderShop.category }),
    shopByRole(role) {
      const shop = shops.find((s) => s.storyRole === role);
      if (!shop) throw new Error(`no cast shop has the story role "${role}"`);
      return shop;
    },
    shopByEns(name) {
      return byEns.get(name) ?? null;
    },
    shopAgentNames,
  });
}
