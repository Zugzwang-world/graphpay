// Builds the team's two phone apps (frontend/, their folder, never edited here) with
// their own toolchain, wrapped in our live adapter, into apps/web/public/phones/ for
// the site to serve on the same origin (integration audit, option A). Their story.json
// is swapped at build time for a projection of packages/config/story.json.
//
//   node apps/phones/build.mjs          (apps/web's build runs it before next build)

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { story } from '../../packages/config/index.mjs';
import { projectStory } from './story-projection.mjs';
import { menuImages } from './menu-images.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const frontend = join(repo, 'frontend');
const outDir = join(repo, 'apps/web/public/phones');
const theirStory = join(frontend, 'src/data/story.json');

if (!existsSync(join(frontend, 'package.json'))) throw new Error('apps/phones: frontend/ is missing; the phones need the team folder');

// Their dependencies, from their own lockfile (they are outside the pnpm workspace). Their
// toolchain is in devDependencies, which npm skips under NODE_ENV=production (Vercel).
if (!existsSync(join(frontend, 'node_modules/.package-lock.json'))) {
  console.log('apps/phones: installing frontend/ dependencies (npm ci)');
  execFileSync('npm', ['ci', '--include=dev', '--no-audit', '--no-fund'], { cwd: frontend, stdio: 'inherit' });
}

// Our entry and adapter against their contract and components, with their TypeScript.
execFileSync(process.execPath, [join(frontend, 'node_modules/typescript/bin/tsc'), '-p', join(here, 'tsconfig.json'), '--noEmit'], { stdio: 'inherit' });

const fromFrontend = createRequire(join(frontend, 'package.json'));
const load = async (name) => import(pathToFileURL(fromFrontend.resolve(name)).href);
const { build } = await load('vite');
const react = (await load('@vitejs/plugin-react')).default;
const tailwindcss = (await load('@tailwindcss/vite')).default;

const projection = projectStory(story);
// Every photo's Swarm link, read through its shop's menu row on Arkiv: the phones show the photo
// with its link, and a product with no image in the story shows the Swarm copy itself.
let swarmLinks = { menus: {}, storefronts: {}, dishes: {} };
try {
  const links = await menuImages(projection.shops.map((s) => s.ens));
  for (const p of projection.products) {
    p.swarm = links.get(`${p.shop}|${p.id}`) ?? null;
    p.image ??= p.swarm;
  }
  for (const s of projection.shops) s.swarm = links.storefronts.get(s.ens) ?? null;
  swarmLinks = { menus: Object.fromEntries(links.menus), storefronts: Object.fromEntries(links.storefronts), dishes: Object.fromEntries(links) };
  console.log(`apps/phones: ${links.size} menu image(s) and ${links.storefronts.size} storefront(s) from Swarm`);
} catch {
  console.warn('apps/phones: the menu images could not be read; the photos show without their Swarm links');
}
const projected = JSON.stringify(projection, null, 2);

// Their story.json is read through a relative import; serve the projection in its place.
const storySwap = {
  name: 'graphpay-story-projection',
  enforce: 'pre',
  load(id) {
    return id.split('?')[0] === theirStory ? projected : null;
  },
};

rmSync(outDir, { recursive: true, force: true });
await build({
  configFile: false,
  root: here,
  base: '/phones/',
  logLevel: 'warn',
  plugins: [storySwap, react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${join(frontend, 'src')}/` },
      // One React for their components and our entry: theirs.
      { find: /^(react|react-dom)(\/.*)?$/, replacement: `${join(frontend, 'node_modules')}/$1$2` },
    ],
  },
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: { input: { customer: join(here, 'customer.html'), merchant: join(here, 'merchant.html') } },
  },
});
// Grok's resized figurines and photos (apps/phones/grok-images.mjs), served from our own site.
if (existsSync(join(here, 'static/grok'))) cpSync(join(here, 'static/grok'), join(outDir, 'grok'), { recursive: true });
// The same Swarm links for the stage's top bar and scenes (public references only).
writeFileSync(join(outDir, 'swarm.json'), `${JSON.stringify({ about: 'Read at build time from each shop menu row on Arkiv (apps/phones/menu-images.mjs).', ...swarmLinks }, null, 2)}\n`);
console.log(`apps/phones: built the customer and merchant phones into ${outDir.slice(repo.length + 1)}/`);
