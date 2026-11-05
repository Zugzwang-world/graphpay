// Checkout logs → events in chain order. The ABI comes from the contracts package
// (M1); a log this ABI does not know is counted and skipped, never guessed at.

import { decodeEventLog } from 'viem';
import { comparePosition, eventId } from './ids.mjs';

export function decodeLogs(abi, logs, { chainId }) {
  const events = [];
  let unknown = 0;
  for (const log of logs) {
    if (log.removed) continue;
    let decoded;
    try {
      decoded = decodeEventLog({ abi, data: log.data, topics: log.topics, strict: true });
    } catch {
      unknown += 1;
      continue;
    }
    events.push({
      id: eventId(chainId, log.transactionHash, log.logIndex),
      name: decoded.eventName,
      args: decoded.args,
      block: Number(log.blockNumber),
      logIndex: Number(log.logIndex),
      txHash: log.transactionHash.toLowerCase(),
      address: log.address.toLowerCase(),
    });
  }
  events.sort(comparePosition);
  return { events, unknown };
}
