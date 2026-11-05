// <command> | pnpm secrets:stdin NAME [--overwrite]
// Stores another tool's output in .env without echoing it; prints the name and a status only.

import { EnvError, setEnvValue } from '../lib/env-file.mjs';
import { locateEnvFile } from '../lib/env-loader.mjs';
import { assertSettable, fail, validateValue } from './common.mjs';

async function main() {
  const args = process.argv.slice(2);
  const name = args.find((a) => !a.startsWith('--'));
  if (!name) throw new EnvError('usage: <command> | pnpm secrets:stdin NAME [--overwrite]');
  assertSettable(name);
  if (process.stdin.isTTY) throw new EnvError(`${name}: refused (pipe the value in; to type it use pnpm secrets:set ${name})`);
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const value = Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
  await validateValue(name, value);
  const { path } = locateEnvFile({ create: true });
  console.log(`${name}: ${setEnvValue(path, name, value, { overwrite: args.includes('--overwrite') })}`);
}

main().catch(fail);
