// GraphPay's money graph, defined on @graphpay_ethglobal/arkiv-graph (planning/SPEC/ARKIV_GRAPH.md §3
// as amended by docs/plan/amendments/M7-arkiv.md §1–§5): actors are nodes keyed by
// namehash(ENS) and epoch, every event is a readonly edge, tallies keep absolute
// counters per node, epoch and window, pair links keep count and sum per payer–shop
// pair for the money kinds. Plus the shop directory and quotes (W_DIRECTORY) and the
// plain model the benchmark compares against. Addresses come from the config file.

import { defineGraph, defineEntity, checkedOwner } from '@graphpay_ethglobal/arkiv-graph';
import { config, network } from '@graphpay/config';

export const PROJECT = config.arkiv.project;
export const SCHEMA_VERSION = config.arkiv.schemaVersion;
export const ENTITY_CONTRACT = config.arkiv.entityContract;
export const RABDI = network('rabdi');

// Lifetimes (planning/DECISIONS.md E-4; ADR-0035; M7 amendment §3, §5).
export const LIFETIME = Object.freeze({ realDays: 30, syntheticDays: 14, shopDays: 14, quoteMinutes: 15, probeDays: 1, heartbeatDays: 1, openMinutes: 15, presenceMinutes: 15, handoffMinutes: 30 });

export const EDGE_KINDS = ['owns', 'order', 'pay', 'refund', 'fail', 'subscribe', 'renew', 'deliver', 'late', 'cancel', 'dispute', 'request'];
export const MONEY_KINDS = ['pay', 'refund', 'fail', 'renew'];
export const TALLY_COUNTERS = ['orders', 'paid_micro', 'refunds', 'refunded_micro', 'fails', 'delivered', 'on_time', 'cancels', 'disputes'];

// Tally rules (§3): both ends, in `all` and the event's day. A renewal's money is counted
// once, on its payment; the `renew` edge carries 0. A DUPLICATE failure is not counted.
export function tallyRules(event) {
  switch (event.kind) {
    case 'order':
    case 'subscribe':
      return { orders: 'count' };
    case 'pay':
    case 'renew':
      return { paid_micro: 'value' };
    case 'refund':
      return { refunds: 'count', refunded_micro: 'value' };
    case 'fail':
      return event.reason === 'DUPLICATE' ? null : { fails: 'count' };
    case 'deliver':
      return { delivered: 'count', on_time: 'count' };
    case 'late':
      return { delivered: 'count' };
    case 'cancel':
      return { cancels: 'count' };
    case 'dispute':
      return { disputes: 'count' };
    default:
      return null; // owns, request
  }
}

const context = { project: PROJECT, schemaVersion: SCHEMA_VERSION };

export const graph = defineGraph({
  ...context,
  types: { node: 'node', edge: 'edge', totals: 'tally', link: 'link', checkpoint: 'checkpoint' },
  node: {
    columns: [
      'ens:str/i',
      'owner_node:key/io',
      'verified:bool',
      'synthetic:bool',
      'dataset:str',
      'category:str/io',
      'city:str/io',
      'status:str/o',
      'cap_micro:u64/o',
    ],
  },
  edge: {
    value: 'amount_micro',
    // The mirror polls recorder edges by ts (ADR-0041).
    index: ['ts'],
    columns: ['synthetic:bool', 'dataset:str', 'payload:bytes/o', 'from_ens:str/o', 'to_ens:str/o', 'order_id:str/io'],
  },
  totals: { counters: TALLY_COUNTERS, rules: tallyRules, columns: ['synthetic:bool', 'dataset:str'] },
  link: { sum: 'sum_micro', kinds: MONEY_KINDS, columns: ['from_ens:str/o', 'to_ens:str/o', 'synthetic:bool', 'dataset:str'] },
});

// The directory, quotes and the benchmark's plain model.
export const ENTITIES = {
  ...graph.defs,
  tally: graph.defs.totals,
  shop: defineEntity(
    'shop',
    {
      columns: [
        'shop_key:key/i',
        'shop_ens:str',
        'category:str/i',
        'area:str/o',
        'city:str/o',
        'lat:i32/i',
        'lng:i32/i',
        'status:str',
        'synthetic:bool/i',
        'dataset:str/o',
        'payload:bytes/o',
      ],
    },
    context,
  ),
  quote: defineEntity('quote', { columns: ['request_id:str/i', 'shop_key:key', 'agent_ens:str', 'price:u64', 'valid_until:u64'], readonly: true }, context),
  record: defineEntity(
    'record',
    {
      columns: [
        'from_name:str/i',
        'to_name:str/i',
        'kind:str/i',
        'amount_micro:u64',
        'day:u64/i',
        'ts:u64',
        'ref:str',
        'synthetic:bool',
        'dataset:str',
        'payload:bytes/o',
      ],
      readonly: true,
    },
    context,
  ),
  // The mirror's lease and lag (Join, M11): one mutable row per instance, W_LEDGER, 1 day, extended.
  heartbeat: defineEntity(
    'heartbeat',
    { columns: ['instance:str', 'state:str', 'cursor_block:u64', 'cursor_log:u64', 'head_block:u64', 'lag_blocks:u64', 'updated_ts:u64'] },
    context,
  ),
  profile: defineEntity('profile', { columns: ['name:str/i', 'kind:str/i', 'owner_name:str/io', 'synthetic:bool', 'dataset:str'] }, context),
  // Friday activity (EVENT_ADDENDUM 6–8, ADR-0035), all W_DIRECTORY: a shop's Open toggle
  // (patched and extended while on), an agent at work (readonly, extended while it runs)
  // and one agent passing work to another (readonly). Each lapses by itself.
  shop_open: defineEntity('shop_open', { columns: ['shop_key:key/i', 'shop_ens:str', 'open_until:u64'] }, context),
  agent_presence: defineEntity('agent_presence', { columns: ['agent_ens:str/i', 'owner_ens:str/i', 'role:str', 'session:str/i'], readonly: true }, context),
  // Friday Swarm (ADR-0061), W_DIRECTORY: a shop's public menu on Swarm. The row keeps the 64-hex
  // reference of the menu and the sha-256 of its bytes; mutable (a new version patches it).
  menu: defineEntity('menu', { columns: ['shop_key:key/i', 'shop_ens:str', 'version:u64', 'swarm_ref:str', 'content_hash:str', 'size:u64'] }, context),
  handoff: defineEntity('handoff', { columns: ['request_id:str/i', 'from_agent:str', 'to_agent:str', 'step:str'], readonly: true }, context),
};
delete ENTITIES.totals;

// Every filter a shipped query makes, per type, beyond project, type and the owner
// (ADR-0041: indexed if and only if listed; a test holds the two together).
export const QUERIES = {
  node: ['node', 'ens', 'kind', 'owner_node', 'category', 'city'],
  edge: ['from_node', 'to_node', 'kind', 'day', 'ts', 'from_epoch', 'to_epoch', 'ref', 'order_id'],
  tally: ['node', 'epoch', 'kind', 'window', 'day'],
  link: ['from_node', 'to_node', 'kind'],
  checkpoint: ['stream'],
  record: ['from_name', 'to_name', 'kind', 'day'],
  profile: ['name', 'kind', 'owner_name'],
  shop: ['shop_key', 'category', 'lat', 'lng', 'synthetic'],
  quote: ['request_id'],
  heartbeat: [],
  shop_open: ['shop_key'],
  agent_presence: ['agent_ens', 'owner_ens', 'session'],
  handoff: ['request_id'],
  menu: ['shop_key'],
};

export const WRITER_ROLES = ['W_LEDGER', 'W_SYNC', 'W_DIRECTORY', 'W_SEED_EVENT', 'W_SEED_M_EVENT'];

// The writer addresses from the config (lower case). Blank or malformed is a start-up error.
export function writerAddresses(source = config) {
  const writers = source.arkiv?.writers ?? {};
  return Object.fromEntries(WRITER_ROLES.map((role) => [role, checkedOwner(writers[role], role)]));
}

// Trusted owners per type (M7 amendment §2). Synthetic graph rows are read only on opt-in,
// from the size's seed wallet alone (one dataset per owner).
export function trustedOwners(type, { writers = writerAddresses(), synthetic = null } = {}) {
  if (synthetic) return [checkedOwner(synthetic, 'synthetic seed')];
  switch (type) {
    case 'node':
    case 'tally':
    case 'link':
    case 'checkpoint':
    case 'heartbeat':
      return [writers.W_LEDGER];
    case 'edge':
      return [writers.W_LEDGER, writers.W_SYNC];
    case 'shop':
    case 'quote':
    case 'shop_open':
    case 'agent_presence':
    case 'handoff':
    case 'menu':
      return [writers.W_DIRECTORY];
    default:
      throw new Error(`money-graph: no trusted writer for entity type "${type}"`);
  }
}

// The seed wallet of a synthetic city size (story syntheticCity.sizes[size].owner).
export function seedOwner(size, story, writers = writerAddresses()) {
  const role = story?.syntheticCity?.sizes?.[size]?.owner;
  if (!role || !Object.hasOwn(writers, role)) throw new Error(`money-graph: no seed wallet for city size "${size}"`);
  return writers[role];
}
