// pnpm secrets:import-lab [--from <lab .env>] [--only NAME]
// Copies exactly FUNDER_PRIVATE_KEY, OPERATOR_PRIVATE_KEY, ARKIV_ACCESS_KEY and
// ANTHROPIC_API_KEY from the lab's .env (default ~/graphpay-lab/.env) into this
// repo's .env (planning/DECISIONS.md E-7). Every other name is refused, only
// names are printed (plus the public addresses of the two keys), a key whose
// address is not the carried-over one is refused before anything is written,
// and a different existing value is never overwritten.

import { existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { config } from '../../packages/config/index.mjs';
import { EnvError, readEnvFile, safeName, setEnvValue } from '../lib/env-file.mjs';
import { locateEnvFile } from '../lib/env-loader.mjs';
import { addressOfKey } from '../lib/wallets.mjs';
import { fail, guard, validateValue } from './common.mjs';

guard();

export const ALLOWLIST = Object.freeze(['FUNDER_PRIVATE_KEY', 'OPERATOR_PRIVATE_KEY', 'ARKIV_ACCESS_KEY', 'ANTHROPIC_API_KEY']);

// Checks a value before it is written; returns the note printed after the status.
async function check(name, value) {
  if (!name.endsWith('_PRIVATE_KEY')) {
    await validateValue(name, value);
    return '';
  }
  const role = name.slice(0, -'_PRIVATE_KEY'.length);
  const address = addressOfKey(value);
  if (!address) throw new EnvError(`${name}: refused (not a valid private key)`);
  if (address.toLowerCase() !== config.wallets.carried[role].toLowerCase()) {
    throw new EnvError(`${name}: refused (its address ${address} is not the carried-over ${role} ${config.wallets.carried[role]})`);
  }
  return ` (${role} ${address}, matches the config file)`;
}

async function main() {
  const args = process.argv.slice(2);
  for (const a of args) {
    if (a.startsWith('--') && a !== '--from' && a !== '--only') {
      throw new EnvError(`refused: unknown option ${/^--[a-z-]+$/.test(a) ? a : ''}`.trimEnd());
    }
  }
  const from = args.includes('--from') ? args[args.indexOf('--from') + 1] : join(homedir(), 'graphpay-lab', '.env');
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : undefined;
  if (only !== undefined && !ALLOWLIST.includes(only)) throw new EnvError(`${safeName(only)}: refused (not on the import allowlist)`);
  const names = only ? [only] : ALLOWLIST;
  if (!from || !existsSync(from)) throw new EnvError('refused: the lab .env was not found (pass --from <path>)');
  const { path: dest } = locateEnvFile({ create: true });
  if (existsSync(dest) && realpathSync(resolve(from)) === realpathSync(dest)) throw new EnvError("refused: the source is this repo's own .env");

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
      const note = await check(name, value);
      console.log(`${name}: ${setEnvValue(dest, name, value)}${note}`);
    } catch (error) {
      console.log(error instanceof EnvError ? error.message : `${name}: refused (unexpected error)`);
      failed += 1;
    }
  }
  if (failed > 0) process.exitCode = 1;
}

main().catch(fail);
