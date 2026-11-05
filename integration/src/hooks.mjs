// The live hooks behind the agents' interfaces (packages/agents/index.d.ts, LiveHooks),
// the parts that read ENS and Arkiv:
//   resolvePayee, readAccepts  ENS on Sepolia at pay time, cached 20 s (M5 amendment §2)
//   nodeOf                     the namehash of the normalised name
//   directory, shopKey         discoverShops around the persona (M7 amendment §6), W_DIRECTORY
//   findQuotes                 the errand's quote entities (M7 amendment §5), W_DIRECTORY
//   payerWallet                the paying agent's wallet address by its role (never a key)
// The shop side (catalog, storefront, the 402 and the settlement), x402 signing and the
// ENS gate (ensCheck) come from M3 and M6 and are added beside these.

import { activeCast, castEntries, config, disposableEntry, story } from '@graphpay/config';
import { createEnsReader, namehash, normalizeName } from '@graphpay/ens';
import { boxAround, discoverShops, findQuotes } from '@graphpay/money-graph';

const NETWORK = `eip155:${config.networks.whitechain.chainId}`;

// What the payer reads: [{ network, asset }] (CAIP-2 network, token address).
export function acceptsForAgents(list) {
  return list.map((e) => ({ network: `eip155:${e.chainId}`, asset: e.token }));
}

// The persona's search box: its configured point and radius (story.json `locations`).
export function personaBox(source = story) {
  const { persona, searchRadiusKm } = source.locations;
  return boxAround({ lat: persona.lat, lng: persona.lng }, searchRadiusKm);
}

// ens: a Sepolia public client (chain id checked by clientsFor). arkiv: a read connection
// (connectArkiv). wallets: public addresses by wallet role (scripts/lib/wallets.mjs).
export function createReadHooks({ ens, arkiv, wallets = {}, cast = activeCast(), root = config.root.ens, box = personaBox() }) {
  const reader = createEnsReader({ client: ens });
  const shopKeys = new Map();
  const pc = arkiv.publicClient;
  const disposableOf = (key) => {
    const n = key.startsWith(cast.disposable.labelPrefix) ? Number(key.slice(cast.disposable.labelPrefix.length)) : NaN;
    return Number.isInteger(n) && n >= 1 ? disposableEntry(n, cast, root) : null;
  };

  async function discover(category) {
    const { shops } = await discoverShops(pc, { category, box });
    for (const s of shops) shopKeys.set(s.ens, s.shopKey);
    return shops;
  }

  return {
    reader,
    async resolvePayee(shopEns) {
      const r = await reader.resolvePayee(shopEns);
      if (!r.ok) throw new Error(`${r.refused ?? 'PAYEE_UNRESOLVED'}: ${r.detail ?? 'no Whitechain address in ENS'}`);
      return r.payee;
    },
    async readAccepts(shopEns) {
      const r = await reader.readAccepts(shopEns);
      if (!r.ok) throw new Error(`${r.refused ?? 'ACCEPTS_UNRESOLVED'}: ${r.detail ?? 'the accepts record could not be read'}`);
      return acceptsForAgents(r.accepts);
    },
    async nodeOf(name) {
      return namehash(normalizeName(name));
    },
    async directory({ category } = {}) {
      return (await discover(category)).map((s) => s.ens).filter((n) => n.endsWith(`.${root}`));
    },
    async shopKey(shopEns) {
      if (!shopKeys.has(shopEns)) await discover();
      const k = shopKeys.get(shopEns);
      if (!k) throw new Error(`no active directory row for ${shopEns}`);
      return k;
    },
    async findQuotes(requestId) {
      const rows = await findQuotes(pc, requestId);
      return rows.map((q) => ({ key: q.key, requestId: q.requestId, shopKey: q.shopKey, agentEns: q.agentEns, priceMicro: q.price, validUntil: q.validUntil }));
    },
    async payerWallet(key) {
      const entry = castEntries(cast, root).find((e) => e.key === key && e.pays) ?? disposableOf(key);
      const address = entry ? wallets[entry.walletRole] : null;
      if (!address) throw new Error(`no wallet address for the paying agent ${key}`);
      return address;
    },
    contracts: [config.whitechain.contracts.checkout.address],
    network: NETWORK,
  };
}
