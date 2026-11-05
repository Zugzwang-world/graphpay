// Typed values in and plain values out. Every value written or compared is typed by
// its column: a bare bigint is a u256 to the SDK and silently matches nothing on a
// u64 column, so nothing here passes one through.

import { addr, bool, bytes, i32, key, str, u64 } from '@arkiv-network/sdk';
import { hexToString, stringToHex } from 'viem';

const TYPED = { addr, bool, bytes, i32, key, str, u64 };
const FIXED = new Set(['project', 'type', 'schema_v']);

// One value typed by its column type. u64 takes a bigint, a safe integer or a decimal string.
export function typed(type, value) {
  if (!Object.hasOwn(TYPED, type)) throw new Error(`arkiv-graph: no constructor for type "${type}"`);
  if (type === 'u64' && typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new Error(`arkiv-graph: ${value} is not a safe integer for a u64`);
  }
  if ((type === 'key' || type === 'addr') && typeof value === 'string') value = value.toLowerCase();
  return TYPED[type](value);
}

// The create values of an entity: its convention columns plus the given ones, each typed.
// An unknown name is an error; undefined and null values are left out.
export function entityValues(def, values) {
  const cols = def.schema.columns;
  const out = { project: str(def.project), type: str(def.type), schema_v: u64(def.schemaVersion) };
  for (const [name, value] of Object.entries(values)) {
    if (FIXED.has(name)) continue;
    if (!Object.hasOwn(cols, name)) throw new Error(`arkiv-graph: ${def.type} has no column "${name}"`);
    if (value === undefined || value === null) continue;
    out[name] = typed(cols[name].type, value);
  }
  return out;
}

// Patch values (a subset of the columns), each typed. The convention columns are fixed.
export function patchValues(def, values) {
  const cols = def.schema.columns;
  const out = {};
  for (const [name, value] of Object.entries(values)) {
    if (FIXED.has(name)) throw new Error(`arkiv-graph: ${name} is fixed at creation`);
    if (!Object.hasOwn(cols, name)) throw new Error(`arkiv-graph: ${def.type} has no column "${name}"`);
    if (value === undefined || value === null) continue;
    out[name] = typed(cols[name].type, value);
  }
  return out;
}

// A row from the SDK ({ type, value } per column, plus $key, $owner, …) as plain values:
// u64 as bigint, i32 as number, key and addr in lower case, bytes as hex.
export function plainRow(row) {
  const out = {};
  for (const [name, cell] of Object.entries(row)) {
    if (cell && typeof cell === 'object' && 'type' in cell && 'value' in cell) {
      out[name] = cell.type === 'addr' || cell.type === 'key' ? String(cell.value).toLowerCase() : cell.value;
    } else if ((name === '$owner' || name === '$creator' || name === '$key') && typeof cell === 'string') {
      out[name] = cell.toLowerCase();
    } else {
      out[name] = cell;
    }
  }
  return out;
}

// JSON payloads as bytes and back.
export function jsonBytes(value) {
  return stringToHex(JSON.stringify(value));
}

export function fromJsonBytes(hex) {
  if (typeof hex !== 'string' || hex === '0x') return null;
  try {
    return JSON.parse(hexToString(hex));
  } catch {
    return null;
  }
}

// UTC day number (days since 1970-01-01) of a unix time in seconds.
export function dayOf(ts) {
  return Math.floor(Number(ts) / 86_400);
}
