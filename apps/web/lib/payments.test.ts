// The hosted payment routes, offline: the environment the routes derive, the 503 / no-store /
// redaction wrapper, and the bearer guards on the recorder and the cron. The packages' own tests
// cover the pipeline, the shop and the facilitator's bearer and start-up checks.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { config, story } from '@graphpay/config';
import { hostedEnv, route } from './payments.server.ts';
import { GET as cron } from '../app/api/cron/renew/route.ts';
import { POST as recorderPost } from '../app/api/recorder/[...path]/route.ts';

const SITE = String(config.site.url);
const secret = 'c'.repeat(32);

test('hostedEnv: the production URLs and the merchant lists from the shop keys; explicit values win', () => {
  const shop = story.shops[0];
  const key = generatePrivateKey();
  const address = privateKeyToAccount(key).address;
  const env = hostedEnv({ [`${shop.walletRole}_PRIVATE_KEY`]: key });
  assert.equal(env.FACILITATOR_URL, `${SITE}/api/facilitator`);
  assert.equal(env.ATTEMPTS_URL, undefined, 'no recorder URL without its token');
  assert.deepEqual(JSON.parse(env.SHOP_MERCHANTS ?? '{}'), { [shop.key]: address });
  assert.equal(env.ALLOWED_MERCHANTS, address);
  assert.equal(hostedEnv({ RECORDER_TOKEN: secret }).ATTEMPTS_URL, `${SITE}/api/recorder/attempts`);
  const own = hostedEnv({ FACILITATOR_URL: 'https://other.example/api/facilitator', ALLOWED_MERCHANTS: '0x1', [`${shop.walletRole}_PRIVATE_KEY`]: key });
  assert.equal(own.FACILITATOR_URL, 'https://other.example/api/facilitator');
  assert.equal(own.ALLOWED_MERCHANTS, '0x1', 'an explicit list is kept (and checked by the settings)');
  assert.throws(() => hostedEnv({ [`${shop.walletRole}_PRIVATE_KEY`]: 'not a key' }), /is not a valid key/);
});

test('route: 503 while the service cannot start, 500 with one redacted line on an error, always no-store', async () => {
  const lines: string[] = [];
  const original = console.error;
  console.error = (line: string) => lines.push(line);
  try {
    const starting = await route('t', async () => {
      throw new Error('https://rpc.example/secret-key unreachable');
    })(new Request('https://x.test/'));
    assert.equal(starting.status, 503);
    assert.deepEqual(await starting.json(), { error: 'starting' });
    assert.equal(starting.headers.get('cache-control'), 'no-store');

    const failing = await route('t', async () => async () => {
      throw new TypeError('https://rpc.example/secret-key said no');
    })(new Request('https://x.test/'));
    assert.equal(failing.status, 500);
    assert.deepEqual(await failing.json(), { error: 'internal error' });
    assert.deepEqual(lines, ['t: TypeError'], 'the name only, never the message');

    const ok = await route('t', async () => async () => Response.json({ ok: true }, { headers: { 'cache-control': 'max-age=60' } }))(new Request('https://x.test/'));
    assert.equal(ok.headers.get('cache-control'), 'no-store', 'every answer is no-store');
  } finally {
    console.error = original;
  }
});

test('cron: 401 without CRON_SECRET, with a wrong one, or when the configured one is short', async () => {
  const call = (auth?: string) => cron(new Request('https://x.test/api/cron/renew', { headers: auth ? { authorization: auth } : {} }));
  process.env.CRON_SECRET = secret;
  assert.equal((await call()).status, 401);
  assert.equal((await call(`Bearer ${'d'.repeat(32)}`)).status, 401);
  assert.equal((await call(secret)).status, 401, 'the bearer scheme is required');
  process.env.CRON_SECRET = 'short';
  assert.equal((await call('Bearer short')).status, 401);
  delete process.env.CRON_SECRET;
  assert.equal((await call('Bearer ')).status, 401);
});

test('recorder: 503 without its token, 401 without the bearer, 503 until the W_SYNC writer is configured', async () => {
  const post = (auth?: string) => recorderPost(new Request('https://x.test/api/recorder/attempts', { method: 'POST', headers: auth ? { authorization: auth } : {}, body: '{}' }));
  delete process.env.RECORDER_TOKEN;
  delete process.env.W_SYNC_PRIVATE_KEY;
  const original = console.error;
  console.error = () => {};
  try {
    assert.equal((await post()).status, 503);
    process.env.RECORDER_TOKEN = secret;
    const unauth = await post();
    assert.equal(unauth.status, 401);
    assert.equal(unauth.headers.get('cache-control'), 'no-store');
    assert.equal((await post(`Bearer ${'x'.repeat(32)}`)).status, 401);
    const noWriter = await post(`Bearer ${secret}`);
    assert.equal(noWriter.status, 503);
    assert.deepEqual(await noWriter.json(), { error: 'recorder not configured' });
  } finally {
    console.error = original;
    delete process.env.RECORDER_TOKEN;
  }
});
