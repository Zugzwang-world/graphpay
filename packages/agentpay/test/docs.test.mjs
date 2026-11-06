// What the published docs promise: the README's quickstart is the shipped example, every
// runtime export is in the README's API reference and in the type declarations, and the
// changelog and the MCP server report this version. (The examples themselves run on an anvil
// fork in test-fork/examples.test.mjs.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as api from '../index.mjs';
import * as sandbox from '../sandbox.mjs';
import { createAgentPayMcpServer } from '../index.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(dir, file), 'utf8');
const readme = read('README.md');
const pkg = JSON.parse(read('package.json'));
const named = (text, name) => new RegExp(`(^|[^\\w$])${name.replace(/\$/g, '\\$')}(?![\\w$])`).test(text);
const declared = (types, name) => new RegExp(`export\\s+(declare\\s+(function|const|class)\\s+|\\{[^}]*\\b)${name}\\b`).test(types);

test('the README quickstart is examples/sweets.mjs, verbatim', () => {
  const blocks = [...readme.matchAll(/```js\n([\s\S]*?)```/g)].map((m) => m[1]);
  assert.ok(blocks.includes(read('examples/sweets.mjs')), 'the README has no js block equal to examples/sweets.mjs');
});

test('every export is in the README API reference and in the type declarations', () => {
  const start = readme.indexOf('## API reference');
  const reference = readme.slice(start, readme.indexOf('\n## ', start + 1));
  for (const [file, mod] of [['index.d.ts', api], ['sandbox.d.ts', sandbox]]) {
    const types = read(file);
    for (const name of Object.keys(mod)) {
      assert.ok(named(reference, name), `${name} is not in the README's API reference`);
      assert.ok(declared(types, name), `${name} is not declared in ${file}`);
    }
  }
});

test('the changelog starts with this version, and the MCP server reports it', () => {
  assert.match(read('CHANGELOG.md'), new RegExp(`^# Changelog\\n\\n## ${pkg.version.replace(/\./g, '\\.')} `));
  const server = createAgentPayMcpServer({});
  assert.equal(server.server._serverInfo.version, pkg.version);
});
