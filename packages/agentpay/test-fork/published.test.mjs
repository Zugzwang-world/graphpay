// The shipped examples and the sandbox, run as an outside developer runs them: as plain scripts
// that import the package by name. Each starts its own anvil fork, deploys its own checkout
// (deployCheckout), and pays one order with one signature.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const examples = join(dirname(fileURLToPath(import.meta.url)), '..', 'examples');

for (const [file, who, micro] of [['sweets.mjs', 'agent', '4800000n'], ['cab.mjs', 'rider', '3200000n']]) {
  test(`examples/${file} pays on a sandbox with its own checkout`, async () => {
    const { stdout } = await run(process.execPath, [join(examples, file)], { timeout: 120_000 });
    assert.match(stdout, new RegExp(`${who}: paid ${micro}`));
  });
}
