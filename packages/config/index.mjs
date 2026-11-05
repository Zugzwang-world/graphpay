// @graphpay/config: the one config file (ADR-0030) and the helpers every
// package uses to read it. Names and addresses come from here, never from code.

import { readFileSync } from 'node:fs';

export const config = JSON.parse(readFileSync(new URL('./graphpay.config.json', import.meta.url), 'utf8'));

export function network(key) {
  const net = config.networks[key];
  if (!net) throw new Error(`unknown network: ${key}`);
  return net;
}

// The active cast: GRAPHPAY_CAST if set, else cast.active ("test" tonight, "demo" from Friday).
export function activeCast(env = process.env) {
  const key = env.GRAPHPAY_CAST || config.cast.active;
  const cast = config.cast[key];
  if (!cast || key === 'active') throw new Error(`cast "${key}" is not in the config file`);
  return { key, ...cast };
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
    return { url: candidate.url, label: candidate.label, secret: candidate.secret, chainId, refused };
  }
  throw new Error(`${net.name}: no RPC answered with chain id ${net.chainId} (${refused.join('; ')})`);
}

export { probeChainId };
