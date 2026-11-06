// The menu images (T3, Swarm): each shop's menu row on Arkiv points at its menu document on
// Swarm, verified by its hash; an item's `image` gives its Swarm link, and the menu's `shop.image`
// the storefront photo's. The build reads them keyless and passes each link into the projection,
// so the phones show the photos with their Swarm links, and writes the same links for the stage.
// A read that fails leaves the link empty; the build goes on.

import { connectArkiv, menuImageLink, readMenu, swarmClient } from '../../packages/money-graph/index.mjs';

export async function menuImages(shops, { timeoutMs = 20_000 } = {}) {
  // Keyless and read only: an empty env, so no key is ever read.
  const arkiv = await connectArkiv({ backend: 'rabdi', env: {} });
  const swarm = swarmClient();
  const links = new Map();
  const storefronts = new Map();
  const menus = new Map();
  const read = async (shopEns) => {
    const menu = await readMenu(arkiv.publicClient, swarm, { shopEns });
    if (!menu?.verified || !Array.isArray(menu.document?.items)) return;
    menus.set(shopEns, menu.link);
    if (menu.document.shop?.image?.ref) storefronts.set(shopEns, menuImageLink(swarm, menu.document.shop.image));
    for (const item of menu.document.items) {
      if (item?.image?.ref && item.sku) links.set(`${shopEns}|${item.sku}`, menuImageLink(swarm, item.image));
    }
  };
  const all = Promise.all(shops.map((ens) => read(ens).catch(() => undefined)));
  await Promise.race([all, new Promise((resolve) => setTimeout(resolve, timeoutMs).unref?.())]);
  return Object.assign(links, { storefronts, menus });
}
