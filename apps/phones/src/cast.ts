// The story as the stage's phones read it: the build's projection of packages/config/story.json
// (apps/phones/story-projection.mjs), typed with the fields the projection adds for the stage, and
// the cast the agents' line templates fill from (apps/web/lib/stage/lines.ts). No value is written here.

import { story } from '@/data/story';
import type { LineCast } from '../../web/lib/stage/lines.ts';

export interface StageProduct {
  id: string;
  shop: string;
  name: string;
  short: string;
  priceUsdt: string;
  priceMicro: string;
  image: string | null;
  swarm: string | null;
}

export interface StageShop {
  name: string;
  ens: string;
  storyRole: string;
  priceUsdt: string;
  image: string | null;
  swarm: string | null;
}

interface StageStory {
  order: { item: string; area: string; sku: string; quantity: number; budgetMicro: string; refundMicro: string; refundReason: string; reorder: { sku: string; item: string; priceMicro: string } };
  renewal: { item: string; amountUsdt: string; priceMicro?: string; shop: string };
  swarmGateway: string;
  explorers: { whitechain: string; whitechainLabel: string; ens: string; ensLabel: string; ensApp: string | null; arkiv: string; arkivLabel: string };
}

const extra = story as unknown as StageStory;

export const products = story.products as unknown as StageProduct[];
export const shops = story.shops as unknown as StageShop[];
export const order = extra.order;
export const renewal = extra.renewal;
export const swarmGateway = extra.swarmGateway;
export const explorers = extra.explorers;
export const timeZone = story.city.timeZone;

const agent = (role: string) => [...story.agents, ...story.shop.agents].find((a) => a.role === role);

export const cast: LineCast = {
  timeZone,
  persona: { name: story.customer.name, ens: story.customer.ens },
  agents: Object.fromEntries([...story.agents, ...story.shop.agents].map((a) => [a.role, { label: a.label, ens: a.ens }])),
  shops: shops.map((s) => ({ ens: s.ens, name: s.name, storyRole: s.storyRole })),
  merchant: { ens: story.shop.ens, name: story.shop.name },
  order: { item: order.item, area: order.area, budgetMicro: order.budgetMicro, refundMicro: order.refundMicro, refundReason: order.refundReason, reorderItem: order.reorder.item },
};

export const buyerRoles = story.agents.map((a) => a.role);
export const shopRoles = story.shop.agents.map((a) => a.role);
export const payer = agent(story.spendingPass.payingRole)!;
export const agentOf = (role: string) => agent(role);
export const shopOf = (ens: string | null | undefined) => shops.find((s) => s.ens === ens);
export const productOf = (shop: string, sku: string) => products.find((p) => p.shop === shop && p.id === sku);
export const menuOf = (shop: string) => products.filter((p) => p.shop === shop);

// Explorer and name links, from the projection's bases (the config's networks).
const trim = (u: string) => u.replace(/\/+$/, '');
export const links = {
  whitechainTx: (tx: string) => `${trim(explorers.whitechain)}/tx/${tx}`,
  sepoliaTx: (tx: string) => `${trim(explorers.ens)}/tx/${tx}`,
  arkivTx: (tx: string) => `${trim(explorers.arkiv)}/tx/${tx}`,
  arkivEntity: (key: string) => `${trim(explorers.arkiv)}/entity/${key}`,
  ensName: (name: string) => (explorers.ensApp ? `${trim(explorers.ensApp)}/${name}` : null),
  swarm: (ref: string, file: string) => `${trim(swarmGateway)}/bzz/${ref}/${file}`,
};

export const networks = { whitechain: explorers.whitechainLabel, sepolia: explorers.ensLabel, arkiv: explorers.arkivLabel, swarm: 'Swarm' };
