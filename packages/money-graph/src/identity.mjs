// ENS identity as GraphPay uses it: node = namehash(normalize(ens)), identity =
// (node, epoch), and the identity key keccak256(abi.encode(bytes32 node, uint32 epoch))
// (planning/SPEC/IDENTITY_ENS.md §9). Fresh ENSv2 names are epoch 0.

import { encodeAbiParameters, keccak256 } from 'viem';
import { namehash, normalize } from 'viem/ens';

// ENSIP-15 normalised name; the empty name (the root node) is refused.
export function normalizedName(ens) {
  if (typeof ens !== 'string' || ens.trim() === '') throw new Error('money-graph: an ENS name is required');
  const name = normalize(ens);
  if (name === '') throw new Error('money-graph: an ENS name is required');
  return name;
}

export function nodeOf(ens) {
  return namehash(normalizedName(ens));
}

export function identityKey(node, epoch) {
  const e = Number(epoch);
  if (!Number.isInteger(e) || e < 0 || e > 0xffffffff) throw new Error(`money-graph: epoch ${epoch} is not a uint32`);
  return keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint32' }], [node, e]));
}

// Degrees to the i32 micro-degrees the shop directory stores (19.0760 → 19076000).
export function microDegrees(deg) {
  if (typeof deg !== 'number' || !Number.isFinite(deg) || Math.abs(deg) > 180) throw new Error(`money-graph: ${deg} is not a coordinate`);
  return Math.round(deg * 1_000_000);
}

// A box of `km` around a point, in micro-degrees (a degree of latitude is about 111.32 km).
export function boxAround({ lat, lng }, km) {
  const dLat = km / 111.32;
  const dLng = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  return { latMin: microDegrees(lat - dLat), latMax: microDegrees(lat + dLat), lngMin: microDegrees(lng - dLng), lngMax: microDegrees(lng + dLng) };
}
