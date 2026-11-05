import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { addressFindings, checkEnvExample, run, storyFindings, storyLiterals } from '../check.mjs';
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

test('story names and values are flagged in code outside the story file, nowhere else', () => {
  const shop = ['kesar', 'kingdom'].join('-'); // built at run time: this file is code too
  const literals = [shop, ['Kesar', 'Kingdom'].join(' ')];
  assert.equal(storyFindings('packages/agents/src/a.ts', `const best = "${shop}";`, literals).length, 1);
  assert.equal(storyFindings('apps/web/app/page.tsx', `<h1>${literals[1]}</h1>`, literals).length, 1);
  assert.equal(storyFindings('packages/config/story.json', `"${shop}"`, literals).length, 0);
  assert.equal(storyFindings('docs/plan/MASTER_PLAN.md', shop, literals).length, 0);
  assert.equal(storyFindings('scripts/x.mjs', 'process.env.SHOP_KESAR_PRIVATE_KEY', literals).length, 0);
  assert.equal(storyFindings('scripts/x.mjs', `${shop}s-and-more`, literals).length, 0);
  assert.ok(storyLiterals(process.cwd()).length > 5);
});
