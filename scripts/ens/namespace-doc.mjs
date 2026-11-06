// node scripts/ens/namespace-doc.mjs
// Renders docs/sessions/identity/namespace.md from docs/sessions/identity/namespace.json (written by
// real-run.mjs --real): every name, node, epoch, resolver, registry, expiry and transaction link,
// and the hand-off table T1's policies and Join's mirror read. Public addresses and hashes only.

import { readFileSync, writeFileSync } from 'node:fs';
import { config } from '../../packages/config/index.mjs';

const JSON_FILE = 'docs/sessions/identity/namespace.json';
const MD_FILE = 'docs/sessions/identity/namespace.md';
const rec = JSON.parse(readFileSync(JSON_FILE, 'utf8'));
const explorer = config.networks[config.ens.network].explorer;
const when = (s) => new Date(s * 1000).toISOString().slice(0, 10);
const addr = (a) => `[\`${a}\`](${explorer}/address/${a})`;
const tx = (h) => `[${h.slice(0, 10)}…](${explorer}/tx/${h})`;
const gas = rec.txs.reduce((s, t) => s + t.gasUsed, 0);

const out = [];
out.push(`# Namespace under ${rec.root.name} (Ethereum Sepolia, chain ${config.networks[config.ens.network].chainId})`);
out.push('');
out.push(`Generated from \`${JSON_FILE}\` by \`scripts/ens/namespace-doc.mjs\`; updated ${rec.updatedAt}. Real run: ${rec.txs.length} transactions, ${gas.toLocaleString('en')} gas. Names come from the story config and addresses from \`packages/config/graphpay.config.json\`; this file records what was created.`);
out.push('');
if (rec.renamed?.length) {
  out.push('## Renamed shops');
  out.push('');
  out.push('Each new name was built like the old one (its own registry and resolvers, the same records) and points at the wallet the old name used, so no funds moved. The old names stay registered as history; nothing on chain was changed for them.');
  out.push('');
  out.push('| old name (history) | new name | wallet | registered (UTC) |');
  out.push('|---|---|---|---|');
  const holderOf = (name) => rec.owners.find((o) => o.name === name)?.holder;
  for (const r of rec.renamed) out.push(`| ${r.from} | ${r.to} | ${r.walletRole} ${holderOf(r.to) ? addr(holderOf(r.to)) : ''} | ${r.at.slice(0, 16).replace('T', ' ')} |`);
  out.push('');
}
out.push('## Hand-off table (payments policies, Join\'s mirror)');
out.push('');
out.push('Read by `node` and `epoch` (fresh ENSv2 names are epoch 0). The wallet is the token holder and the coin type 2147485522 address record. Only paying agents get an AgentPolicy; the others are held by their owner.');
out.push('');
out.push('| name | node | epoch | wallet | expiry (UTC date) |');
out.push('|---|---|---|---|---|');
for (const a of rec.agents) out.push(`| ${a.name} | \`${a.node}\` | ${a.epoch} | ${addr(a.holder)} | ${when(a.expiry)} |`);
out.push('');
out.push('## Root, owners and wildcard');
out.push('');
out.push('| name | registry | resolver |');
out.push('|---|---|---|');
out.push(`| ${rec.root.name} | ${addr(rec.root.registry)} | ${addr(rec.root.resolver)} |`);
for (const o of rec.owners) out.push(`| ${o.name} | ${addr(o.registry)} | ${addr(o.resolver)} |`);
out.push(`| ${rec.wildcard.name} (reserved wildcard) | none | ${addr(rec.wildcard.resolver)} |`);
out.push('');
out.push('## Agent resolvers and registries');
out.push('');
out.push('| name | registry holding it | resolver |');
out.push('|---|---|---|');
for (const a of rec.agents) out.push(`| ${a.name} | ${addr(a.registry)} | ${addr(a.resolver)} |`);
out.push('');
out.push('## Transactions');
out.push('');
out.push('| step | name | tx | block | gas |');
out.push('|---|---|---|---|---|');
for (const t of rec.txs) out.push(`| ${t.step} | ${t.name} | ${tx(t.hash)} | ${t.block} | ${t.gasUsed.toLocaleString('en')} |`);
out.push('');
writeFileSync(MD_FILE, `${out.join('\n')}\n`);
console.log(`wrote ${MD_FILE} (${rec.agents.length} agents, ${rec.txs.length} transactions)`);
