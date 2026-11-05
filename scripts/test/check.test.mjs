import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { addressFindings, checkEnvExample, run, storyFindings, storyLiterals, storyVariants } from '../check.mjs';
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
  assert.equal(addressFindings('apps/web/app/explorer/page.mdx', addr, known).length, 1);
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

// Story words for the tests below, built at run time so this file never holds one.
const glue = (...parts) => parts.join('');
const cap = (w) => w[0].toUpperCase() + w.slice(1);
const SHOP_WORDS = [glue('kes', 'ar'), glue('king', 'dom')];
const PERSONA = glue('vita', 'lik');

test('story literals match in any case and in kebab, snake, spaced and camelCase spellings', () => {
  const [a, b] = SHOP_WORDS;
  const literals = [SHOP_WORDS.join('-')];
  const count = (text) => storyFindings('packages/agents/src/a.ts', text, literals).length;
  assert.deepEqual(storyVariants(literals[0]), [`${a}-${b}`, `${a}_${b}`, `${a} ${b}`, `${a}${cap(b)}`]);
  assert.deepEqual(storyVariants(PERSONA), [PERSONA]);
  const spellings = [
    `${a}-${b}`,
    `${a}_${b}`,
    `${a} ${b}`,
    `${a}${cap(b)}`,
    `${cap(a)} ${cap(b)}`,
    `${cap(a)}${cap(b)}`,
    `${a.toUpperCase()} ${b}`,
    `${cap(a)}-${b.toUpperCase()}`,
    `${a}\n      ${b}`, // wrapped across lines, as JSX or MDX text can be
  ];
  for (const spelling of spellings) assert.equal(count(`const shop = "${spelling}";`), 1, spelling);
  // Inside longer names: across a camelCase hump, '-' or '_', never into a word.
  assert.equal(count(`const best${cap(a)}${cap(b)}Shop = 1;`), 1);
  assert.equal(count(`class="${a}-${b}-card"`), 1);
  assert.equal(count(`${a}_${b}_price`), 1);
  assert.equal(count(`${a}-${b}s and ${a}${b}er and x${a}${b}`), 0);
  // Entirely upper case is an env or wallet role name.
  assert.equal(count(`${a.toUpperCase()}_${b.toUpperCase()}_PRIVATE_KEY, ${a.toUpperCase()} ${b.toUpperCase()}`), 0);
});

test('the persona name is flagged in any case but all capitals; env and role names pass', () => {
  const literals = [PERSONA, cap(PERSONA)];
  const count = (text) => storyFindings('scripts/x.mjs', text, literals).length;
  assert.equal(count(`const name = 'payer.${PERSONA}.graphpay.eth';`), 1);
  assert.equal(count(`// ${cap(PERSONA)} pays`), 1);
  assert.equal(count(`const ${PERSONA}Wallet = 1;`), 1);
  assert.equal(count(`process.env.${PERSONA.toUpperCase()}_PRIVATE_KEY; role: '${PERSONA.toUpperCase()}'`), 0);
  assert.equal(count('process.env.SHOP_KESAR_PRIVATE_KEY'), 0);
  assert.equal(count(`${PERSONA}ish`), 0);
});

test('the story rule scans .mdx, .html and .graphql under the code paths; the story file and docs stay exempt', () => {
  const literals = [SHOP_WORDS.join('-')];
  const text = `<p>${SHOP_WORDS.map(cap).join(' ')}</p>`;
  const flagged = [
    'apps/web/app/about/page.mdx',
    'apps/web/public/index.html',
    'packages/graph/schema.graphql',
    'packages/graph/queries/shop.gql',
    'apps/web/app/page.tsx',
    'packages/config/graphpay.config.json',
  ];
  for (const path of flagged) assert.equal(storyFindings(path, text, literals).length, 1, path);
  const exempt = ['packages/config/story.json', 'docs/plan/MASTER_PLAN.md', 'docs/site/page.mdx', 'README.md', 'packages/graph/README.md', 'planning/SPEC/AGENTS.md', 'apps/web/node_modules/x/index.js'];
  for (const path of exempt) assert.equal(storyFindings(path, text, literals).length, 0, path);
});

test('the real story literals are found in their spellings, the request text even when wrapped, once per place', () => {
  const literals = storyLiterals(process.cwd());
  const story = JSON.parse(readFileSync('packages/config/story.json', 'utf8'));
  // The request holds the item name too: one finding, not two.
  const wrapped = story.order.request.replace(/ /g, '\n    ');
  assert.equal(storyFindings('apps/web/app/page.tsx', `<p>\n    ${wrapped}\n</p>`, literals).length, 1);
  for (const shop of story.shops) {
    const camel = shop.label.split('-').map((w, i) => (i === 0 ? w : cap(w))).join('');
    assert.equal(storyFindings('packages/agents/src/a.ts', `const ${camel}Price = 1;`, literals).length, 1, shop.storyRole);
    for (const product of shop.products) {
      assert.equal(storyFindings('packages/shop/src/c.ts', `sku: '${product.sku}'`, literals).length, 1, shop.storyRole);
    }
  }
});

test('pnpm check reports a story literal in a new file type by path, line and label only', () => {
  const root = mkdtempSync(join(tmpdir(), 'gp-story-'));
  mkdirSync(join(root, 'packages/config'), { recursive: true });
  mkdirSync(join(root, 'apps/web/app'), { recursive: true });
  const shop = { key: 'a', label: SHOP_WORDS.join('-'), displayName: SHOP_WORDS.map(cap).join(' '), products: [] };
  writeFileSync(join(root, 'packages/config/story.json'), JSON.stringify({ persona: { label: PERSONA }, shops: [shop] }));
  writeFileSync(join(root, 'apps/web/app/page.mdx'), `# Welcome\n\nOrder from ${SHOP_WORDS.map(cap).join('')} today.\n`);
  writeFileSync(join(root, 'apps/web/app/env.ts'), `export const role = '${PERSONA.toUpperCase()}';\n`);
  const { findings } = run(['--paths', 'apps/web/app/page.mdx', 'apps/web/app/env.ts', 'packages/config/story.json'], root);
  rmSync(root, { recursive: true, force: true });
  assert.deepEqual(findings, [{ path: 'apps/web/app/page.mdx', line: 3, label: 'story-literal-outside-story-config' }]);
});
