// The namespace under the root, built from the story config (names, wallet roles, caps;
// ADR-0047) and the infrastructure config (root, ENS texts and parameters; ADR-0030).
// No name, cap or address is written here (acceptance A7, A8).

import { activeCast, config } from '@graphpay/config';
import { normalize } from 'viem/ens';

const ns = () => config.ens.namespace;

function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    if (!(k in values)) throw new Error(`ENS text placeholder {${k}} has no value`);
    return values[k];
  });
}

function capOf(agent) {
  if (agent.pays) {
    if (!Number.isSafeInteger(agent.capMicro) || agent.capMicro <= 0) throw new Error(`${agent.key}: a paying agent needs a positive capMicro in the story`);
    return BigInt(agent.capMicro);
  }
  const cap = agent.capMicro ?? ns().capMicroWithoutPolicy;
  if (!Number.isSafeInteger(cap) || cap < 0) throw new Error(`${agent.key}: invalid capMicro`);
  return BigInt(cap);
}

function agentEntry({ key, label, displayName, role, owner, walletRole, pays, capMicro, ttlDays, disposable = false }) {
  const selfHeld = walletRole !== owner.walletRole;
  if (pays && !selfHeld) throw new Error(`${key}: a paying agent needs its own wallet, never its owner's (E-14)`);
  if (!pays && selfHeld) throw new Error(`${key}: an agent with its own wallet must be a paying agent`);
  const name = `${label}.${owner.name}`;
  const t = config.ens.texts;
  const context = fill(t.agent, {
    displayName,
    role,
    principal: owner.name,
    custody: selfHeld ? t.custodyOwn : t.custodyOwner,
  });
  return { kind: 'agent', key, label, name, displayName, role, owner: owner.name, ownerKey: owner.key, walletRole, ownerWalletRole: owner.walletRole, pays, selfHeld, capMicro: capOf({ key, pays, capMicro }), ttlDays, disposable, context };
}

// The whole plan. `cast` and `root` default to the active story and the configured root.
export function namespacePlan({ cast = activeCast(), root = config.root.ens } = {}) {
  const t = config.ens.texts;
  const persona = cast.persona;
  const human = {
    kind: 'human',
    key: persona.key,
    label: persona.label,
    name: `${persona.label}.${root}`,
    displayName: persona.displayName,
    walletRole: persona.walletRole,
    context: fill(t.human, { displayName: persona.displayName }),
  };
  const shops = cast.shops.map((s) => ({
    kind: 'shop',
    key: s.key,
    label: s.label,
    name: `${s.label}.${root}`,
    displayName: s.displayName,
    walletRole: s.walletRole,
    context: fill(t.shop, { displayName: s.displayName }),
  }));
  const owners = [human, ...shops];
  const ttlDays = ns().agentTtlDays;
  const agents = [];
  for (const a of [...cast.buyerAgents, ...cast.workingAgents]) {
    agents.push(agentEntry({ key: a.key, label: a.label, displayName: a.displayName, role: a.key, owner: human, walletRole: a.walletRole, pays: a.pays, capMicro: a.capMicro, ttlDays }));
  }
  for (const shop of shops) {
    for (const a of cast.shopAgents) {
      agents.push(agentEntry({ key: `${shop.key}/${a.key}`, label: a.label, displayName: a.displayName, role: a.key, owner: shop, walletRole: shop.walletRole, pays: false, ttlDays }));
    }
  }
  const names = [...owners, ...agents].map((e) => e.name);
  if (new Set(names).size !== names.length) throw new Error('the cast has a duplicate ENS name');
  const wildcard = { kind: 'wildcard', label: ns().wildcardLabel, name: `${ns().wildcardLabel}.${root}`, context: t.wildcard };
  if (names.includes(wildcard.name)) throw new Error('a cast name collides with the wildcard');
  const rootEntry = { kind: 'root', name: root, label: root.split('.')[0], parent: root.split('.').slice(1).join('.'), context: t.root };
  return { root: rootEntry, owners, agents, wildcard, cast, human };
}

// The cast with some shops under new ENS labels (`relabel`: shop key → new label). Each shop
// keeps its key, wallet role and everything else, so a renamed shop's records point at the
// wallet its old name used and no funds move; the old name is never touched on chain. A new
// label must be one normalised label, new to the namespace (persona, shops, wildcard).
export function relabelShops(cast, relabel) {
  const map = relabel instanceof Map ? relabel : new Map(Object.entries(relabel ?? {}));
  const taken = new Set([cast.persona.label, ns().wildcardLabel, ...cast.shops.map((s) => s.label)]);
  const fresh = new Set();
  for (const [key, label] of map) {
    if (!cast.shops.some((s) => s.key === key)) throw new Error(`relabel: ${key} is not a shop of the story`);
    if (typeof label !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(label) || normalize(label) !== label) throw new Error(`relabel: ${label} is not one normalised label`);
    if (taken.has(label) || fresh.has(label)) throw new Error(`relabel: ${label} is already a label of the namespace`);
    fresh.add(label);
  }
  return { ...cast, shops: cast.shops.map((s) => (map.has(s.key) ? { ...s, label: map.get(s.key) } : s)) };
}

// A `--relabel` argument, `<shop key>=<label>[,…]`, as the map relabelShops takes.
export function parseRelabel(text = '') {
  return new Map(text.split(',').filter(Boolean).map((pair) => {
    const [key, label, extra] = pair.split('=');
    if (!key || !label || extra !== undefined) throw new Error(`relabel takes <shop key>=<label> pairs, got ${pair}`);
    return [key.trim(), label.trim()];
  }));
}

// disposable-<n> under the persona, held by DISPOSABLE_<n> (a fresh wallet per kill).
export function disposableAgent(n, { cast = activeCast(), root = config.root.ens } = {}) {
  if (!Number.isSafeInteger(n) || n < 1) throw new Error('disposable agents are numbered from 1');
  const d = cast.disposable;
  const { human } = namespacePlan({ cast, root });
  const label = `${d.labelPrefix}${n}`;
  return agentEntry({ key: label, label, displayName: label, role: 'disposable', owner: human, walletRole: `${d.walletRolePrefix}${n}`, pays: true, capMicro: d.capMicro, ttlDays: d.expiryDays, disposable: true });
}

// Every wallet role the plan needs a key or address for.
export function walletRolesOf(plan, extraAgents = []) {
  return [...new Set([...plan.owners, ...plan.agents, ...extraAgents].map((e) => e.walletRole))];
}
