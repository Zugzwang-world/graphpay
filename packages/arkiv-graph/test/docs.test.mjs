// What the published docs promise: the README's quickstart is the shipped example, both
// examples run as an outside developer runs them (importing the package by name), and every
// runtime export is in the README's API reference and in index.d.ts.

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import * as api from '../index.mjs';

const run = promisify(execFile);
const dir = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(dir, file), 'utf8');
const readme = read('README.md');
const pkg = JSON.parse(read('package.json'));
const named = (text, name) => new RegExp(`(^|[^\\w$])${name.replace(/\$/g, '\\$')}(?![\\w$])`).test(text);

test('the README quickstart is examples/quickstart.mjs, verbatim', () => {
  const blocks = [...readme.matchAll(/```js\n([\s\S]*?)```/g)].map((m) => m[1]);
  assert.ok(blocks.includes(read('examples/quickstart.mjs')), 'the README has no js block equal to examples/quickstart.mjs');
});

test('examples/quickstart.mjs prints the totals and the explain trace the README shows', async () => {
  const { stdout } = await run(process.execPath, [join(dir, 'examples/quickstart.mjs')], { cwd: dir, timeout: 60_000, env: { PATH: process.env.PATH } });
  assert.match(stdout, /^grace: \{ follows: 1n, likes: 2n \}\nexplain [0-9a-f]{12} - 1 read\(s\):\n {3}project = str\('quickstart'\) AND type = str\('totals'\)/);
});

test('examples/leaderboard.mjs ranks three players in one read', async () => {
  const { stdout } = await run(process.execPath, [join(dir, 'examples/leaderboard.mjs')], { cwd: dir, timeout: 60_000, env: { PATH: process.env.PATH } });
  assert.match(stdout, /^1\. ada {2}55 points in 2 win\(s\)\n2\. linus {2}40 points in 1 win\(s\)\n3\. grace {2}35 points in 2 win\(s\)\n\(1 read, explain [0-9a-f]{12}\)\n$/);
});

test('every export is in the README API reference and in index.d.ts', () => {
  const reference = readme.slice(readme.indexOf('## API reference'), readme.indexOf('\n## ', readme.indexOf('## API reference') + 1));
  const types = read('index.d.ts');
  for (const name of Object.keys(api)) {
    assert.ok(named(reference, name), `${name} is not in the README's API reference`);
    assert.ok(new RegExp(`export\\s+(declare\\s+(function|const|class)\\s+|\\{[^}]*\\b)${name}\\b`).test(types), `${name} is not declared in index.d.ts`);
  }
});

test('the changelog starts with this version', () => {
  assert.match(read('CHANGELOG.md'), new RegExp(`^# Changelog\\n\\n## ${pkg.version.replace(/\./g, '\\.')}\\b`));
});
