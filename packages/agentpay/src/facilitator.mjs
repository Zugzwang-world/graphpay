// The facilitator interface: who checks a signed payment and sends it on-chain. A merchant
// never needs a relayer key of its own; it hands the payer's signature to a facilitator.
//
//   verify(paymentPayload, requirements) → { isValid, invalidReason?, payer? }
//   settle(paymentPayload, requirements) → { success, errorReason?, payer?, transaction, network, amount? }
//   supported?()                          → { kinds: [{ x402Version, scheme, network }] }
//   subscribe?({ sub, permitSingle, permitSig, subSig, approvalPermit }) → { success, transaction, ... }
//   renew?(subId)                         → { success, transaction, orderId?, errorReason? }
//   cancelSubscription?({ subId, deadline, signature }) → { success, transaction }
//
// Adapters: httpFacilitator speaks the x402 facilitator HTTP API (POST /verify and /settle with
// a bearer token), which is what GraphPay's own facilitator (T1, M3) serves; inProcessFacilitator
// wraps an x402Facilitator-shaped object in the same process. The reference relayer
// (relayer.mjs) implements every method, for tests and small deployments.

import { X402_VERSION } from './wire.mjs';

export class FacilitatorUnavailable extends Error {
  constructor(message) {
    super(message);
    this.name = 'FacilitatorUnavailable';
  }
}

const bigintSafe = (_, v) => (typeof v === 'bigint' ? v.toString() : v);

// url: the facilitator's base (…/api/facilitator); authToken: its bearer token (a server
// secret, read from the environment by the caller, never logged).
export function httpFacilitator({ url, authToken, fetch: fetchImpl = globalThis.fetch, timeoutMs = 60_000 }) {
  const base = String(url).replace(/\/+$/, '');
  if (!/^https:\/\/|^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/.test(base)) throw new Error('httpFacilitator: https only (or a loopback URL for tests)');
  async function call(path, body) {
    let res;
    try {
      res = await fetchImpl(`${base}/${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { 'content-type': 'application/json', ...(authToken ? { authorization: `Bearer ${authToken}` } : {}) },
        body: body ? JSON.stringify(body, bigintSafe) : undefined,
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new FacilitatorUnavailable(`facilitator ${path}: no answer`);
    }
    // 429 and 503 carry a settle result too (rate limited, busy): pass them through.
    if (res.status >= 500 && res.status !== 503) throw new FacilitatorUnavailable(`facilitator ${path}: HTTP ${res.status}`);
    if (res.status === 401 || res.status === 404) throw new FacilitatorUnavailable(`facilitator ${path}: HTTP ${res.status}`);
    try {
      return await res.json();
    } catch {
      throw new FacilitatorUnavailable(`facilitator ${path}: not JSON`);
    }
  }
  return Object.freeze({
    kind: 'http',
    verify: (paymentPayload, paymentRequirements) => call('verify', { x402Version: X402_VERSION, paymentPayload, paymentRequirements }),
    settle: (paymentPayload, paymentRequirements) => call('settle', { x402Version: X402_VERSION, paymentPayload, paymentRequirements }),
    supported: () => call('supported'),
  });
}

// Any object with verify and settle (an @x402/core x402Facilitator with the graphpay-order
// scheme registered, such as GraphPay's own facilitator) as an AgentPay facilitator.
export function inProcessFacilitator(facilitator) {
  if (typeof facilitator?.verify !== 'function' || typeof facilitator?.settle !== 'function') throw new Error('inProcessFacilitator: needs verify and settle');
  return Object.freeze({
    kind: 'in-process',
    verify: (p, r) => facilitator.verify(p, r),
    settle: (p, r) => facilitator.settle(p, r),
    supported: () => (typeof facilitator.getSupported === 'function' ? facilitator.getSupported() : facilitator.supported?.()),
    subscribe: facilitator.subscribe?.bind(facilitator),
    renew: facilitator.renew?.bind(facilitator),
    cancelSubscription: facilitator.cancelSubscription?.bind(facilitator),
  });
}
