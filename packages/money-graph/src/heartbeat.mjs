// The mirror's heartbeat row (Join, M11): mutable, owned by W_LEDGER, one per instance,
// 1-day life, extended while it runs. The lease and the website's lag chip read it.

import { ExpirationTime } from '@arkiv-network/sdk';
import { readAll } from '@graphpay/arkiv-graph';
import { ENTITIES, LIFETIME, writerAddresses } from './model.mjs';

// values: { instance, state, cursorBlock, cursorLog, headBlock, lagBlocks, updatedTs }.
// Creates the row the first time (key = null), patches it after; returns its key.
export async function writeHeartbeat(arkiv, { instance, state, cursorBlock, cursorLog, headBlock, lagBlocks, updatedTs }, { key = null, extend = false } = {}) {
  if (!arkiv?.writer) throw new Error('money-graph: writeHeartbeat needs a W_LEDGER connection with a writer');
  const values = { instance, state, cursor_block: BigInt(cursorBlock), cursor_log: BigInt(cursorLog), head_block: BigInt(headBlock), lag_blocks: BigInt(lagBlocks), updated_ts: BigInt(updatedTs) };
  const expiration = () => ExpirationTime.fromDays(LIFETIME.heartbeatDays);
  if (!key) {
    const { createdKeys } = await arkiv.writer.send({ creates: [{ def: ENTITIES.heartbeat, values, expiration: expiration() }] });
    return createdKeys[0];
  }
  const { instance: _i, ...set } = values;
  await arkiv.writer.send({ patches: [{ def: ENTITIES.heartbeat, key, values: set }], extensions: extend ? [{ key, expiration: expiration() }] : [] });
  return key;
}

export async function readHeartbeats(publicClient, { owner = writerAddresses().W_LEDGER } = {}) {
  return readAll(publicClient, ENTITIES.heartbeat, { owner, cap: 100, truncate: true });
}

