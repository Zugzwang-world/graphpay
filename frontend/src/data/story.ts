import raw from './story.json';

/**
 * Typed access to the story data. Components read identity, names, prices and
 * prompts from here (or from the adapter), never from literals.
 */

export interface StoryAgent {
  role: string;
  label: string;
  ens: string;
  main: boolean;
  pays?: boolean;
  capUsdt?: string;
  does?: string;
  avatar?: string | null;
}

export interface StoryShopChoice {
  name: string;
  ens: string;
  storyRole: 'good' | 'runner-up' | 'trap';
  priceUsdt: string;
  distanceKm: number;
  paidOrders: number;
  refundRate: string;
  repeatBuyers: number;
  onTimeRate: string;
  open: boolean;
  image?: string | null;
  rejectedBecause?: string;
}

export interface StoryProduct {
  id: string;
  shop: string;
  name: string;
  short: string;
  priceUsdt: string;
  image: string | null;
}

export interface StoryQuickPrompt {
  text: string;
  kind: 'ask' | 'reorder';
  productId: string;
}

export interface Story {
  synthetic: boolean;
  city: { name: string; timeZone: string; timeZoneLabel: string; currency: 'USDT' };
  customer: { name: string; ens: string; avatar: string | null };
  agents: StoryAgent[];
  shop: { name: string; ens: string; area: string; image: string | null; agents: StoryAgent[] };
  shops: StoryShopChoice[];
  products: StoryProduct[];
  quickPrompts: StoryQuickPrompt[];
  spendingPass: { capUsdt: string; period: 'day'; usedTodayUsdt: string; payingRole: string };
  renewal: { productId: string; item: string; schedule: string; amountUsdt: string };
  buyerReputation: { orders: number; refunds: number; since: string; riskVerdict: string };
  otherCustomer: { name: string; ens: string; agentEns: string; schedule: string; productId: string };
  demo: { capRaiseAttemptUsdt: string; quoteValidityMinutes: number };
  explorers: {
    whitechain: string;
    whitechainLabel: string;
    ens: string;
    ensLabel: string;
    arkiv: string;
    arkivLabel: string;
  };
}

export const story = raw as Story;

export function productById(id: string | undefined): StoryProduct | undefined {
  return story.products.find((p) => p.id === id);
}

export function agentByRole(role: string): StoryAgent | undefined {
  return story.agents.find((a) => a.role === role) ?? story.shop.agents.find((a) => a.role === role);
}

export function agentByEns(ens: string): StoryAgent | undefined {
  return story.agents.find((a) => a.ens === ens) ?? story.shop.agents.find((a) => a.ens === ens);
}

/** The agent that pays within the spending pass. */
export function payingAgent(): StoryAgent {
  const a = agentByRole(story.spendingPass.payingRole) ?? story.agents.find((x) => x.pays);
  if (!a) throw new Error('story.json: no paying agent');
  return a;
}

/** The main agent (the one that manages the others). */
export function mainAgent(): StoryAgent {
  return story.agents.find((a) => a.main) ?? story.agents[0]!;
}

export function mainShopAgent(): StoryAgent {
  return story.shop.agents.find((a) => a.main) ?? story.shop.agents[0]!;
}
