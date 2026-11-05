// Shared by the live scripts: secrets through the repo's git-based loader (never
// printed), redacted errors, and a hand-built `execute` patch for simulations (eth_call,
// nothing signed or sent).

import { encodeAbiParameters, encodeFunctionData, stringToHex, toFunctionSelector } from 'viem';
import { loadEnv } from '../../../scripts/lib/env-loader.mjs';
import { installErrorBoundary } from '../../../scripts/lib/redact.mjs';

export function loadSecrets() {
  let values = new Map();
  installErrorBoundary(() => values);
  ({ values } = loadEnv());
  return Object.fromEntries(values);
}

const EXECUTE = [{ type: 'function', name: 'execute', inputs: [{ type: 'tuple[]', components: [{ type: 'uint8' }, { type: 'bytes' }] }], outputs: [{ type: 'bytes32[]' }] }];
const PATCH = [{ type: 'tuple', components: [{ type: 'bytes32' }, { type: 'tuple[]', components: [{ type: 'bytes32' }, { type: 'uint8' }, { type: 'bytes' }] }] }];

// Calldata of one patch setting a stored-only u64 column (type id 3) to `value`.
export function u64PatchData(entityKey, column, value) {
  const name = stringToHex(column, { size: 32 });
  const word = `0x${BigInt(value).toString(16).padStart(64, '0')}`;
  const payload = encodeAbiParameters(PATCH, [[entityKey, [[name, 3, word]]]]);
  return encodeFunctionData({ abi: EXECUTE, functionName: 'execute', args: [[[2, payload]]] });
}

// Simulates a patch from `from` with eth_call: { ok: true } or { ok: false, reason }.
export async function simulatePatch(publicClient, { entityContract, from, entityKey, column, value }) {
  try {
    await publicClient.call({ account: from, to: entityContract, data: u64PatchData(entityKey, column, value) });
    return { ok: true };
  } catch (error) {
    const text = `${error.shortMessage ?? ''} ${error.details ?? ''} ${error.cause?.data ?? error.data ?? ''}`;
    // ReadOnlyEntity(bytes32) selector, or the node's own words.
    const readonly = /ReadOnlyEntity|read.?only/i.test(text) || text.includes(readOnlySelector());
    return { ok: false, reason: readonly ? 'ReadOnlyEntity' : (error.shortMessage ?? 'reverted') };
  }
}

let selector;
function readOnlySelector() {
  selector ??= toFunctionSelector('ReadOnlyEntity(bytes32)');
  return selector;
}
