import assert from 'node:assert/strict';
import { test } from 'node:test';
import { config } from '@graphpay/config';
import { addressUrl, arkivQueryUrl, blockUrl, entityUrl, shortHex, tokenUrl, txUrl, type ExplorerBases } from './explorer.ts';

const bases: ExplorerBases = {
  whitechain: config.networks.whitechain.explorer,
  sepolia: config.networks.sepolia.explorer,
  rabdi: config.networks.rabdi.explorer,
};
const hash = `0x${'ab'.repeat(32)}`;
const address = `0x${'12'.repeat(20)}`;

test('every transaction links to its own network explorer', () => {
  assert.equal(txUrl(bases, 'whitechain', hash), `${bases.whitechain}/tx/${hash}`);
  assert.equal(txUrl(bases, 'sepolia', hash), `${bases.sepolia}/tx/${hash}`);
  assert.equal(txUrl(bases, 'rabdi', hash), `${bases.rabdi}/tx/${hash}`);
});

test('a transaction hash is linked in lower case', () => {
  assert.equal(txUrl(bases, 'whitechain', hash.toUpperCase().replace('0X', '0x')), `${bases.whitechain}/tx/${hash}`);
});

test('addresses, tokens, blocks and Arkiv entities get their explorer pages', () => {
  assert.equal(addressUrl(bases, 'whitechain', address), `${bases.whitechain}/address/${address}`);
  assert.equal(addressUrl(bases, 'sepolia', address), `${bases.sepolia}/address/${address}`);
  assert.equal(tokenUrl(bases, address), `${bases.whitechain}/token/${address}`);
  assert.equal(blockUrl(bases, 'whitechain', 123n), `${bases.whitechain}/block/123`);
  assert.equal(blockUrl(bases, 'sepolia', '9876543'), `${bases.sepolia}/block/9876543`);
  assert.equal(blockUrl(bases, 'rabdi', 5), `${bases.rabdi}/blocks`);
  assert.equal(entityUrl(bases, hash), `${bases.rabdi}/entity/${hash}`);
});

test('anything that is not a hash, address, key or block number gets no link', () => {
  for (const bad of ['', '0x', '0x1234', `${hash}00`, `0x${'zz'.repeat(32)}`, `javascript:alert(1)`, `${hash}/../x`, null, undefined, 42]) {
    assert.equal(txUrl(bases, 'whitechain', bad), null, String(bad));
    assert.equal(entityUrl(bases, bad), null, String(bad));
  }
  for (const bad of ['', '0x12', `${address}0`, `0x${'gg'.repeat(20)}`, `${address}?x=1`]) {
    assert.equal(addressUrl(bases, 'whitechain', bad), null, bad);
    assert.equal(tokenUrl(bases, bad), null, bad);
  }
  for (const bad of ['-1', '1.5', '0x10', '', 'abc', -1, 1.5]) assert.equal(blockUrl(bases, 'whitechain', bad), null, String(bad));
});

test('an Arkiv query link encodes the query and refuses an empty one', () => {
  const query = '$owner = 0x12 && type = "shop"';
  assert.equal(arkivQueryUrl(bases, query), `${bases.rabdi}/entity-explorer?q=${encodeURIComponent(query)}`);
  assert.equal(arkivQueryUrl(bases, '   '), null);
});

test('a trailing slash on a base URL does not double up', () => {
  assert.equal(txUrl({ ...bases, whitechain: `${bases.whitechain}/` }, 'whitechain', hash), `${bases.whitechain}/tx/${hash}`);
});

test('short hex keeps the head and the tail', () => {
  assert.equal(shortHex(hash), `0xabab…abab`);
  assert.equal(shortHex('0x1234'), '0x1234');
});
