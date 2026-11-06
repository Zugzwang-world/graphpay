// Resizes Grok's figurines and photos (assets/grok/part2) for the phones: node apps/phones/grok-images.mjs
// Uses macOS `sips`; the small results are committed under apps/phones/static/grok/ and the phones
// build copies them to apps/web/public/phones/grok/, so Vercel needs no image tools.
//   agents/<role>-<state>.png   112 px   (idle, thinking, talking, success, refused)
//   dishes/<sku>.jpg            240 px
//   shops/<name>.jpg            480 px

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '../..');
const from = join(repo, 'assets/grok/part2');
const to = join(repo, 'apps/phones/static/grok');
const STATES = ['idle', 'thinking', 'talking', 'success', 'refused'];

function resize(src, dest, px, jpeg) {
  mkdirSync(dirname(dest), { recursive: true });
  execFileSync('sips', ['-Z', String(px), ...(jpeg ? ['--setProperty', 'format', 'jpeg', '--setProperty', 'formatOptions', '55'] : []), src, '--out', dest], { stdio: 'ignore' });
}

let n = 0;
for (const f of readdirSync(join(from, 'agents/png'))) {
  const m = /^([a-z]+)-([a-z]+)\.png$/.exec(f);
  if (!m || !STATES.includes(m[2])) continue;
  resize(join(from, 'agents/png', f), join(to, 'agents', f), 112, false);
  n++;
}
for (const f of readdirSync(join(from, 'images/dishes')).filter((x) => x.endsWith('.jpg'))) {
  resize(join(from, 'images/dishes', f), join(to, 'dishes', f), 240, true);
  n++;
}
for (const f of readdirSync(join(from, 'images/storefronts')).filter((x) => x.endsWith('.jpg'))) {
  resize(join(from, 'images/storefronts', f), join(to, 'shops', f), 480, true);
  n++;
}
console.log(`apps/phones: ${n} images resized into apps/phones/static/grok/`);
if (!existsSync(join(to, 'agents/concierge-idle.png'))) throw new Error('grok-images: the concierge figurine is missing');
