// pnpm secrets:set NAME [--overwrite]
// Asks for a value in a real terminal with keystrokes hidden, checks it (an RPC
// URL must answer the right chain id), writes .env and prints the name and a
// status only. For values copied from a web console or a provider dashboard.

import { EnvError, safeName, setEnvValue } from '../lib/env-file.mjs';
import { locateEnvFile } from '../lib/env-loader.mjs';
import { assertSettable, fail, guard, validateValue } from './common.mjs';

guard();

const ESC = '\u001b';

// Raw-mode reader: escape sequences (bracketed-paste markers, arrow keys) are
// dropped, a paste with more than one line is refused, and input still arriving
// after Enter is drained before raw mode ends so the shell never reads it.
function readHidden(label) {
  return new Promise((resolve, reject) => {
    const { stdin, stderr } = process;
    let value = '';
    let escape = null; // null, 'start' (after ESC) or 'csi' (inside ESC [ ...)
    let done = null;
    const finish = (error) => {
      if (done) return;
      done = error ?? true;
      setTimeout(() => {
        stdin.removeListener('data', onData);
        stdin.setRawMode(false);
        stdin.pause();
        stderr.write('\n');
        if (done !== true) reject(done);
        else resolve(value.trim());
      }, 150);
    };
    const onData = (chunk) => {
      if (done) return; // draining
      for (let i = 0; i < chunk.length; i += 1) {
        const ch = chunk[i];
        if (escape === 'start') {
          escape = ch === '[' ? 'csi' : null;
          continue;
        }
        if (escape === 'csi') {
          if (ch >= '@' && ch <= '~') escape = null;
          continue;
        }
        if (ch === ESC) {
          escape = 'start';
          continue;
        }
        if (ch === '\u0003') return finish(new EnvError(`${label}: cancelled`));
        if (ch === '\r' || ch === '\n' || ch === '\u0004') {
          const rest = chunk.slice(i + 1).replace(/\u001b\[[0-9;]*[@-~]/g, '');
          if (rest.trim() !== '') return finish(new EnvError(`${label}: refused (the paste had more than one line)`));
          return finish();
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else if (ch >= ' ' && ch <= '~') value += ch;
        else return finish(new EnvError(`${label}: refused (only printable ASCII can be stored)`));
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
    throw new EnvError(`${safeName(name)}: refused (needs a real terminal; to pipe a value use: <command> | pnpm secrets:stdin ${safeName(name)})`);
  }
  const value = await readHidden(name);
  await validateValue(name, value);
  const { path } = locateEnvFile({ create: true });
  console.log(`${name}: ${setEnvValue(path, name, value, { overwrite })}`);
}

main().catch(fail);
