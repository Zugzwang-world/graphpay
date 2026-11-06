// The menu images (T3, Swarm): each shop's menu row on Arkiv points at its menu document on
// Swarm, verified by its hash; an item's `image` gives its Swarm link. The build reads them
// keyless and passes each link into the projected product, so the phones show the image
// wherever they show a product. A read that fails leaves the image empty; the build goes on.

import { connectArkiv, menuImageLink, readMenu, swarmClient } from '../../packages/money-graph/index.mjs';

export async function menuImages(shops, { timeoutMs = 20_000 } = {}) {
  // Keyless and read only: an empty env, so no key is ever read.
  const arkiv = await connectArkiv({ backend: 'rabdi', env: {} });
  const swarm = swarmClient();
  const links = new Map();
  const read = async (shopEns) => {
    const menu = await readMenu(arkiv.publicClient, swarm, { shopEns });
    if (!menu?.verified || !Array.isArray(menu.document?.items)) return;
    for (const item of menu.document.items) {
      if (item?.image?.ref && item.sku) links.set(`${shopEns}|${item.sku}`, menuImageLink(swarm, item.image));
    }
  };
  const all = Promise.all(shops.map((ens) => read(ens).catch(() => undefined)));
  await Promise.race([all, new Promise((resolve) => setTimeout(resolve, timeoutMs).unref?.())]);
  return links;
}
