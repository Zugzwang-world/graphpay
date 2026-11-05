// ERC-7930 interoperable addresses (version 1) and the accepts list built from them
// (planning/SPEC/IDENTITY_ENS.md §5; ADR-0038: the text record `x-graphpay-accepts`
// holds the ENSIP-31 entry format, without the ENSIP-31 data record).
//
// Entry: version 0x0001 | chain type (2 bytes; eip155 = 0x0000) | reference length (1)
// | chain reference (the chain id, minimal big-endian) | address length (1) | address.
// A list is entries concatenated without a delimiter. If any entry is malformed, the
// whole list is ignored.

import { getAddress, hexToBytes, isHex, toHex } from 'viem';

const VERSION = 1;
const EIP155 = 0;

function minimalBigEndian(value) {
  let n = BigInt(value);
  if (n <= 0n) throw new Error('chain id must be positive');
  const out = [];
  while (n > 0n) {
    out.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  return out;
}

// One eip155 entry. `address` null or undefined: the chain's native asset (no address).
export function encodeInteropAddress({ chainId, address }) {
  const ref = minimalBigEndian(chainId);
  const addr = address == null ? [] : [...hexToBytes(getAddress(address))];
  const bytes = [0, VERSION, 0, EIP155, ref.length, ...ref, addr.length, ...addr];
  return toHex(Uint8Array.from(bytes));
}

export function encodeInteropList(entries) {
  return `0x${entries.map((e) => encodeInteropAddress(e).slice(2)).join('')}`;
}

// Parses a concatenated list. Returns the entries, or null if anything is malformed.
// eip155 entries come back as { chainType: 0, chainId, address | null }; other chain
// types keep their raw reference and address bytes.
export function parseInteropList(hex) {
  if (typeof hex !== 'string' || !isHex(hex) || hex.length % 2 !== 0) return null;
  const b = hexToBytes(hex);
  const u16 = (at) => (b[at] << 8) | b[at + 1];
  const entries = [];
  let i = 0;
  while (i < b.length) {
    if (i + 5 > b.length) return null;
    const version = u16(i);
    const chainType = u16(i + 2);
    const refLen = b[i + 4];
    if (version !== VERSION) return null;
    i += 5;
    if (i + refLen + 1 > b.length) return null;
    const ref = b.subarray(i, i + refLen);
    i += refLen;
    const addrLen = b[i];
    i += 1;
    if (i + addrLen > b.length) return null;
    const addr = b.subarray(i, i + addrLen);
    i += addrLen;
    if (chainType === EIP155) {
      if (refLen === 0 || ref[0] === 0) return null; // a chain reference is required and minimal
      if (addrLen !== 0 && addrLen !== 20) return null;
      let chainId = 0n;
      for (const byte of ref) chainId = (chainId << 8n) | BigInt(byte);
      if (chainId > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      entries.push({ chainType, chainId: Number(chainId), address: addrLen === 0 ? null : getAddress(toHex(addr)) });
    } else {
      entries.push({ chainType, reference: toHex(ref), addressBytes: toHex(addr) });
    }
  }
  return entries;
}

// The tokens a payee accepts: eip155 entries that name a token contract, in record order.
// Empty or absent → [] (no preference). Malformed → [] (the whole record is ignored).
export function parseAccepts(value) {
  if (value == null || value === '' || value === '0x') return [];
  const entries = parseInteropList(value);
  if (entries === null) return [];
  return entries.filter((e) => e.chainType === EIP155 && e.address !== null).map((e) => ({ chainId: e.chainId, token: e.address }));
}

// True if the accepts list names this token on this chain (chain and token must both match).
export function accepts(list, { chainId, token }) {
  const t = getAddress(token).toLowerCase();
  return list.some((e) => e.chainId === chainId && e.token.toLowerCase() === t);
}
