import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { addressFindings, checkEnvExample, run } from '../check.mjs';
import { SAMPLES } from './samples.mjs';

test('env.example must hold names only', () => {
  assert.deepEqual(checkEnvExample('# comment\n\nA_NAME=\n'), []);
  assert.equal(checkEnvExample('A_NAME=value\n')[0].label, 'env-example-not-name-only');
  assert.deepEqual(checkEnvExample(readFileSync('env.example', 'utf8')), []);
});

test('a known address is flagged in code outside the config file, nowhere else', () => {
  const addr = `0x${'ab'.repeat(20)}`;
  const known = new Set([addr]);
  assert.equal(addressFindings('packages/pay/src/a.ts', `const A = "${addr.toUpperCase().replace('0X', '0x')}";`, known).length, 1);
  assert.equal(addressFindings('apps/web/app/page.tsx', addr, known).length, 1);
  assert.equal(addressFindings('packages/contracts/test/A.t.sol', addr, known).length, 1);
  assert.equal(addressFindings('packages/config/graphpay.config.json', addr, known).length, 0);
  assert.equal(addressFindings('docs/technical/FACTS.md', addr, known).length, 0);
  assert.equal(addressFindings('packages/pay/src/a.ts', `0x${'cd'.repeat(20)}`, known).length, 0);
  // Bare and embedded forms count too (an ABI-encoded word, a hex blob).
  assert.equal(addressFindings('packages/pay/src/b.ts', `const word = "0x${'0'.repeat(24)}${addr.slice(2)}";`, known).length, 1);
  assert.equal(addressFindings('packages/pay/src/c.ts', `bare ${addr.slice(2).toUpperCase()}`, known).length, 1);
});

test('A2 negative check: a temporary key-shaped file is flagged by label, never echoed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gp-check-'));
  const file = join(dir, 'leak.txt');
  writeFileSync(file, `oops\n${SAMPLES['hex-private-key']}\n`);
  const res = spawnSync(process.execPath, ['scripts/check.mjs', '--paths', file], { encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
  assert.equal(res.status, 1);
  assert.match(res.stdout, /leak\.txt:2 hex-private-key/);
  assert.ok(!res.stdout.includes(SAMPLES['hex-private-key']));
});

test('the repository is clean', () => {
  const { findings } = run([]);
  assert.deepEqual(findings, []);
});
