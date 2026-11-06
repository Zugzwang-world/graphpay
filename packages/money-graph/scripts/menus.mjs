// Uploads the active story's cast menus (public JSON, synthetic) to Swarm through the public
// gateway and writes each shop's `menu` row from W_DIRECTORY (ADR-0061).
//   pnpm -s --filter @graphpay/money-graph menus            dry run: bytes and hashes only
//   pnpm -s --filter @graphpay/money-graph menus --execute  upload, read back, write the rows
// Prints addresses-free labels, keys, hashes and links only; never a URL with a secret.
// W_DIRECTORY creates (and, on a changed menu, patches) its own `menu` rows: not while a
// W_DIRECTORY script such as the shop seeding runs (ADR-0033).

import { writeFileSync } from 'node:fs';
import { castMenus, connectArkiv, menuBytes, menuDocument, sha256Hex, swarmClient, writeMenu } from '../index.mjs';
import { loadSecrets } from './lib.mjs';

const execute = process.argv.includes('--execute');
const menus = castMenus();
const out = [];

if (!execute) {
  for (const m of menus) {
    const doc = menuDocument({ ...m, version: 1 });
    const bytes = menuBytes(doc);
    console.log(`${m.shopEns}: ${bytes.length} bytes, sha256 ${sha256Hex(bytes)} (dry run, nothing uploaded)`);
  }
  process.exit(0);
}

const env = loadSecrets();
const arkiv = await connectArkiv({ backend: 'rabdi', env, role: 'W_DIRECTORY' });
const swarm = swarmClient();
for (const m of menus) {
  const document = menuDocument({ ...m, version: 1 });
  const r = await writeMenu(arkiv, swarm, { shopEns: m.shopEns, document });
  console.log(`${m.shopEns}: v${r.version} ${r.created ? 'created' : r.unchanged ? 'unchanged' : 'patched'} entity ${r.entityKey} ref ${r.reference}${r.txHash ? ` tx ${r.txHash}` : ''}`);
  out.push({ shopEns: m.shopEns, entityKey: r.entityKey, txHash: r.txHash, reference: r.reference, link: r.link, version: r.version, contentHash: sha256Hex(menuBytes({ ...document, version: r.version })) });
}
writeFileSync(new URL('../../../docs/sessions/arkiv/swarm-menus.json', import.meta.url), `${JSON.stringify({ gateway: swarm.gateway, synthetic: true, writtenAt: new Date().toISOString(), menus: out }, null, 2)}\n`);
