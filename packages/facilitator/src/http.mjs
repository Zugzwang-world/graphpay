// HTTP for the facilitator and the recorder as Fetch-API handlers (Request → Response), so the
// same code runs in a local Node server and in Next.js route handlers on Vercel (M4).
// Every answer is no-store; an error is one redacted log line and {"error":"internal error"}.

import { createHash, timingSafeEqual } from 'node:crypto';
import { RateLimiter } from './limits.mjs';

export const BODY_LIMIT_BYTES = 64 * 1024;
const HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store' };

export const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body, (_, v) => (typeof v === 'bigint' ? String(v) : v)), { status, headers: { ...HEADERS, ...extra } });

// An error for a log line: the class names along its cause chain, each with an HTTP status or an
// RPC code where it is a plain integer, a text code that is a plain constant (ECONNREFUSED), or a
// contract revert's error name (ContractFunctionRevertedError BadState). Never a message: viem's
// messages quote the RPC URL, and keyed URLs carry the key.
const IDENT = /^[A-Za-z][A-Za-z0-9]{0,60}$/;
const CONST = /^[A-Z][A-Z0-9_]{0,40}$/;
export function errorNames(e) {
  const parts = [];
  try {
    for (let x = e, i = 0; x && i < 6; x = x.cause, i += 1) {
      const name = typeof x.name === 'string' && IDENT.test(x.name) ? x.name : 'Error';
      const extra = [x.status, x.code].find((v) => Number.isInteger(v)) ?? [x.code].find((v) => typeof v === 'string' && CONST.test(v)) ?? [x.data?.errorName].find((v) => typeof v === 'string' && IDENT.test(v));
      parts.push(extra === undefined ? name : `${name} ${extra}`);
    }
  } catch {
    parts.push('Error'); // a getter that throws: what was read so far is kept
  }
  return parts.join(' < ') || 'Error';
}

// Constant-time and length-independent: both sides are hashed first.
export function bearerOk(request, token) {
  if (typeof token !== 'string' || token.length < 24) return false;
  const header = request.headers.get('authorization') ?? '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(token).digest();
  return timingSafeEqual(a, b) && given.length > 0;
}

// Reads at most `limit` bytes of the body, counting what was actually read (not Content-Length).
export async function readJson(request, limit = BODY_LIMIT_BYTES) {
  const reader = request.body?.getReader();
  if (!reader) return { error: 400 };
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      return { error: 413 };
    }
    chunks.push(value);
  }
  try {
    return { value: JSON.parse(Buffer.concat(chunks).toString('utf8')) };
  } catch {
    return { error: 400 };
  }
}

// The last path segment names the route, so /verify and /api/facilitator/verify both work.
const route = (request) => new URL(request.url).pathname.replace(/\/+$/, '').split('/').pop();

// facilitator: an x402Facilitator with our scheme registered; scheme: our scheme object (stats);
// ready(): the start-up checks (a failure answers 503 and is retried on the next request);
// health(): { signer, balanceWei, ... }, cached for 5 s; log(line): one redacted line.
export function facilitatorHandler({ facilitator, scheme, authToken, ready, health, log = console.error, clock = () => Date.now() }) {
  const bucket = new RateLimiter(60, 60_000, clock); // one shared bucket: no socket address on Vercel
  let healthCache = { at: -Infinity, body: null };

  return async function handle(request) {
    try {
      const name = route(request);
      if (request.method === 'GET' && name === 'supported') return json(200, facilitator.getSupported());
      if (request.method === 'GET' && name === 'health') {
        if (clock() - healthCache.at >= 5_000) {
          const startup = await ready().then(() => 'ok', () => 'failed');
          healthCache = { at: clock(), body: { ok: startup === 'ok', startup, ...(await health()), ...scheme.stats() } };
        }
        return json(healthCache.body.ok ? 200 : 503, healthCache.body);
      }
      if (request.method !== 'POST' || (name !== 'verify' && name !== 'settle')) return json(404, { error: 'not found' });
      if (!bearerOk(request, authToken)) return json(401, { error: 'unauthorized' });
      // Refusals before any send carry x402's settle shape, so a client sees them as such.
      if (!bucket.take('all')) return json(429, { error: 'rate limited', success: false, errorReason: 'rate_limited', transaction: '', network: '' });
      try {
        await ready();
      } catch {
        return json(503, { error: 'starting', success: false, errorReason: 'busy', transaction: '', network: '' });
      }
      const body = await readJson(request);
      if (body.error) return json(body.error, { error: body.error === 413 ? 'body too large' : 'bad request' });
      const { paymentPayload, paymentRequirements } = body.value ?? {};
      const known =
        paymentPayload && typeof paymentPayload === 'object' && paymentRequirements && typeof paymentRequirements === 'object' &&
        facilitator.getSupported().kinds.some((k) => k.x402Version === paymentPayload.x402Version && k.scheme === paymentRequirements.scheme && k.network === paymentRequirements.network);
      if (!known) {
        return json(200, name === 'verify' ? { isValid: false, invalidReason: 'unsupported_scheme' } : { success: false, errorReason: 'unsupported_scheme', transaction: '', network: '' });
      }
      if (name === 'verify') return json(200, await facilitator.verify(paymentPayload, paymentRequirements));
      const result = await facilitator.settle(paymentPayload, paymentRequirements);
      if (!result.success && result.errorReason === 'rate_limited') return json(429, result);
      if (!result.success && result.errorReason === 'busy') return json(503, result);
      return json(200, result);
    } catch (e) {
      log(`facilitator: ${errorNames(e)}`); // never the message: viem's quotes the RPC URL
      return json(500, { error: 'internal error' });
    }
  };
}
