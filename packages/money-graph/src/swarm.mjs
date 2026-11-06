// Swarm through the public gateway (ADR-0039, ADR-0061). Anonymous uploads with the all-zero
// postage batch id: we sign nothing, buy no stamp and run no Bee node; the gateway's operator
// pays. Only public, unencrypted content goes this way (a menu), never personal data, and
// never an encrypted upload: a 128-hex (encrypted) reference in a reply is refused.
// Content is uploaded as a one-file collection (POST /bzz?name=…) and read back from
// /bzz/<reference>/<name>; the same bytes always give the same reference.

import { createHash } from 'node:crypto';
import { config } from '@graphpay/config';

// 64 zero hex digits: the gateway's "no stamp of ours" batch id. Built, not written out.
export const ZERO_BATCH = '0'.repeat(64);
const REFERENCE = /^[0-9a-f]{64}$/;
const NAME = /^[A-Za-z0-9._-]{1,64}$/;

export class SwarmError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = 'SwarmError';
    this.status = status;
  }
}

export const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex');

// options: { gateway?, fetchFn?, timeoutMs?, attempts? }
export function swarmClient({ gateway = config.swarm.gateway, fetchFn = globalThis.fetch, timeoutMs = 20_000, attempts = 2 } = {}) {
  const base = gateway.replace(/\/+$/, '');
  if (!/^https:\/\//.test(base)) throw new SwarmError('swarm: the gateway must be an https URL');

  async function request(url, init) {
    return fetchFn(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  }

  const link = (reference, name) => `${base}/bzz/${reference}/${name}`;

  // Returns { reference, link }. The reference is 64 hex or the upload is refused.
  async function upload(bytes, { name, contentType = 'application/json' }) {
    if (!NAME.test(name ?? '')) throw new SwarmError('swarm: a file name is letters, digits, dot, dash and underscore');
    let last;
    for (let i = 0; i < attempts; i += 1) {
      try {
        const res = await request(`${base}/bzz?name=${encodeURIComponent(name)}`, {
          method: 'POST',
          headers: { 'swarm-postage-batch-id': ZERO_BATCH, 'content-type': contentType },
          body: bytes,
        });
        if (res.status !== 201 && res.status !== 200) throw new SwarmError(`swarm: the gateway refused the upload (HTTP ${res.status})`, { status: res.status });
        const reference = (await res.json())?.reference;
        if (!REFERENCE.test(reference ?? '')) throw new SwarmError('swarm: the gateway answered with a reference that is not 64 hex digits');
        return { reference, link: link(reference, name) };
      } catch (error) {
        last = error;
        if (error instanceof SwarmError && error.status && error.status < 500) throw error;
      }
    }
    throw last instanceof SwarmError ? last : new SwarmError(`swarm: upload failed (${last?.name ?? 'error'})`);
  }

  // Returns the bytes, or null when the gateway does not have the reference (404).
  async function read(reference, name) {
    if (!REFERENCE.test(reference ?? '')) throw new SwarmError('swarm: a reference is 64 hex digits');
    let last;
    for (let i = 0; i < attempts; i += 1) {
      try {
        const res = await request(link(reference, name), { method: 'GET' });
        if (res.status === 404) return null;
        if (res.status !== 200) throw new SwarmError(`swarm: the gateway answered HTTP ${res.status}`, { status: res.status });
        return new Uint8Array(await res.arrayBuffer());
      } catch (error) {
        last = error;
      }
    }
    throw last instanceof SwarmError ? last : new SwarmError(`swarm: read failed (${last?.name ?? 'error'})`);
  }

  return { gateway: base, upload, read, link };
}
