// Reads that decide trust, from chain state only (planning/SPEC/IDENTITY_ENS.md §6–§7):
// the registry walk every check starts with, record reads through the Universal Resolver,
// and the payee and accepts reads of docs/plan/amendments/M5-ens.md §1 rows 5 and 7.
// Fail closed: a read error is a refusal, never "active"; empty is not an error.

import { config } from '@graphpay/config';
import { decodeFunctionResult, encodeFunctionData, getAddress, isAddressEqual, size, zeroAddress } from 'viem';
import { permissionedRegistryAbi, universalResolverAbi, verifiableFactoryAbi } from './abi.generated.mjs';
import { ENS, profileAbi } from './contracts.mjs';
import { parseAccepts } from './erc7930.mjs';
import { dnsEncode, epochOf, exactName, isUnder, labelId, labelsOf, namehash, STATUS } from './names.mjs';
import { KEYS, WHITECHAIN_COIN_TYPE } from './records.mjs';

export const CACHE_TTL_MS = 20_000;

export async function registryState(client, registry, label) {
  const s = await client.readContract({ address: registry, abi: permissionedRegistryAbi, functionName: 'getState', args: [labelId(label)] });
  return { status: Number(s.status), expiry: BigInt(s.expiry), latestOwner: s.latestOwner, tokenId: s.tokenId, resource: s.resource, epoch: epochOf(s.resource) };
}

const read = (client, registry, functionName, args) => client.readContract({ address: registry, abi: permissionedRegistryAbi, functionName, args });

// A record read through the Universal Resolver: { value, resolver } or a throw. Reads use
// the latest block: the public Sepolia RPC is load balanced, and a read pinned to a block
// another node has not seen yet fails (planning/SPEC/IDENTITY_ENS.md §10 pitfall 3).
export async function resolveRecord(client, name, call) {
  const data = encodeFunctionData({ abi: profileAbi, ...call });
  const [result, resolver] = await client.readContract({
    address: ENS.universalResolver,
    abi: universalResolverAbi,
    functionName: 'resolve',
    args: [dnsEncode(name), data],
  });
  return { value: decodeFunctionResult({ abi: profileAbi, functionName: call.functionName, data: result }), resolver };
}

export const readText = async (client, name, key) => (await resolveRecord(client, name, { functionName: 'text', args: [namehash(name), key] })).value;

export const readAddressBytes = async (client, name, coinType) =>
  (await resolveRecord(client, name, { functionName: 'addr', args: [namehash(name), BigInt(coinType)] })).value;

const refuse = (reason, extra = {}) => ({ ok: false, reason, ...extra });

// The registry walk (gate steps 1–5 of §7): the exact normalised spelling under an allowed
// root; every label from the top REGISTERED with expiry after the latest block's time; the
// leaf's resolver set in its parent registry, found by the Universal Resolver at offset 0,
// and a verified factory proxy of the PermissionedResolver implementation.
// Returns { ok: true, name, node, epoch, expiry, owner, tokenId, resource, registry, resolver, now }
// or { ok: false, reason, detail? } with the gate's reason codes.
export async function walkName(client, name, { allowedRoots = [config.root.ens] } = {}) {
  let exact;
  try {
    exact = exactName(name);
  } catch {
    return refuse('ENS_NAME_INVALID');
  }
  if (!allowedRoots.some((root) => isUnder(exact, root) && exact !== root)) return refuse('ENS_ROOT_NOT_ALLOWED');
  try {
    const block = await client.getBlock({ blockTag: 'latest' });
    const now = block.timestamp;
    const labels = labelsOf(exact);
    let registry = ENS.rootRegistry;
    let leaf;
    for (let i = labels.length - 1; i >= 0; i -= 1) {
      const label = labels[i];
      const isLeaf = i === 0;
      const state = await registryState(client, registry, label);
      const live = state.expiry > now;
      if (state.status === STATUS.RESERVED && live && !isLeaf) {
        // A reserved ancestor is the wildcard: synthetic names resolve, but never pay.
        let synthetic = '';
        try {
          synthetic = await readText(client, exact, KEYS.synthetic);
        } catch {
          return refuse('ENS_READ_FAILED', { detail: 'wildcard read' });
        }
        return refuse(synthetic === 'true' ? 'ENS_SYNTHETIC' : 'ENS_NOT_FOUND');
      }
      if (state.status !== STATUS.REGISTERED || !live) {
        if (isLeaf) return refuse(state.expiry === 0n ? 'ENS_NOT_FOUND' : 'ENS_EXPIRED_OR_REVOKED', { detail: label });
        return refuse(state.expiry === 0n ? 'ENS_NOT_FOUND' : 'ENS_ANCESTOR_INACTIVE', { detail: label });
      }
      if (isLeaf) {
        const resolver = await read(client, registry, 'getResolver', [label]);
        leaf = { state, registry, resolver };
      } else {
        registry = await read(client, registry, 'getSubregistry', [label]);
        if (isAddressEqual(registry, zeroAddress)) return refuse('ENS_NOT_FOUND', { detail: `no registry under ${label}` });
      }
    }
    const [found, , offset] = await client.readContract({
      address: ENS.universalResolver,
      abi: universalResolverAbi,
      functionName: 'findResolver',
      args: [dnsEncode(exact)],
    });
    if (offset !== 0n || isAddressEqual(leaf.resolver, zeroAddress) || !isAddressEqual(found, leaf.resolver)) return refuse('ENS_RESOLVER_MISMATCH');
    let impl;
    try {
      impl = await client.readContract({ address: ENS.factory, abi: verifiableFactoryAbi, functionName: 'verifyContract', args: [leaf.resolver] });
    } catch {
      return refuse('ENS_RESOLVER_MISMATCH', { detail: 'not a factory proxy' });
    }
    if (!isAddressEqual(impl, ENS.resolverImpl)) return refuse('ENS_RESOLVER_MISMATCH', { detail: 'not a PermissionedResolver' });
    const s = leaf.state;
    return {
      ok: true,
      name: exact,
      node: namehash(exact),
      epoch: s.epoch,
      expiry: s.expiry,
      owner: getAddress(s.latestOwner),
      tokenId: s.tokenId,
      resource: s.resource,
      registry: getAddress(leaf.registry),
      resolver: getAddress(leaf.resolver),
      now,
    };
  } catch {
    return refuse('ENS_READ_FAILED');
  }
}

// A 20 s cache keyed by the exact spelling and stamped before the reads (§7). A failed
// read is not cached, so an RPC blip never refuses a name for the next 20 s.
const readFailed = (v) => !v.ok && v.detail === 'ENS_READ_FAILED';
function ttlCache(ttlMs, clock) {
  const map = new Map();
  return {
    async get(key, load) {
      const hit = map.get(key);
      const t = clock();
      if (hit && t - hit.at < ttlMs) return hit.value;
      const value = await load();
      if (!readFailed(value)) map.set(key, { at: t, value });
      return value;
    },
    invalidate(key) {
      if (key === undefined) map.clear();
      else map.delete(key);
    },
  };
}

// The payee and accepts reads with their caches. One reader per client; the watcher (M6)
// calls invalidatePayee / invalidateAccepts on AddressUpdated / TextUpdated.
export function createEnsReader({ client, ttlMs = CACHE_TTL_MS, clock = Date.now, allowedRoots = [config.root.ens] }) {
  const payees = ttlCache(ttlMs, clock);
  const acceptsCache = ttlCache(ttlMs, clock);

  // The shop's Whitechain receiving address (coin type 2147485522), from its own resolver
  // after the registry walk. Exactly 20 bytes; empty or malformed → PAYEE_UNRESOLVED.
  async function resolvePayee(shopName) {
    return payees.get(shopName, async () => {
      const walk = await walkName(client, shopName, { allowedRoots });
      if (!walk.ok) return refuse('PAYEE_UNRESOLVED', { detail: walk.reason });
      try {
        const { value, resolver } = await resolveRecord(client, walk.name, { functionName: 'addr', args: [walk.node, WHITECHAIN_COIN_TYPE] });
        if (!isAddressEqual(resolver, walk.resolver)) return refuse('PAYEE_UNRESOLVED', { detail: 'ENS_RESOLVER_MISMATCH' });
        if (value === '0x' || size(value) !== 20) return refuse('PAYEE_UNRESOLVED', { detail: value === '0x' ? 'no address record' : 'not 20 bytes' });
        return { ok: true, payee: getAddress(value), name: walk.name, node: walk.node, epoch: walk.epoch, resolver: walk.resolver };
      } catch {
        return refuse('PAYEE_UNRESOLVED', { detail: 'ENS_READ_FAILED' });
      }
    });
  }

  // The tokens the shop accepts ({ chainId, token }[]), from its `x-graphpay-accepts` text
  // record. Empty → []; malformed → [] (the whole record is ignored). A failed walk or read
  // is a refusal.
  async function readAccepts(shopName) {
    return acceptsCache.get(shopName, async () => {
      const walk = await walkName(client, shopName, { allowedRoots });
      if (!walk.ok) return refuse('ACCEPTS_UNRESOLVED', { detail: walk.reason });
      try {
        const { value, resolver } = await resolveRecord(client, walk.name, { functionName: 'text', args: [walk.node, KEYS.acceptsText] });
        if (!isAddressEqual(resolver, walk.resolver)) return refuse('ACCEPTS_UNRESOLVED', { detail: 'ENS_RESOLVER_MISMATCH' });
        return { ok: true, accepts: parseAccepts(value), raw: value, name: walk.name };
      } catch {
        return refuse('ACCEPTS_UNRESOLVED', { detail: 'ENS_READ_FAILED' });
      }
    });
  }

  return {
    client,
    resolvePayee,
    readAccepts,
    walk: (name) => walkName(client, name, { allowedRoots }),
    invalidatePayee: (name) => payees.invalidate(name),
    invalidateAccepts: (name) => acceptsCache.invalidate(name),
  };
}
