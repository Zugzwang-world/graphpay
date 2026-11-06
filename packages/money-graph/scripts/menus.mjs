// Uploads a cast's menus (public JSON, synthetic) to Swarm through the public gateway and writes
// each shop's `menu` row from W_DIRECTORY (ADR-0061).
//   pnpm -s --filter @graphpay/money-graph menus            dry run: bytes and hashes only
//   pnpm -s --filter @graphpay/money-graph menus --execute  upload, read back, write the rows
// Options:
//   --cast <name>     a cast pinned in story syntheticCity.casts (ADR-0077), for example final,
//                     instead of the story's live labels
//   --images <dir>    every item's image from <dir>/<sku>.<jpg|png|webp|svg>, where one exists
//                     (small files we own; each is uploaded first and the item's `image` points at it)
//   --image <file> --shop <story shop key> --sku <sku>   one image for one item
// Prints addresses-free labels, keys, hashes and links only; never a URL with a secret.
// W_DIRECTORY creates (and, on a changed menu, patches) its own `menu` rows: not while a
// W_DIRECTORY script such as the shop seeding runs (ADR-0033).

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { activeCast, story } from '@graphpay/config';
import { castMenus, connectArkiv, menuBytes, menuDocument, sha256Hex, swarmClient, uploadMenuImage, writeMenu } from '../index.mjs';
// The pinned casts are read by the city package; by path, as money-graph does not depend on it.
import { pinnedCast } from '../../city/src/cast.mjs';
import { loadSecrets } from './lib.mjs';

const flag = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null);
const execute = process.argv.includes('--execute');
const castName = flag('--cast');
const imagesDir = flag('--images');
const imageFile = flag('--image');
const imageShop = flag('--shop');
const imageSku = flag('--sku');
const menus = castMenus(castName ? pinnedCast(story, castName) : activeCast());
const out = [];
const TYPES = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
if (imageFile) {
  const target = menus.find((m) => m.key === imageShop)?.items.find((i) => i.sku === imageSku);
  if (!target) throw new Error('menus: --image needs --shop <story shop key> and --sku <sku> that exist in the story');
  if (!TYPES[extname(imageFile)]) throw new Error('menus: the image is .svg, .png, .jpg or .webp');
  target.imageFile = imageFile;
}
// --images is read from the repo root (pnpm --filter runs scripts in the package), and every item
// must have its image there: a menu written without them would replace one that has them.
if (imagesDir) {
  const dir = isAbsolute(imagesDir) ? imagesDir : resolve(fileURLToPath(new URL('../../../', import.meta.url)), imagesDir);
  if (!existsSync(dir)) throw new Error(`menus: --images ${imagesDir} is not a directory in the repo`);
  for (const m of menus) {
    for (const item of m.items) {
      item.imageFile ??= Object.keys(TYPES).map((ext) => join(dir, `${item.sku}${ext}`)).find((f) => existsSync(f));
      if (!item.imageFile) throw new Error(`menus: ${item.sku} has no image in ${imagesDir}`);
    }
  }
}

if (!execute) {
  for (const m of menus) {
    const doc = menuDocument({ ...m, version: 1 });
    const bytes = menuBytes(doc);
    const images = m.items.filter((i) => i.imageFile).map((i) => `${i.sku} (${statSync(i.imageFile).size} bytes)`);
    console.log(`${m.shopEns}: ${bytes.length} bytes, sha256 ${sha256Hex(bytes)} without the image references; ${images.length} of ${m.items.length} items with an image${images.length ? `: ${images.join(', ')}` : ''} (dry run, nothing uploaded)`);
  }
  process.exit(0);
}

const env = loadSecrets();
const arkiv = await connectArkiv({ backend: 'rabdi', env, role: 'W_DIRECTORY' });
const swarm = swarmClient();
for (const m of menus) {
  for (const item of m.items) {
    if (!item.imageFile) continue;
    const bytes = new Uint8Array(readFileSync(item.imageFile));
    item.image = await uploadMenuImage(swarm, { bytes, name: item.imageFile.split('/').pop(), contentType: TYPES[extname(item.imageFile)] });
    console.log(`image ${item.image.name}: ref ${item.image.ref}, ${item.image.bytes} bytes, sha256 ${item.image.sha256}`);
  }
}
// One record of the menus on Swarm, written after every menu so a stop part-way keeps what landed;
// a menu written earlier keeps its entry (and its transaction) until it is written again, and menus
// of other names stay listed under `previous`.
const file = new URL('../../../docs/sessions/arkiv/swarm-menus.json', import.meta.url);
const earlier = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
const save = () => {
  const names = new Set(menus.map((m) => m.shopEns));
  const kept = (earlier?.menus ?? []).filter((m) => names.has(m.shopEns) && !out.some((o) => o.shopEns === m.shopEns));
  const previous = [...(earlier?.menus ?? []), ...(earlier?.previous ?? [])].filter((m) => !names.has(m.shopEns));
  writeFileSync(file, `${JSON.stringify({ gateway: swarm.gateway, synthetic: true, writtenAt: new Date().toISOString(), cast: castName ?? 'live', menus: [...out, ...kept], ...(previous.length ? { previous } : {}) }, null, 2)}\n`);
};
for (const m of menus) {
  const document = menuDocument({ ...m, version: 1 });
  const r = await writeMenu(arkiv, swarm, { shopEns: m.shopEns, document });
  console.log(`${m.shopEns}: v${r.version} ${r.created ? 'created' : r.unchanged ? 'unchanged' : 'patched'} entity ${r.entityKey} ref ${r.reference}${r.txHash ? ` tx ${r.txHash}` : ''}`);
  const images = m.items.filter((i) => i.image).map((i) => ({ sku: i.sku, ref: i.image.ref, link: swarm.link(i.image.ref, i.image.name), sha256: i.image.sha256, bytes: i.image.bytes }));
  const before = (earlier?.menus ?? []).find((e) => e.shopEns === m.shopEns && e.reference === r.reference);
  out.push({ shopEns: m.shopEns, entityKey: r.entityKey, txHash: r.txHash ?? before?.txHash ?? null, reference: r.reference, link: r.link, version: r.version, contentHash: sha256Hex(menuBytes({ ...document, version: r.version })), images });
  save();
}
