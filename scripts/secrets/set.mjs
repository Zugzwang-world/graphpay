// pnpm secrets:set NAME [--overwrite]
// Asks for a value in a real terminal with keystrokes hidden, checks it (an RPC
// URL must answer the right chain id), writes .env and prints the name and a
// status only. For values copied from a web console or a provider dashboard.

import { EnvError, setEnvValue } from '../lib/env-file.mjs';
import { locateEnvFile } from '../lib/env-loader.mjs';
import { assertSettable, fail, validateValue } from './common.mjs';

function readHidden(label) {
  return new Promise((resolve, reject) => {
    const { stdin, stderr } = process;
    let value = '';
    const finish = (error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      stderr.write('\n');
      if (error) reject(error);
      else resolve(value.trim());
    };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n' || ch === '\u0004') return finish();
        if (ch === '\u0003') return finish(new EnvError(`${label}: cancelled`));
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else if (ch >= ' ') value += ch;
      }
    };
    stderr.write(`${label} (input hidden; paste, then press Enter): `);
    stdin.setEncoding('utf8');
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const name = args.find((a) => !a.startsWith('--'));
  const overwrite = args.includes('--overwrite');
  if (!name) throw new EnvError('usage: pnpm secrets:set NAME [--overwrite]');
  assertSettable(name);
  if (!process.stdin.isTTY) {
    throw new EnvError(`${name}: refused (needs a real terminal; to pipe a value use: <command> | pnpm secrets:stdin ${name})`);
  }
  const value = await readHidden(name);
  await validateValue(name, value);
  const { path } = locateEnvFile({ create: true });
  console.log(`${name}: ${setEnvValue(path, name, value, { overwrite })}`);
}

main().catch(fail);
