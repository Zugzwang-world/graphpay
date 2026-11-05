// pnpm secrets:gen NAME [--bytes 32] [--rotate]
// A random base64url secret (at least 24 characters) straight into .env, for
// DEMO_PASSCODE, FACILITATOR_AUTH_TOKEN, RECORDER_TOKEN and CRON_SECRET. An
// existing value is kept unless --rotate. Prints the name and a status only.

import { randomBytes } from 'node:crypto';
import { EnvError, readEnvFile, setEnvValue } from '../lib/env-file.mjs';
import { locateEnvFile } from '../lib/env-loader.mjs';
import { fail, isKnownName } from './common.mjs';

function main() {
  const args = process.argv.slice(2);
  const name = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--bytes');
  const bytesAt = args.indexOf('--bytes');
  const bytes = bytesAt === -1 ? 32 : Number(args[bytesAt + 1]);
  if (!name) throw new EnvError('usage: pnpm secrets:gen NAME [--bytes 32] [--rotate]');
  if (!isKnownName(name) || !/_(?:TOKEN|SECRET|PASSCODE)$/.test(name)) {
    throw new EnvError(`${name}: refused (only generated secrets: *_TOKEN, *_SECRET, *_PASSCODE in env.example)`);
  }
  if (!Number.isInteger(bytes) || bytes < 18 || bytes > 64) throw new EnvError(`${name}: refused (--bytes must be 18 to 64)`);
  const { path } = locateEnvFile({ create: true });
  const rotate = args.includes('--rotate');
  if (readEnvFile(path).get(name) && !rotate) {
    console.log(`${name}: already set (kept; use --rotate to replace it)`);
    return;
  }
  const value = randomBytes(bytes).toString('base64url');
  console.log(`${name}: ${setEnvValue(path, name, value, { overwrite: rotate })} (${value.length} characters)`);
}

try {
  main();
} catch (error) {
  fail(error);
}
