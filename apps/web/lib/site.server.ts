// The site model: everything the pages show about the story and the networks,
// read from the two config files (ADR-0030, ADR-0047) and passed to client
// components as plain data. Nothing story-specific is written in code.

import { activeCast, castEntries, config, network, story } from '@graphpay/config';
import type { ExplorerBases } from './explorer.ts';
import { publicAccess } from './passcode.ts';

export interface ModelAgent {
  key: string;
  displayName: string;
  ens: string;
  pays: boolean;
  capMicro: string | null;
}

export interface ModelProduct {
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  priceMicro: string;
}

export interface ModelShop {
  key: string;
  displayName: string;
  ens: string;
  storyRole: string;
  category: string;
  products: ModelProduct[];
  agents: { key: string; displayName: string; ens: string }[];
}

export interface SiteModel {
  siteUrl: string;
  // Visitors meet no passcode (ADR-0069; the config's site.publicAccess).
  publicAccess: boolean;
  root: string;
  storyName: string;
  storyLocked: boolean;
  synthetic: boolean;
  city: { name: string; timeZone: string; currency: string };
  explorers: ExplorerBases;
  networks: Record<keyof ExplorerBases, { name: string; chainId: number; nativeSymbol: string }>;
  token: { symbol: string; name: string; address: string; decimals: number };
  persona: { displayName: string; ens: string };
  buyerAgents: ModelAgent[];
  payer: ModelAgent;
  shops: ModelShop[];
  // The shop the scripted order goes to: the merchant screen's shop.
  merchant: ModelShop;
  order: {
    request: string;
    sku: string;
    item: string;
    quantity: number;
    priceMicro: string;
    budgetMicro: string;
    deadlineLocal: string;
    refundMicro: string;
    refundReason: string;
    // The story's re-order: its own item (a sku of the merchant shop), quantity and price.
    reorder: { sku: string; item: string; quantity: number; priceMicro: string };
    // The story's order over the payer's pass ("for everyone"): the request and how many of the order's item.
    overPass: { request: string; quantity: number };
  };
  renewal: {
    plan: string;
    item: string;
    // The plan's product at its shop (a sku of the renewal shop).
    sku: string;
    // The renewal shop's ENS name.
    shopEns: string;
    priceMicro: string;
    period: string;
    weekday: string | null;
    // The labelled demo clock; maxCharges bounds what a demo subscription can ever pull.
    demoPeriod: { id: string; seconds: number; label: string; maxCharges: number };
  };
}

type Loose = Record<string, unknown>;

function field<T>(source: Loose, key: string, check: (v: unknown) => v is T, where: string): T {
  const value = source[key];
  if (!check(value)) throw new Error(`story config: ${where}.${key} is missing or malformed`);
  return value;
}

const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObject = (v: unknown): v is Loose => v !== null && typeof v === 'object' && !Array.isArray(v);

let cached: SiteModel | null = null;

export function siteModel(): SiteModel {
  if (cached) return cached;
  const cast = activeCast();
  const root: string = config.root.ens;
  const entries = castEntries(cast, root);
  const ensOf = (kind: string, key: string) => {
    const entry = entries.find((e) => e.kind === kind && e.key === key);
    if (!entry) throw new Error(`story config: no ENS name for ${kind} ${key}`);
    return entry.ensName;
  };

  const order = cast.order as Loose;
  const renewal = cast.renewal as Loose;
  const reorder = field(order, 'reorder', isObject, 'order');
  const overPass = field(order, 'overPass', isObject, 'order');
  const schedule = field(renewal, 'schedule', isObject, 'renewal');
  const demoPeriod = field(renewal, 'demoPeriod', isObject, 'renewal');

  const shops: ModelShop[] = cast.shops.map((shop) => ({
    key: shop.key,
    displayName: shop.displayName,
    ens: ensOf('shop', shop.key),
    storyRole: shop.storyRole,
    category: shop.category,
    products: shop.products.map((p) => ({ ...p, priceMicro: String(p.priceMicro) })),
    agents: cast.shopAgents.map((a) => ({ key: a.key, displayName: a.displayName, ens: ensOf('shop-agent', `${shop.key}/${a.key}`) })),
  }));
  const merchantKey = field(order, 'shop', isString, 'order');
  const merchant = shops.find((s) => s.key === merchantKey);
  if (!merchant) throw new Error('story config: order.shop is not one of the shops');

  const buyerAgents: ModelAgent[] = cast.buyerAgents.map((a) => ({
    key: a.key,
    displayName: a.displayName,
    ens: ensOf('buyer-agent', a.key),
    pays: a.pays,
    capMicro: a.capMicro === undefined ? null : String(a.capMicro),
  }));
  const payer = buyerAgents.find((a) => a.key === 'payer');
  if (!payer) throw new Error('story config: the buyer team has no payer agent');

  const usdt = config.whitechain.tokens.usdt;
  const net = (key: keyof ExplorerBases) => {
    const n = network(key);
    return { name: n.name, chainId: n.chainId, nativeSymbol: n.nativeSymbol };
  };

  cached = {
    siteUrl: config.site.url,
    publicAccess: publicAccess(),
    root,
    storyName: story.name,
    storyLocked: story.locked,
    synthetic: story.synthetic,
    city: cast.city,
    explorers: { whitechain: network('whitechain').explorer, sepolia: network('sepolia').explorer, rabdi: network('rabdi').explorer },
    networks: { whitechain: net('whitechain'), sepolia: net('sepolia'), rabdi: net('rabdi') },
    token: { symbol: usdt.symbol, name: usdt.name, address: usdt.address, decimals: usdt.decimals },
    persona: { displayName: cast.persona.displayName, ens: ensOf('persona', cast.persona.key) },
    buyerAgents,
    payer,
    shops,
    merchant,
    order: {
      request: field(order, 'request', isString, 'order'),
      sku: field(order, 'sku', isString, 'order'),
      item: field(order, 'item', isString, 'order'),
      quantity: field(order, 'quantity', isNumber, 'order'),
      priceMicro: String(field(order, 'priceMicro', isNumber, 'order')),
      budgetMicro: String(field(order, 'budgetMicro', isNumber, 'order')),
      deadlineLocal: field(order, 'deadlineLocal', isString, 'order'),
      refundMicro: String(field(order, 'refundMicro', isNumber, 'order')),
      refundReason: field(order, 'refundReason', isString, 'order'),
      reorder: {
        sku: field(reorder, 'sku', isString, 'order.reorder'),
        item: field(reorder, 'item', isString, 'order.reorder'),
        quantity: field(reorder, 'quantity', isNumber, 'order.reorder'),
        priceMicro: String(field(reorder, 'priceMicro', isNumber, 'order.reorder')),
      },
      overPass: { request: field(overPass, 'request', isString, 'order.overPass'), quantity: field(overPass, 'quantity', isNumber, 'order.overPass') },
    },
    renewal: {
      plan: field(renewal, 'plan', isString, 'renewal'),
      item: field(renewal, 'item', isString, 'renewal'),
      sku: field(renewal, 'sku', isString, 'renewal'),
      shopEns: ensOf('shop', field(renewal, 'shop', isString, 'renewal')),
      priceMicro: String(field(renewal, 'priceMicro', isNumber, 'renewal')),
      period: field(schedule, 'period', isString, 'renewal.schedule'),
      weekday: isString(schedule.weekday) ? schedule.weekday : null,
      demoPeriod: {
        id: field(demoPeriod, 'id', isString, 'renewal.demoPeriod'),
        seconds: field(demoPeriod, 'seconds', isNumber, 'renewal.demoPeriod'),
        label: field(demoPeriod, 'label', isString, 'renewal.demoPeriod'),
        maxCharges: field(demoPeriod, 'maxCharges', isNumber, 'renewal.demoPeriod'),
      },
    },
  };
  return cached;
}

// The checkout contract: `whitechain.contracts.checkout.address` in the infrastructure config
// (M2's deployment record). null while no well-formed address is recorded.
export function checkoutAddress(contracts: Loose = config.whitechain.contracts ?? {}): string | null {
  const checkout = contracts.checkout;
  const address = typeof checkout === 'object' && checkout !== null ? (checkout as Loose).address : null;
  return typeof address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(address) ? address : null;
}

// The token the checkout settles in: the configured test USDT unless GRAPHPAY_TOKEN
// names another one, which the chip then labels "stand-in (not USDT)".
export function tokenMode(env: Record<string, string | undefined> = process.env): { mode: 'usdt' | 'standin'; address: string } {
  const usdt: string = config.whitechain.tokens.usdt.address;
  const address = env.GRAPHPAY_TOKEN && /^0x[0-9a-fA-F]{40}$/.test(env.GRAPHPAY_TOKEN) ? env.GRAPHPAY_TOKEN : usdt;
  return { mode: address.toLowerCase() === usdt.toLowerCase() ? 'usdt' : 'standin', address };
}
