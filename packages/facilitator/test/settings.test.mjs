// Settings from the environment: the config file is the source of every address and of the token's
// EIP-712 domain; a repeated env value must equal it; limits parse strictly; secrets are checked
// for length and never appear in an error.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEther } from 'viem';
import { config, story } from '@graphpay/config';
import { chainSettings, configMerchants, facilitatorSettings, shopSettings } from '../src/settings.mjs';
import { DEFAULT_LIMITS } from '../src/pipeline.mjs';
import { StartupError } from '../src/startup.mjs';

const checkout = config.whitechain.contracts.checkout;
const token = config.whitechain.tokens[checkout.token];
const merchant = `0x${'12'.repeat(20)}`;
const SECRET = 's'.repeat(32);
const base = { ALLOWED_MERCHANTS: merchant, FACILITATOR_AUTH_TOKEN: SECRET };
const shopKeys = story.shops.map((s) => s.key);

test('the chain settings come from the config, and repeated env values must equal it', () => {
  const s = chainSettings({});
  assert.equal(s.chainId, config.networks.whitechain.chainId);
  assert.equal(s.checkout.toLowerCase(), checkout.address.toLowerCase());
  assert.equal(s.token.address.toLowerCase(), token.address.toLowerCase());
  assert.deepEqual(s.token.eip712, token.eip712);
  assert.doesNotThrow(() => chainSettings({ GRAPHPAY_CONTRACT: checkout.address.toLowerCase(), GRAPHPAY_TOKEN_NAME: token.eip712.name, GRAPHPAY_ROOT_ENS: config.root.ens, ENS_ALLOWED_ROOTS: config.root.ens }));
  for (const env of [
    { GRAPHPAY_CONTRACT: `0x${'1'.repeat(40)}` },
    { GRAPHPAY_TOKEN: config.whitechain.tokens.neverUse[0] },
    { GRAPHPAY_TOKEN_NAME: 'USDT' },
    { GRAPHPAY_TOKEN_VERSION: '2' },
    { GRAPHPAY_ROOT_ENS: 'evil.eth' },
    { ENS_ALLOWED_ROOTS: `${config.root.ens},evil.eth` },
  ]) {
    assert.throws(() => chainSettings(env), StartupError, JSON.stringify(Object.keys(env)));
  }
});

test('facilitator settings: defaults, strict limits, the allow-list, the bearer and the recorder', () => {
  const s = facilitatorSettings(base);
  assert.deepEqual(s.allowedMerchants.map((a) => a.toLowerCase()), [merchant]);
  assert.equal(s.limits.maxSettleGas, DEFAULT_LIMITS.maxSettleGas);
  assert.equal(s.limits.minRelayerBalanceWei, DEFAULT_LIMITS.minRelayerBalanceWei);
  assert.equal(s.recorder, null);
  const tuned = facilitatorSettings({ ...base, GAS_BUDGET_DAILY_WBT: '0.1', MIN_RELAYER_BALANCE_WBT: '0.3', RECORDED_FAILURES_PER_DAY: '0', ATTEMPTS_URL: 'https://site.example/api/recorder/attempts', RECORDER_TOKEN: SECRET });
  assert.equal(tuned.limits.gasBudgetDailyWei, parseEther('0.1'));
  assert.equal(tuned.limits.recordedFailuresPerDay, 0);
  assert.equal(tuned.recorder.url, 'https://site.example/api/recorder/attempts');
  for (const env of [
    {},
    { ...base, ALLOWED_MERCHANTS: '[]' },
    { ...base, ALLOWED_MERCHANTS: 'not-an-address' },
    { ...base, ALLOWED_MERCHANTS: `0x${'0'.repeat(40)}` },
    { ...base, FACILITATOR_AUTH_TOKEN: 'short' },
    { ...base, MAX_SETTLE_GAS: '300000' },
    { ...base, MAX_SETTLE_GAS: '4.5e5' },
    { ...base, GAS_BUDGET_DAILY_WBT: '-1' },
    { ...base, RECEIPT_TIMEOUT_MS: '0' },
    { ...base, ATTEMPTS_URL: 'http://site.example/api/recorder/attempts', RECORDER_TOKEN: SECRET },
    { ...base, ATTEMPTS_URL: 'https://site.example/api/recorder/attempts' },
  ]) {
    assert.throws(() => facilitatorSettings(env), (e) => e instanceof StartupError && !e.message.includes(SECRET));
  }
  assert.equal(facilitatorSettings({ ...base, ALLOWED_MERCHANTS: JSON.stringify([merchant, `0x${'34'.repeat(20)}`]) }).allowedMerchants.length, 2);
});

test('shop settings: merchants by story shop key, the facilitator URL and bearer', () => {
  const [key] = shopKeys;
  const env = { SHOP_MERCHANTS: JSON.stringify({ [key]: merchant }), FACILITATOR_URL: 'https://site.example/api/facilitator/', FACILITATOR_AUTH_TOKEN: SECRET, DEMO_PASSCODE: SECRET };
  const s = shopSettings(env, { shopKeys });
  assert.equal(s.merchants[key].toLowerCase(), merchant);
  assert.equal(s.facilitatorUrl, 'https://site.example/api/facilitator');
  for (const bad of [
    { ...env, SHOP_MERCHANTS: '' },
    { ...env, SHOP_MERCHANTS: '[1]' },
    { ...env, SHOP_MERCHANTS: JSON.stringify({ 'not-a-story-shop': merchant }) },
    { ...env, SHOP_MERCHANTS: JSON.stringify({ [key]: 'nope' }) },
    { ...env, FACILITATOR_URL: 'http://site.example/api/facilitator' },
    { ...env, FACILITATOR_AUTH_TOKEN: '' },
  ]) {
    assert.throws(() => shopSettings(bad, { shopKeys }), StartupError);
  }
});

test('once the config holds the role addresses, both merchant values must equal it', () => {
  assert.equal(configMerchants(), config.wallets.addresses ? configMerchants() : null);
  const addresses = Object.fromEntries(story.shops.map((shop, i) => [shop.walletRole, `0x${String(i + 1).repeat(40)}`]));
  const cfg = { ...config, wallets: { ...config.wallets, addresses } };
  const expected = story.shops.map((shop, i) => `0x${String(i + 1).repeat(40)}`);
  assert.deepEqual(facilitatorSettings({ FACILITATOR_AUTH_TOKEN: SECRET }, { cfg }).allowedMerchants.map((a) => a.toLowerCase()), expected);
  assert.throws(() => facilitatorSettings(base, { cfg }), /differs/);
  const shop = { FACILITATOR_URL: 'https://site.example/api/facilitator', FACILITATOR_AUTH_TOKEN: SECRET };
  assert.equal(shopSettings(shop, { shopKeys, cfg }).merchants[story.shops[0].key].toLowerCase(), expected[0]);
  assert.throws(() => shopSettings({ ...shop, SHOP_MERCHANTS: JSON.stringify({ [story.shops[0].key]: merchant }) }, { shopKeys, cfg }), /differs/);
});
