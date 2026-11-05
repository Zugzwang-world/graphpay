// The two plug-in interfaces. AgentPay pays on Whitechain and imports no identity or memory
// system; a deployment plugs its own in (GraphPay: ENS names and its Arkiv money graph).
//
// IdentityResolver
//   resolve(name)                         → { name, node, address } | null
//   verifyMerchant?({ name, node, address }) → boolean   (buyer: is this payee really that merchant?)
//   verifyPayer?({ name, node, address })    → boolean   (relayer: is this wallet really that agent?)
//
// ReputationProvider
//   assess({ subject: 'buyer' | 'merchant', name, node, address })
//     → { risk: 'low' | 'medium' | 'high', score?: number, reasons?: string[], source?: string }
//
// A buyer refuses a merchant its provider rates high risk; a merchant's default risk check
// refuses a payer rated high risk. Both are optional.

import { getAddress, isAddressEqual } from 'viem';
import { nodeOf } from './order.mjs';

// A fixed name → address table, for tests, examples and closed deployments.
export function staticIdentity(entries) {
  const byNode = new Map(entries.map((e) => [nodeOf(e.name), { name: e.name, node: nodeOf(e.name), address: getAddress(e.address) }]));
  const matches = ({ name, node, address }) => {
    const e = byNode.get(node ?? nodeOf(name));
    return Boolean(e && isAddressEqual(e.address, address));
  };
  return Object.freeze({
    resolve: async (name) => byNode.get(nodeOf(name)) ?? null,
    verifyMerchant: async (m) => matches(m),
    verifyPayer: async (p) => matches(p),
  });
}

// A fixed rating table: { [name]: { risk, reasons } }.
export function staticReputation(table) {
  const byNode = new Map(Object.entries(table).map(([name, v]) => [nodeOf(name), v]));
  return Object.freeze({
    assess: async ({ name, node }) => ({ source: 'static', ...(byNode.get(node ?? nodeOf(name)) ?? { risk: 'low' }) }),
  });
}
