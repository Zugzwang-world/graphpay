// Names, hashes and ids on ENSv2 (planning/SPEC/IDENTITY_ENS.md §1, §9, §10).
// Registry calls take uint256(keccak256(label)); setters and the Universal Resolver
// take the DNS-encoded name; the epoch is the low 32 bits of a label's resource.

import { encodeAbiParameters, keccak256, stringToBytes, toHex } from 'viem';
import { namehash as viemNamehash, normalize, packetToBytes, toCoinType } from 'viem/ens';

// Registry Status enum, in its verified order (IPermissionedRegistry.sol).
export const STATUS = Object.freeze({ AVAILABLE: 0, RESERVED: 1, REGISTERED: 2 });
export const STATUS_NAME = Object.freeze(['AVAILABLE', 'RESERVED', 'REGISTERED']);

const LOW_32 = 0xffffffffn;

// ENSIP-15 normalisation. Throws on an invalid name.
export function normalizeName(name) {
  if (typeof name !== 'string' || name.length === 0) throw new Error('ENS name must be a non-empty string');
  return normalize(name);
}

// The name only if it is already in normalised form: a look-alike spelling is refused,
// never silently mapped onto the real name (planning/PITFALLS.md 18).
export function exactName(name) {
  const normal = normalizeName(name);
  if (normal !== name) throw new Error('ENS name is not in normalised form');
  return normal;
}

export const namehash = (name) => viemNamehash(name);

export function labelsOf(name) {
  const labels = name.split('.');
  if (labels.some((l) => l.length === 0)) throw new Error('ENS name has an empty label');
  return labels;
}

// uint256(keccak256(label)): the id every registry call takes.
export const labelId = (label) => BigInt(keccak256(stringToBytes(label)));

// The DNS wire encoding every PermissionedResolver setter and the Universal Resolver take.
// The root name encodes as 0x00, which writes the default record: never pass '' by accident.
export function dnsEncode(name) {
  if (name === '') throw new Error('refusing to DNS-encode the root name (it writes the default record)');
  return toHex(packetToBytes(name));
}

// The epoch (uint32) of a resource or token id: its low 32 bits. Read it only while the
// label is REGISTERED (§9: an AVAILABLE label shows the next version).
export const epochOf = (resource) => Number(BigInt(resource) & LOW_32);

// The id that survives role changes (the low 32 bits of a token id change on them, §8).
export const canonicalId = (id) => BigInt(id) ^ (BigInt(id) & LOW_32);

// Identity key: keccak256(abi.encode(bytes32 node, uint32 epoch)) (§9, ADR-0007).
export const identityKey = (node, epoch) =>
  keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint32' }], [node, epoch]));

// ENSIP-11 coin type of an EVM chain (Whitechain Sepolia 1874 → 2147485522).
export const coinTypeOf = (chainId) => toCoinType(chainId);

// The parent of a name ('a.b.c' → 'b.c'); the root's parent is ''.
export function parentOf(name) {
  const at = name.indexOf('.');
  return at === -1 ? '' : name.slice(at + 1);
}

// True if `name` is `root` or ends with `.root`.
export function isUnder(name, root) {
  return name === root || name.endsWith(`.${root}`);
}
