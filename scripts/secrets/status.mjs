// pnpm secrets:status: every name in env.example as set or missing, never a value.

import { readEnvFile } from '../lib/env-file.mjs';
import { locateEnvFile } from '../lib/env-loader.mjs';
import { DISPOSABLE, envNames, fail } from './common.mjs';

try {
  const { path, source } = locateEnvFile();
  const values = readEnvFile(path);
  const names = envNames();
  console.log(`env file: ${source}`);
  let set = 0;
  for (const name of names) {
    const ok = Boolean(values.get(name));
    if (ok) set += 1;
    console.log(`${ok ? 'set    ' : 'missing'} ${name}`);
  }
  for (const name of values.keys()) {
    if (!names.includes(name)) console.log(`${DISPOSABLE.test(name) ? 'set    ' : 'extra  '} ${name}`);
  }
  console.log(`${set} of ${names.length} names set`);
} catch (error) {
  fail(error);
}
