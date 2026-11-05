// The "about 20 lines" claim, counted from this app's real files (the lines between the
// graphpay markers, blank lines and comments left out).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const FILES = ['lib/store.ts', 'app/api/catalog/route.ts', 'app/api/order/route.ts', 'components/buy.tsx'];

function linesOf(source) {
  const lines = [];
  let inside = false;
  for (const raw of source.split('\n')) {
    if (/graphpay:begin/.test(raw)) inside = true;
    else if (/graphpay:end/.test(raw)) inside = false;
    else if (inside && raw.trim() !== '' && !raw.trim().startsWith('//')) lines.push(raw);
  }
  return lines;
}

test('the whole kit integration is 20 lines or fewer, in four files', () => {
  const counts = Object.fromEntries(FILES.map((f) => [f, linesOf(readFileSync(root + f, 'utf8')).length]));
  for (const [file, n] of Object.entries(counts)) assert.ok(n > 0, `${file} has no integration lines`);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.ok(total <= 20, `${total} lines: ${JSON.stringify(counts)}`);
});

test('the README of the kit shows the same integration: the import, the config and the three mounts', () => {
  const readme = readFileSync(root + '../../packages/checkout-kit/README.md', 'utf8');
  for (const needle of ['createGraphPayShop({', 'export const GET = shop.catalog;', 'export const GET = shop.order;', '<GraphPayButton']) assert.ok(readme.includes(needle), needle);
});
