// pnpm wallet:gen --only ROLE
// One fresh key for one role per run (a generator that filled every missing
// role at once minted clashing keys twice in the lab). The key is made in this
// process and written straight into .env through the setter's write path; only
// the role and its public address are printed. FUNDER and OPERATOR are imported,
// never generated.

import { generatePrivateKey } from 'viem/accounts';
import { EnvError, readEnvFile, setEnvValue } from '../lib/env-file.mjs';
import { locateEnvFile } from '../lib/env-loader.mjs';
import { addressOfKey, CARRIED, DISPOSABLE_ROLE, FRESH, labAddresses, roleAddresses } from '../lib/wallets.mjs';
import { fail } from './common.mjs';

function main() {
  const args = process.argv.slice(2);
  const at = args.indexOf('--only');
  const role = at === -1 ? undefined : args[at + 1];
  if (!role || args.length !== 2) throw new EnvError('usage: pnpm wallet:gen --only ROLE (one role per run)');
  if (CARRIED.includes(role)) throw new EnvError(`${role}: refused (imported from the lab with secrets:import-lab, never generated)`);
  if (!FRESH.includes(role) && !DISPOSABLE_ROLE.test(role)) throw new EnvError(`${role}: refused (not a fresh role in the config file)`);
  const name = `${role}_PRIVATE_KEY`;
  const { path } = locateEnvFile({ create: true });
  const values = readEnvFile(path);
  if (values.get(name)) {
    console.log(`${role}: already set, not regenerated (${addressOfKey(values.get(name)) ?? 'not a valid key'})`);
    return;
  }
  const key = generatePrivateKey();
  const address = addressOfKey(key);
  const taken = new Set(Object.values(roleAddresses(values)).filter(Boolean).map((a) => a.toLowerCase()));
  if (labAddresses().has(address.toLowerCase()) || taken.has(address.toLowerCase())) {
    throw new EnvError(`${role}: refused (the new address clashes with a lab or role wallet; run again)`);
  }
  setEnvValue(path, name, key);
  console.log(`${role} ${address}`);
}

try {
  main();
} catch (error) {
  fail(error);
}
