// The actors the mirror may write about: nodes keyed by their ENS name
// (node = namehash(normalize(ens)), identity = node + epoch; ADR-0007, ADR-0017).
// The cast is registered before the chain source starts (SPEC/INTEGRATION_AND_MIRROR.md
// §2 step 5); an event naming any other node waits until that node is registered.

import { activeCast, castEntries, config, disposableEntry } from '@graphpay/config';
import { namehash, normalize } from 'viem/ens';

const KINDS = new Set(['human', 'agent', 'shop']);
const STATUSES = new Set(['active', 'paused', 'revoked', 'expired']);

export function nodeOf(ens) {
  const name = normalize(ens);
  if (name === '') throw new Error('nodeOf: an empty name is the root node');
  return namehash(name);
}

export class Actors {
  #byNode = new Map();
  #byWallet = new Map();

  // Adds an actor or moves it to a newer epoch. An older epoch never replaces a newer one.
  register(actor) {
    const a = checkActor(actor);
    const known = this.#byNode.get(a.node);
    if (known && known.epoch > a.epoch) return { added: false, actor: known };
    if (known && known.epoch === a.epoch) {
      const merged = { ...known, ...definedOnly(a) };
      this.#byNode.set(a.node, merged);
      if (merged.wallet) this.#byWallet.set(merged.wallet, a.node);
      return { added: false, actor: merged };
    }
    this.#byNode.set(a.node, a);
    if (a.wallet) this.#byWallet.set(a.wallet, a.node);
    return { added: true, actor: a };
  }

  get(node) {
    return this.#byNode.get(node.toLowerCase());
  }

  has(node) {
    return this.#byNode.has(node.toLowerCase());
  }

  // The standing from an AgentPolicySet of the same epoch, and the wallet it binds.
  setStanding(node, { epoch, status, capMicro, wallet }) {
    const a = this.get(node);
    if (!a || a.epoch !== epoch) return false;
    if (status !== undefined) a.status = status;
    if (capMicro !== undefined) a.capMicro = capMicro;
    if (wallet) {
      if (a.wallet && this.#byWallet.get(a.wallet) === a.node) this.#byWallet.delete(a.wallet);
      a.wallet = wallet.toLowerCase();
      this.#byWallet.set(a.wallet, a.node);
    }
    return true;
  }

  // The node a wallet is bound to by the checkout's AgentPolicy, if any.
  nodeOfWallet(wallet) {
    return this.#byWallet.get(wallet.toLowerCase());
  }

  list() {
    return [...this.#byNode.values()];
  }

  get size() {
    return this.#byNode.size;
  }
}

function definedOnly(o) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}

function checkActor(actor) {
  const { ens, kind } = actor;
  if (typeof ens !== 'string' || ens === '') throw new Error('actor: an ENS name is required');
  if (!KINDS.has(kind)) throw new Error(`actor ${ens}: kind must be human, agent or shop`);
  const node = nodeOf(ens);
  if (actor.node && actor.node.toLowerCase() !== node) throw new Error(`actor ${ens}: node is not the namehash of the name`);
  const epoch = actor.epoch ?? 0;
  if (!Number.isInteger(epoch) || epoch < 0) throw new Error(`actor ${ens}: epoch must be a whole number`);
  const status = actor.status ?? 'active';
  if (!STATUSES.has(status)) throw new Error(`actor ${ens}: unknown status ${status}`);
  return {
    node,
    ens: normalize(ens),
    epoch,
    kind,
    ownerNode: actor.ownerNode?.toLowerCase(),
    category: actor.category,
    city: actor.city,
    verified: actor.verified ?? false,
    synthetic: actor.synthetic ?? false,
    status,
    capMicro: actor.capMicro,
    wallet: actor.wallet?.toLowerCase(),
  };
}

const KIND_OF_ENTRY = { persona: 'human', 'buyer-agent': 'agent', shop: 'shop', 'shop-agent': 'agent' };

// The active cast as actors (story.json through @graphpay/config; ADR-0047). Epochs
// come from the identity track's hand-off (`epochs`, by ENS name); a fresh ENSv2 name
// is epoch 0. `wallets` (by wallet role) binds the paying agents' wallets.
export function castActors({ cast = activeCast(), root = config.root.ens, epochs = {}, wallets = {} } = {}) {
  const entries = castEntries(cast, root);
  const persona = entries.find((e) => e.kind === 'persona');
  const shops = new Map(cast.shops.map((s) => [`${s.label}.${root}`, s]));
  const city = cast.city.name.toLowerCase();
  return entries.map((e) => {
    const shopName = e.kind === 'shop-agent' ? e.ensName.slice(e.ensName.indexOf('.') + 1) : null;
    const shop = shops.get(e.ensName);
    return {
      ens: e.ensName,
      kind: KIND_OF_ENTRY[e.kind],
      epoch: epochs[e.ensName] ?? 0,
      ownerNode: e.kind === 'buyer-agent' ? nodeOf(persona.ensName) : shopName ? nodeOf(shopName) : undefined,
      category: shop?.category,
      city: shop ? city : undefined,
      verified: true,
      synthetic: false,
      capMicro: e.capMicro,
      wallet: e.pays ? wallets[e.walletRole] : undefined,
    };
  });
}

// Names the mirror can recognise by their node alone: the numbered disposable agents
// (SPEC/IDENTITY_ENS.md; provisioned during the run, never in the bootstrap file).
export function candidateNames({ cast = activeCast(), root = config.root.ens, disposableMax = 64 } = {}) {
  const out = new Map();
  for (let n = 1; n <= disposableMax; n += 1) {
    const e = disposableEntry(n, cast, root);
    out.set(nodeOf(e.ensName), { ens: e.ensName, kind: 'agent', ownerNode: nodeOf(`${cast.persona.label}.${root}`), capMicro: e.capMicro, verified: true });
  }
  return out;
}
