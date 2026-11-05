// pnpm wallets:addresses [--markdown]
// Derives every role's public address from .env and checks ACCEPTANCE_TESTS A5:
// FUNDER and OPERATOR equal the carried-over addresses; no other role is a lab
// wallet (planning/WALLETS.md §5); no two roles share an address. Exit 1 on a failure.

import { config } from '../../packages/config/index.mjs';
import { loadEnv } from '../lib/env-loader.mjs';
import { CARRIED, FRESH, labAddresses, roleAddresses } from '../lib/wallets.mjs';
import { fail, guard } from '../secrets/common.mjs';

guard();

try {
  const { values } = loadEnv();
  const addresses = roleAddresses(values);
  const lab = labAddresses();
  const problems = [];
  const seen = new Map();
  const roles = [...CARRIED, ...FRESH, ...Object.keys(addresses).filter((r) => !CARRIED.includes(r) && !FRESH.includes(r)).sort()];
  const rows = [];
  for (const role of roles) {
    const address = addresses[role];
    let note = '';
    if (!address) {
      note = role in addresses ? 'invalid key' : 'missing';
      problems.push(`${role} is ${note}`);
    } else if (CARRIED.includes(role)) {
      note = address.toLowerCase() === config.wallets.carried[role].toLowerCase() ? 'carried over (matches)' : 'carried over: MISMATCH';
      if (note.includes('MISMATCH')) problems.push(`${role} does not match the carried-over address`);
    } else {
      note = lab.has(address.toLowerCase()) ? 'LAB WALLET' : 'fresh';
      if (note === 'LAB WALLET') problems.push(`${role} is a lab wallet`);
    }
    if (address) {
      const other = seen.get(address.toLowerCase());
      if (other) problems.push(`${role} shares an address with ${other}`);
      seen.set(address.toLowerCase(), role);
    }
    rows.push({ role, address: address ?? '—', note });
  }
  if (process.argv.includes('--markdown')) {
    console.log('| role | address | source |');
    console.log('|---|---|---|');
    for (const r of rows) console.log(`| ${r.role} | \`${r.address}\` | ${r.note} |`);
  } else {
    for (const r of rows) console.log(`${r.role.padEnd(18)} ${r.address.padEnd(42)} ${r.note}`);
  }
  if (problems.length > 0) {
    for (const p of problems) console.log(`A5 FAIL: ${p}`);
    process.exitCode = 1;
  } else {
    console.log(`A5: ok (${Object.values(addresses).filter(Boolean).length} role addresses, none a lab wallet, no duplicates)`);
  }
} catch (error) {
  fail(error);
}
