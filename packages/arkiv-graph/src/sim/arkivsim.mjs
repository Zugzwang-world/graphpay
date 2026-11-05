// ArkivSim: an in-memory Arkiv node behind a `fetch` function, so the stock SDK runs
// on it unchanged through viem's own HTTP transport (only the transport's fetchFn is
// swapped). It enforces the node's rules as measured on Rabdi
// (planning/SPEC/ARKIV_GRAPH.md §2, M7 amendment §8): pages of 100; 64 predicate
// leaves including the owner filter; indexed-only filters (a filter on a stored-only
// attribute matches nothing); creation order; count; atomic batches; readonly
// entities; expiry by block; keys from owner + entity nonce + salt (a repeated create
// duplicates); one landing per transaction nonce; and the 256 KiB request body limit
// with HTTP 413. Test hooks inject lost responses and move the clock.

import {
  bytesToString,
  decodeAbiParameters,
  decodeFunctionData,
  encodeAbiParameters,
  encodeErrorResult,
  encodeEventTopics,
  encodeFunctionResult,
  encodePacked,
  hexToBytes,
  keccak256,
  numberToHex,
  parseAbi,
  parseAbiParameters,
  parseTransaction,
  recoverTransactionAddress,
} from 'viem';
import { LIMITS } from '../schema.mjs';
import { parseQuery } from './query.mjs';

const PAGE_SIZE = LIMITS.pageSize;
const PREDICATE_LEAVES = LIMITS.predicateLeaves;

// The entity contract's ABI as the SDK 1.0.1 source declares it (src/entity/operations.ts,
// src/entity/events.ts, src/utils/arkivTransactions.ts).
export const EXECUTE_ABI = parseAbi([
  'function execute((uint8 operation, bytes operationData)[] ops) external returns (bytes32[] keys)',
  'function entityNonce(address owner) external view returns (uint64)',
  'error EmptyBatch()',
  'error InvalidOpType(uint8 operation)',
  'error AttributesNotSorted()',
  'error TooManyAttributes(uint256 count, uint256 maxCount)',
  'error EmptyMutations(bytes32 entityKey)',
  'error TombstoneInCreate(bytes32 name)',
  'error TombstoneValueNotEmpty(bytes32 name)',
  'error SystemAttributeNotWritable(bytes32 name)',
  'error InvalidValueType(bytes32 name, uint8 typeId)',
  'error Ident32Empty()',
  'error Ident32InvalidByte(uint256 position, bytes1 value)',
  'error EntityNotFound(bytes32 entityKey)',
  'error EntityExpired(bytes32 entityKey, uint64 expiresAt)',
  'error NotOwner(bytes32 entityKey, address caller, address owner)',
  'error ReadOnlyEntity(bytes32 entityKey)',
  'error ReservedCreationFlags(uint8 creationFlags)',
  'error ExpiryDeadOnArrival(uint64 target, uint64 currentBlock)',
  'error ExpiryBeyondMaxLifetime(uint64 target, uint64 currentBlock, uint64 maxLifetime)',
  'error ExpiryNotExtended(bytes32 entityKey, uint64 newExpiresAt, uint64 currentExpiresAt)',
  'error TransferToZeroAddress(bytes32 entityKey)',
  'error TransferToSelf(bytes32 entityKey)',
]);

export const EVENTS_ABI = parseAbi([
  'event EntityCreated(bytes32 indexed entityKey, address indexed owner, uint64 expiresAt, uint8 creationFlags)',
  'event EntityPatched(bytes32 indexed entityKey, address indexed owner)',
  'event ExpiryExtended(bytes32 indexed entityKey, address indexed owner, uint64 expiresAt)',
  'event OwnershipTransferred(bytes32 indexed entityKey, address indexed previousOwner, address indexed newOwner)',
  'event EntityDeleted(bytes32 indexed entityKey, address indexed owner)',
]);

const ATTRS = '(bytes32 name, uint8 typeId, bytes value)[]';
const PAYLOADS = {
  1: parseAbiParameters(`(uint128 salt, uint64 expiresAt, uint64 minLifetime, uint8 creationFlags, ${ATTRS} attributes)`),
  2: parseAbiParameters(`(bytes32 entityKey, ${ATTRS} mutations)`),
  3: parseAbiParameters('(bytes32 entityKey, uint64 expiresAt, uint64 minLifetime)'),
  4: parseAbiParameters('(bytes32 entityKey, address newOwner)'),
  5: parseAbiParameters('(bytes32 entityKey)'),
};

const MAX_LIFETIME = LIMITS.maxLifetimeBlocks;
const MAX_ATTRIBUTES = 32;
const MAX_STRING_BYTES = LIMITS.stringBytes;
const MAX_ENTITY_BYTES = 128 * 1024;
const MAX_QUERY_BYTES = 8 * 1024;
const MAX_DEPTH = 4;
const INDEXED = 0x80;
const TAGS = { 1: 'bool', 2: 'i32', 3: 'u64', 4: 'u256', 5: 'dec', 6: 'key', 7: 'bytes', 8: 'str', 9: 'addr', 10: 'key' };
const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;
const SYSTEM = { $key: 'key', $owner: 'addr', $creator: 'addr', $expiresAt: 'u64' };

class Revert extends Error {
  constructor(errorName, args = []) {
    super(`reverted: ${errorName}`);
    this.data = encodeErrorResult({ abi: EXECUTE_ABI, errorName, args });
    this.errorName = errorName;
  }
}

class RpcFailure extends Error {
  constructor(code, message, data) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

const lower = (hex) => String(hex).toLowerCase();

// The comparable form of a 32-byte attribute word (or of str and bytes data).
function decodeValue(tag, hex) {
  switch (tag) {
    case 'str':
      return bytesToString(hexToBytes(hex));
    case 'bytes':
      return lower(hex);
    case 'bool':
      return BigInt(hex) === 1n;
    case 'i32':
      return Number(BigInt.asIntN(32, BigInt(hex)));
    case 'u64':
    case 'u256':
      return BigInt(hex);
    case 'dec':
      return BigInt.asIntN(256, BigInt(hex));
    case 'key':
      return lower(hex);
    case 'addr':
      return `0x${lower(hex).slice(-40)}`;
    default:
      throw new Error(`unknown tag ${tag}`);
  }
}

function decString(units) {
  const neg = units < 0n;
  const abs = neg ? -units : units;
  const scale = 10n ** 18n;
  const whole = abs / scale;
  let frac = (abs % scale).toString().padStart(18, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${whole}${frac ? `.${frac}` : ''}`;
}

// The JSON encoding each declared type prescribes on the wire (SDK src/types/rpcSchema.ts).
function rpcValue(tag, value) {
  switch (tag) {
    case 'i32':
    case 'str':
    case 'bool':
    case 'key':
    case 'addr':
    case 'bytes':
      return value;
    case 'u64':
    case 'u256':
      return numberToHex(value);
    case 'dec':
      return decString(value);
    default:
      return value;
  }
}

function compare(tag, a, b) {
  if (tag === 'str') return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  if (tag === 'bool') return Number(a) - Number(b);
  if (typeof a === 'bigint' || typeof a === 'number') return a < b ? -1 : a > b ? 1 : 0;
  return a < b ? -1 : a > b ? 1 : 0;
}

function nameOf(word) {
  const bytes = hexToBytes(word);
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end -= 1;
  if (end === 0) throw new Revert('Ident32Empty');
  for (let i = 0; i < end; i += 1) {
    const c = bytes[i];
    const letter = (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
    const ok = letter || (i > 0 && ((c >= 48 && c <= 57) || c === 46 || c === 45 || c === 95));
    if (!ok) throw new Revert('Ident32InvalidByte', [BigInt(i), numberToHex(c, { size: 1 })]);
  }
  return bytesToString(bytes.slice(0, end));
}

function jsonResponse(body, status, headers) {
  return new Response(JSON.stringify(body, (_, v) => (typeof v === 'bigint' ? numberToHex(v) : v)), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

export class ArkivSim {
  // chainId and entityContract are the network's (the chain id it answers and the
  // address entity operations go to); both are required, so keys derive as on that network.
  constructor({ chainId, entityContract, startBlock = 1_000n, blockTime = LIMITS.blockSeconds, requestLimit = LIMITS.requestBodyBytes, gasPrice = 1_000_000_000n, rateLimit = 5000 } = {}) {
    if (!Number.isInteger(chainId) || chainId <= 0) throw new Error('ArkivSim: a chain id is required');
    if (typeof entityContract !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(entityContract)) throw new Error('ArkivSim: the entity contract address is required');
    this.chainId = chainId;
    this.entityContract = entityContract.toLowerCase();
    this.blockNumber = BigInt(startBlock);
    this.blockTime = blockTime;
    this.timestamp = BigInt(Math.floor(Date.now() / 1000));
    this.requestLimit = requestLimit;
    this.gasPrice = BigInt(gasPrice);
    this.rateLimit = rateLimit;
    this.blocks = new Map();
    this.txs = new Map();
    this.nonces = new Map();
    this.entityNonces = new Map();
    this.entities = new Map();
    this.sequence = 0;
    this.faults = [];
    this.stats = { requests: 0, byMethod: {}, status: {} };
    this.recordBlock([]);
    this.fetch = this.fetch.bind(this);
  }

  // ---- test hooks ------------------------------------------------------------

  // Queue a fault for the next call of a method:
  //   { method, kind: 'apply-then-fail' }  the node applies a sent transaction, the response is lost (HTTP 504)
  //   { method, kind: 'fail' }             the request is lost before the node sees it (HTTP 504)
  injectFault(fault) {
    this.faults.push({ times: 1, ...fault });
  }

  advanceBlocks(n) {
    for (let i = 0n; i < BigInt(n); i += 1n) this.mine([]);
  }

  advanceSeconds(seconds) {
    this.advanceBlocks(Math.ceil(seconds / this.blockTime));
  }

  liveEntities() {
    return [...this.entities.values()].filter((e) => e.expiresAt > this.blockNumber);
  }

  // ---- chain -------------------------------------------------------------------

  recordBlock(txHashes) {
    const number = this.blockNumber;
    const hash = keccak256(encodePacked(['string', 'uint256'], ['arkivsim-block', number]));
    this.blocks.set(number, { number, hash, timestamp: this.timestamp, txHashes });
  }

  mine(txHashes) {
    this.blockNumber += 1n;
    this.timestamp += BigInt(this.blockTime);
    for (const e of [...this.entities.values()]) if (e.expiresAt <= this.blockNumber) this.entities.delete(e.key);
    this.recordBlock(txHashes);
    return this.blockNumber;
  }

  blockJson(number, full) {
    const b = this.blocks.get(number);
    if (!b) return null;
    return {
      number: numberToHex(b.number),
      hash: b.hash,
      parentHash: this.blocks.get(b.number - 1n)?.hash ?? `0x${'0'.repeat(64)}`,
      timestamp: numberToHex(b.timestamp),
      baseFeePerGas: numberToHex(this.gasPrice),
      gasLimit: numberToHex(30_000_000n),
      gasUsed: '0x0',
      miner: ZERO_ADDRESS,
      difficulty: '0x0',
      extraData: '0x',
      logsBloom: `0x${'0'.repeat(512)}`,
      nonce: '0x0000000000000000',
      sha3Uncles: `0x${'0'.repeat(64)}`,
      size: '0x0',
      stateRoot: `0x${'0'.repeat(64)}`,
      transactionsRoot: `0x${'0'.repeat(64)}`,
      receiptsRoot: `0x${'0'.repeat(64)}`,
      uncles: [],
      transactions: full ? b.txHashes.map((h) => this.txs.get(h).json) : b.txHashes,
    };
  }

  blockOf(tag) {
    if (tag === 'latest' || tag === 'pending' || tag === 'safe' || tag === 'finalized' || tag === undefined) return this.blockNumber;
    if (tag === 'earliest') return 0n;
    return BigInt(tag);
  }

  // ---- entity engine -------------------------------------------------------------

  decodeOps(data) {
    const { functionName, args } = decodeFunctionData({ abi: EXECUTE_ABI, data });
    if (functionName !== 'execute') throw new RpcFailure(-32000, `unsupported call ${functionName}`);
    const ops = args[0];
    if (ops.length === 0) throw new Revert('EmptyBatch');
    return ops.map(({ operation, operationData }) => {
      const params = PAYLOADS[operation];
      if (!params) throw new Revert('InvalidOpType', [operation]);
      const [payload] = decodeAbiParameters(params, operationData);
      return { op: operation, ...payload };
    });
  }

  attributesOf(list, { create }) {
    const out = [];
    let previous = null;
    let blobBytes = 0;
    for (const a of list) {
      if (previous !== null && lower(a.name) <= previous) throw new Revert('AttributesNotSorted');
      previous = lower(a.name);
      const name = nameOf(a.name);
      if (name.startsWith('$')) throw new Revert('SystemAttributeNotWritable', [a.name]);
      if (a.typeId === 0) {
        if (create) throw new Revert('TombstoneInCreate', [a.name]);
        if (a.value !== '0x') throw new Revert('TombstoneValueNotEmpty', [a.name]);
        out.push({ name, tombstone: true });
        continue;
      }
      const tag = TAGS[a.typeId & ~INDEXED];
      const indexed = (a.typeId & INDEXED) !== 0;
      if (!tag || (tag === 'bytes' && indexed)) throw new Revert('InvalidValueType', [a.name, a.typeId]);
      const width = (a.value.length - 2) / 2;
      if (tag !== 'str' && tag !== 'bytes' && width !== 32) throw new Revert('InvalidValueType', [a.name, a.typeId]);
      if (tag === 'str' && width > MAX_STRING_BYTES) throw new Revert('InvalidValueType', [a.name, a.typeId]);
      if (tag === 'bytes') blobBytes += width;
      out.push({ name, tag, indexed, value: decodeValue(tag, a.value) });
    }
    if (blobBytes > MAX_ENTITY_BYTES) throw new Revert('InvalidValueType', [list[0].name, 7]);
    return out;
  }

  target(expiresAt, minLifetime, landing) {
    const relative = minLifetime === 0n ? 0n : landing + minLifetime;
    const target = expiresAt > relative ? expiresAt : relative;
    if (target <= landing) throw new Revert('ExpiryDeadOnArrival', [target, landing]);
    if (target > landing + MAX_LIFETIME) throw new Revert('ExpiryBeyondMaxLifetime', [target, landing, MAX_LIFETIME]);
    return target;
  }

  live(state, key) {
    const e = state.entities.get(lower(key));
    if (!e) throw new Revert('EntityNotFound', [key]);
    if (e.expiresAt <= state.landing) throw new Revert('EntityExpired', [key, e.expiresAt]);
    return e;
  }

  // Applies a batch to a copy of the state and returns the copy, the logs and the keys.
  // Any revert leaves the real state untouched (batches are atomic).
  execute(from, data, landing) {
    const ops = this.decodeOps(data);
    const state = {
      landing,
      entities: new Map([...this.entities].map(([k, e]) => [k, { ...e, attrs: new Map(e.attrs) }])),
      entityNonces: new Map(this.entityNonces),
      sequence: this.sequence,
    };
    const owner = lower(from);
    const logs = [];
    const keys = [];
    const counts = { creates: 0, patches: 0, deletes: 0, extends: 0, transfers: 0, attributes: 0 };
    for (const o of ops) {
      if (o.op === 1) {
        if ((o.creationFlags & ~0b11) !== 0) throw new Revert('ReservedCreationFlags', [o.creationFlags]);
        const attrs = this.attributesOf(o.attributes, { create: true });
        if (attrs.length > MAX_ATTRIBUTES) throw new Revert('TooManyAttributes', [BigInt(attrs.length), BigInt(MAX_ATTRIBUTES)]);
        const expiresAt = this.target(o.expiresAt, o.minLifetime, landing);
        const nonce = state.entityNonces.get(owner) ?? 0n;
        state.entityNonces.set(owner, nonce + 1n);
        const key = lower(
          keccak256(encodePacked(['uint256', 'address', 'address', 'uint64', 'uint128'], [BigInt(this.chainId), this.entityContract, from, nonce, o.salt])),
        );
        state.sequence += 1;
        state.entities.set(key, {
          key,
          owner,
          creator: owner,
          createdAt: landing,
          updatedAt: landing,
          expiresAt,
          flags: o.creationFlags,
          seq: state.sequence,
          attrs: new Map(attrs.map((a) => [a.name, a])),
        });
        keys.push(key);
        counts.creates += 1;
        counts.attributes += attrs.length;
        logs.push({ eventName: 'EntityCreated', args: { entityKey: key, owner: from }, data: [expiresAt, o.creationFlags] });
      } else if (o.op === 2) {
        const e = this.live(state, o.entityKey);
        if (e.owner !== owner) throw new Revert('NotOwner', [o.entityKey, from, e.owner]);
        if (e.flags & 1) throw new Revert('ReadOnlyEntity', [o.entityKey]);
        if (o.mutations.length === 0) throw new Revert('EmptyMutations', [o.entityKey]);
        for (const m of this.attributesOf(o.mutations, { create: false })) {
          if (m.tombstone) e.attrs.delete(m.name);
          else e.attrs.set(m.name, m);
        }
        if (e.attrs.size > MAX_ATTRIBUTES) throw new Revert('TooManyAttributes', [BigInt(e.attrs.size), BigInt(MAX_ATTRIBUTES)]);
        e.updatedAt = landing;
        counts.patches += 1;
        counts.attributes += o.mutations.length;
        logs.push({ eventName: 'EntityPatched', args: { entityKey: e.key, owner: from }, data: [] });
      } else if (o.op === 3) {
        const e = this.live(state, o.entityKey);
        if (e.owner !== owner && !(e.flags & 2)) throw new Revert('NotOwner', [o.entityKey, from, e.owner]);
        const next = this.target(o.expiresAt, o.minLifetime, landing);
        if (next < e.expiresAt) throw new Revert('ExpiryNotExtended', [o.entityKey, next, e.expiresAt]);
        e.expiresAt = next;
        counts.extends += 1;
        logs.push({ eventName: 'ExpiryExtended', args: { entityKey: e.key, owner: e.owner }, data: [next] });
      } else if (o.op === 4) {
        const e = this.live(state, o.entityKey);
        if (e.owner !== owner) throw new Revert('NotOwner', [o.entityKey, from, e.owner]);
        if (lower(o.newOwner) === ZERO_ADDRESS) throw new Revert('TransferToZeroAddress', [o.entityKey]);
        if (lower(o.newOwner) === owner) throw new Revert('TransferToSelf', [o.entityKey]);
        e.owner = lower(o.newOwner);
        counts.transfers += 1;
        logs.push({ eventName: 'OwnershipTransferred', args: { entityKey: e.key, previousOwner: from, newOwner: o.newOwner }, data: [] });
      } else if (o.op === 5) {
        const e = this.live(state, o.entityKey);
        if (e.owner !== owner) throw new Revert('NotOwner', [o.entityKey, from, e.owner]);
        state.entities.delete(e.key);
        counts.deletes += 1;
        logs.push({ eventName: 'EntityDeleted', args: { entityKey: e.key, owner: from }, data: [] });
      }
    }
    return { state, logs, keys, counts };
  }

  // A deterministic gas model, close to Rabdi's measured costs (a 1-day create of a
  // full row about 215k; a steady money event about 310k). It is a model, not a measurement.
  gasOf(data, counts) {
    let calldata = 0n;
    for (const b of hexToBytes(data)) calldata += b === 0 ? 4n : 16n;
    return (
      21_000n +
      calldata +
      BigInt(counts.creates) * 60_000n +
      BigInt(counts.patches) * 15_000n +
      BigInt(counts.attributes) * 4_000n +
      BigInt(counts.deletes + counts.extends + counts.transfers) * 15_000n
    );
  }

  call(tx) {
    const data = tx.data ?? tx.input;
    if (lower(tx.to) !== this.entityContract) return '0x';
    const { functionName, args } = decodeFunctionData({ abi: EXECUTE_ABI, data });
    if (functionName === 'entityNonce') {
      return encodeFunctionResult({ abi: EXECUTE_ABI, functionName, result: this.entityNonces.get(lower(args[0])) ?? 0n });
    }
    const { keys } = this.execute(tx.from ?? ZERO_ADDRESS, data, this.blockNumber + 1n);
    return encodeFunctionResult({ abi: EXECUTE_ABI, functionName: 'execute', result: keys });
  }

  estimate(tx) {
    const data = tx.data ?? tx.input;
    if (lower(tx.to) !== this.entityContract) return 21_000n;
    const { counts } = this.execute(tx.from ?? ZERO_ADDRESS, data, this.blockNumber + 1n);
    return this.gasOf(data, counts);
  }

  async sendRaw(raw) {
    const tx = parseTransaction(raw);
    const from = lower(await recoverTransactionAddress({ serializedTransaction: raw }));
    const hash = lower(keccak256(raw));
    if (this.txs.has(hash)) throw new RpcFailure(-32000, 'already known');
    if (BigInt(tx.chainId ?? 0) !== BigInt(this.chainId)) throw new RpcFailure(-32000, 'invalid chain id');
    const expected = this.nonces.get(from) ?? 0n;
    const nonce = BigInt(tx.nonce ?? 0);
    if (nonce < expected) throw new RpcFailure(-32000, 'nonce too low');
    if (nonce > expected) throw new RpcFailure(-32000, 'nonce too high');
    this.nonces.set(from, expected + 1n);

    const landing = this.blockNumber + 1n;
    let status = '0x1';
    let gasUsed = 21_000n;
    let logs = [];
    if (tx.to && lower(tx.to) === this.entityContract && tx.data) {
      try {
        const result = this.execute(from, tx.data, landing);
        gasUsed = this.gasOf(tx.data, result.counts);
        if (gasUsed > tx.gas) throw new Revert('EmptyBatch'); // out of gas: nothing applies
        this.entities = result.state.entities;
        this.entityNonces = result.state.entityNonces;
        this.sequence = result.state.sequence;
        logs = result.logs;
      } catch (error) {
        if (!(error instanceof Revert)) throw error;
        status = '0x0';
        gasUsed = gasUsed > tx.gas ? tx.gas : tx.gas / 2n;
        logs = [];
      }
    }
    this.mine([hash]);
    const block = this.blocks.get(landing);
    const receiptLogs = logs.map((l, i) => ({
      address: this.entityContract,
      topics: encodeEventTopics({ abi: EVENTS_ABI, eventName: l.eventName, args: l.args }),
      data: this.logData(l),
      blockNumber: numberToHex(landing),
      blockHash: block.hash,
      transactionHash: hash,
      transactionIndex: '0x0',
      logIndex: numberToHex(i),
      removed: false,
    }));
    const json = {
      hash,
      from,
      to: tx.to ? lower(tx.to) : null,
      nonce: numberToHex(nonce),
      gas: numberToHex(tx.gas ?? 0n),
      gasPrice: numberToHex(this.gasPrice),
      maxFeePerGas: tx.maxFeePerGas !== undefined ? numberToHex(tx.maxFeePerGas) : undefined,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas !== undefined ? numberToHex(tx.maxPriorityFeePerGas) : undefined,
      input: tx.data ?? '0x',
      value: numberToHex(tx.value ?? 0n),
      type: tx.type === 'eip1559' ? '0x2' : '0x0',
      chainId: numberToHex(this.chainId),
      blockNumber: numberToHex(landing),
      blockHash: block.hash,
      transactionIndex: '0x0',
      v: '0x0',
      r: `0x${'1'.padStart(64, '0')}`,
      s: `0x${'1'.padStart(64, '0')}`,
    };
    const receipt = {
      transactionHash: hash,
      transactionIndex: '0x0',
      blockHash: block.hash,
      blockNumber: numberToHex(landing),
      from,
      to: json.to,
      cumulativeGasUsed: numberToHex(gasUsed),
      gasUsed: numberToHex(gasUsed),
      effectiveGasPrice: numberToHex(this.gasPrice),
      contractAddress: null,
      logs: receiptLogs,
      logsBloom: `0x${'0'.repeat(512)}`,
      status,
      type: json.type,
    };
    this.txs.set(hash, { json, receipt });
    return hash;
  }

  logData(l) {
    if (l.eventName === 'EntityCreated') return encodeAbiParameters(parseAbiParameters('uint64, uint8'), l.data);
    if (l.eventName === 'ExpiryExtended') return encodeAbiParameters(parseAbiParameters('uint64'), l.data);
    return '0x';
  }

  // ---- queries -------------------------------------------------------------------

  matches(e, node) {
    switch (node.kind) {
      case 'and':
        return node.items.every((n) => this.matches(e, n));
      case 'or':
        return node.items.some((n) => this.matches(e, n));
      case 'exists': {
        const a = e.attrs.get(node.name);
        return Boolean(a && a.indexed);
      }
      case 'typeOf': {
        const a = e.attrs.get(node.name);
        return Boolean(a && a.indexed && a.tag === node.tag);
      }
      default: {
        const cell = this.cell(e, node.name);
        if (!cell || !cell.indexed || cell.tag !== node.value?.tag) return false;
        if (node.kind === 'startsWith') return cell.tag === 'str' && Buffer.from(cell.value).indexOf(Buffer.from(node.value.value)) === 0;
        if (node.kind === 'between') {
          return compare(cell.tag, cell.value, node.value.value) >= 0 && compare(cell.tag, cell.value, node.high.value) <= 0;
        }
        const c = compare(cell.tag, cell.value, node.value.value);
        switch (node.operator) {
          case '=':
            return c === 0;
          case '<':
            return c < 0;
          case '<=':
            return c <= 0;
          case '>':
            return c > 0;
          case '>=':
            return c >= 0;
          default:
            return false;
        }
      }
    }
  }

  cell(e, name) {
    if (Object.hasOwn(SYSTEM, name)) {
      const tag = SYSTEM[name];
      const value = name === '$key' ? e.key : name === '$owner' ? e.owner : name === '$creator' ? e.creator : e.expiresAt;
      return { tag, value, indexed: true };
    }
    return e.attrs.get(name);
  }

  query(text, options = {}) {
    if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_QUERY_BYTES) throw new RpcFailure(-32004, 'query text too long');
    let parsed;
    try {
      parsed = parseQuery(text);
    } catch (error) {
      throw new RpcFailure(-32001, `parse error: ${error.message}`);
    }
    if (parsed.leaves > PREDICATE_LEAVES) throw new RpcFailure(-32004, 'query has too many predicates');
    if (parsed.depth > MAX_DEPTH) throw new RpcFailure(-32004, 'query is nested too deeply');
    const limit = options.limit === undefined ? PAGE_SIZE : Number(BigInt(options.limit));
    const offset = options.offset === undefined ? 0 : Number(BigInt(options.offset));
    if (!Number.isInteger(limit) || limit < 1 || limit > PAGE_SIZE) throw new RpcFailure(-32004, `limit ${limit} is out of range`);
    const select = options.select ?? { key: true };

    let rows = this.liveEntities().filter((e) => this.matches(e, parsed.where));
    rows.sort((a, b) => a.seq - b.seq);
    if (parsed.orderBy) {
      const { name, tag, direction } = parsed.orderBy;
      const has = (e) => {
        const c = this.cell(e, name);
        return c && c.tag === tag ? c : null;
      };
      rows = rows
        .map((e, i) => ({ e, i, c: has(e) }))
        .sort((x, y) => {
          if (!x.c && !y.c) return x.i - y.i;
          if (!x.c) return direction === 'ASC' ? -1 : 1;
          if (!y.c) return direction === 'ASC' ? 1 : -1;
          const c = compare(tag, x.c.value, y.c.value);
          return c !== 0 ? (direction === 'ASC' ? c : -c) : x.i - y.i;
        })
        .map((x) => x.e);
    }
    const fields = Object.entries(select).filter(([k, v]) => k !== 'count' && v);
    const page = fields.length === 0 ? [] : rows.slice(offset, offset + limit).map((e) => this.project(e, select));
    const out = { data: page, blockNumber: numberToHex(this.blockNumber) };
    if (select.count) out.count = numberToHex(rows.length);
    return out;
  }

  project(e, select) {
    const out = {};
    if (select.key ?? true) out.key = e.key;
    if (select.owner) out.owner = e.owner;
    if (select.creator) out.creator = e.creator;
    if (select.createdAt) out.createdAt = numberToHex(e.createdAt);
    if (select.updatedAt) out.updatedAt = numberToHex(e.updatedAt);
    if (select.expiresAt) out.expiresAt = numberToHex(e.expiresAt);
    if (select.creationFlags) out.creationFlags = { readonly: Boolean(e.flags & 1), permissionlessExtension: Boolean(e.flags & 2), raw: e.flags };
    if (select.attributeSchema) out.attributeSchema = [...e.attrs.values()].map((a) => ({ name: a.name, type: a.tag, indexed: a.indexed }));
    if (select.attributes) {
      const wanted = select.attributes === true ? null : new Set(Object.keys(select.attributes).filter((k) => select.attributes[k]));
      out.attributes = [...e.attrs.values()]
        .filter((a) => !wanted || wanted.has(a.name))
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .map((a) => ({ name: a.name, type: a.tag, value: rpcValue(a.tag, a.value) }));
    }
    return out;
  }

  getEntity(entityKey) {
    const e = this.entities.get(lower(entityKey));
    if (!e || e.expiresAt <= this.blockNumber) return null;
    return this.project(e, { key: true, owner: true, creator: true, createdAt: true, updatedAt: true, expiresAt: true, creationFlags: true, attributes: true });
  }

  // ---- JSON-RPC over fetch ---------------------------------------------------------

  async dispatch(method, params = []) {
    switch (method) {
      case 'eth_chainId':
        return numberToHex(this.chainId);
      case 'net_version':
        return String(this.chainId);
      case 'eth_blockNumber':
        return numberToHex(this.blockNumber);
      case 'eth_gasPrice':
        return numberToHex(this.gasPrice);
      case 'eth_maxPriorityFeePerGas':
        return '0x0';
      case 'eth_getBalance':
        return numberToHex(10n ** 24n);
      case 'eth_getBlockByNumber':
        return this.blockJson(this.blockOf(params[0]), Boolean(params[1]));
      case 'eth_getBlockByHash': {
        const b = [...this.blocks.values()].find((x) => x.hash === lower(params[0]));
        return b ? this.blockJson(b.number, Boolean(params[1])) : null;
      }
      case 'eth_getTransactionCount':
        return numberToHex(this.nonces.get(lower(params[0])) ?? 0n);
      case 'eth_estimateGas':
        return numberToHex(this.estimate(params[0]));
      case 'eth_call':
        return this.call(params[0]);
      case 'eth_sendRawTransaction':
        return this.sendRaw(params[0]);
      case 'eth_getTransactionReceipt':
        return this.txs.get(lower(params[0]))?.receipt ?? null;
      case 'eth_getTransactionByHash':
        return this.txs.get(lower(params[0]))?.json ?? null;
      case 'arkiv_query':
        return this.query(params[0], params[1]);
      case 'arkiv_getEntity':
        return this.getEntity(params[0]);
      case 'arkiv_getBlockTiming':
        return { current_block: Number(this.blockNumber), current_block_time: Number(this.timestamp), duration: this.blockTime };
      default:
        throw new RpcFailure(-32601, `the method ${method} does not exist/is not available`);
    }
  }

  async answer(request) {
    const { id = null, method, params } = request;
    this.stats.byMethod[method] = (this.stats.byMethod[method] ?? 0) + 1;
    try {
      return { jsonrpc: '2.0', id, result: await this.dispatch(method, params) };
    } catch (error) {
      if (error instanceof Revert) return { jsonrpc: '2.0', id, error: { code: 3, message: 'execution reverted', data: error.data } };
      if (error instanceof RpcFailure) return { jsonrpc: '2.0', id, error: { code: error.code, message: error.message, ...(error.data ? { data: error.data } : {}) } };
      return { jsonrpc: '2.0', id, error: { code: -32603, message: error instanceof Error ? error.message : String(error) } };
    }
  }

  takeFault(method) {
    const i = this.faults.findIndex((f) => f.method === method);
    if (i === -1) return null;
    const fault = this.faults[i];
    fault.times -= 1;
    if (fault.times <= 0) this.faults.splice(i, 1);
    return fault;
  }

  headers() {
    const remaining = Math.max(0, this.rateLimit - (this.stats.requests % this.rateLimit));
    return { ratelimit: `limit=${this.rateLimit}, remaining=${remaining}, reset=10` };
  }

  async fetch(_url, init = {}) {
    const body = typeof init.body === 'string' ? init.body : init.body ? await new Response(init.body).text() : '';
    this.stats.requests += 1;
    const bytes = Buffer.byteLength(body);
    if (bytes > this.requestLimit) {
      this.stats.status[413] = (this.stats.status[413] ?? 0) + 1;
      return new Response('request body too large', { status: 413, statusText: 'Payload Too Large', headers: { 'content-type': 'text/plain', ...this.headers() } });
    }
    const request = JSON.parse(body);
    const single = Array.isArray(request) ? null : request;
    if (single) {
      const fault = this.takeFault(single.method);
      if (fault?.kind === 'fail') return new Response('gateway timeout', { status: 504, headers: { 'content-type': 'text/plain' } });
      const answer = await this.answer(single);
      if (fault?.kind === 'apply-then-fail') return new Response('gateway timeout', { status: 504, headers: { 'content-type': 'text/plain' } });
      this.stats.status[200] = (this.stats.status[200] ?? 0) + 1;
      return jsonResponse(answer, 200, this.headers());
    }
    const answers = [];
    for (const r of request) answers.push(await this.answer(r));
    this.stats.status[200] = (this.stats.status[200] ?? 0) + 1;
    return jsonResponse(answers, 200, this.headers());
  }
}
