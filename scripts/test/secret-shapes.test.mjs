import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { english } from 'viem/accounts';
import { findSecrets, maskSecrets } from '../lib/secret-shapes.mjs';
import { hex, SAMPLES, twelveWords } from './samples.mjs';

const labels = (text, options) => findSecrets(text, options).map((f) => f.label);

for (const [label, sample] of Object.entries(SAMPLES)) {
  test(`flags ${label}`, () => {
    assert.ok(labels(`value: ${sample} end`).includes(label));
  });
}

test('the hex key rule accepts every key-word form and up to 16 spaces', () => {
  const key = hex(64, 'd');
  const forms = ['private key', 'priv key', 'secret key', 'signer key', 'private_key', 'private-key', 'privatekey', 'PRIVATE_KEY', 'privateKey'];
  for (const form of forms) {
    assert.ok(labels(`${form} = "0x${key}"`).includes('hex-private-key'), form);
    assert.ok(labels(`${form}:${' '.repeat(16)}${key}`).includes('hex-private-key'), `${form} with 16 spaces`);
  }
  assert.ok(labels(`"privateKey": "0x${key}"`).includes('hex-private-key'));
});

test('placeholders and public URLs pass', () => {
  const ok = [
    'https://rpc.rabdi.db-chain.testnet.arkiv.network/${ARKIV_ACCESS_KEY}',
    'https://rpc.rabdi.db-chain.testnet.arkiv.network/<key>',
    'postgres://user:[YOUR-PASSWORD]@db.example.com/app',
    'https://rpc.ankr.com/whitechain_testnet',
    'https://rpc.ankr.com/whitechain_testnet/<key>',
    'https://rpc.testnet.whitechain.io',
    'FUNDER_PRIVATE_KEY=',
  ];
  for (const text of ok) assert.deepEqual(labels(text), [], text);
});

test('a public transaction hash passes the repository scan but is masked in prompt logs', () => {
  const tx = `0x${hex(64, 'e')}`;
  assert.deepEqual(labels(`settled in ${tx}`), []);
  assert.ok(labels(`settled in ${tx}`, { promptLog: true }).includes('hex-64-possible-key'));
});

test('recovery phrases are caught in quotes, as lists and in comma form', async () => {
  const words = await twelveWords();
  const cases = [
    `Secret Recovery Phrase: "${words.join(' ')}"`,
    `seed words:\n${words.map((w, i) => `${i + 1}. ${w}`).join('\n')}`,
    `my mnemonic is ${words.join(', ')}`,
    `recovery phrase\n- ${words.join('\n- ')}`,
    `seed phrase ['${words.join("', '")}']`,
  ];
  for (const text of cases) assert.ok(labels(text).includes('recovery-phrase'), text.slice(0, 40));
});

test('ordinary prose after a key word is not a phrase, and eleven words are not enough', async () => {
  const words = await twelveWords();
  assert.deepEqual(labels('Write down your Secret Recovery Phrase and keep it somewhere safe, never online.'), []);
  assert.deepEqual(labels(`seed phrase: "${words.slice(0, 11).join(' ')}"`), []);
});

test('the pack passes, including the must-pass prose in SECURITY_AND_OPS and SPONSOR_CHECKLIST', () => {
  for (const file of ['planning/SPEC/SECURITY_AND_OPS.md', 'planning/SPONSOR_CHECKLIST.md', 'planning/FACTS.md']) {
    assert.deepEqual(labels(readFileSync(file, 'utf8')), [], file);
  }
});

test('masking replaces every finding and keeps the rest', () => {
  const out = maskSecrets(`a ${SAMPLES['github-token']} b ${SAMPLES['anthropic-api-key']} c`);
  assert.equal(out, 'a <masked:github-token> b <masked:anthropic-api-key> c');
});

test('the committed BIP-39 wordlist equals the standard list', () => {
  const ours = readFileSync('scripts/lib/bip39-english.txt', 'utf8').split('\n').filter(Boolean);
  assert.equal(ours.length, 2048);
  assert.deepEqual(ours, [...english]);
});

test('a Kimi key is caught, including an admin key, and an Anthropic key keeps its own label', () => {
  assert.deepEqual(labels(`key ${['sk', 'admin', 'A'.repeat(40)].join('-')} end`), ['kimi-api-key']);
  assert.deepEqual(labels(`key ${SAMPLES['anthropic-api-key']} end`), ['anthropic-api-key']);
  assert.deepEqual(labels('the prefix sk- alone or sk-short is fine'), []);
});
