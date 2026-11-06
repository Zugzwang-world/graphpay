// The safe writer. One serialised queue per wallet; every transaction goes out with the
// wallet's confirmed nonce (`latest`, never `pending`). After an uncertain send (a
// timeout, a lost response, a refused nonce) it never resends blindly: it waits for the
// confirmed nonce to move, finds the mined transaction by that nonce in the blocks since
// the send and takes the created keys from its receipt, in batch order. Only when the
// nonce has not moved for the whole recovery window does it send the same chunk again
// with the same nonce, so at most one of the two can land. A revert stops it. Batches
// are sized by encoded bytes: in split mode (seeding) they are cut under 120 KB and
// halved again on an HTTP 413 found down the error's cause chain; otherwise a batch
// that does not fit is an error.

import { ENTITY_EVENTS_ABI } from '@arkiv-network/sdk';
import { decodeEventLog } from 'viem';
import { LIMITS } from './schema.mjs';
import { isRequestTooLarge } from './transport.mjs';
import { entityValues, patchValues } from './values.mjs';

const queues = new Map();

// Runs fn after every earlier task of the same wallet, whatever their outcome.
function serialised(address, fn) {
  const prev = queues.get(address) ?? Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  queues.set(
    address,
    run.catch(() => {}),
  );
  return run;
}

export class WriteRevertedError extends Error {
  constructor(message, { cause, txHash } = {}) {
    super(message, { cause });
    this.name = 'WriteRevertedError';
    this.txHash = txHash;
  }
}

// The caller's nonce (read before it read its anchors) was used by another transaction:
// the plan may be stale, so nothing is sent.
export class WriteNonceTakenError extends Error {
  constructor(nonce, confirmed) {
    super(`arkiv-graph: nonce ${nonce} is taken (confirmed ${confirmed}); re-read the state`);
    this.name = 'WriteNonceTakenError';
    this.code = 'NONCE_TAKEN';
    this.nonce = nonce;
  }
}

export class WriteUncertainError extends Error {
  constructor(message, { cause, nonce } = {}) {
    super(message, { cause });
    this.name = 'WriteUncertainError';
    this.nonce = nonce;
  }
}

// Encoded size of one operation as the entity contract's calldata carries it: per
// attribute 160 bytes plus its value padded to 32-byte words; a create's frame is
// about 352 bytes and a patch's 256 (planning/SPEC/ARKIV_GRAPH.md §7).
function valueBytes(v) {
  if (v?.type === 'str') return Buffer.byteLength(v.value);
  if (v?.type === 'bytes') return (v.value.length - 2) / 2;
  return 32;
}
const pad32 = (n) => Math.ceil(n / 32) * 32;

export function operationBytes(op) {
  if (op.kind === 'create' || op.kind === 'patch') {
    const values = op.kind === 'create' ? op.params.values : op.params.set;
    let n = op.kind === 'create' ? 352 : 256;
    for (const v of Object.values(values)) n += 160 + pad32(valueBytes(v));
    return n;
  }
  return op.kind === 'extend' ? 224 : 160;
}

const TX_BYTES = 68;

function classify(error) {
  if (isRequestTooLarge(error)) return 'too-large';
  for (let e = error, depth = 0; e && depth < 12; e = e.cause, depth += 1) {
    if (e.name === 'ContractFunctionRevertedError' || e.name === 'ExecutionRevertedError' || e.code === 3) return 'revert';
  }
  const message = String(error?.message ?? '');
  if (/ran out of gas/i.test(message)) return 'out-of-gas';
  if (/ reverted[.:]/i.test(message) && error?.txHash) return 'revert';
  return 'uncertain';
}

export function createWriter({
  walletClient,
  publicClient,
  entityContract,
  splitBytes = LIMITS.splitBytes,
  recoveryMs = 60_000,
  pollMs = 2_000,
  maxSends = 3,
  sentHashes = null,
  log = () => {},
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  if (!walletClient?.account) throw new Error('arkiv-graph: the writer needs a wallet client with an account');
  if (!publicClient) throw new Error('arkiv-graph: the writer needs a public client');
  if (typeof entityContract !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(entityContract)) throw new Error('arkiv-graph: the writer needs the entity contract address');
  const address = walletClient.account.address.toLowerCase();
  const contract = entityContract.toLowerCase();
  // The nonce after the last transaction this writer saw land. A load-balanced RPC can
  // answer a confirmed count one behind right after a receipt, so the count is never
  // allowed to go back below it.
  let nextNonce = 0;
  // Reads are retried (a slow node times out now and then); nothing is sent by them.
  async function read(fn, tries = 4) {
    for (let i = 1; ; i += 1) {
      try {
        return await fn();
      } catch (error) {
        if (i >= tries || classify(error) === 'revert') throw error;
        await sleep(pollMs * i);
      }
    }
  }

  // The SDK parameters of a batch given as { creates: [{ def, values, expiration, readonly? }],
  // patches: [{ def, key, values }], deletes: [{ key }], extensions: [{ key, expiration }] }.
  function operations(batch) {
    const ops = [];
    for (const c of batch.creates ?? []) {
      if (!c.expiration) throw new Error(`arkiv-graph: a ${c.def.type} create needs an expiration`);
      const readonly = c.readonly ?? c.def.readonly;
      ops.push({ kind: 'create', params: { schema: c.def.schema, values: entityValues(c.def, c.values), expiration: c.expiration, flags: { readonly } } });
    }
    for (const p of batch.patches ?? []) {
      if (p.def.readonly) throw new Error(`arkiv-graph: ${p.def.type} entities are readonly and are never patched`);
      ops.push({ kind: 'patch', params: { schema: p.def.schema, entityKey: p.key, set: patchValues(p.def, p.values) } });
    }
    for (const d of batch.deletes ?? []) ops.push({ kind: 'delete', params: { entityKey: d.key } });
    for (const x of batch.extensions ?? []) ops.push({ kind: 'extend', params: { entityKey: x.key, expiration: x.expiration } });
    return ops;
  }

  function sdkBatch(ops) {
    const out = { creates: [], patches: [], deletes: [], extensions: [] };
    for (const op of ops) out[{ create: 'creates', patch: 'patches', delete: 'deletes', extend: 'extensions' }[op.kind]].push(op.params);
    return out;
  }

  function chunks(ops) {
    const out = [];
    let current = [];
    let size = TX_BYTES;
    for (const op of ops) {
      const n = operationBytes(op);
      if (n + TX_BYTES > splitBytes) throw new Error(`arkiv-graph: one operation is ${n} bytes, over the ${splitBytes}-byte split size`);
      if (current.length > 0 && size + n > splitBytes) {
        out.push(current);
        current = [];
        size = TX_BYTES;
      }
      current.push(op);
      size += n;
    }
    if (current.length > 0) out.push(current);
    return out;
  }

  function createdKeysOf(receipt) {
    const keys = [];
    for (const l of receipt.logs ?? []) {
      if (String(l.address).toLowerCase() !== contract) continue;
      try {
        const decoded = decodeEventLog({ abi: ENTITY_EVENTS_ABI, topics: l.topics, data: l.data });
        if (decoded.eventName === 'EntityCreated') keys.push(decoded.args.entityKey.toLowerCase());
      } catch {
        // an event this ABI does not describe
      }
    }
    return keys;
  }

  async function adopt(hash, ops, { recovered }) {
    const receipt = await read(() => publicClient.getTransactionReceipt({ hash }));
    if (receipt.status !== 'success') throw new WriteRevertedError(`arkiv-graph: transaction ${hash} reverted`, { txHash: hash });
    const keys = createdKeysOf(receipt);
    const creates = ops.filter((o) => o.kind === 'create').length;
    if (keys.length !== creates) {
      throw new WriteUncertainError(`arkiv-graph: transaction ${hash} created ${keys.length} entities for ${creates} creates; re-read the state before writing again`);
    }
    return {
      hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      effectiveGasPrice: receipt.effectiveGasPrice ?? 0n,
      creates,
      patches: ops.filter((o) => o.kind === 'patch').length,
      createdKeys: keys,
      recovered,
    };
  }

  async function findByNonce(nonce, fromBlock) {
    const head = await read(() => publicClient.getBlockNumber());
    for (let b = fromBlock; b <= head; b += 1n) {
      const block = await read(() => publicClient.getBlock({ blockNumber: b, includeTransactions: true }));
      const tx = block.transactions.find((t) => typeof t === 'object' && t.from?.toLowerCase() === address && Number(t.nonce) === nonce);
      if (tx) return tx.hash;
    }
    return null;
  }

  // Waits for the confirmed nonce to pass `nonce`, then finds that transaction. Returns
  // its hash, or null when the nonce did not move for the whole window.
  async function recover(nonce, fromBlock) {
    const deadline = Date.now() + recoveryMs;
    for (;;) {
      const confirmed = await read(() => publicClient.getTransactionCount({ address, blockTag: 'latest' }));
      if (confirmed > nonce) {
        const hash = await findByNonce(nonce, fromBlock);
        if (hash) return hash;
      }
      if (Date.now() >= deadline) return null;
      await sleep(pollMs);
    }
  }

  // Checks a transaction found by nonce, retrying a check that fails to read. Returns
  // true (ours), false (another writer's) or throws WriteUncertainError.
  async function verified(verifyRecovered, tx, nonce) {
    if (!verifyRecovered) return true;
    let lastError;
    for (let i = 0; i < 3; i += 1) {
      try {
        return Boolean(await verifyRecovered(tx.createdKeys, tx));
      } catch (error) {
        lastError = error;
        await sleep(pollMs);
      }
    }
    throw new WriteUncertainError(`arkiv-graph: transaction ${tx.hash} landed at nonce ${nonce} but could not be checked; re-read the state`, { cause: lastError, nonce });
  }

  // Once a send is uncertain, its nonce and first block are pinned: the chunk is only
  // ever sent again at that same nonce (so at most one copy can land), and the search
  // for it always starts from the first send's block. A new nonce is taken only when
  // the transaction at the pinned nonce is positively someone else's.
  async function sendChunk(ops, split, verifyRecovered, fixedNonce = null) {
    let pinned = null;
    for (let attempt = 1; ; attempt += 1) {
      const confirmed = await read(() => publicClient.getTransactionCount({ address, blockTag: 'latest' }));
      if (pinned && confirmed > pinned.nonce) {
        const hash = await findByNonce(pinned.nonce, pinned.fromBlock);
        if (!hash) {
          if (attempt > maxSends * 3) throw new WriteUncertainError(`arkiv-graph: nonce ${pinned.nonce} moved but its transaction was not found; re-read the state`, { nonce: pinned.nonce });
          await sleep(pollMs);
          continue;
        }
        nextNonce = Math.max(nextNonce, pinned.nonce + 1);
        const tx = await adopt(hash, ops, { recovered: true });
        if (await verified(verifyRecovered, tx, pinned.nonce)) {
          log({ event: 'recovered-by-nonce', nonce: pinned.nonce, hash });
          return [tx];
        }
        log({ event: 'nonce-taken-by-another', nonce: pinned.nonce, hash });
        if (fixedNonce !== null) throw new WriteNonceTakenError(fixedNonce, confirmed);
        pinned = null; // our transaction can no longer land at that nonce
        if (attempt >= maxSends) throw new WriteUncertainError(`arkiv-graph: nonces were taken by another writer ${attempt} times`, { nonce: confirmed });
        continue;
      }
      if (fixedNonce !== null && !pinned) {
        if (confirmed > fixedNonce) throw new WriteNonceTakenError(fixedNonce, confirmed);
        if (confirmed < fixedNonce) throw new Error(`arkiv-graph: nonce ${fixedNonce} is ahead of the confirmed ${confirmed}; it would wait in the mempool`);
      }
      const nonce = pinned ? pinned.nonce : (fixedNonce ?? Math.max(confirmed, nextNonce));
      const fromBlock = pinned ? pinned.fromBlock : await read(() => publicClient.getBlockNumber());
      try {
        const res = await walletClient.executeBatch(sdkBatch(ops), { nonce });
        nextNonce = Math.max(nextNonce, nonce + 1);
        // viem's waitForTransactionReceipt follows a replacement: if another transaction of
        // this key took our nonce, the hash that comes back is not the one we sent, and its
        // entities are not ours. Our transaction can no longer land at this nonce. (If the
        // replacement fails, the SDK's error carries that other transaction's hash.)
        if (sentHashes) {
          if (typeof res.txHash !== 'string') throw new WriteUncertainError('arkiv-graph: the node returned no transaction hash; re-read the state before writing again', { nonce });
          if (!sentHashes.has(res.txHash.toLowerCase())) {
            // A send that was resent at its pinned nonce can come back as the first copy's
            // receipt: the pinned branch finds it by nonce and verifyRecovered judges it.
            if (pinned) continue;
            nextNonce = Math.max(nextNonce, nonce + 1);
            log({ event: 'replaced-by-another', nonce, hash: res.txHash });
            if (fixedNonce !== null) throw new WriteNonceTakenError(fixedNonce, nonce + 1);
            if (attempt >= maxSends) throw new WriteUncertainError(`arkiv-graph: nonce ${nonce} was taken by another transaction of this key ${attempt} times`, { nonce });
            continue;
          }
        }
        const tx = await adopt(res.txHash, ops, { recovered: false });
        return [tx];
      } catch (error) {
        if (error instanceof WriteRevertedError || error instanceof WriteUncertainError || error instanceof WriteNonceTakenError) throw error;
        const kind = classify(error);
        log({ event: 'send-failed', kind, attempt, nonce, ops: ops.length });
        if (kind === 'too-large' && !pinned) {
          if (!split || ops.length < 2) throw error;
          const half = Math.ceil(ops.length / 2);
          return [...(await sendChunk(ops.slice(0, half), split, verifyRecovered)), ...(await sendChunk(ops.slice(half), split, verifyRecovered))];
        }
        if (kind === 'revert') {
          if (error.txHash) nextNonce = Math.max(nextNonce, nonce + 1); // mined and reverted: the nonce is spent
          throw new WriteRevertedError(`arkiv-graph: the batch reverted: ${error.shortMessage ?? error.message}`, { cause: error, txHash: error.txHash });
        }
        if (kind === 'out-of-gas' && !pinned) {
          nextNonce = Math.max(nextNonce, nonce + 1);
          if (attempt >= maxSends) throw error;
          continue; // mined, nothing applied: send again at the next nonce
        }
        pinned ??= { nonce, fromBlock };
        const hash = await recover(pinned.nonce, pinned.fromBlock);
        if (hash) {
          attempt -= 1; // the next round adopts it through the pinned branch
          continue;
        }
        if (attempt >= maxSends) throw new WriteUncertainError(`arkiv-graph: nothing landed at nonce ${pinned.nonce} after ${attempt} sends`, { cause: error, nonce: pinned.nonce });
        log({ event: 'resend-same-nonce', nonce: pinned.nonce, attempt });
      }
    }
  }

  // Sends a batch (one transaction, or several in split mode) and returns the
  // transactions and every created key in batch order.
  // verifyRecovered(createdKeys) → boolean, for writers that share a wallet: called when a
  // transaction was found by nonce rather than sent, to confirm it carries this batch.
  //
  // nonce: send at exactly this nonce (read by the caller before its anchors) and refuse
  // with NONCE_TAKEN, sending nothing, if another transaction already holds it.
  function send(batch, { split = false, verifyRecovered = null, nonce = null } = {}) {
    const ops = operations(batch);
    if (ops.length === 0) return Promise.resolve({ txs: [], createdKeys: [] });
    const parts = chunks(ops);
    if (!split && parts.length > 1) throw new Error(`arkiv-graph: the batch needs ${parts.length} transactions; only split mode cuts a batch`);
    if (nonce !== null && (split || !Number.isInteger(nonce) || nonce < 0)) throw new Error('arkiv-graph: a fixed nonce needs one unsplit transaction');
    if (nonce !== null && !verifyRecovered) throw new Error('arkiv-graph: a fixed nonce needs verifyRecovered, so a transaction found by nonce is checked to be this batch');
    return serialised(address, async () => {
      const txs = [];
      for (const part of parts) txs.push(...(await sendChunk(part, split, verifyRecovered, nonce)));
      return { txs, createdKeys: txs.flatMap((t) => t.createdKeys) };
    });
  }

  // The wallet's confirmed nonce, for callers that pin a send to it.
  const confirmedNonce = () => publicClient.getTransactionCount({ address, blockTag: 'latest' });

  return { address, send, confirmedNonce, operations, operationBytes, recover };
}
