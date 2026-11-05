import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MIN_PASSCODE_LENGTH, PASSCODE_HEADER, checkPasscode, requirePasscode } from './passcode.ts';

// A throwaway value built at run time, never a real passcode.
const passcode = 'p'.repeat(MIN_PASSCODE_LENGTH + 8);
const env = { DEMO_PASSCODE: passcode };
const request = (value?: string) =>
  new Request('https://example.test/api/customer/reorder', { method: 'POST', headers: value === undefined ? {} : { [PASSCODE_HEADER]: value } });

test('no passcode is refused with 401', () => {
  assert.deepEqual(checkPasscode(request(), env), { ok: false, status: 401, error: 'passcode required' });
});

test('a wrong passcode is refused with 401', () => {
  for (const wrong of ['x', passcode.slice(1), `${passcode}x`, passcode.toUpperCase(), 'p'.repeat(4096)]) {
    const result = checkPasscode(request(wrong), env);
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.status, 401);
  }
});

test('the right passcode passes', () => {
  assert.deepEqual(checkPasscode(request(passcode), env), { ok: true });
  assert.equal(requirePasscode(request(passcode), env), null);
});

test('with no passcode configured, spending is off even for a guess', () => {
  for (const configured of [{}, { DEMO_PASSCODE: '' }, { DEMO_PASSCODE: 'short' }]) {
    const result = checkPasscode(request(passcode), configured);
    assert.equal(result.ok === false && result.status, 503);
    // and a request without the header is still told it needs one
    const missing = checkPasscode(request(), configured);
    assert.equal(missing.ok === false && missing.status, 401);
  }
});

test('the refusal is a no-store JSON response that names no secret', async () => {
  const response = requirePasscode(request('nope'), env);
  assert.ok(response);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const text = await response.text();
  assert.ok(!text.includes(passcode));
  assert.deepEqual(JSON.parse(text), { error: 'wrong passcode' });
});

test('the passcode is read from the header only, never from the URL', () => {
  const inUrl = new Request(`https://example.test/api/customer/reorder?passcode=${passcode}&${PASSCODE_HEADER}=${passcode}`, { method: 'POST' });
  assert.equal(checkPasscode(inUrl, env).ok, false);
});
