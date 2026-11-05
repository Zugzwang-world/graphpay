// pnpm secrets:status: every name in env.example as set or missing, never a value.

import { NAME, readEnvFile } from '../lib/env-file.mjs';
import { locateEnvFile } from '../lib/env-loader.mjs';
import { DISPOSABLE, envNames, fail, guard } from './common.mjs';

guard();

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
  let unrecognised = 0;
  for (const name of values.keys()) {
    if (names.includes(name)) continue;
    // Only plain upper-case names are printed: anything else may be a stray value.
    if (DISPOSABLE.test(name)) console.log(`set     ${name}`);
    else if (NAME.test(name)) console.log(`extra   ${name}`);
    else unrecognised += 1;
  }
  if (unrecognised > 0) console.log(`${unrecognised} unrecognised line(s) in .env (not shown; fix them by hand)`);
  console.log(`${set} of ${names.length} names set`);
} catch (error) {
  fail(error);
}
