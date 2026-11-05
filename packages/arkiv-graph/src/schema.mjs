// Entity definitions. Every entity a graph writes carries three convention columns
// from the developer's names: `project` (str, indexed), `type` (str, indexed) and
// `schema_v` (u64, stored), so every query can scope itself by project and type, and
// every row read back is checked for its version. Schemas are unnamed, so the SDK
// types the columns without writing a tag of its own.

import { addr, bool, bytes, defineSchema, i32, key, str, u64 } from '@arkiv-network/sdk';

// Arkiv's limits as measured on its testnet (attribute and request limits) and the
// split size the writer keeps transactions under.
export const LIMITS = Object.freeze({
  userAttributes: 30,
  nameBytes: 32,
  stringBytes: 128,
  pageSize: 100,
  predicateLeaves: 64,
  requestBodyBytes: 256 * 1024,
  splitBytes: 120 * 1024,
  maxLifetimeBlocks: 7_884_000n,
  blockSeconds: 2,
});

const COLUMN = { addr, bool, bytes, i32, key, str, u64 };
const SNAKE = /^[a-z][a-z0-9_]*$/;
const CONVENTION = ['project', 'type', 'schema_v'];

// Column specs as 'name:type' with optional flags after a slash (i = indexed,
// o = optional), for example 'owner:addr/i' or 'note:str/o'.
export function parseColumns(specs) {
  const out = {};
  for (const spec of specs) {
    const m = /^([a-z][a-z0-9_]*):(addr|bool|bytes|i32|key|str|u64)(?:\/([io]+))?$/.exec(spec);
    if (!m) throw new Error(`arkiv-graph: bad column spec "${spec}"`);
    const [, name, type, flags = ''] = m;
    if (Object.hasOwn(out, name)) throw new Error(`arkiv-graph: column "${name}" is defined twice`);
    let column = COLUMN[type]();
    if (flags.includes('i')) {
      if (type === 'bytes') throw new Error(`arkiv-graph: "${name}" is bytes, which cannot be indexed`);
      column = column.indexed();
    }
    if (flags.includes('o')) column = column.optional();
    out[name] = column;
  }
  return out;
}

// One entity type: `type` is the value of its `type` column; `columns` are column specs.
export function defineEntity(type, { columns = [], readonly = false } = {}, { project, schemaVersion = 1 } = {}) {
  if (typeof project !== 'string' || project === '') throw new Error('arkiv-graph: a project name is required');
  if (typeof type !== 'string' || !SNAKE.test(type)) throw new Error(`arkiv-graph: bad entity type "${type}"`);
  const specs = ['project:str/i', 'type:str/i', 'schema_v:u64', ...columns];
  const schema = defineSchema(parseColumns(specs));
  const cols = schema.columns;
  const indexed = new Set(Object.keys(cols).filter((n) => cols[n].isIndexed));
  return Object.freeze({
    type,
    schema,
    readonly: Boolean(readonly),
    indexed,
    names: Object.keys(cols),
    project,
    schemaVersion: BigInt(schemaVersion),
  });
}

// The generic definition check: at most 30 user attributes (the convention columns
// included), snake_case names of at most 32 bytes, the convention columns present, and
// no bytes column on entities that are patched often (`noBytes`). Returns the problems.
export function checkDefinition(def, { noBytes = false } = {}) {
  const problems = [];
  const cols = def.schema.columns;
  const names = Object.keys(cols);
  if (names.length > LIMITS.userAttributes) problems.push(`${def.type}: ${names.length} attributes, more than ${LIMITS.userAttributes}`);
  for (const name of names) {
    if (!SNAKE.test(name) || Buffer.byteLength(name) > LIMITS.nameBytes) problems.push(`${def.type}.${name}: not a snake_case name of at most 32 bytes`);
    if (noBytes && cols[name].type === 'bytes') problems.push(`${def.type}.${name}: this entity carries no bytes`);
    if (cols[name].type === 'bytes' && cols[name].isIndexed) problems.push(`${def.type}.${name}: bytes cannot be indexed`);
  }
  for (const c of CONVENTION) if (!Object.hasOwn(cols, c)) problems.push(`${def.type}: missing ${c}`);
  return problems;
}

// The filters a set of queries makes must equal the indexed columns (index if and only
// if a shipped query filters on it). Returns the problems found.
export function checkIndexes(def, filtered) {
  const problems = [];
  const wanted = new Set(['project', 'type', ...filtered]);
  for (const name of wanted) {
    if (!Object.hasOwn(def.schema.columns, name)) problems.push(`${def.type}.${name}: filtered but not a column`);
    else if (!def.indexed.has(name)) problems.push(`${def.type}.${name}: filtered but not indexed`);
  }
  for (const name of def.indexed) if (!wanted.has(name)) problems.push(`${def.type}.${name}: indexed but never filtered`);
  return problems;
}
