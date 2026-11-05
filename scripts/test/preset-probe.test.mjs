import assert from 'node:assert/strict';
import { test } from 'node:test';
import Anthropic from '@anthropic-ai/sdk';
import { config, story } from '../../packages/config/index.mjs';
import { clientOptions, parseProbeArgs, rejectedFlags } from '../agents/probe-lib.mjs';
import { redactor } from '../lib/redact.mjs';
import { SAMPLES } from './samples.mjs';

// The probe spends API money, so these tests load only its helpers (never
// scripts/agents/preset-probe.mjs itself) and never reach the network.

test('agents:probe refuses an unknown preset and any other argument, echoing plain names only', () => {
  const presets = story.agentModels.presets;
  const [first] = Object.keys(presets);
  assert.equal(parseProbeArgs([], presets), null);
  assert.equal(parseProbeArgs(['--preset', first], presets), first);
  assert.throws(() => parseProbeArgs(['--preset', 'nope'], presets), /^Error: unknown preset "nope"; the story config has /);
  for (const name of ['constructor', '__proto__', 'toString']) {
    assert.throws(() => parseProbeArgs(['--preset', name], presets), /unknown preset/, name);
  }
  for (const argv of [['--preset'], [`--preset=${first}`], ['--preset', first, '--preset', first], ['--dry-run'], [first]]) {
    assert.throws(() => parseProbeArgs(argv, presets), /usage: pnpm agents:probe/, argv.join(' '));
  }
  const secret = SAMPLES['anthropic-api-key'];
  assert.throws(
    () => parseProbeArgs(['--preset', secret], presets),
    (error) => !error.message.includes(secret) && /unknown preset that name/.test(error.message),
  );
});

test('agents:probe pins the API URL from the config: a shell ANTHROPIC_BASE_URL cannot redirect the key', async () => {
  const saved = process.env.ANTHROPIC_BASE_URL;
  process.env.ANTHROPIC_BASE_URL = 'https://attacker.example';
  const seen = [];
  try {
    const fetch = async (url, init) => {
      // Wherever the SDK puts the key (x-api-key or a bearer header), note that it was sent.
      seen.push({ url: String(url), carriesKey: [...new Headers(init.headers).values()].some((v) => v.includes('test-key-not-real')) });
      const body = { id: 'msg_test', type: 'message', role: 'assistant', model: 'm', content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const client = new Anthropic({ ...clientOptions('test-key-not-real', config.models), fetch, maxRetries: 0 });
    assert.equal(client.baseURL, config.models.apiBaseUrl);
    await client.messages.create({ model: 'm', max_tokens: 1, messages: [{ role: 'user', content: 'x' }] });
  } finally {
    if (saved === undefined) delete process.env.ANTHROPIC_BASE_URL;
    else process.env.ANTHROPIC_BASE_URL = saved;
  }
  assert.equal(seen.length, 1);
  assert.equal(new URL(seen[0].url).origin, config.models.apiBaseUrl);
  assert.ok(seen[0].carriesKey, 'the request to the pinned host carries the key');
  for (const apiBaseUrl of [undefined, '', 'http://api.example', 'https://api.example/path']) {
    assert.throws(() => clientOptions('k', { ...config.models, apiBaseUrl }), /must be an https origin/, String(apiBaseUrl));
  }
  assert.throws(() => clientOptions(undefined, config.models), /ANTHROPIC_API_KEY is not set/);
});

test('agents:probe redacts an error before it cuts it to 160 characters', () => {
  // An .env value without a secret shape: only the redactor can hide it.
  const secret = `k${'7'.repeat(39)}`;
  const redact = redactor(new Map([['ARKIV_ACCESS_KEY', secret]]));
  const spanning = rejectedFlags(new Error(`${'x'.repeat(150)}${secret}`), redact);
  assert.ok(!spanning.includes(secret.slice(0, 8)), 'a secret spanning the cut survived');
  assert.equal(spanning, `REJECTED (error): ${'x'.repeat(150)}<redacted>`);
  const key = SAMPLES['anthropic-api-key'];
  const body = { type: 'error', error: { type: 'authentication_error', message: `invalid x-api-key ${key} near ${secret}` } };
  const api = rejectedFlags(Anthropic.APIError.generate(401, body, undefined, new Headers()), redact);
  assert.match(api, /^REJECTED \(401 authentication_error\): 401 /);
  assert.ok(!api.includes(key) && !api.includes(secret.slice(0, 8)), 'the API error kept a secret');
  assert.ok(api.length <= 'REJECTED (401 authentication_error): '.length + 160);
});
