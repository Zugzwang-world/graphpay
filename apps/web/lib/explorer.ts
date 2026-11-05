// Explorer links (WEBSITE_SPEC.md §1 rule 1, §8). The base URLs come from the
// config's networks (graphpay.config.json); the paths are each explorer's own
// routes, checked against it (docs/technical/FACTS.md, website rows). A value
// that is not a well-formed hash, address, entity key or block number gets no
// link, so text from a response never lands in a URL.

export type NetworkKey = 'whitechain' | 'sepolia' | 'rabdi';
export type ExplorerBases = Record<NetworkKey, string>;

const HASH = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const BLOCK = /^\d{1,20}$/;

// Whitechain runs Blockscout, Sepolia is Etherscan, Rabdi is Arkiv's own explorer.
// Only Arkiv's explorer has entity pages and a query page; its block page takes no
// number in the path, so Rabdi blocks link to its block list.
const PATHS = {
  whitechain: { tx: '/tx/', address: '/address/', block: '/block/', token: '/token/' },
  sepolia: { tx: '/tx/', address: '/address/', block: '/block/' },
  rabdi: { tx: '/tx/', address: '/address/', entity: '/entity/', blocks: '/blocks', query: '/entity-explorer' },
} as const;

const base = (bases: ExplorerBases, network: NetworkKey) => bases[network].replace(/\/+$/, '');

export function isTxHash(value: unknown): value is string {
  return typeof value === 'string' && HASH.test(value);
}

export function isAddress(value: unknown): value is string {
  return typeof value === 'string' && ADDRESS.test(value);
}

export function txUrl(bases: ExplorerBases, network: NetworkKey, hash: unknown): string | null {
  return isTxHash(hash) ? `${base(bases, network)}${PATHS[network].tx}${hash.toLowerCase()}` : null;
}

export function addressUrl(bases: ExplorerBases, network: NetworkKey, address: unknown): string | null {
  return isAddress(address) ? `${base(bases, network)}${PATHS[network].address}${address}` : null;
}

export function tokenUrl(bases: ExplorerBases, address: unknown): string | null {
  return isAddress(address) ? `${base(bases, 'whitechain')}${PATHS.whitechain.token}${address}` : null;
}

// An Arkiv entity key is 32 bytes of hex, like a transaction hash.
export function entityUrl(bases: ExplorerBases, key: unknown): string | null {
  return isTxHash(key) ? `${base(bases, 'rabdi')}${PATHS.rabdi.entity}${key.toLowerCase()}` : null;
}

export function blockUrl(bases: ExplorerBases, network: NetworkKey, block: unknown): string | null {
  const text = typeof block === 'bigint' || typeof block === 'number' ? String(block) : block;
  if (typeof text !== 'string' || !BLOCK.test(text)) return null;
  if (network === 'rabdi') return `${base(bases, 'rabdi')}${PATHS.rabdi.blocks}`;
  return `${base(bases, network)}${PATHS[network].block}${text}`;
}

// A query on Arkiv's explorer ("run this query"), in the explorer's own query language.
export function arkivQueryUrl(bases: ExplorerBases, query: string): string | null {
  const q = query.trim();
  if (q === '' || q.length > 2000) return null;
  return `${base(bases, 'rabdi')}${PATHS.rabdi.query}?q=${encodeURIComponent(q)}`;
}

// A short form for chips: 0x1234…abcd.
export function shortHex(value: string, head = 6, tail = 4): string {
  return value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`;
}
