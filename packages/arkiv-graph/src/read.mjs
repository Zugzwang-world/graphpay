// Reads scoped to a trusted owner. Anyone can write entities that look like ours, so
// every query carries project, type and the owner filter, and every row that comes
// back is checked again for its owner and schema version. A blank or malformed owner
// is an error, never "any owner".

import { key, str } from '@arkiv-network/sdk';
import { asc, eq, gt, lte } from '@arkiv-network/sdk/query';
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
    if (row.schema_v !== def.schemaVersion) continue;
    out.push(row);
  }
  return out;
}

// How many matches a page covered. The SDK leaves out a matching entity that does not fit
// the schema (a row written before a column was added, say) but the node counts it toward
// the limit and the offset, so a page that returns fewer rows than its limit is not the
// last one unless it also covered fewer matches.
export const coveredBy = (page) => page.entities.length + (Number.isInteger(page.skipped) ? page.skipped : 0);

// The pages of a type owned by `o` that match `where`, in $key order, each match once even
// while others write. A page continues from its last row's key. A page whose matches were all
// left out for the schema has no row to continue from: a page of keys alone (no schema, so
// nothing is left out) bounds that stretch, and the stretch is read again up to that key, so
// a row that slid into it (when another expired meanwhile, say) is never stepped over.
async function* keyPages(publicClient, def, o, where) {
  let last = null;
  for (;;) {
    const filters = [...scope(def), ...where];
    if (last) filters.push(gt('$key', key(last)));
    const rows = (...extra) =>
      publicClient
        .select('*')
        .from(def.schema)
        .where(...filters, ...extra)
        .ownedBy(o)
        .orderBy(asc('$key'))
        .limit(LIMITS.pageSize)
        .fetch();
    const page = await rows();
    yield page;
    if (coveredBy(page) < LIMITS.pageSize) return;
    if (page.entities.length > 0) {
      last = page.entities.at(-1).$key;
      continue;
    }
    const keys = await publicClient.select({ $key: true }).where(...filters).ownedBy(o).orderBy(asc('$key')).limit(LIMITS.pageSize).fetch();
    if (keys.entities.length === 0) return;
    const bound = keys.entities.at(-1).$key;
    const stretch = await rows(lte('$key', key(bound)));
    yield stretch;
    last = stretch.entities.length > 0 && coveredBy(stretch) >= LIMITS.pageSize ? stretch.entities.at(-1).$key : bound;
  }
}

// Every row of a type owned by `owner` that matches `where`, paged by $key (each row
// exactly once even while others write). Once it has covered `cap` matches (rows, and rows
// left out for the schema) with more to come it throws, unless `truncate` is set, in which
// case it stops there.
export async function readAll(publicClient, def, { owner, where = [], cap = 50_000, truncate = false } = {}) {
  const o = checkedOwner(owner);
  const rows = [];
  let covered = 0;
  for await (const page of keyPages(publicClient, def, o, where)) {
    rows.push(...trustedRows(def, o, page.entities));
    covered += coveredBy(page);
    if (coveredBy(page) < LIMITS.pageSize) continue; // the last page, or a stretch read again
    if (covered >= cap) {
      if (truncate) break;
      throw new Error(`arkiv-graph: more than ${cap} ${def.type} rows; raise the cap or narrow the query`);
    }
  }
  return rows;
}

// The first matching row, or null (an existence check asks for one row). A first match
// that does not fit the schema is read past, in $key order.
export async function findOne(publicClient, def, { owner, where = [] } = {}) {
  const o = checkedOwner(owner);
  const page = await publicClient
    .select('*')
    .from(def.schema)
    .where(...scope(def), ...where)
    .ownedBy(o)
    .limit(1)
    .fetch();
  if (page.entities.length > 0 || coveredBy(page) === 0) return trustedRows(def, o, page.entities)[0] ?? null;
  for await (const next of keyPages(publicClient, def, o, where)) {
    const row = trustedRows(def, o, next.entities)[0];
    if (row) return row;
  }
  return null;
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
