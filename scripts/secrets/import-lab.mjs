// pnpm secrets:import-lab [--from <lab .env>] [--only NAME]
// Copies exactly FUNDER_PRIVATE_KEY, OPERATOR_PRIVATE_KEY, ARKIV_ACCESS_KEY and
// ANTHROPIC_API_KEY from the lab's .env (default ~/graphpay-lab/.env) into this
// repo's .env (planning/DECISIONS.md E-7). Every other name is refused, only
// names are printed (plus the public addresses of the two keys, checked against
// the config file), and a different existing value is never overwritten.

import { existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { config } from '../../packages/config/index.mjs';
import { EnvError, readEnvFile, setEnvValue } from '../lib/env-file.mjs';
import { locateEnvFile } from '../lib/env-loader.mjs';
import { addressOfKey } from '../lib/wallets.mjs';
import { fail } from './common.mjs';

export const ALLOWLIST = Object.freeze(['FUNDER_PRIVATE_KEY', 'OPERATOR_PRIVATE_KEY', 'ARKIV_ACCESS_KEY', 'ANTHROPIC_API_KEY']);

function main() {
  const args = process.argv.slice(2);
  for (const a of args) {
    if (a.startsWith('--') && a !== '--from' && a !== '--only') throw new EnvError(`refused: unknown option ${a}`);
  }
  const from = args.includes('--from') ? args[args.indexOf('--from') + 1] : join(homedir(), 'graphpay-lab', '.env');
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : undefined;
  if (only !== undefined && !ALLOWLIST.includes(only)) throw new EnvError(`${only}: refused (not on the import allowlist)`);
  const names = only ? [only] : ALLOWLIST;
  if (!from || !existsSync(from)) throw new EnvError('refused: the lab .env was not found (pass --from <path>)');
  const { path: dest } = locateEnvFile({ create: true });
  if (existsSync(dest) && realpathSync(resolve(from)) === realpathSync(dest)) throw new EnvError('refused: the source is this repo\'s own .env');

  const lab = readEnvFile(from);
  let failed = 0;
  for (const name of names) {
    const value = lab.get(name);
    if (!value) {
      console.log(`${name}: missing in the lab file`);
      failed += 1;
      continue;
    }
    try {
      const status = setEnvValue(dest, name, value);
      const role = name.endsWith('_PRIVATE_KEY') ? name.slice(0, -'_PRIVATE_KEY'.length) : null;
      if (role) {
        const address = addressOfKey(value);
        const expected = config.wallets.carried[role];
        const match = address && expected && address.toLowerCase() === expected.toLowerCase();
        console.log(`${name}: ${status} (${role} ${address ?? 'not a valid key'}${match ? ', matches the config file' : ', DOES NOT match the config file'})`);
        if (!match) failed += 1;
      } else {
        console.log(`${name}: ${status}`);
      }
    } catch (error) {
      console.log(error instanceof EnvError ? error.message : `${name}: refused (unexpected error)`);
      failed += 1;
    }
  }
  if (failed > 0) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  fail(error);
}
