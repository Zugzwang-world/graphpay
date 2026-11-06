import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFlags } from '../ops/payer-topup.mjs';

test('the payer top-up takes one source, a capped target and both real flags, and refuses the rest without echoing a value', () => {
  assert.deepEqual(parseFlags(['--from', 'shop']), { from: 'shop', target: '125', execute: false, real: false });
  assert.deepEqual(parseFlags(['--from', 'funder', '--target', '150', '--execute', '--real']), { from: 'funder', target: '150', execute: true, real: true });
  const refused = [
    [],
    ['--from', 'bank'],
    ['--from', 'shop', '--from', 'funder'],
    ['--from', 'shop', '--target', '201'],
    ['--from', 'shop', '--target', '0'],
    ['--from', 'shop', '--target', '12.1234567'],
    ['--from', 'shop', '--execute'],
    ['--from', 'shop', '--real'],
    ['--from', 'shop', 'stray'],
    ['--from=shop'],
    ['--from'],
  ];
  for (const argv of refused) assert.throws(() => parseFlags(argv), undefined, JSON.stringify(argv));
  const pasted = `0x${'ab'.repeat(32)}`;
  for (const argv of [['--from', 'shop', '--target', pasted], ['--from', 'shop', pasted]]) {
    assert.throws(() => parseFlags(argv), (e) => !String(e.message).includes(pasted), 'a pasted value is never echoed');
  }
});
