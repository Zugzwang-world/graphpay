// Reads scoped to a trusted owner. Anyone can write entities that look like ours, so
// every query carries project, type and the owner filter, and every row that comes
// back is checked again for its owner and schema version. A blank or malformed owner
// is an error, never "any owner".

import { key, str } from '@arkiv-network/sdk';
import { asc, eq, gt } from '@arkiv-network/sdk/query';
import { LIMITS } from './schema.mjs';
import { plainRow } from './values.mjs';

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function checkedOwner(address, label = 'owner') {
  if (typeof address !== 'string' || address.trim() === '') throw new Error(`arkiv-graph: the trusted ${label} address is blank`);
  if (!ADDRESS.test(address) || /^0x0{40}$/.test(address)) throw new Error(`arkiv-graph: the trusted ${label} address is malformed`);
  return address.toLowerCase();
}

// The scope filters every query of an entity type starts with.
export function scope(def) {
  return [eq('project', str(def.project)), eq('type', str(def.type))];
}

// Plain rows that pass the owner and version checks.
export function trustedRows(def, owner, entities) {
  const o = checkedOwner(owner);
  const out = [];
  for (const e of entities) {
    const row = plainRow(e);
    if (row.$owner !== o) continue;
    if (row.schema_v !== undefined && row.schema_v !== def.schemaVersion) continue;
    out.push(row);
  }
  return out;
}

// Every row of a type owned by `owner` that matches `where`, paged by $key (each row
// exactly once even while others write), up to `cap` rows.
export async function readAll(publicClient, def, { owner, where = [], cap = 50_000 } = {}) {
  const o = checkedOwner(owner);
  const rows = [];
  let last = null;
  for (;;) {
    const filters = [...scope(def), ...where];
    if (last) filters.push(gt('$key', key(last)));
    const page = await publicClient
      .select('*')
      .from(def.schema)
      .where(...filters)
      .ownedBy(o)
      .orderBy(asc('$key'))
      .limit(LIMITS.pageSize)
      .fetch();
    rows.push(...trustedRows(def, o, page.entities));
    if (page.entities.length < LIMITS.pageSize || rows.length >= cap) break;
    last = page.entities.at(-1).$key;
  }
  return rows;
}

// The first matching row, or null (an existence check asks for one row).
export async function findOne(publicClient, def, { owner, where = [] } = {}) {
  const o = checkedOwner(owner);
  const page = await publicClient
    .select('*')
    .from(def.schema)
    .where(...scope(def), ...where)
    .ownedBy(o)
    .limit(1)
    .fetch();
  return trustedRows(def, o, page.entities)[0] ?? null;
}

// count() of a type owned by `owner` that matches `where`.
export async function countRows(publicClient, def, { owner, where = [] } = {}) {
  const o = checkedOwner(owner);
  return publicClient
    .count()
    .from(def.schema)
    .where(...scope(def), ...where)
    .ownedBy(o)
    .fetch();
}
