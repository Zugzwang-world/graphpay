// Event ids and stream positions. An event's id is `<chainId>:<txHash>:<logIndex>`
// (SPEC/PAYMENTS_WHITECHAIN.md §3.3), the `ref` of the edge it writes. A position is
// { block, logIndex }, compared in chain order; a checkpoint is the last position done.

export const ZERO_NODE = `0x${'0'.repeat(64)}`;
// The log index that stands for "the whole block is done" (a u64 column takes it).
export const BLOCK_DONE = Number.MAX_SAFE_INTEGER;
export const DAY_S = 86_400;

export function eventId(chainId, txHash, logIndex) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new Error('eventId: a transaction hash is 32 bytes of hex');
  return `${chainId}:${txHash.toLowerCase()}:${Number(logIndex)}`;
}

export function comparePosition(a, b) {
  return a.block - b.block || a.logIndex - b.logIndex;
}

export const atOrBefore = (pos, checkpoint) => checkpoint != null && comparePosition(pos, checkpoint) <= 0;

// The last position strictly before `pos`.
export function before(pos) {
  return pos.logIndex > 0 ? { block: pos.block, logIndex: pos.logIndex - 1 } : { block: pos.block - 1, logIndex: BLOCK_DONE };
}

export const minPosition = (a, b) => (comparePosition(a, b) <= 0 ? a : b);

export const utcDay = (ts) => Math.floor(Number(ts) / DAY_S);

export const isZeroNode = (node) => typeof node === 'string' && /^0x0{64}$/i.test(node);
