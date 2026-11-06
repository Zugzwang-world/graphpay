// The filter compiler: { field: { eq, in, gt, gte, lt, lte, between: [lo, hi], startsWith,
// exists }, AND: [...], OR: [...] } into SDK expressions, typed by the entity's columns.
// Rejected as errors, never silently: unknown fields, stored-only columns, startsWith on a
// non-string, ranges on anything but u64 and i32, exists: false, a u64 outside 0…2⁶⁴−1,
// an i32 outside its range, a key that is not 32-byte hex, an addr that is not 20 bytes,
// strings over 128 bytes. Keys and addresses are lower-cased.

import { addr, bool, i32, key, str, u64 } from '@arkiv-network/sdk';
import { and, between, eq, exists, gt, gte, lt, lte, or, startsWith } from '@arkiv-network/sdk/query';
import { LIMITS } from './schema.mjs';

const OPS = new Set(['eq', 'in', 'gt', 'gte', 'lt', 'lte', 'between', 'startsWith', 'exists']);

function value(type, v, field) {
  switch (type) {
    case 'u64': {
      // A bigint, a safe integer or a decimal or 0x string: never a boolean, an empty string or
      // a number too large to be exact.
      let n;
      if (typeof v === 'bigint') n = v;
      else if (typeof v === 'number' && Number.isSafeInteger(v)) n = BigInt(v);
      else if (typeof v === 'string' && /^(\d+|0x[0-9a-fA-F]+)$/.test(v)) n = BigInt(v);
      else throw new Error(`filter: ${field} needs an integer (a bigint, a safe integer or a decimal or 0x string)`);
      if (n < 0n || n > 2n ** 64n - 1n) throw new Error(`filter: ${field} is outside u64`);
      return u64(n);
    }
    case 'i32': {
      const n = typeof v === 'bigint' && v >= -2147483648n && v <= 2147483647n ? Number(v) : v;
      if (!Number.isInteger(n) || n < -2147483648 || n > 2147483647) throw new Error(`filter: ${field} is outside i32`);
      return i32(n);
    }
    case 'key':
      if (typeof v !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(v)) throw new Error(`filter: ${field} needs 32-byte hex`);
      return key(v.toLowerCase());
    case 'addr':
      if (typeof v !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(v)) throw new Error(`filter: ${field} needs a 20-byte address`);
      return addr(v.toLowerCase());
    case 'str':
      if (typeof v !== 'string' || Buffer.byteLength(v) > LIMITS.stringBytes) throw new Error(`filter: ${field} needs a string of at most ${LIMITS.stringBytes} bytes`);
      return str(v);
    case 'bool':
      if (typeof v !== 'boolean') throw new Error(`filter: ${field} needs a boolean`);
      return bool(v);
    default:
      throw new Error(`filter: ${field} cannot be filtered`);
  }
}

// Returns a list of expressions to AND, or null when an empty `in` means "matches nothing"
// (send no query).
export function compileFilter(def, input) {
  const cols = def.schema.columns;
  const out = [];
  let empty = false;
  for (const [field, spec] of Object.entries(input ?? {})) {
    if (field === 'AND' || field === 'OR') {
      if (!Array.isArray(spec) || spec.length === 0) throw new Error(`filter: ${field} needs a non-empty list`);
      const parts = spec.map((x) => compileFilter(def, x));
      const live = parts.filter((p) => p !== null);
      if (field === 'AND') {
        if (live.length < parts.length) empty = true;
        else out.push(and(live.flat()));
      } else if (live.length === 0) empty = true;
      else out.push(or(live.map((p) => and(p))));
      continue;
    }
    const col = cols[field];
    if (!col) throw new Error(`filter: unknown field "${field}"`);
    if (!col.isIndexed) throw new Error(`filter: "${field}" is stored only and cannot be filtered`);
    if (typeof spec !== 'object' || spec === null) throw new Error(`filter: ${field} needs an operator object`);
    for (const [op, v] of Object.entries(spec)) {
      if (!OPS.has(op)) throw new Error(`filter: unknown operator "${op}"`);
      const ranged = col.type === 'u64' || col.type === 'i32';
      if (['gt', 'gte', 'lt', 'lte', 'between'].includes(op) && !ranged) throw new Error(`filter: ranges need a u64 or i32 field, not ${field}`);
      if (op === 'startsWith' && col.type !== 'str') throw new Error(`filter: startsWith needs a string field, not ${field}`);
      if (op === 'exists') {
        if (v !== true) throw new Error('filter: exists takes true only');
        out.push(exists(field));
        continue;
      }
      if (op === 'in') {
        if (!Array.isArray(v)) throw new Error(`filter: ${field}.in needs a list`);
        if (v.length === 0) {
          empty = true;
          continue;
        }
        out.push(or(v.map((x) => eq(field, value(col.type, x, field)))));
        continue;
      }
      if (op === 'between') {
        if (!Array.isArray(v) || v.length !== 2) throw new Error(`filter: ${field}.between needs [low, high]`);
        out.push(between(field, value(col.type, v[0], field), value(col.type, v[1], field)));
        continue;
      }
      if (op === 'startsWith') {
        out.push(startsWith(field, value('str', v, field)));
        continue;
      }
      out.push({ eq, gt, gte, lt, lte }[op](field, value(col.type, v, field)));
    }
  }
  return empty ? null : out;
}
