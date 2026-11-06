// @graphpay/config: the infrastructure config (addresses, networks, wallet roles,
// model pricing; ADR-0030) and the one story config (everything story-specific;
// ADR-0047), plus the helpers every package uses to read them. Names, story
// values and addresses come from these files, never from code.

import { readFileSync } from 'node:fs';

const read = (file) => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));

export const config = read('./graphpay.config.json');
export const story = read('./story.json');

export function network(key) {
  const net = config.networks[key];
  if (!net) throw new Error(`unknown network: ${key}`);
  return net;
}

// The cast of the story (tonight the test story; the founder's final story replaces the file).
export function activeCast(source = story) {
  const { persona, buyerAgents, workingAgents, disposable, shopAgents, shops, city, order, renewal } = source;
  return { key: source.name, persona, buyerAgents, workingAgents, disposable, shopAgents, shops, city, order, renewal };
}

// Every cast member with its ENS name and wallet role.
export function castEntries(cast = activeCast(), root = config.root.ens) {
  const owner = `${cast.persona.label}.${root}`;
  const entries = [{ kind: 'persona', key: cast.persona.key, ensName: owner, walletRole: cast.persona.walletRole }];
  for (const a of [...cast.buyerAgents, ...cast.workingAgents]) {
    entries.push({ kind: 'buyer-agent', key: a.key, ensName: `${a.label}.${owner}`, walletRole: a.walletRole, pays: a.pays, capMicro: a.capMicro });
  }
  for (const shop of cast.shops) {
    const shopName = `${shop.label}.${root}`;
    entries.push({ kind: 'shop', key: shop.key, ensName: shopName, walletRole: shop.walletRole, storyRole: shop.storyRole });
    for (const a of cast.shopAgents) {
      entries.push({ kind: 'shop-agent', key: `${shop.key}/${a.key}`, ensName: `${a.label}.${shopName}`, walletRole: shop.walletRole });
    }
  }
  return entries;
}

export function disposableEntry(n, cast = activeCast(), root = config.root.ens) {
  if (!Number.isInteger(n) || n < 1) throw new Error('disposable agents are numbered from 1');
  const d = cast.disposable;
  return {
    kind: 'buyer-agent',
    key: `${d.labelPrefix}${n}`,
    ensName: `${d.labelPrefix}${n}.${cast.persona.label}.${root}`,
    walletRole: `${d.walletRolePrefix}${n}`,
    pays: true,
    capMicro: d.capMicro,
  };
}

// The model settings of an agent role under the active preset (ADR-0048).
// AGENT_PRESET overrides the story's active preset for one run.
export function agentPreset(role, { env = process.env, source = story } = {}) {
  const { active, presets } = source.agentModels;
  const name = env.AGENT_PRESET || active;
  // Own keys only: "constructor" or "__proto__" is no preset and no role.
  if (!Object.hasOwn(presets, name)) throw new Error(`agent preset "${name}" is not in the story config`);
  const { roles } = presets[name];
  if (!Object.hasOwn(roles, role)) throw new Error(`agent preset "${name}" has no settings for role "${role}"`);
  return { preset: name, role, ...roles[role] };
}

// API cost in USD of one response's usage, from the configured per-million-token prices.
// A model's longPrompt card (Haiku 5.5: a prompt over 100,000 tokens, counting cache
// reads and writes) prices every token of that request, output included. 1-hour cache
// writes cost cacheWrite1h and 5-minute writes cacheWrite5m, from usage.cache_creation;
// writes it does not break down are priced at the 5-minute rate.
export function apiCostUsd(model, usage) {
  const prices = config.models.pricingUsdPerMTok;
  if (!Object.hasOwn(prices, model)) throw new Error(`no price for model "${model}" in the config file`);
  const tokens = (n) => (Number.isFinite(n) && n > 0 ? n : 0);
  const u = usage ?? {};
  const byTtl = u.cache_creation ?? {};
  const input = tokens(u.input_tokens);
  const output = tokens(u.output_tokens);
  const read = tokens(u.cache_read_input_tokens);
  const write1h = tokens(byTtl.ephemeral_1h_input_tokens);
  const write5m = Math.max(tokens(byTtl.ephemeral_5m_input_tokens), tokens(u.cache_creation_input_tokens) - write1h);
  const base = prices[model];
  const long = base.longPrompt;
  const card = long && input + read + write5m + write1h > long.aboveInputTokens ? long : base;
  // A price is needed only for a token kind the response used: Kimi's cards have no cache-write prices.
  const cost = (count, key) => {
    if (count === 0) return 0;
    if (!Number.isFinite(card[key])) throw new Error(`no ${key} price for model "${model}" in the config file`);
    return count * card[key];
  };
  return (cost(input, 'input') + cost(output, 'output') + cost(write5m, 'cacheWrite5m') + cost(write1h, 'cacheWrite1h') + cost(read, 'cacheRead')) / 1e6;
}

// RPC candidates in order: the secret URL (if set), the keyed Arkiv URL (if the key
// is set), then the public URLs. Labels are safe to print; URLs of secret ones are not.
export function rpcCandidates(key, env = process.env) {
  const net = network(key);
  const out = [];
  if (net.secretRpcEnv && env[net.secretRpcEnv]) out.push({ label: `${net.secretRpcEnv} (secret)`, url: env[net.secretRpcEnv], secret: true });
  if (net.accessKeyEnv && env[net.accessKeyEnv]) out.push({ label: `${net.name} keyed`, url: `${net.rpcBase}/${env[net.accessKeyEnv]}`, secret: true });
  for (const p of net.publicRpcs) out.push({ ...p, secret: false });
  return out;
}

async function probeChainId(url, fetchImpl, timeoutMs) {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (typeof body?.result !== 'string' || !/^0x[0-9a-f]+$/i.test(body.result)) throw new Error('no chain id');
  return Number.parseInt(body.result, 16);
}

// The first candidate whose eth_chainId equals the network's chain id. A candidate
// on any other chain is refused. Errors and the refused list carry labels, never URLs.
export async function resolveRpc(key, { env = process.env, fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
  const net = network(key);
  const refused = [];
  for (const candidate of rpcCandidates(key, env)) {
    if (candidate.secret && !/^https:\/\/|^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(candidate.url)) {
      refused.push(`${candidate.label}: refused, not an https URL`);
      continue;
    }
    let chainId;
    try {
      chainId = await probeChainId(candidate.url, fetchImpl, timeoutMs);
    } catch {
      refused.push(`${candidate.label}: no answer`);
      continue;
    }
    if (chainId !== net.chainId) {
      refused.push(`${candidate.label}: refused, chain ${chainId} is not ${net.chainId}`);
      continue;
    }
    const resolved = { label: candidate.label, secret: candidate.secret, chainId, refused };
    Object.defineProperty(resolved, 'url', { value: candidate.url, enumerable: false });
    return resolved;
  }
  throw new Error(`${net.name}: no RPC answered with chain id ${net.chainId} (${refused.join('; ')})`);
}

export { probeChainId };
