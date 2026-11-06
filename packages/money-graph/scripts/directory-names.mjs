// Updates the cast shops' display names in their W_DIRECTORY `shop` rows to the active story's
// (the row's payload.name only; ENS name, category, area and coordinates stay as they are).
//   pnpm -s --filter @graphpay/money-graph directory-names            dry run: current and new names
//   pnpm -s --filter @graphpay/money-graph directory-names --execute  patch the rows that differ
// Prints labels, names and transaction hashes only; never a URL with a secret.

import { ENTITIES, castMenus, connectArkiv } from '../index.mjs';
import { fromJsonBytes, jsonBytes, readAll } from '@graphpay_ethglobal/arkiv-graph';
import { loadSecrets } from './lib.mjs';

const execute = process.argv.includes('--execute');
const env = loadSecrets();
const arkiv = await connectArkiv({ backend: 'rabdi', env, ...(execute ? { role: 'W_DIRECTORY' } : {}) });
const owner = arkiv.owner ?? (await import('../index.mjs')).writerAddresses().W_DIRECTORY;
const rows = await readAll(arkiv.publicClient, ENTITIES.shop, { owner, cap: 500 });
const patches = [];
for (const m of castMenus()) {
  const found = rows.filter((r) => r.shop_ens === m.shopEns);
  if (found.length === 0) console.log(`${m.shopEns}: no directory row`);
  for (const row of found) {
    const payload = fromJsonBytes(row.payload) ?? {};
    const same = payload.name === m.name;
    console.log(`${m.shopEns}: "${payload.name ?? ''}" -> "${m.name}"${same ? ' (unchanged)' : ''}`);
    if (!same) patches.push({ def: ENTITIES.shop, key: row.$key, values: { payload: jsonBytes({ ...payload, name: m.name }) } });
  }
}
if (execute && patches.length > 0) {
  const { txs } = await arkiv.writer.send({ patches });
  console.log(`patched ${patches.length} rows in ${txs.length} tx: ${txs.map((t) => t.hash).join(' ')}`);
} else if (!execute) console.log('dry run, nothing written');
